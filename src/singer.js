// The vocal coach.
// Takes a voice and a phrase and works out a performance that fits the music.
// Nothing in here makes a sound - the band plays the result
//
// There are two kinds of performance :
//  sung   : one sound per word, each on the note of the melody and each
//           exactly as long as its note, so that the words land on the beat
//  spoken : one sound for the whole phrase, with every word nudged up or
//           down to the nearest note of the home chord so that it speaks in key

import { composeMelody, modeFor, tempoFor, degreeToMidi } from './composer'
import { estimateWordSeconds } from './text'
import { detectPitch, findSound, midiToHz, foldIntoRange, snapToScale, tuningRate } from './pitch'

const ROOT = 50
// no word is allowed to hog more than half a bar
const LONGEST_NOTE = 8
// leave a sliver of air between one word and the next
const LEGATO = 0.94
// how far a natural voice may be bent before it stops sounding natural
const BEND_LIMIT = 3

const hasBreath = text => /[.,;:!?]["”’)\]]*$/.test(text)

// A performance for a singing voice.
// Each note of the melody gets the word, the length and the layers of sound
export const arrangeSung = (voice, phrase, mood, pace = 1) => {
    const mode = modeFor(mood.valence)
    const sixteenth = 15 / tempoFor(mood)
    const who = mood.beneficiary
    const [low, high] = voice.range(who)

    const melody = composeMelody(phrase).map((note, index) => {
        const word = phrase.words[index]
        const midi = foldIntoRange(degreeToMidi(mode, note.degree, ROOT), low, high)
        const hz = midiToHz(midi)

        // say it once to find out how long it takes...
        const rough = voice.render(word.text, { hz, who, speed: pace })
        if (!rough) {
            // unpronounceable, so the band plays the note alone
            return { ...note, length: 1, layers: [] }
        }
        const natural = rough.samples.length / rough.sampleRate
        const length = Math.max(1, Math.min(LONGEST_NOTE, Math.round(natural / sixteenth)))

        // ...then again at the pace that fills the note exactly
        const stretch = natural / (length * sixteenth * LEGATO)
        const sing = (target, level) => {
            const sound = Math.abs(stretch - 1) < 0.04 && target === midi
                ? rough
                : voice.render(word.text, { hz: midiToHz(target), who, speed: pace * stretch })
            return sound && {
                samples: sound.samples,
                sampleRate: sound.sampleRate,
                // the last few cents that the synthesiser could not manage itself
                rate: tuningRate(sound.hz, target, 2),
                level
            }
        }

        const layers = [sing(midi, 1)]
        // the best words get a harmony above and the worst get a shadow below
        if (word.score > 1 && mood.valence > 0.15) {
            layers.push(sing(foldIntoRange(degreeToMidi(mode, note.degree + 2, ROOT), low, high + 5), 0.5))
        } else if (word.trigger) {
            layers.push(sing(midi - 12 >= low - 7 ? midi - 12 : midi - 5, 0.7))
        }

        return {
            ...note,
            midi,
            // commas and full stops are where a singer breathes
            length: length + (hasBreath(word.text) ? 2 : 0),
            layers: layers.filter(Boolean)
        }
    })

    return { style: 'sung', melody }
}

// Guess where each word starts in a recording of the whole phrase.
// Words are given a share of the time according to how long they are, and
// the pauses in the recording are lined up with the punctuation
export const locateWords = (samples, sampleRate, words) => {
    const sound = findSound(samples, sampleRate)
    const weights = words.map(word => estimateWordSeconds(word))

    // find the pauses
    const size = Math.floor(sampleRate * 0.02)
    const pauses = []
    let quietSince = -1
    for (let from = sound.start; from + size <= sound.end; from += size) {
        let peak = 0
        for (let i = 0; i < size; i += 2) {
            peak = Math.max(peak, Math.abs(samples[from + i]))
        }
        if (peak < 0.02) {
            quietSince = quietSince < 0 ? from : quietSince
        } else {
            if (quietSince >= 0 && from - quietSince > sampleRate * 0.12) {
                pauses.push({ start: quietSince, end: from })
            }
            quietSince = -1
        }
    }

    // the words that should be followed by a pause
    const breaths = []
    words.forEach((word, index) => index < words.length - 1 && hasBreath(word) && breaths.push(index))

    // stretches of speech between pauses, and the words that belong in each
    const stretches = []
    if (pauses.length && pauses.length === breaths.length) {
        let from = sound.start
        let first = 0
        pauses.forEach((pause, index) => {
            stretches.push({ from, to: pause.start, first, last: breaths[index] })
            from = pause.end
            first = breaths[index] + 1
        })
        stretches.push({ from, to: sound.end, first, last: words.length - 1 })
    } else {
        stretches.push({ from: sound.start, to: sound.end, first: 0, last: words.length - 1 })
    }

    const located = []
    stretches.forEach(({ from, to, first, last }) => {
        let total = 0
        for (let i = first; i <= last; ++i) {
            total += weights[i]
        }
        let at = from
        for (let i = first; i <= last; ++i) {
            const share = (to - from) * weights[i] / total
            located.push({ start: Math.round(at), end: Math.round(at + share) })
            at += share
        }
    })
    // nothing is left out : the first word owns the lead in, the last owns
    // the tail and a pause belongs to the word before it
    located[0].start = 0
    located[located.length - 1].end = samples.length
    for (let i = 1; i < located.length; ++i) {
        located[i - 1].end = located[i].start
    }
    return located
}

// Listen to a recording of a phrase once, so that it can be retuned for
// whatever mood the music is in when its turn comes
export const studySpoken = (sound, phrase) => {
    const { samples, sampleRate } = sound
    const words = locateWords(samples, sampleRate, phrase.words.map(word => word.text))
    words.forEach(word => {
        word.hz = detectPitch(samples, sampleRate, word.start, word.end)
    })
    return { samples, sampleRate, words }
}

// A performance for a natural voice : how fast to play each word so that
// it lands on a note of the home chord, and when each word will be heard
export const arrangeSpoken = (study, mood) => {
    const mode = modeFor(mood.valence)
    // the first, third and fifth notes of the mode. the brighter the mood
    // the sweeter the chord, and at the bottom of the ladder it is diminished
    const chord = [mode.steps[0], mode.steps[2], mode.steps[4]]
    const { samples, sampleRate, words } = study
    let rate = 1
    let time = 0
    const segments = words.map(word => {
        // words with no pitch of their own borrow from the one before
        if (word.hz) {
            rate = tuningRate(word.hz, snapToScale(word.hz, ROOT, chord), BEND_LIMIT)
        }
        const segment = { time, offset: word.start / sampleRate, rate }
        time += (word.end - word.start) / sampleRate / rate
        return segment
    })
    return { style: 'spoken', samples, sampleRate, segments, duration: time }
}
