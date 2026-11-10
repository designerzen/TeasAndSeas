// The narrator.
// Speaks a phrase at a time and reports which word it has reached so that
// the karaoke can follow along. Not every voice tells us where it is, so a
// timer does the same job until (and unless) the voice speaks up for itself

import { estimateWordSeconds } from './text'

export const hasSpeech = () => typeof window !== 'undefined' && 'speechSynthesis' in window

export const getVoices = () => hasSpeech()
    ? window.speechSynthesis.getVoices().filter(voice => /^en/i.test(voice.lang))
    : []

// voices turn up late in some browsers
export const onVoicesReady = callback => {
    if (!hasSpeech()) {
        return callback([])
    }
    callback(getVoices())
    window.speechSynthesis.addEventListener('voiceschanged', () => callback(getVoices()))
}

const findVoice = name => {
    const voices = getVoices()
    return voices.find(voice => voice.name === name)
        || voices.find(voice => voice.default)
        || voices.find(voice => voice.localService)
        || voices[0]
}

// contracts love to SHOUT but speech synthesisers spell out capitals
export const tame = text => {
    const letters = text.replace(/[^a-z]/gi, '')
    const capitals = letters.replace(/[^A-Z]/g, '')
    return letters.length > 3 && capitals.length / letters.length > 0.6 ? text.toLowerCase() : text
}

// each call makes the previous one irrelevant
let session = 0

////////////////////////////////////////////////////////////
// Speak these words out loud
// rate     0.1 to 10
// pitch    0 to 2
// onWord   called with the index of each word as it is said
// onEnd    called once when the last word has been said
// silent   keeps time without making a sound
////////////////////////////////////////////////////////////
export const say = (words, { rate = 1, pitch = 1, volume = 1, voice, silent = false, onWord, onEnd }) => {
    const id = ++session
    const timers = []
    let finished = false
    let isLeading = false
    let current = -1

    const isStale = () => id !== session || finished

    const reach = index => {
        if (isStale() || index <= current || index >= words.length) {
            return
        }
        // never skip a word, even if the voice only reports some of them
        while (current < index) {
            onWord && onWord(++current)
        }
    }

    const finish = () => {
        if (isStale()) {
            return
        }
        reach(words.length - 1)
        finished = true
        timers.forEach(clearTimeout)
        onEnd && onEnd()
    }

    // where each word begins, in time and in characters
    const offsets = []
    const starts = []
    let seconds = 0
    let characters = 0
    words.forEach(word => {
        offsets.push(seconds)
        starts.push(characters)
        seconds += estimateWordSeconds(word, rate)
        characters += word.length + 1
    })

    let isFollowing = false
    const follow = () => {
        if (isFollowing || isStale()) {
            return
        }
        isFollowing = true
        offsets.forEach((offset, index) => {
            timers.push(setTimeout(() => !isLeading && reach(index), offset * 1000))
        })
    }

    if (silent || !hasSpeech()) {
        follow()
        timers.push(setTimeout(finish, seconds * 1000))
        return
    }

    const speech = new SpeechSynthesisUtterance(tame(words.join(' ')))
    const person = findVoice(voice)
    if (person) {
        speech.voice = person
        speech.lang = person.lang
    } else {
        speech.lang = 'en-GB'
    }
    speech.volume = volume
    speech.rate = rate
    speech.pitch = pitch

    speech.onstart = follow
    // and some never report that they have started
    timers.push(setTimeout(follow, 800))

    speech.onboundary = event => {
        if (isStale() || (event.name && event.name !== 'word')) {
            return
        }
        // this voice knows where it is, so stop guessing
        isLeading = true
        let index = starts.length - 1
        while (index > 0 && starts[index] > event.charIndex) {
            index--
        }
        reach(index)
    }

    speech.onend = finish
    speech.onerror = finish

    // some voices never report that they have finished
    timers.push(setTimeout(finish, (seconds * 2.5 + 4) * 1000))

    const synthesiser = window.speechSynthesis
    if (synthesiser.speaking || synthesiser.pending) {
        synthesiser.cancel()
    }
    synthesiser.speak(speech)
}

export const stopSpeaking = () => {
    session++
    hasSpeech() && window.speechSynthesis.cancel()
}
