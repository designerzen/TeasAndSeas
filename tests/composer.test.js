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

    test('the key only moves when the feeling does', () => {
        const happy = blendMood(null, mood(0.3))
        expect(happy.emotion).toBe('happy')
        expect(happy.key).toBe(0)
        // the same feeling again stays put
        const again = blendMood(happy, mood(0.3))
        expect(again.key).toBe(0)
        expect(again.modulated).toBe(false)
        // turning sour takes the song to the relative minor
        const sad = blendMood(blendMood(again, mood(-0.8)), mood(-0.8))
        expect(sad.emotion).toBe('sad')
        expect(sad.key).toBe(-3)
        // calm keeps whatever key it finds itself in
        const calm = blendMood({ ...sad, valence: 0, severity: 0 }, mood(0))
        expect(calm.emotion).toBe('calm')
        expect(calm.key).toBe(-3)
        // and other shades of trouble stay there too, even after the calm
        const worse = blendMood(calm, mood(-0.9, 0.8))
        expect(worse.emotion).toBe('doom')
        expect(worse.key).toBe(-3)
        // but doom out of a clear sky goes a tritone from home, and says it has moved
        const doom = blendMood(happy, mood(-0.9, 0.8))
        expect(doom.key).toBe(-6)
        expect(doom.modulated).toBe(true)
        // and a new key starts on its own key note
        const bar = composeBar({ bar: 3, mood: doom })
        const bass = bar.events.find(event => event.track === 'bass')
        expect(((bass.midi - 50 - doom.key) % 12 + 12) % 12).toBe(0)
    })

    test('the melody and singer follow the key', () => {
        const [phrase] = analyse('You may cancel at any time and we will refund you in full.').phrases
        const melody = composeMelody(phrase)
        const home = composeBar({ bar: 0, mood: { ...blendMood(null, phrase), key: 0 }, melody })
        const away = composeBar({ bar: 0, mood: { ...blendMood(null, phrase), key: 2 }, melody })
        const tune = bar => bar.events.filter(event => event.track === 'you').map(event => event.midi)
        expect(tune(away)).toEqual(tune(home).map(midi => midi + 2))
    })

    test('chords move smoothly instead of jumping in parallel', () => {
        const calm = blendMood(null, mood(0))
        for (let bar = 0; bar < 8; ++bar) {
            const pads = [bar, bar + 1].map(at => composeBar({ bar: at, mood: calm }).events
                .filter(event => event.track === 'pad').map(event => event.midi))
            // every chord sits within an octave
            pads.forEach(pad => expect(Math.max(...pad) - Math.min(...pad)).toBeLessThan(12))
            // and each note of the next chord is a short step from one in this chord
            pads[1].forEach(midi => expect(Math.min(...pads[0].map(other => Math.abs(other - midi)))).toBeLessThanOrEqual(4))
        }
    })

    test('each emotion has its own chord colour and arpeggio', () => {
        const emotions = [mood(0.8), mood(0.3), mood(0), mood(-0.3), mood(-0.8), mood(-0.6, 0.5), mood(-0.9, 0.8)]
            .map(each => blendMood(null, each))
        expect(emotions.map(each => each.emotion)).toEqual(['celebrating', 'happy', 'calm', 'uncertain', 'sad', 'frustrated', 'doom'])
        const arps = emotions.map(each => composeBar({ bar: 0, mood: each }).events.filter(event => event.track === 'arp'))
        // doom has the bell instead
        expect(arps.pop().length).toBe(0)
        arps.forEach(arp => expect(arp.length).toBeGreaterThan(0))
        expect(new Set(arps.map(arp => arp.map(event => `${event.at}:${event.velocity}`).join())).size).toBe(arps.length)
        // celebration piles on a ninth, frustration a flattened fifth
        const pad = each => composeBar({ bar: 0, mood: each }).events.filter(event => event.track === 'pad')
        expect(pad(emotions[0]).length).toBe(5)
        const frustrated = pad(emotions[5]).map(event => event.midi)
        expect(frustrated.some(low => frustrated.some(high => Math.abs(high - low) === 6))).toBe(true)
    })

    test('"provided that" borrows a chord and resolves its suspension', () => {
        const pivot = blendMood(null, mood(0.2, 0, { pivot: true }))
        const pad = composeBar({ bar: 0, phraseBar: 0, mood: pivot }).events.filter(event => event.track === 'pad')
        const tonic = 50 + pivot.key
        // the flattened sixth
        expect(pad.some(event => (event.midi - tonic - 8) % 12 === 0)).toBe(true)
        const fourth = pad.find(event => event.at === 0 && event.length === 8)
        const third = pad.find(event => event.at === 8)
        expect(fourth.midi - third.midi).toBe(1)
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
        expect(tracks).toBe(8)

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
