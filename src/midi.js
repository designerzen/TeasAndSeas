// Save the song as a standard MIDI file to play on your synths at home.
// The song is rebuilt from the analysis using the same composer as the
// live playback, with the length of each phrase estimated from its words

import { composeBar, composeMelody, composeEnding, blendMood, SIXTEENTHS } from './composer'
import { estimateWordSeconds } from './text'

const TICKS_PER_BEAT = 480
const TICKS_PER_SIXTEENTH = TICKS_PER_BEAT / 4

// general midi instruments and drum notes
const TRACKS = {
    pad: { name: 'Mood', channel: 0, program: 89 },
    bass: { name: 'Bass', channel: 1, program: 38 },
    you: { name: 'You', channel: 2, program: 11 },
    them: { name: 'Them', channel: 3, program: 61 },
    bell: { name: 'Doom bell', channel: 4, program: 14 },
    drums: { name: 'Drums', channel: 9 }
}
const DRUM_NOTES = { kick: 36, snare: 38, hat: 42 }

// how many bars does it take to say this phrase at this tempo?
export const barsFor = (phrase, bpm) => {
    const seconds = phrase.words.reduce((sum, word) => sum + estimateWordSeconds(word.text), 0)
    const barSeconds = 240 / bpm
    return Math.max(1, Math.round(seconds / barSeconds))
}

// the whole song as a list of bars
export const arrange = analysis => {
    const bars = []
    let mood = null
    analysis.phrases.forEach(phrase => {
        mood = blendMood(mood, phrase)
        const melody = composeMelody(phrase)
        const first = composeBar({ bar: bars.length, mood, melody })
        const quantity = barsFor(phrase, first.bpm)
        for (let phraseBar = 0; phraseBar < quantity; ++phraseBar) {
            bars.push(composeBar({
                bar: bars.length,
                phraseBar,
                mood,
                melody,
                melodyCursor: phraseBar * SIXTEENTHS
            }))
        }
    })
    const ending = composeEnding(analysis.overall)
    bars.push({ ...ending, length: ending.bars * SIXTEENTHS })
    return bars
}

const variableLength = value => {
    const bytes = [value & 0x7f]
    while ((value >>= 7)) {
        bytes.unshift((value & 0x7f) | 0x80)
    }
    return bytes
}

const text = string => [...string].map(character => character.charCodeAt(0) & 0x7f)

const chunk = (id, data) => [
    ...text(id),
    (data.length >>> 24) & 0xff, (data.length >>> 16) & 0xff, (data.length >>> 8) & 0xff, data.length & 0xff,
    ...data
]

// messages are { tick, data } and may arrive in any order
const track = (name, messages) => {
    const data = [0, 0xff, 0x03, ...variableLength(name.length), ...text(name)]
    let now = 0
    messages
        .map((message, order) => ({ ...message, order }))
        // note offs before note ons when they land on the same tick
        .sort((a, b) => a.tick - b.tick || a.priority - b.priority || a.order - b.order)
        .forEach(message => {
            data.push(...variableLength(message.tick - now), ...message.data)
            now = message.tick
        })
    data.push(0, 0xff, 0x2f, 0)
    return chunk('MTrk', data)
}

export const createMidi = analysis => {
    const bars = arrange(analysis)
    const tempo = []
    const messages = {}
    Object.keys(TRACKS).forEach(id => {
        const { channel, program } = TRACKS[id]
        messages[id] = program === undefined ? [] : [{ tick: 0, priority: 0, data: [0xc0 | channel, program] }]
    })

    let tick = 0
    let bpm = 0
    bars.forEach(bar => {
        if (bar.bpm !== bpm) {
            bpm = bar.bpm
            const microseconds = Math.round(60000000 / bpm)
            tempo.push({
                tick,
                priority: 0,
                data: [0xff, 0x51, 0x03, (microseconds >>> 16) & 0xff, (microseconds >>> 8) & 0xff, microseconds & 0xff]
            })
        }
        bar.events.forEach(event => {
            const isDrum = event.track in DRUM_NOTES
            const id = isDrum ? 'drums' : event.track
            const { channel } = TRACKS[id]
            const note = isDrum ? DRUM_NOTES[event.track] : event.midi
            const start = tick + Math.round(event.at * TICKS_PER_SIXTEENTH)
            const end = start + Math.max(1, Math.round(event.length * TICKS_PER_SIXTEENTH) - 1)
            const velocity = Math.max(1, Math.min(127, Math.round(event.velocity * 127)))
            messages[id].push({ tick: start, priority: 1, data: [0x90 | channel, note, velocity] })
            messages[id].push({ tick: end, priority: 0, data: [0x80 | channel, note, 0] })
        })
        tick += (bar.length || SIXTEENTHS) * TICKS_PER_SIXTEENTH
    })

    const ids = Object.keys(TRACKS)
    const header = chunk('MThd', [0, 1, 0, ids.length + 1, (TICKS_PER_BEAT >> 8) & 0xff, TICKS_PER_BEAT & 0xff])
    return new Uint8Array([
        ...header,
        ...track('Teas & Seas', tempo),
        ...ids.flatMap(id => track(TRACKS[id].name, messages[id]))
    ])
}

export const downloadMidi = (analysis, name = 'contract') => {
    const blob = new Blob([createMidi(analysis)], { type: 'audio/midi' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${name}.mid`
    link.click()
    setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}
