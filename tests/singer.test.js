import { describe, expect, test } from 'vitest'
import { analyse } from '../src/analyser'
import { blendMood, composeBar, tempoFor, modeFor } from '../src/composer'
import { detectPitch, findSound, midiToHz, hzToMidi, foldIntoRange, snapToScale, tuningRate } from '../src/pitch'
import { arrangeSung, arrangeSpoken, studySpoken, locateWords } from '../src/singer'
import { create as createSam } from '../src/voices/sam'
import { create as createEspeak } from '../src/voices/espeak'
import { speakable, decodeWav } from '../src/voices/speakable'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

const SAMPLE_RATE = 22050

// a voice-like buzz : a fundamental with a few harmonics on top
const buzz = (hz, seconds, sampleRate = SAMPLE_RATE) => {
    const samples = new Float32Array(Math.floor(seconds * sampleRate))
    for (let i = 0; i < samples.length; ++i) {
        const phase = 2 * Math.PI * hz * i / sampleRate
        samples[i] = 0.4 * Math.sin(phase) + 0.25 * Math.sin(phase * 2) + 0.15 * Math.sin(phase * 3)
    }
    return samples
}

const cents = (hz, midi) => Math.abs(hzToMidi(hz) - midi) * 100

describe('pitch', () => {
    test('hears the note of a voice', () => {
        ;[70, 98, 147, 220, 311].forEach(hz => {
            expect(Math.abs(detectPitch(buzz(hz, 0.4), SAMPLE_RATE) - hz)).toBeLessThan(hz * 0.02)
        })
    })

    test('hears nothing in silence or noise', () => {
        expect(detectPitch(new Float32Array(8000), SAMPLE_RATE)).toBe(0)
        let seed = 1
        const noise = Float32Array.from({ length: 8000 }, () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.5)
        expect(detectPitch(noise, SAMPLE_RATE)).toBe(0)
    })

    test('finds where the sound is', () => {
        const samples = new Float32Array(3000)
        samples.set(buzz(200, 0.05), 1000)
        const { start, end } = findSound(samples, SAMPLE_RATE)
        expect(start).toBeGreaterThan(800)
        expect(start).toBeLessThanOrEqual(1000)
        expect(end).toBeLessThan(2300)
    })

    test('tuning maths', () => {
        expect(foldIntoRange(74, 36, 50)).toBe(50)
        expect(foldIntoRange(30, 36, 50)).toBe(42)
        // D minor triad : a slightly flat F sharp is pulled down to F
        expect(snapToScale(midiToHz(53.6), 50, [0, 3, 7])).toBe(53)
        expect(tuningRate(midiToHz(60), 62)).toBeCloseTo(Math.pow(2, 2 / 12))
        // never bends further than it is allowed to
        expect(tuningRate(midiToHz(60), 72, 3)).toBeCloseTo(Math.pow(2, 3 / 12))
        expect(tuningRate(0, 72)).toBe(1)
    })
})

describe('the small voices', () => {
    test('awkward punctuation is made pronounceable', () => {
        expect(speakable('(THE “COMPETITION”),')).toBe('THE COMPETITION')
        expect(speakable("Artist's")).toBe("Artist's")
        expect(speakable('T&C’s')).toBe("T and C's")
        expect(speakable('—')).toBe('')
    })

    test('SAM sings the note it is asked for', async () => {
        const sam = await createSam()
        ;[40, 45, 50, 55].forEach(midi => {
            const sound = sam.render('irrevocable', { hz: midiToHz(midi), who: 'them' })
            // what it says it sang, once the fine tuning is applied, is the note
            expect(cents(sound.hz * tuningRate(sound.hz, midi, 1), midi)).toBeLessThan(1)
            // and what it says it sang is what a listener hears
            expect(cents(detectPitch(sound.samples, sound.sampleRate), hzToMidi(sound.hz))).toBeLessThan(60)
        })
    })

    test('SAM can be hurried along or slowed down', async () => {
        const sam = await createSam()
        const normal = sam.render('perpetual', { hz: 110 })
        const fast = sam.render('perpetual', { hz: 110, speed: 2 })
        expect(fast.samples.length).toBeLessThan(normal.samples.length * 0.7)
        expect(sam.render('”', { hz: 110 })).toBe(null)
    })

    test('eSpeak sings close to the note it is asked for', async () => {
        const espeak = await createEspeak(async () => require('mespeak'))
        ;['them', 'you'].forEach(who => {
            const [low, high] = espeak.range(who)
            ;[low + 2, Math.round((low + high) / 2), high - 2].forEach(midi => {
                const sound = espeak.render('agreement', { hz: midiToHz(midi), who })
                expect(sound.samples.length).toBeGreaterThan(2000)
                // within the reach of the fine tuning
                expect(cents(sound.hz, midi)).toBeLessThan(160)
            })
        })
    })
})

describe('singing', () => {
    const [phrase] = analyse('The Artist irrevocably waives all moral rights, forever.').phrases
    const mood = blendMood(null, phrase)

    test('every word fills its note and lands on the grid', async () => {
        const sam = await createSam()
        const { melody } = arrangeSung(sam, phrase, mood)
        const sixteenth = 15 / tempoFor(mood)
        expect(melody.length).toBe(phrase.words.length)
        melody.forEach((note, index) => {
            expect(Number.isInteger(note.length)).toBe(true)
            expect(note.layers.length).toBeGreaterThan(0)
            const [lead] = note.layers
            const seconds = lead.samples.length / lead.sampleRate / lead.rate
            const breath = /[.,]$/.test(phrase.words[index].text) ? 2 : 0
            const room = (note.length - breath) * sixteenth
            // long enough to be heard as the note, short enough not to tread on the next
            expect(seconds).toBeLessThan(room * 1.15 + 0.03)
            expect(seconds).toBeGreaterThan(room * 0.6 - 0.03)
        })
    })

    test('the notes sung are notes of the mode', async () => {
        const sam = await createSam()
        const { melody } = arrangeSung(sam, phrase, mood)
        const { steps } = modeFor(mood.valence)
        melody.forEach(note => {
            expect(steps).toContain(((note.midi - 50) % 12 + 12) % 12)
            const [low, high] = sam.range(mood.beneficiary)
            expect(note.midi).toBeGreaterThanOrEqual(low)
            expect(note.midi).toBeLessThanOrEqual(high)
        })
    })

    test('the worst words get a shadow', async () => {
        const sam = await createSam()
        const { melody } = arrangeSung(sam, phrase, mood)
        const index = phrase.words.findIndex(word => word.trigger)
        expect(index).toBeGreaterThan(-1)
        expect(melody[index].layers.length).toBe(2)
    })

    test('a sung tune is played once and tells the band which word is which', () => {
        const melody = [{ degree: 0, length: 4 }, { degree: 1, length: 4 }]
        const words = bar => composeBar({ bar: 0, mood, melody, melodyCursor: bar * 16, repeat: false })
            .events.filter(event => event.word !== undefined).map(event => event.word)
        expect(words(0)).toEqual([0, 1])
        expect(words(1)).toEqual([])
        // an instrument on its own keeps going round
        expect(composeBar({ bar: 0, mood, melody }).events.filter(event => event.word !== undefined).length).toBeGreaterThan(2)
    })
})

describe('speaking in key', () => {
    // three "words" on three notes with a pause after the second
    const gap = new Float32Array(Math.floor(SAMPLE_RATE * 0.2))
    const parts = [buzz(110, 0.3), buzz(128, 0.3), gap, buzz(170, 0.3)]
    const samples = new Float32Array(parts.reduce((sum, part) => sum + part.length, 0))
    parts.reduce((at, part) => (samples.set(part, at), at + part.length), 0)
    const spoken = { words: [{ text: 'aaa' }, { text: 'bbb,' }, { text: 'ccc' }] }

    test('pauses are lined up with punctuation', () => {
        const words = locateWords(samples, SAMPLE_RATE, spoken.words.map(word => word.text))
        expect(words.length).toBe(3)
        expect(words[0].start).toBe(0)
        expect(words[2].end).toBe(samples.length)
        // the third word starts after the pause, not in the middle of the second
        expect(Math.abs(words[2].start / SAMPLE_RATE - 0.8)).toBeLessThan(0.05)
    })

    test('every word is nudged onto the home chord', () => {
        const study = studySpoken({ samples, sampleRate: SAMPLE_RATE }, spoken)
        const mood = { valence: -0.3, severity: 0.3 }
        const { segments, duration } = arrangeSpoken(study, mood)
        const { steps } = modeFor(mood.valence)
        const chord = [steps[0], steps[2], steps[4]]
        segments.forEach((segment, index) => {
            const heard = hzToMidi(study.words[index].hz * segment.rate)
            const nearest = Math.round(heard)
            expect(Math.abs(heard - nearest)).toBeLessThan(0.15)
            expect(chord).toContain(((nearest - 50) % 12 + 12) % 12)
        })
        // and the words are told when they will be heard
        expect(segments[0].time).toBe(0)
        expect(segments[2].time).toBeGreaterThan(segments[1].time)
        expect(duration).toBeGreaterThan(0.8)
    })

    test('wav files are read properly', () => {
        const bytes = new Uint8Array(44 + 4)
        const view = new DataView(bytes.buffer)
        ;[[0, 0x52494646], [8, 0x57415645], [12, 0x666d7420], [36, 0x64617461]].forEach(([at, tag]) => view.setUint32(at, tag, false))
        view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
        view.setUint32(24, 22050, true); view.setUint16(34, 16, true); view.setUint32(40, 4, true)
        view.setInt16(44, 16384, true); view.setInt16(46, -32768, true)
        const { samples: decoded, sampleRate } = decodeWav(bytes)
        expect(sampleRate).toBe(22050)
        expect([...decoded]).toEqual([0.5, -1])
    })
})
