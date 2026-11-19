// The composer.
// Pure functions that turn a mood into a bar of music. Nothing in here makes
// a sound - the engine plays the notes live and the MIDI export writes the
// very same notes to a file.
//
// Events are { track, midi, at, length, velocity } with time in sixteenths

import { countSyllables } from './text'

export const SIXTEENTHS = 16

// D is home. The song wanders to other keys as the contract changes its
// mind, and always comes back here for the final word
const ROOT = 50

// ordered from darkest to brightest. each step up raises one note
export const MODES = [
    { name: 'Locrian', steps: [0, 1, 3, 5, 6, 8, 10] },
    { name: 'Phrygian', steps: [0, 1, 3, 5, 7, 8, 10] },
    { name: 'Aeolian', steps: [0, 2, 3, 5, 7, 8, 10] },
    { name: 'Dorian', steps: [0, 2, 3, 5, 7, 9, 10] },
    { name: 'Mixolydian', steps: [0, 2, 4, 5, 7, 9, 10] },
    { name: 'Ionian', steps: [0, 2, 4, 5, 7, 9, 11] },
    { name: 'Lydian', steps: [0, 2, 4, 6, 7, 9, 11] }
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

// How the contract makes you feel, in finer shades than the groove.
// Each emotion has its own key, chord colour and chord sequence:
//  family      : the key only changes when the feeling moves to another family,
//                so that shades of the same feeling do not keep shifting key
//  key         : where it takes the song, in semitones from home.
//                null stays in whatever key the song is already in
//  colour      : the notes of each chord, as steps up the mode from its root
//  add         : notes that do not belong to the mode, in semitones from the root
//  progression : the chords, as steps up the mode from the key note
// These are choices made for this song, not rules about how keys feel
export const EMOTIONS = {
    // up a tone, the lift at the end of a pop song. ninth chords
    celebrating: { family: 'bright', key: 2, colour: [0, 2, 4, 6, 8], progression: [0, 4, 5, 3, 0, 4, 3, 4] },
    // home, with an added ninth
    happy: { family: 'bright', key: 0, colour: [0, 2, 4, 8], progression: [0, 5, 3, 4, 0, 5, 1, 4] },
    // wherever we are, softened by sevenths
    calm: { family: 'still', key: null, colour: [0, 2, 4, 6], progression: [0, 3, 5, 3, 0, 3, 1, 4] },
    // the dominant, a question waiting for an answer. suspended chords that
    // never touch the key note
    uncertain: { family: 'troubled', key: -5, colour: [0, 3, 4, 6], progression: [3, 4, 3, 1, 3, 4, 5, 4] },
    // the relative minor
    sad: { family: 'troubled', key: -3, colour: [0, 2, 4, 6], progression: [0, 5, 2, 6, 0, 5, 3, 4] },
    // further down and further out. every chord has a flattened fifth in it
    frustrated: { family: 'troubled', key: -4, colour: [0, 2, 6], add: [6], progression: [0, 1, 0, 1, 5, 6, 4, 4] },
    // a tritone from home, as far away as music goes, unless trouble has
    // already taken us somewhere. clusters
    doom: { family: 'troubled', key: -6, colour: [0], add: [1, 6], progression: [0, 0, 1, 0, 0, 0, 4, 1] }
}

export const emotionFor = mood => {
    if (mood.doom) {
        return 'doom'
    }
    if (mood.severity > 0.25) {
        return mood.valence < -0.15 || mood.severity > 0.45 ? 'frustrated' : 'uncertain'
    }
    if (mood.valence > 0.55) {
        return 'celebrating'
    }
    if (mood.valence > 0.15) {
        return 'happy'
    }
    if (mood.valence < -0.4) {
        return 'sad'
    }
    return mood.valence < -0.15 ? 'uncertain' : 'calm'
}

// keys are kept within a tritone of home so the register never runs away
const normaliseKey = key => ((key + 6) % 12 + 12) % 12 - 6

// the key note of the key the mood is in
export const tonicFor = mood => ROOT + (mood.key || 0)

const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
export const keyName = mood => NOTE_NAMES[tonicFor(mood) % 12]

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

// move a note into the octave that starts at low
const fold = (midi, low) => low + ((midi - low) % 12 + 12) % 12

// Spread the chord around a centre note, each note in the octave nearest to
// it. Successive chords then share notes and move by step instead of
// jumping about in parallel, as a choir or a pianist would
const voice = (tones, centre) => [...new Set(tones.map(midi => fold(midi, centre - 6)))].sort((a, b) => a - b)

// the notes of the chord built on a step of the mode
const chordTones = (mode, tonic, root, emotion) => {
    const { colour, add = [] } = EMOTIONS[emotion]
    const bottom = degreeToMidi(mode, root, tonic)
    return [...colour.map(step => degreeToMidi(mode, root + step, tonic)), ...add.map(semitones => bottom + semitones)]
}

// the arpeggio : how each emotion breaks up its chord
const arpeggiate = (emotion, tones, add) => {
    const count = tones.length
    const upAndDown = [...tones, ...tones.slice(1, -1).reverse()]
    switch (emotion) {
        case 'celebrating':
            // a torrent of sixteenths up and down the chord
            for (let i = 0; i < 16; ++i) {
                add('arp', upAndDown[i % upAndDown.length], i, 1, i % 4 === 0 ? 0.36 : 0.24)
            }
            break
        case 'happy':
            // climbing eighths
            for (let i = 0; i < 8; ++i) {
                add('arp', tones[i % count], i * 2, 2, i % 2 ? 0.22 : 0.3)
            }
            break
        case 'calm':
            // a slow fall, one note a beat
            for (let i = 0; i < 4; ++i) {
                add('arp', tones[count - 1 - i % count], i * 4, 4, 0.2)
            }
            break
        case 'uncertain':
            // the top note again and again, off the beat, like a held breath
            for (let i = 0; i < 4; ++i) {
                add('arp', tones[count - 1], i * 4 + 2, 2, 0.18)
            }
            break
        case 'sad':
            // a sigh in the second half of the bar, falling and fading
            for (let i = 0; i < 4; ++i) {
                add('arp', tones[count - 1 - i % count], 8 + i * 2, 2, 0.24 - i * 0.03)
            }
            break
        case 'frustrated':
            // the bottom two notes, nagging in sixteenths
            for (let i = 0; i < 16; ++i) {
                add('arp', tones[i % 2], i, 1, i % 4 === 0 ? 0.3 : 0.18)
            }
            break
    }
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

    // HARMONY : each emotion has its own chords and its own key. A song that
    // has just changed key starts by planting its feet on the new key note
    const emotion = mood.emotion || emotionFor(mood)
    const tonic = tonicFor(mood)
    const { progression } = EMOTIONS[emotion]
    const isDoom = feel === FEEL_DOOM
    const isPivot = mood.pivot && phraseBar === 0
    const chord = isPivot ? 5
        : mood.modulated && phraseBar === 0 && emotion !== 'uncertain' ? 0
        : progression[bar % progression.length]
    const nextChord = progression[(bar + 1) % progression.length]
    // doom sits an octave down in the mud
    const centre = isDoom ? ROOT - 3 : ROOT + 9
    // the chords swell a little as a phrase goes on
    const padLevel = Math.min(1, (0.3 + mood.severity * 0.3) * (1 + Math.min(phraseBar, 3) * 0.05))
    let tones
    if (isPivot) {
        // "provided that..." pulls the rug with a chord borrowed from the minor :
        // the flattened sixth, its fourth sinking onto the third halfway through
        const third = voice([tonic + 12], centre)[0]
        tones = voice([tonic + 8, tonic + 12, tonic + 15], centre)
        tones.filter(midi => midi !== third).forEach(midi => add('pad', midi, 0, 16, padLevel))
        add('pad', third + 1, 0, 8, padLevel)
        add('pad', third, 8, 8, padLevel)
    } else {
        tones = voice(chordTones(mode, tonic, chord, emotion), centre)
        tones.forEach(midi => add('pad', midi, 0, 16, padLevel))
    }

    // ARPEGGIO : the same chord an octave up, broken into a pattern
    arpeggiate(emotion, tones.map(midi => midi + 12), add)

    // BASS : kept between D1 and C#2 whatever the key
    const low = ROOT - 24
    const bassTonic = fold(tonic, low)
    const bassRoot = isPivot ? fold(tonic + 8, low) : fold(degreeToMidi(mode, chord, tonic), low)
    const bassFifth = bassRoot + 7
    switch (feel) {
        case FEEL_DOOM:
            // a drone that never leaves the key note
            add('bass', bassTonic, 0, 16, 1)
            break
        case FEEL_TENSE: {
            // frustration sits on a pedal : the chords move but the bass will not let go
            const pedal = emotion === 'frustrated' ? bassTonic : bassRoot
            for (let i = 0; i < 8; ++i) {
                add('bass', pedal, i * 2, 2, i % 4 === 0 ? 0.9 : 0.6)
            }
            break
        }
        case FEEL_BRIGHT: {
            // walks into the next chord from a semitone below
            const nextRoot = fold(degreeToMidi(mode, nextChord, tonic), low)
            add('bass', bassRoot, 0, 3, 0.8)
            add('bass', bassFifth, 6, 2, 0.6)
            add('bass', bassRoot, 8, 3, 0.8)
            add('bass', nextRoot === bassRoot ? bassFifth : nextRoot - 1, 14, 2, 0.6)
            break
        }
        default:
            add('bass', bassRoot, 0, 8, 0.6)
            add('bass', bar % 2 ? bassFifth : bassRoot, 8, 8, 0.5)
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
        const base = track === 'them' ? tonic : tonic + 24
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

    return { events, mode, feel, emotion, key: mood.key || 0, bpm: tempoFor(mood), chord }
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

    // four, five, home. everybody happy. the five holds its fourth for a
    // moment before giving way, and home has a ninth on top
    const centre = ROOT + 9
    ;[[3, 0, [0, 2, 4, 6]], [4, 8, [0, 2, 4, 6]], [0, 16, [0, 2, 4, 8]]].forEach(([chord, at, colour]) => {
        const length = chord === 0 ? 16 : 8
        const tones = voice(colour.map(step => degreeToMidi(mode, chord + step)), centre)
        if (chord === 4) {
            const third = voice([degreeToMidi(mode, chord + 2)], centre)[0]
            tones.filter(midi => midi !== third).forEach(midi => add('pad', midi, at, length, 0.45))
            add('pad', voice([degreeToMidi(mode, chord + 3)], centre)[0], at, 4, 0.45)
            add('pad', third, at + 4, 4, 0.45)
        } else {
            tones.forEach(midi => add('pad', midi, at, length, 0.45))
        }
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
    const blended = {
        valence,
        severity,
        doom: phrase.doom,
        pivot: phrase.pivot,
        beneficiary: phrase.beneficiary
    }
    // The key only moves when the feeling changes family, or for the lift
    // into celebration. A song that has jumped here starts in the key of
    // the feeling it lands in
    const emotion = emotionFor(blended)
    // keyFamily remembers which family chose the key, as calm passes it on
    const { family, key: requested } = EMOTIONS[emotion]
    const held = previous ? previous.key || 0 : 0
    const heldFamily = previous && previous.keyFamily
    const moves = requested !== null && (heldFamily !== family || (emotion === 'celebrating' && previous.emotion !== emotion))
    const key = normaliseKey(moves ? requested : held)
    const keyFamily = moves ? family : heldFamily
    return { ...blended, emotion, key, keyFamily, modulated: !!previous && key !== held }
}
