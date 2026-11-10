import { readFile, uploadFile, ACCEPTED } from './read-file'
import { analyse } from './analyser'
import { elements } from './elements'
import { presets } from './presets'
import { composeMelody, blendMood } from './composer'
import { startAudio, stopAudio, pauseAudio, resumeAudio, playEnding, setMood, setVolume, toll, sing, speak, hush } from './audio'
import { say, stopSpeaking, onVoicesReady, tame } from './speech'
import { VOICES, findVoice, loadVoice } from './voices'
import { arrangeSpoken, studySpoken } from './singer'
import { downloadMidi } from './midi'
import { estimateWordSeconds } from './text'
import { showPhrase, showWord, paintMood, clearMood, pulse, drawStrip, phraseAt, colourFor } from './visuals'
import { showElement, hideElement, remember, recall, toCSS } from './utils'

// Settings
// a breath between phrases and a longer one between sentences
const PHRASE_GAP = 120
const SENTENCE_GAP = 380
const FINAL_GAP = 400
// the bell should toll, not rattle
const TOLL_GAP = 1500
// anything longer than this is not a contract, it is a mistake
const MAX_CHARACTERS = 2000000
// how the voices that come with the browser are told apart from our own
const BROWSER_VOICE = 'browser:'

// holder of data
let analysis
let name = 'contract'

// flags
let isPlaying = false
let isPaused = false

// counters
// the phrase on screen, and the one being got ready (which may not be there yet)
let position = 0
let upcoming = 0
let mood = null
let lastToll = 0
let timer
// goes up every time playback is interrupted so that stale callbacks give up
let take = 0
// performances of the phrases that are coming up, prepared while the current one plays
let studies = {}

// Set the status of the indicator
const setStatus = (status, percent) => {
    elements.busy.textContent = status
    showElement(elements.feedback)
    if (percent === undefined) {
        elements.progress.removeAttribute('value')
    } else {
        elements.progress.value = percent
    }
}

const clearStatus = () => hideElement(elements.feedback)

const describeLength = phrases => {
    const rate = Number(elements.rate.value)
    const seconds = phrases.reduce((sum, phrase) =>
        sum + phrase.words.reduce((total, word) => total + estimateWordSeconds(word.text, rate), 0) + 0.2, 0)
    const minutes = Math.round(seconds / 60)
    return minutes < 1 ? 'under a minute' : minutes < 90 ? `about ${minutes} minute${minutes === 1 ? '' : 's'}` : `about ${Math.round(minutes / 60)} hours`
}

// Creates a MIDI file in memory then downloads it
// to allow the user to play the song on their synths at home
const download = () => {
    analysis && downloadMidi(analysis, name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'contract')
}

// we hide the selections and show the presentation
const present = () => {
    hideElement(elements.start)
    hideElement(elements.verdict)
    hideElement(elements.controls)
    showElement(elements.words)
    showElement(elements.goButton)
    elements.words.classList.remove('playing', 'finished')

    const { phrases, sentences, overall } = analysis
    const reader = phrases.some(phrase => phrase.source === 'claude') ? 'Read by Claude' : 'Read by the built in rules'
    elements.title.textContent = name
    elements.summary.textContent = `${overall.words} words in ${sentences} sentence${sentences === 1 ? "" : "s"}, ${describeLength(phrases)} long. ${reader}.`
    elements.before.textContent = ''
    elements.after.textContent = ''
    elements.data.textContent = ''
    elements.ticker.textContent = 'Ready when you are'
    elements.ticker.className = ''
    drawStrip(phrases)
    elements.goButton.focus()
}

// This is the first part of the application
// We take in a text from memory, split it into phrases and work
// out what each of them means for the person signing
const prepare = async (text, title) => {
    stop()
    forgetStudies()
    name = title

    if (text.length > MAX_CHARACTERS) {
        throw new Error(`${title} is too long to read (${Math.round(text.length / 1000000)} million characters).`)
    }

    setStatus(`Reading ${title}`)
    // let the status appear before the heavy lifting begins
    await new Promise(resolve => setTimeout(resolve, 20))

    analysis = analyse(text)
    if (!analysis.phrases.length) {
        throw new Error(`No words were found in ${title}.`)
    }

    // optionally ask for a more considered view
    const apiKey = elements.apiKey.value.trim()
    let note = ''
    if (apiKey) {
        try {
            setStatus(`Claude is reading ${title}`, 0)
            const { getSecondOpinion } = await import('./second-opinion')
            const { skipped } = await getSecondOpinion(analysis, apiKey, progress => {
                setStatus(`Claude is reading ${title}`, Math.round(progress * 100))
            })
            remember('api-key', apiKey, 'sessionStorage')
            note = skipped ? ` Claude read the first ${analysis.phrases.length - skipped} phrases, the rules read the rest.` : ''
        } catch (error) {
            console.error(error)
            note = ` The second opinion failed, so the built in rules were used instead. ${error.message}`
        }
    }

    present()
    note ? setStatus(note.trim(), 100) : clearStatus()
}

const fail = error => {
    console.error(error)
    setStatus(error.message || 'Something went wrong', 0)
}

// moods drift from one phrase to the next unless we jumped here
const moodFor = index => blendMood(index === position + 1 ? mood : null, analysis.phrases[index])

// put a phrase and its mood on screen
const show = (index, nextMood) => {
    mood = nextMood
    position = index
    paintMood(mood)
    showPhrase(analysis.phrases, index)
    showWord(-1)
    drawStrip(analysis.phrases, index)
}

const pace = phrase => Number(elements.rate.value) * (phrase.doom ? 0.88 : 1)

// light up a word, and ring the bell if it deserves it
const reach = (phrase, wordIndex) => {
    showWord(wordIndex)
    const now = Date.now()
    if (phrase.words[wordIndex].trigger && now - lastToll > TOLL_GAP) {
        lastToll = now
        toll()
    }
}

// The voice built in to the browser (or no voice at all).
// It cannot be heard by the band, so the words lead and the music follows
const narrate = index => {
    const { phrases } = analysis
    const current = take
    const phrase = phrases[index]
    const next = phrases[index + 1]

    show(index, moodFor(index))
    setMood(mood, composeMelody(phrase))

    say(phrase.words.map(word => word.text), {
        rate: pace(phrase),
        // good news is delivered brightly. doom comes from the basement
        pitch: phrase.doom ? 0.55 : 1 + mood.valence * 0.25,
        voice: elements.voice.value.replace(BROWSER_VOICE, ''),
        silent: !elements.narration.checked,
        onWord: wordIndex => current === take && reach(phrase, wordIndex),
        onEnd: () => {
            if (current !== take) {
                return
            }
            showWord(phrase.words.length)
            const gap = next && next.sentence === phrase.sentence ? PHRASE_GAP : SENTENCE_GAP
            timer = setTimeout(() => current === take && playPhrase(index + 1), gap)
        }
    })
}

// Working out how a voice will perform a phrase takes a moment, so the
// phrases that are coming up are prepared while the current one plays.
//  before : the mood of the phrase that comes before this one
const prepareAhead = (voice, index, before) => {
    const phrase = analysis.phrases[index]
    if (!phrase) {
        return null
    }
    if (!studies[index]) {
        const itsMood = blendMood(before, phrase)
        const performance = voice.style === 'sung'
            ? voice.arrange(phrase, itsMood, pace(phrase))
            : voice
                .render(tame(phrase.words.map(word => word.text).join(' ')), { speed: pace(phrase), who: phrase.beneficiary })
                .then(sound => arrangeSpoken(studySpoken(sound, phrase), itsMood))
        // a failure is dealt with when its turn comes
        performance.catch(() => {})
        studies[index] = { mood: itsMood, performance }
    }
    return studies[index]
}

const forgetStudies = () => {
    studies = {}
}

// The voices that go through the band (see voices/index.js).
// Here the music leads and the words land on its beat
const perform = async (index, voiceId) => {
    const current = take
    const phrase = analysis.phrases[index]
    let performance
    let nextMood

    try {
        const voice = await fetchVoice(voiceId)
        if (current !== take) {
            return
        }
        const prepared = prepareAhead(voice, index, index === position + 1 ? mood : null)
        nextMood = prepared.mood
        // get ahead while this one is being performed
        const following = prepareAhead(voice, index + 1, nextMood)
        following && voice.style === 'spoken' && prepareAhead(voice, index + 2, following.mood)
        delete studies[index - 1]

        performance = await prepared.performance
        if (current !== take) {
            return
        }
    } catch (error) {
        if (current !== take) {
            return
        }
        // carry on with the voice that always works
        console.error(error)
        setStatus(`${findVoice(voiceId).name} is not available, so the browser is reading instead. ${error.message || ''}`, 100)
        selectBrowserVoice()
        forgetStudies()
        return narrate(index)
    }

    const callbacks = {
        onStart: () => current === take && show(index, nextMood),
        onWord: wordIndex => current === take && reach(phrase, wordIndex),
        // this arrives a moment early so that the next phrase is ready for its beat
        onEnd: () => {
            if (current !== take) {
                return
            }
            if (index + 1 < analysis.phrases.length) {
                return playPhrase(index + 1)
            }
            // let the last word finish before the final chords
            timer = setTimeout(() => current === take && finish(), FINAL_GAP)
        }
    }
    if (performance.style === 'sung') {
        sing(nextMood, performance, callbacks)
    } else {
        speak(nextMood, composeMelody(phrase), performance, callbacks)
    }
}

const playPhrase = index => {
    if (index >= analysis.phrases.length) {
        return finish()
    }
    upcoming = index
    const voiceId = elements.voice.value
    if (!elements.narration.checked || !findVoice(voiceId)) {
        return narrate(index)
    }
    return perform(index, voiceId)
}

// resolves with a voice, telling everybody how the download is going
const fetchVoice = async voiceId => {
    const { name } = findVoice(voiceId)
    let isSlow = false
    const voice = await loadVoice(voiceId, progress => {
        isSlow = true
        setStatus(`Fetching ${name}`, Math.round(progress * 100))
    })
    isSlow && clearStatus()
    return voice
}

const selectBrowserVoice = () => {
    const option = [...elements.voice.options].find(option => option.value.startsWith(BROWSER_VOICE))
    if (option) {
        elements.voice.value = option.value
    } else {
        elements.narration.checked = false
    }
}

const interrupt = () => {
    take++
    // whatever was prepared assumed that we would carry straight on
    forgetStudies()
    clearTimeout(timer)
    stopSpeaking()
    hush()
}

// Now run this!
const run = async (from = 0) => {
    interrupt()
    hideElement(elements.goButton)
    hideElement(elements.verdict)
    setStatus('Tuning up')

    try {
        await startAudio({
            onBeat: pulse,
            // for the musically curious
            onBar: ({ mode, bpm }) => {
                elements.summary.textContent = `D ${mode} at ${bpm} beats per minute`
            }
        })
    } catch (error) {
        return fail(error)
    }
    setVolume(Number(elements.volume.value))
    clearStatus()

    isPlaying = true
    isPaused = false
    elements.pauseButton.textContent = 'Pause'
    showElement(elements.controls)
    elements.words.classList.remove('finished')
    elements.words.classList.add('playing')

    position = from - 1
    mood = null
    playPhrase(from)
}

const pause = () => {
    if (!isPlaying || isPaused) {
        return
    }
    isPaused = true
    interrupt()
    pauseAudio()
    elements.pauseButton.textContent = 'Play'
}

const resume = () => {
    if (!isPlaying || !isPaused) {
        return
    }
    isPaused = false
    resumeAudio()
    elements.pauseButton.textContent = 'Pause'
    playPhrase(upcoming)
}

// jump to another phrase, whether we are playing yet or not
const seek = index => {
    if (!analysis) {
        return
    }
    index = Math.max(0, Math.min(analysis.phrases.length - 1, index))
    if (!isPlaying) {
        return run(index)
    }
    interrupt()
    if (isPaused) {
        upcoming = index
        show(index, moodFor(index))
    } else {
        playPhrase(index)
    }
}

// silence everything and forget where we were
const stop = () => {
    interrupt()
    stopAudio()
    isPlaying = false
    isPaused = false
    elements.words.classList.remove('playing')
}

const quit = () => {
    stop()
    clearMood()
    clearStatus()
    hideElement(elements.words)
    hideElement(elements.verdict)
    showElement(elements.start)
}

const listPhrases = (list, indexes) => {
    list.replaceChildren()
    indexes.forEach(index => {
        const phrase = analysis.phrases[index]
        const item = document.createElement('li')
        const button = document.createElement('button')
        const quote = document.createElement('q')
        quote.textContent = phrase.text
        button.type = 'button'
        button.title = 'Hear this again'
        button.style.setProperty('--tint', toCSS(colourFor(phrase.valence, phrase.doom)))
        button.appendChild(quote)
        if (phrase.reason) {
            const reason = document.createElement('small')
            reason.textContent = phrase.reason
            button.appendChild(reason)
        }
        button.addEventListener('click', () => run(index))
        item.appendChild(button)
        list.appendChild(item)
    })
}

// The song is over. Play the last chords and deliver the verdict
const finish = async () => {
    const current = ++take
    clearTimeout(timer)
    const { overall, phrases } = analysis
    isPlaying = false
    hideElement(elements.controls)
    elements.words.classList.remove('playing')
    // the words step aside for the verdict
    elements.words.classList.add('finished')
    drawStrip(phrases)
    paintMood({
        valence: Math.max(-1, Math.min(1, overall.balance * 1.6)),
        severity: overall.balance < -0.2 ? 0.8 : 0,
        doom: overall.balance < -0.5
    })

    elements.verdictLabel.textContent = overall.label
    elements.verdictSummary.textContent = overall.summary
    elements.verdictNeedle.style.left = `${(overall.balance + 1) * 50}%`
    elements.verdictStats.textContent = `${overall.against} of ${phrases.length} phrases work against you and ${overall.inFavour} work for you. `
        + (overall.doom ? `${overall.doom} ${overall.doom === 1 ? 'is' : 'are'} doom.` : 'None of them are doom.')
    listPhrases(elements.verdictWorst, overall.worst)
    listPhrases(elements.verdictBest, overall.best)
    elements.verdictWorstSection.hidden = !overall.worst.length
    elements.verdictBestSection.hidden = !overall.best.length
    showElement(elements.verdict)
    elements.verdict.scrollIntoView({ behavior: 'smooth', block: 'nearest' })

    await playEnding(overall)
    current === take && stopAudio()
}

const loadPreset = async preset => {
    try {
        setStatus(`Fetching ${preset.title}`)
        await prepare(await readFile(preset.url), preset.title)
    } catch (error) {
        fail(error)
    }
}

const loadFile = async file => {
    try {
        setStatus(`Opening ${file.name}`)
        await prepare(await uploadFile(file), file.name.replace(/\.[^.]+$/, ''))
    } catch (error) {
        fail(error)
    }
}

// Create interactions ============================
export const init = () => {

    // This is the UL of presets in LI -> A
    presets.forEach(preset => {
        const item = document.createElement('li')
        const link = document.createElement('a')
        link.className = 'preset'
        link.href = `?contract=${preset.id}`
        link.textContent = preset.title
        if (preset.note) {
            const note = document.createElement('small')
            note.textContent = preset.note
            link.appendChild(note)
        }
        /////////////////////////////////////////////////////////////////////////////////////
        // EVENT : Preset selected
        // as these are hrefs we need to intercept click to prevent
        // the default behaviour of reloading the page
        /////////////////////////////////////////////////////////////////////////////////////
        link.addEventListener('click', event => {
            event.preventDefault()
            loadPreset(preset)
        })
        item.appendChild(link)
        elements.presets.appendChild(item)
    })

    /////////////////////////////////////////////////////////////////////////////////////
    // EVENT : Upload button
    // Upload custom contract as a text file, PDF or Word document
    /////////////////////////////////////////////////////////////////////////////////////
    elements.uploadField.accept = ACCEPTED
    elements.uploadField.addEventListener('change', () => {
        const file = elements.uploadField.files[0]
        file && loadFile(file)
        // allow the same file to be chosen twice in a row
        elements.uploadField.value = ''
    })

    // ...or dropped anywhere on the uploader
    ;['dragenter', 'dragover'].forEach(type => elements.dropzone.addEventListener(type, event => {
        event.preventDefault()
        elements.dropzone.classList.add('over')
    }))
    ;['dragleave', 'drop'].forEach(type => elements.dropzone.addEventListener(type, event => {
        event.preventDefault()
        elements.dropzone.classList.remove('over')
    }))
    elements.dropzone.addEventListener('drop', event => {
        const file = event.dataTransfer.files[0]
        file && loadFile(file)
    })
    elements.dropzone.addEventListener('submit', event => event.preventDefault())

    /////////////////////////////////////////////////////////////////////////////////////
    // EVENT : Paste button
    /////////////////////////////////////////////////////////////////////////////////////
    elements.pasteButton.addEventListener('click', () => {
        const text = elements.pasted.value
        if (!text.trim().length) {
            return fail(new Error('Paste some words in first.'))
        }
        prepare(text, 'Pasted contract').catch(fail)
    })

    /////////////////////////////////////////////////////////////////////////////////////
    // EVENT : Start button (requires a text to already be loaded)
    // and for the sentiment to be available
    /////////////////////////////////////////////////////////////////////////////////////
    elements.goButton.addEventListener('click', () => run(0))
    elements.againButton.addEventListener('click', () => run(0))

    /////////////////////////////////////////////////////////////////////////////////////
    // EVENT : Transport
    /////////////////////////////////////////////////////////////////////////////////////
    elements.pauseButton.addEventListener('click', () => isPaused ? resume() : pause())
    elements.previousButton.addEventListener('click', () => seek(position - 1))
    elements.nextButton.addEventListener('click', () => seek(position + 1))
    elements.quitButton.addEventListener('click', quit)
    elements.anotherButton.addEventListener('click', quit)

    // click anywhere on the map of the contract to jump there
    elements.strip.addEventListener('click', event => seek(phraseAt(event.clientX)))
    elements.strip.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            seek(position)
        }
    })
    window.addEventListener('resize', () => analysis && !elements.words.hidden && drawStrip(analysis.phrases, isPlaying ? position : -1))

    /////////////////////////////////////////////////////////////////////////////////////
    // EVENT : Download button
    // (requires a text to already be loaded)
    /////////////////////////////////////////////////////////////////////////////////////
    elements.downloadButton.addEventListener('click', download)
    elements.verdictDownload.addEventListener('click', download)

    /////////////////////////////////////////////////////////////////////////////////////
    // EVENT : Settings
    /////////////////////////////////////////////////////////////////////////////////////
    elements.volume.value = recall('volume', elements.volume.value)
    elements.rate.value = recall('rate', elements.rate.value)
    elements.narration.checked = recall('narration', 'on') === 'on'
    elements.apiKey.value = recall('api-key', '', 'sessionStorage')

    elements.volume.addEventListener('input', () => {
        setVolume(Number(elements.volume.value))
        remember('volume', elements.volume.value)
    })
    elements.rate.addEventListener('change', () => {
        remember('rate', elements.rate.value)
        // anything recorded ahead of time was at the old pace
        forgetStudies()
    })
    elements.narration.addEventListener('change', () => {
        remember('narration', elements.narration.checked ? 'on' : 'off')
        // pick the phrase up again with or without the voice
        isPlaying && !isPaused && seek(position)
    })
    elements.voice.addEventListener('change', async () => {
        const voiceId = elements.voice.value
        remember('voice', voiceId)
        forgetStudies()
        if (findVoice(voiceId)) {
            // start the download now rather than at the next phrase
            try {
                await fetchVoice(voiceId)
            } catch (error) {
                return fail(new Error(`${findVoice(voiceId).name} is not available. ${error.message || ''}`))
            }
        }
        // pick the phrase up again in the new voice
        elements.voice.value === voiceId && isPlaying && !isPaused && seek(position)
    })

    // the narrators : ours go through the band, the browser's own cannot
    const addVoices = (label, voices) => {
        if (!voices.length) {
            return
        }
        const group = document.createElement('optgroup')
        group.label = label
        voices.forEach(({ id, name }) => {
            const option = document.createElement('option')
            option.value = id
            option.textContent = name
            group.appendChild(option)
        })
        elements.voice.appendChild(group)
    }

    onVoicesReady(voices => {
        const chosen = elements.voice.value || recall('voice', VOICES[0].id)
        elements.voice.replaceChildren()
        addVoices('Sings the tune', VOICES.filter(voice => voice.style === 'sung'))
        addVoices('Speaks in key', VOICES.filter(voice => voice.style === 'spoken'))
        addVoices('Just speaks', voices.map(voice => ({ id: BROWSER_VOICE + voice.name, name: voice.name })))
        elements.voice.value = chosen
        // a voice from another computer may not exist on this one
        if (elements.voice.value !== chosen) {
            elements.voice.value = VOICES[0].id
        }
    })

    /////////////////////////////////////////////////////////////////////////////////////
    // EVENT : Key press
    /////////////////////////////////////////////////////////////////////////////////////
    window.addEventListener('keydown', event => {
        // leave typing and focused controls alone
        const { tagName } = event.target
        if (!isPlaying || /^(INPUT|TEXTAREA|SELECT)$/.test(tagName) || (tagName === 'BUTTON' && event.key === ' ')) {
            return
        }
        switch (event.key) {
            case ' ':
                event.preventDefault()
                isPaused ? resume() : pause()
                break
            case 'ArrowLeft':
                seek(position - 1)
                break
            case 'ArrowRight':
                seek(position + 1)
                break
            case 'Escape':
                quit()
                break
        }
    })

    // the speech synthesiser will happily carry on after the page has gone
    window.addEventListener('pagehide', stopSpeaking)

    // links to a contract open it straight away : ?contract=record-deal
    const wanted = new URLSearchParams(window.location.search).get('contract')
    const preset = presets.find(preset => preset.id === wanted)
    preset && loadPreset(preset)
}
