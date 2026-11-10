import { readFileSync } from 'fs'
import { describe, expect, test } from 'vitest'
import { analyse } from '../src/analyser'
import { composeBar, composeMelody, composeEnding, modeFor, tempoFor, blendMood, MODES, FEEL_DOOM } from '../src/composer'
import { createMidi, arrange } from '../src/midi'

const preset = name => readFileSync(new URL(`../src/presets/${name}.txt`, import.meta.url), 'utf8')
const mood = (valence, severity = 0, extra = {}) => ({
    valence, severity, doom: severity >= 0.6, pivot: false, beneficiary: valence > 0.15 ? 'you' : valence < -0.15 ? 'them' : 'neutral', ...extra
})

describe('composer', () => {
    test('the mode gets brighter as the valence rises', () => {
        const names = [-1, -0.5, -0.3, 0, 0.1, 0.4, 0.9].map(valence => modeFor(valence).name)
        expect(names).toEqual(MODES.map(mode => mode.name))
    })

    test('doom is slow, low and tolls a bell', () => {
        const bar = composeBar({ bar: 0, mood: mood(-0.9, 0.8) })
        expect(bar.feel).toBe(FEEL_DOOM)
        expect(bar.bpm).toBeLessThan(tempoFor(mood(0.6)))
        expect(bar.events.some(event => event.track === 'bell')).toBe(true)
        expect(bar.events.some(event => event.track === 'hat')).toBe(false)
        const pad = bar.events.filter(event => event.track === 'pad').map(event => event.midi)
        const bright = composeBar({ bar: 0, mood: mood(0.6) }).events.filter(event => event.track === 'pad').map(event => event.midi)
        expect(Math.max(...pad)).toBeLessThan(Math.min(...bright))
    })

    test('whoever benefits carries the tune', () => {
        const [phrase] = analyse('The Artist hereby grants to the Label a perpetual and irrevocable licence.').phrases
        const melody = composeMelody(phrase)
        const theirs = composeBar({ bar: 0, mood: blendMood(null, phrase), melody })
        expect(theirs.events.some(event => event.track === 'them')).toBe(true)
        expect(theirs.events.some(event => event.track === 'you')).toBe(false)
    })

    test('nothing spills out of the bar', () => {
        analyse(preset('social-app')).phrases.forEach((phrase, index) => {
            const melody = composeMelody(phrase)
            for (let phraseBar = 0; phraseBar < 3; ++phraseBar) {
                const { events } = composeBar({ bar: index, phraseBar, mood: blendMood(null, phrase), melody, melodyCursor: phraseBar * 16 })
                events.forEach(event => {
                    expect(event.at).toBeGreaterThanOrEqual(0)
                    expect(event.at + event.length).toBeLessThanOrEqual(16)
                    expect(event.velocity).toBeGreaterThan(0)
                    expect(event.velocity).toBeLessThanOrEqual(1)
                    expect(Number.isInteger(event.midi)).toBe(true)
                })
            }
        })
    })

    test('the same contract always plays the same song', () => {
        const first = arrange(analyse(preset('tenancy')))
        const second = arrange(analyse(preset('tenancy')))
        expect(first).toEqual(second)
    })

    test('the ending resolves for a fair contract and not for a bad one', () => {
        const good = composeEnding({ balance: 0.6 })
        const bad = composeEnding({ balance: -0.7 })
        expect(good.events.some(event => event.track === 'bell')).toBe(false)
        expect(bad.events.filter(event => event.track === 'bell').length).toBeGreaterThan(2)
    })
})

describe('midi', () => {
    test('writes a well formed file', () => {
        const bytes = createMidi(analyse(preset('record-deal')))
        const text = (from, length) => String.fromCharCode(...bytes.slice(from, from + length))
        expect(text(0, 4)).toBe('MThd')
        const tracks = (bytes[10] << 8) | bytes[11]
        expect(tracks).toBe(7)

        // walk the chunks : every track must be exactly as long as it claims
        let offset = 14
        let found = 0
        while (offset < bytes.length) {
            expect(text(offset, 4)).toBe('MTrk')
            const length = (bytes[offset + 4] << 24) | (bytes[offset + 5] << 16) | (bytes[offset + 6] << 8) | bytes[offset + 7]
            offset += 8 + length
            // each ends with the end of track message
            expect([...bytes.slice(offset - 3, offset)]).toEqual([0xff, 0x2f, 0])
            found++
        }
        expect(offset).toBe(bytes.length)
        expect(found).toBe(tracks)
    })
})
