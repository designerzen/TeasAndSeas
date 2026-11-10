// Text preparation : turns a raw contract into sentences, phrases and words
// A phrase is the unit that gets spoken, displayed and scored in one go

const ABBREVIATIONS = /(?:^|[\s(])(?:e\.g|i\.e|etc|no|nos|art|arts|inc|ltd|co|corp|mr|mrs|ms|dr|st|vs|v|cf|para|paras|sec|approx|u\.s|u\.k)\.$/i
// list markers such as "1." "12." "a." "(b)." that are not the end of a sentence
const LIST_MARKER = /(?:^|\s)\(?(?:\d{1,3}|[a-z])\.$/i

// words that announce a change of direction inside a sentence
const PIVOT = /^(?:notwithstanding|however|except|unless|but|although|nevertheless)$/i
// these only change direction when followed by the right word : "provided that"
const PIVOT_PAIR = { provided: /^that$/, save: /^(?:that|for|as|where)$/ }
const CONJUNCTION = /^(?:and|or|that|which|who|whether|including|if|where|when)$/i

export const isPivot = (words, index) => {
    const { norm } = words[index]
    const pair = PIVOT_PAIR[norm]
    return PIVOT.test(norm) || (!!pair && !!words[index + 1] && pair.test(words[index + 1].norm))
}

const MAX_PHRASE = 16
const HARD_MAX_PHRASE = 22

export const normalise = raw => {
    const lines = raw
        .replace(/\r\n?/g, '\n')
        .replace(/[ \t\f\v ]+/g, ' ')
        .split('\n')
        .map(line => line.trim())

    // PDFs and plain text files wrap lines in the middle of sentences
    // so only keep a line break when it looks like a real one
    const blocks = []
    let current = ''
    lines.forEach(line => {
        if (!line.length) {
            current && blocks.push(current)
            current = ''
            return
        }
        const endsSentence = /[.!?:;]["”’)\]]*$/.test(current)
        // a short line followed by a capital letter is probably a heading
        const wasHeading = current.length < 40
            && /^[A-Z0-9(]/.test(current) && /^[A-Z0-9(“"]/.test(line)
            && !/[,;]$/.test(current)
            && !/\b(?:and|or|the|of|to|a|an|in|for|by|with|from|that)$/i.test(current)
        if (current && (endsSentence || wasHeading)) {
            blocks.push(current)
            current = line
        } else {
            current = current ? current + ' ' + line : line
        }
    })
    current && blocks.push(current)
    return blocks
}

export const splitSentences = block => {
    const pieces = block.match(/[^.!?]+(?:[.!?]+["”’)\]]*|$)/g) || []
    const sentences = []
    let pending = ''
    pieces.forEach((piece, index) => {
        pending += piece
        const trimmed = pending.trim()
        const next = pieces[index + 1]
        if (ABBREVIATIONS.test(trimmed) || LIST_MARKER.test(trimmed)) {
            return
        }
        // "3.5" and "example.com" are not sentence ends either
        if (next !== undefined && !/^\s/.test(next)) {
            return
        }
        trimmed && sentences.push(trimmed)
        pending = ''
    })
    pending.trim() && sentences.push(pending.trim())
    return sentences
}

// lower case letters only - the form that gets looked up in the lexicons
export const normaliseWord = word => word
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')

// splits a sentence into words that remember where they came from
export const splitWords = sentence => {
    const words = []
    const matcher = /\S+/g
    let match
    while ((match = matcher.exec(sentence))) {
        const norm = normaliseWord(match[0])
        // skip stray punctuation such as lone dashes and bullets
        if (!norm.length) {
            continue
        }
        words.push({
            text: match[0],
            norm,
            start: match.index,
            end: match.index + match[0].length
        })
    }
    return words
}

// chops a sentence into speakable phrases, preferring natural breaks
// returns arrays of word indexes
export const splitPhrases = words => {
    const phrases = []
    let current = []

    const cut = () => {
        current.length && phrases.push(current)
        current = []
    }

    words.forEach((word, index) => {
        const size = current.length
        const startsPivot = isPivot(words, index)
        const opensBracket = /^[(\[]/.test(word.text)

        if (startsPivot && size >= 3) {
            cut()
        } else if (opensBracket && size >= 7) {
            cut()
        } else if (size >= MAX_PHRASE && CONJUNCTION.test(word.norm)) {
            cut()
        } else if (size >= HARD_MAX_PHRASE) {
            cut()
        }

        current.push(index)

        const strongBreak = /[;:]["”’)\]]*$/.test(word.text)
        const weakBreak = /[,)\]]["”’]*$/.test(word.text) || /[—–]$/.test(word.text)
        if ((strongBreak && current.length >= 3) || (weakBreak && current.length >= 7)) {
            cut()
        }
    })
    cut()

    // nobody wants a two word phrase dangling on its own
    for (let i = phrases.length - 1; i > 0; --i) {
        if (phrases[i].length < 3 && phrases[i - 1].length + phrases[i].length <= HARD_MAX_PHRASE) {
            phrases[i - 1] = phrases[i - 1].concat(phrases[i])
            phrases.splice(i, 1)
        }
    }
    return phrases
}



export const countSyllables = word => {
    const groups = word.toLowerCase().replace(/e$/, '').match(/[aeiouy]+/g)
    return Math.max(1, groups ? groups.length : 1)
}

// rough guess at how long a speech synthesiser takes to say a word
export const estimateWordSeconds = (word, rate = 1) => {
    const pause = /[.!?]["”’)\]]*$/.test(word) ? 0.3 : /[,;:]["”’)\]]*$/.test(word) ? 0.15 : 0
    return (0.16 + countSyllables(word) * 0.17 + pause) / rate
}
