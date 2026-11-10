// Getting the words out of things.
// Presets are fetched as text, uploads can be text, PDF or Word documents.
// The heavy document readers are only downloaded if somebody needs them

export const readFile = async url => {
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`Could not load ${url} (${response.status})`)
    }
    return response.text()
}

const readPdf = async file => {
    const [pdfjs, { default: worker }] = await Promise.all([
        import('pdfjs-dist'),
        import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    ])
    pdfjs.GlobalWorkerOptions.workerSrc = worker
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
    const pages = []
    for (let number = 1; number <= pdf.numPages; ++number) {
        const page = await pdf.getPage(number)
        const content = await page.getTextContent()
        let text = ''
        content.items.forEach(item => {
            text += item.str + (item.hasEOL ? '\n' : '')
        })
        pages.push(text)
    }
    return pages.join('\n\n')
}

const readWord = async file => {
    const { default: mammoth } = await import('mammoth/mammoth.browser.js')
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    return result.value
}

export const ACCEPTED = '.txt,.md,.text,.pdf,.docx,text/plain,application/pdf'

// resolves with the text inside a file the user has given us
export const uploadFile = async file => {
    const name = file.name.toLowerCase()
    let text
    if (name.endsWith('.pdf') || file.type === 'application/pdf') {
        text = await readPdf(file)
    } else if (name.endsWith('.docx')) {
        text = await readWord(file)
    } else if (name.endsWith('.doc')) {
        throw new Error('Old style .doc files are not supported. Save it as .docx, PDF or plain text.')
    } else if (/^text\//.test(file.type) || /\.(txt|md|text)$/.test(name) || !file.type) {
        text = await file.text()
    } else {
        throw new Error(`Cannot read ${file.name}. Try a text file, a PDF or a Word document.`)
    }
    if (!text.trim().length) {
        throw new Error(`No words were found in ${file.name}. Scanned documents need to be converted to text first.`)
    }
    return text
}
