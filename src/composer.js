// The composer.
// Pure functions that turn a mood into a bar of music. Nothing in here makes
// a sound - the engine plays the notes live and the MIDI export writes the
// very same notes to a file.
//
// Events are { track, midi, at, length, velocity } with time in sixteenths

import { countSyllables } from './text'

export const SIXTEENTHS = 16

// D is the home note for everything, so that a change of mode
// is heard as a change of light rather than a change of key
const ROOT = 50

// ordered from darkest to brightest. each step up raises one note
export const MODES = [
    { name: 'Locrian', steps: [0, 1, 3, 5, 6, 8, 10], progression: [0, 1, 0, 4] },
    { name: 'Phrygian', steps: [0, 1, 3, 5, 7, 8, 10], progression: [0, 1, 0, 6] },
    { name: 'Aeolian', steps: [0, 2, 3, 5, 7, 8, 10], progression: [0, 5, 3, 4] },
    { name: 'Dorian', steps: [0, 2, 3, 5, 7, 9, 10], progression: [0, 3, 0, 6] },
    { name: 'Mixolydian', steps: [0, 2, 4, 5, 7, 9, 10], progression: [0, 6, 3, 0] },
    { name: 'Ionian', steps: [0, 2, 4, 5, 7, 9, 11], progression: [0, 4, 5, 3] },
    { name: 'Lydian', steps: [0, 2, 4, 6, 7, 9, 11], progression: [0, 1, 0, 4] }
]

const MODE_THRESHOLDS = [-0.7, -0.4, -0.15, 0.05, 0.25, 0.55]

export const modeFor = valence => {
    const index = MODE_THRESHOLDS.findIndex(threshold => valence < threshold)
    return MODES[index < 0 ? MODES.length - 1 : index]
}

// which groove are we in?
export const FEEL_DOOM = 'doom'
export const FEEL_TENSE = 'tense'
export const FEEL_BRIGHT = 'bright'
export const FEEL_CALM = 'calm'

export const feelFor = mood => {
    if (mood.doom) {
        return FEEL_DOOM
    }
    if (mood.severity > 0.25) {
        return FEEL_TENSE
    }
    return mood.valence > 0.15 ? FEEL_BRIGHT : FEEL_CALM
}

export const tempoFor = mood => {
    switch (feelFor(mood)) {
        // doom does not hurry
        case FEEL_DOOM: return 60
        case FEEL_TENSE: return Math.round(108 + (mood.severity - 0.25) * 60)
        case FEEL_BRIGHT: return Math.round(94 + mood.valence * 18)
    }
    return 86
}

export const degreeToMidi = (mode, degree, base = ROOT) => {
    const octave = Math.floor(degree / 7)
    return base + octave * 12 + mode.steps[degree - octave * 7]
}

// a small deterministic random number so that the same contract
// always plays the same song
const chance = seed => {
    let t = (seed + 0x6D2B79F5) | 0
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// Every phrase gets its own tune. The rhythm comes from the syllables and
// the contour from the words - good words climb, bad words fall
export const composeMelody = phrase => {
    let degree = 0
    const notes = phrase.words.map((word, index) => {
        const syllables = countSyllables(word.norm)
        const breath = /[.,;:!?]["”’)\]]*$/.test(word.text) ? 2 : 0
        const length = (syllables > 2 ? 4 : 2) + breath
        const wobble = (word.norm.charCodeAt(0) + word.norm.length) % 3 - 1
        const step = word.score > 0.4 ? (word.score > 1.5 ? 2 : 1)
            : word.score < -0.4 ? (word.score < -1.5 ? -2 : -1)
            : wobble
        if (index > 0) {
            degree = Math.max(-3, Math.min(9, degree + step))
        }
        return { degree, length, accent: Math.abs(word.score) > 1 }
    })
    // happy phrases come home. unhappy ones are left hanging a step above
    const last = notes[notes.length - 1]
    last.degree = phrase.valence > 0.15 ? 0 : phrase.valence < -0.15 ? 1 : last.degree
    last.length += 2
    return notes
}

const DRUMS = {
    [FEEL_DOOM]: { kick: [[0, 1], [10, 0.5], [15, 0.4]], snare: [[8, 1]], hat: [] },
    [FEEL_TENSE]: {
        kick: [[0, 1], [3, 0.7], [6, 0.8], [10, 0.9], [13, 0.6]],
        snare: [[4, 0.9], [12, 0.9]],
        hat: [...Array(16)].map((_, i) => [i, i % 2 ? 0.25 : 0.5])
    },
    [FEEL_BRIGHT]: {
        kick: [[0, 0.9], [8, 0.8], [10, 0.5]],
        snare: [[4, 0.6], [12, 0.6]],
        hat: [...Array(8)].map((_, i) => [i * 2, i % 2 ? 0.5 : 0.3])
    },
    [FEEL_CALM]: { kick: [[0, 0.6]], snare: [], hat: [[4, 0.25], [12, 0.25]] }
}

// One bar of music for the mood.
//  bar          : bar number since the song began (drives the chord sequence)
//  phraseBar    : bar number since this phrase began
//  melody       : notes from composeMelody for the phrase being spoken
//  melodyCursor : where we got to in the melody, in sixteenths
//  repeat       : whether the tune comes round again once it has finished.
//                 an instrument can play it all day, but a voice singing the
//                 words only gets to say them once
export const composeBar = ({ bar, phraseBar = 0, mood, melody = [], melodyCursor = 0, repeat = true }) => {
    const mode = modeFor(mood.valence)
    const feel = feelFor(mood)
    const events = []
    const add = (track, midi, at, length, velocity, word) => events.push(
        word === undefined ? { track, midi, at, length, velocity } : { track, midi, at, length, velocity, word }
    )

    // HARMONY : a pivot ("provided that...") pulls the rug with a surprise chord
    const chord = mood.pivot && phraseBar === 0 ? 5 : mode.progression[bar % 4]
    const isDoom = feel === FEEL_DOOM
    const padBase = isDoom ? ROOT - 12 : ROOT
    // doom squashes the chord into a cluster. happiness adds a seventh on top
    const shape = isDoom ? [0, 1, 4] : mood.valence > 0.25 ? [0, 2, 4, 6] : [0, 2, 4]
    const padLevel = 0.3 + mood.severity * 0.3
    shape.forEach(interval => add('pad', degreeToMidi(mode, chord + interval, padBase), 0, 16, padLevel))

    // BASS
    const bassRoot = degreeToMidi(mode, chord, ROOT - 24)
    switch (feel) {
        case FEEL_DOOM:
            // a drone that never leaves home
            add('bass', ROOT - 24, 0, 16, 1)
            break
        case FEEL_TENSE:
            for (let i = 0; i < 8; ++i) {
                add('bass', bassRoot, i * 2, 2, i % 4 === 0 ? 0.9 : 0.6)
            }
            break
        case FEEL_BRIGHT:
            add('bass', bassRoot, 0, 3, 0.8)
            add('bass', degreeToMidi(mode, chord + 4, ROOT - 24), 6, 2, 0.6)
            add('bass', bassRoot, 8, 3, 0.8)
            add('bass', degreeToMidi(mode, chord + 4, ROOT - 24), 14, 2, 0.6)
            break
        default:
            add('bass', bassRoot, 0, 8, 0.6)
            add('bass', bassRoot, 8, 8, 0.5)
    }

    // DRUMS : with the odd ghost note to stop it sounding like a machine
    const drums = DRUMS[feel]
    Object.keys(drums).forEach(drum => {
        drums[drum].forEach(([at, velocity]) => add(drum, 0, at, 1, velocity))
    })
    if (feel !== FEEL_CALM && chance(bar * 7 + 3) > 0.6) {
        add('kick', 0, 14, 1, 0.4)
    }
    if (bar % 4 === 3 && feel !== FEEL_DOOM && feel !== FEEL_CALM) {
        add('snare', 0, 14, 1, 0.5)
        add('snare', 0, 15, 1, 0.7)
    }

    // the bell tolls as each exploitative phrase begins
    if (isDoom && phraseBar === 0) {
        add('bell', ROOT - 12, 0, 16, 1)
        add('bell', ROOT - 6, 0, 16, 0.7)
    }

    // MELODY : whoever is winning gets to sing
    //  you  - high and clear
    //  them - low and brassy
    if (melody.length) {
        const track = mood.beneficiary === 'them' ? 'them' : 'you'
        const base = track === 'them' ? ROOT : ROOT + 24
        const level = mood.beneficiary === 'neutral' ? 0.3 : 0.55 + mood.severity * 0.35
        // a short rest before the tune comes round again
        const loop = melody.reduce((sum, note) => sum + note.length, 0) + 4
        let position = repeat ? -(melodyCursor % loop) : -melodyCursor
        do {
            melody.forEach((note, index) => {
                if (position >= 0 && position < SIXTEENTHS) {
                    const length = Math.min(note.length, SIXTEENTHS - position)
                    // each note knows which word it belongs to so that a voice can sing along
                    add(track, degreeToMidi(mode, note.degree, base), position, length, note.accent ? Math.min(1, level + 0.2) : level, index)
                }
                position += note.length
            })
            position += 4
        } while (repeat && position < SIXTEENTHS)
    }

    return { events, mode, feel, bpm: tempoFor(mood), chord }
}

// The last word. A fair contract resolves, a bad one is left to rot
export const composeEnding = overall => {
    const valence = Math.max(-1, Math.min(1, overall.balance * 1.6))
    const mode = modeFor(valence)
    const events = []
    const add = (track, midi, at, length, velocity) => events.push({ track, midi, at, length, velocity })

    if (overall.balance < -0.2) {
        // the tritone, held, with the bell tolling three times
        ;[0, 1, 4].forEach(interval => add('pad', degreeToMidi(MODES[0], interval, ROOT - 12), 0, 32, 0.6))
        add('bass', ROOT - 24, 0, 32, 1)
        ;[0, 10, 20].forEach((at, index) => {
            add('bell', ROOT - 12, at, 12, 1 - index * 0.25)
            add('bell', ROOT - 6, at, 12, 0.7 - index * 0.2)
            add('kick', 0, at, 1, 1)
        })
        return { events, mode: MODES[0], bpm: 60, bars: 2 }
    }

    if (overall.balance < 0.2) {
        // neither here nor there : a suspended chord that never lands
        ;[0, 3, 4].forEach(interval => add('pad', degreeToMidi(mode, interval), 0, 32, 0.4))
        add('bass', ROOT - 24, 0, 32, 0.6)
        add('you', degreeToMidi(mode, 3, ROOT + 24), 0, 16, 0.4)
        return { events, mode, bpm: 86, bars: 2 }
    }

    // four, five, home. everybody happy
    ;[[3, 0], [4, 8], [0, 16]].forEach(([chord, at]) => {
        const length = chord === 0 ? 16 : 8
        ;[0, 2, 4].forEach(interval => add('pad', degreeToMidi(mode, chord + interval), at, length, 0.45))
        add('bass', degreeToMidi(mode, chord, ROOT - 24), at, length, 0.8)
        add('kick', 0, at, 1, 0.8)
    })
    ;[0, 2, 4, 7].forEach((degree, index) => add('you', degreeToMidi(mode, degree, ROOT + 24), 16 + index * 2, 8, 0.6))
    return { events, mode, bpm: 100, bars: 2 }
}

// the mood the listener actually hears : it drifts between phrases so that
// the music breathes, but drops straight into doom without a warning
export const blendMood = (previous, phrase) => {
    const sudden = phrase.doom || phrase.pivot || !previous
    const mix = sudden ? 1 : 0.65
    const blend = (from, to) => from + (to - from) * mix
    const valence = previous ? blend(previous.valence, phrase.valence) : phrase.valence
    const severity = previous ? blend(previous.severity, phrase.severity) : phrase.severity
    return {
        valence,
        severity,
        doom: phrase.doom,
        pivot: phrase.pivot,
        beneficiary: phrase.beneficiary
    }
}
