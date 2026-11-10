// The band.
// Plays whatever the composer writes for the current mood, a beat at a
// time, so that the music can change direction as soon as the contract does

import * as Tone from 'tone'
import { composeBar, composeEnding, SIXTEENTHS, FEEL_DOOM } from './composer'
import snareFile from './assets/snare.wav'
import kickFile from './assets/kick.wav'

const KICK = 'C1'
const SNARE = 'D1'
const NEUTRAL = { valence: 0, severity: 0, doom: false, pivot: false, beneficiary: 'neutral' }

let instruments
let effects
let loop

let mood = NEUTRAL
let melody = []
let melodyCursor = 0
let bar = 0
let phraseBar = 0
let beat = 0
let composed
let isNewPhrase = false
let heldChord = []
// whoever is at the microphone, and the sounds they are making right now
let vocal = null
let sounding = []
let busyUntil = 0
let listeners = {}

// callbacks that queue up the next phrase are given a head start,
// so that it is ready before the beat it needs to land on
const LEAD = 0.3

const note = midi => Tone.Frequency(midi, 'midi').toFrequency()

// Tell the page about something at the moment it is heard. Unlike the beat
// pulse these must never be dropped when the page is busy, because the
// next phrase is waiting on them
const announce = (callback, time) => {
    callback && setTimeout(callback, Math.max(0, (time - Tone.now()) * 1000))
}

const build = () => {
    const limiter = new Tone.Limiter(-2).toDestination()
    const reverb = new Tone.Reverb({ decay: 5, wet: 0.15 }).connect(limiter)
    // closes as things get worse, like a door
    const filter = new Tone.Filter(8000, 'lowpass').connect(reverb)
    const grit = new Tone.Distortion({ distortion: 0.6, wet: 0 }).connect(filter)
    const echo = new Tone.FeedbackDelay({ delayTime: '8n.', feedback: 0.3, wet: 0.2 }).connect(filter)

    // THE VOICE : shares the room with the band but not the closing door,
    // as the words still need to be understood
    const voice = new Tone.Gain(1.4)
    const drive = new Tone.Distortion({ distortion: 0.4, wet: 0 }).connect(reverb)
    // doom brings a second voice an octave below
    const demon = new Tone.Gain(0).connect(drive)
    voice.connect(drive)
    voice.connect(new Tone.PitchShift({ pitch: -12, windowSize: 0.08 }).connect(demon))

    effects = { limiter, reverb, filter, grit, echo, voice, drive, demon }

    instruments = {
        pad: new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'fatsawtooth', count: 3, spread: 18 },
            envelope: { attack: 0.5, decay: 0.4, sustain: 0.7, release: 1.5 },
            volume: -20
        }).connect(grit),

        bass: new Tone.MonoSynth({
            oscillator: { type: 'sawtooth' },
            filter: { Q: 2, type: 'lowpass', rolloff: -24 },
            envelope: { attack: 0.01, decay: 0.2, sustain: 0.8, release: 0.3 },
            filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.5, baseFrequency: 80, octaves: 2.5 },
            volume: -10
        }).connect(grit),

        // your voice : a clear bell-like tone, high up
        you: new Tone.PolySynth(Tone.FMSynth, {
            harmonicity: 2,
            modulationIndex: 3,
            envelope: { attack: 0.005, decay: 0.3, sustain: 0.2, release: 0.6 },
            modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.3 },
            volume: -14
        }).connect(echo),

        // their voice : brass, down low
        them: new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'fatsquare', count: 2, spread: 12 },
            envelope: { attack: 0.04, decay: 0.2, sustain: 0.6, release: 0.3 },
            volume: -16
        }).connect(grit),

        bell: new Tone.PolySynth(Tone.FMSynth, {
            harmonicity: 3.01,
            modulationIndex: 14,
            envelope: { attack: 0.001, decay: 4, sustain: 0, release: 4 },
            modulationEnvelope: { attack: 0.001, decay: 2, sustain: 0, release: 2 },
            volume: -8
        }).connect(reverb),

        // a sampler rather than players so that each hit can have its own weight
        drums: new Tone.Sampler({ urls: { [KICK]: kickFile, [SNARE]: snareFile }, volume: -6 }).connect(filter),

        hat: new Tone.NoiseSynth({
            noise: { type: 'white' },
            envelope: { attack: 0.001, decay: 0.05, sustain: 0 },
            volume: -22
        }).connect(new Tone.Filter(7000, 'highpass').connect(filter))
    }
}

// play one composer event at a moment in time
const play = (event, at, sixteenth, isHeld = true) => {
    const length = Math.max(0.05, event.length * sixteenth * 0.95)
    const instrument = instruments[event.track]
    const { drums } = instruments
    switch (event.track) {
        case 'pad':
            if (isHeld) {
                // chords are held until the next bar replaces them
                heldChord.push(note(event.midi))
                instrument.triggerAttack(note(event.midi), at, event.velocity)
            } else {
                instrument.triggerAttackRelease(note(event.midi), length, at, event.velocity)
            }
            break
        case 'kick':
        case 'snare':
            drums.loaded && drums.triggerAttack(event.track === 'kick' ? KICK : SNARE, at, event.velocity * (event.track === 'kick' ? 1 : 0.6))
            break
        case 'hat':
            instrument.triggerAttackRelease(0.05, at, event.velocity)
            break
        case 'bell':
            instrument.triggerAttackRelease(note(event.midi), 4, at, event.velocity)
            break
        default: {
            const singer = vocal
            const sung = singer && singer.style === 'sung' && event.word !== undefined && singer.melody[event.word]
            if (sung) {
                // the voice sings this note, so the instrument steps back and doubles it
                sung.layers.forEach(layer => voiceSound(layer.buffer, at, layer.rate, layer.level))
                const index = event.word
                announce(singer.onWord && (() => singer.onWord(index)), at)
            }
            instrument.triggerAttackRelease(note(event.midi), length, at, event.velocity * (sung ? 0.5 : 1))
        }
    }
}

const toBuffer = (samples, sampleRate) => {
    const buffer = Tone.getContext().createBuffer(1, samples.length, sampleRate)
    buffer.copyToChannel(samples, 0)
    return buffer
}

// one sound from the voice, sent through its effects
const voiceSound = (buffer, at, rate = 1, level = 1) => {
    const source = new Tone.ToneBufferSource({ url: buffer, playbackRate: rate, fadeOut: 0.01 }).connect(effects.voice)
    source.onended = () => {
        sounding = sounding.filter(other => other !== source)
        source.dispose()
    }
    sounding.push(source)
    source.start(at, 0, undefined, level)
    return source
}

// A natural voice says its whole phrase in one go, starting on the beat.
// Each word is played a touch faster or slower so that it lands in key
const startSpeaking = (speaker, time) => {
    const source = voiceSound(speaker.buffer, time, speaker.segments[0].rate)
    speaker.isStarted = true
    busyUntil = time + speaker.duration
    speaker.segments.forEach((segment, index) => {
        const at = time + segment.time
        // glide rather than jump, so that the joins cannot be heard
        index && source.playbackRate.setTargetAtTime(segment.rate, at, 0.015)
        announce(speaker.onWord && (() => speaker.onWord(index)), at)
    })
    announce(speaker.onStart, time)
    announce(speaker.onEnd, time + speaker.duration - LEAD)
}

// play the composer events that fall inside one beat of the bar
const perform = (events, from, time, sixteenth) => {
    events.forEach(event => {
        if (event.at >= from && event.at < from + 4) {
            play(event, time + (event.at - from) * sixteenth, sixteenth)
        }
    })
}

const releaseChord = time => {
    heldChord.length && instruments.pad.triggerRelease(heldChord, time)
    heldChord = []
}

// the mix follows the mood too
const colour = (current, seconds = 1) => {
    const { valence, severity } = current
    const darkness = Math.max(0, -valence)
    effects.filter.frequency.rampTo(9000 - darkness * 6500 + Math.max(0, valence) * 3000, seconds)
    effects.reverb.wet.rampTo(0.15 + severity * 0.4, seconds)
    effects.grit.wet.rampTo(current.doom ? 0.6 : severity * 0.3, seconds)
    effects.drive.wet.rampTo(current.doom ? 0.35 : severity * 0.12, seconds)
    effects.demon.gain.rampTo(current.doom ? 0.8 : 0, seconds)
}

const isSinging = () => !!vocal && vocal.style === 'sung'

// a voice singing the words only gets to sing them once
const compose = () => composeBar({ bar, phraseBar, mood, melody, melodyCursor, repeat: !isSinging() })

// Called on every beat. The music is only ever written one bar ahead and
// played one beat ahead, so a new phrase is never more than a beat away
const onBeat = time => {
    const transport = Tone.getTransport()

    // if the page froze for a while the clock tries to catch up by playing
    // every beat it missed at once. nobody wants to hear that
    if (time < Tone.now() - 0.3) {
        return
    }

    const isFresh = isNewPhrase
    if (isNewPhrase) {
        isNewPhrase = false
        const fresh = compose()
        // a real change of scene starts a new bar there and then.
        // anything less keeps the groove and just swaps the tune
        if (!composed || fresh.feel !== composed.feel || fresh.mode !== composed.mode || mood.doom || mood.pivot) {
            if (beat > 0) {
                beat = 0
                bar++
            }
        } else if (beat > 0) {
            // the new tune starts on this beat rather than at the top of the bar
            melodyCursor = -beat * 4
            composed = compose()
        }
    }

    if (beat === 0) {
        composed = compose()
        releaseChord(time)
        transport.bpm.setValueAtTime(composed.bpm, time)
        colour(mood)
        const info = { bar, bpm: composed.bpm, mode: composed.mode.name, feel: composed.feel }
        Tone.getDraw().schedule(() => listeners.onBar && listeners.onBar(info), time)
    }

    const sixteenth = 60 / composed.bpm / 4
    const current = beat
    const isHeavy = composed.feel === FEEL_DOOM

    if (isFresh && isSinging()) {
        announce(vocal.onStart, time)
    }
    // a speaker waits for a beat that comes after the last one has finished talking
    if (vocal && vocal.style === 'spoken' && !vocal.isStarted && time >= busyUntil - 0.03) {
        startSpeaking(vocal, time)
    }

    perform(composed.events, current * 4, time, sixteenth)
    Tone.getDraw().schedule(() => listeners.onBeat && listeners.onBeat(current, isHeavy), time)

    // has the singer reached the end of the tune?
    if (isSinging() && !vocal.isEnding) {
        const sungSoFar = melodyCursor + current * 4
        if (sungSoFar + 4 >= vocal.length) {
            const singer = vocal
            singer.isEnding = true
            const end = time + (singer.length - sungSoFar) * sixteenth
            announce(singer.onEnd, end - LEAD)
        }
    }

    if (++beat === 4) {
        beat = 0
        bar++
        phraseBar++
        melodyCursor += SIXTEENTHS
    }
}

// must be called from a click as browsers do not allow uninvited noise
export const startAudio = async (callbacks = {}) => {
    await Tone.start()
    listeners = callbacks
    if (!instruments) {
        build()
        // the drums are samples and the reverb needs to work itself out
        await Promise.all([Tone.loaded(), effects.reverb.ready]).catch(error => {
            console.warn('Some sounds failed to load', error)
        })
    }
    const transport = Tone.getTransport()
    transport.stop()
    transport.cancel()
    transport.position = 0
    silence()
    bar = 0
    beat = 0
    phraseBar = 0
    melodyCursor = 0
    mood = NEUTRAL
    melody = []
    composed = undefined
    isNewPhrase = false
    hush()
    loop = transport.scheduleRepeat(onBeat, '4n')
    transport.start('+0.1')
}

// a new phrase has begun : the next beat will follow it
export const setMood = (nextMood, nextMelody = []) => {
    vocal = null
    mood = nextMood
    melody = nextMelody
    melodyCursor = 0
    phraseBar = 0
    isNewPhrase = true
    instruments && colour(mood, 0.4)
}

// A new phrase sung by a voice : one sound per word, on the notes of the
// melody (see singer.js). The band doubles the tune underneath
//  onStart : the first beat of the phrase is being heard
//  onWord  : this word is being sung
//  onEnd   : the phrase is about to finish, so line up the next one
export const sing = (nextMood, performance, callbacks = {}) => {
    const notes = performance.melody.map(sung => ({
        ...sung,
        layers: sung.layers.map(layer => ({ ...layer, buffer: toBuffer(layer.samples, layer.sampleRate) }))
    }))
    setMood(nextMood, notes)
    vocal = {
        style: 'sung',
        melody: notes,
        length: notes.reduce((sum, sung) => sum + sung.length, 0),
        ...callbacks
    }
}

// A new phrase spoken by a natural voice, retuned word by word.
// The band plays the melody on its own as usual
export const speak = (nextMood, nextMelody, performance, callbacks = {}) => {
    setMood(nextMood, nextMelody)
    vocal = {
        style: 'spoken',
        buffer: toBuffer(performance.samples, performance.sampleRate),
        segments: performance.segments,
        duration: performance.duration,
        ...callbacks
    }
}

// stop the voice mid-word and forget what it was going to say
export const hush = () => {
    vocal = null
    busyUntil = 0
    sounding.slice().forEach(source => source.stop())
}

// something dreadful was just said out loud
export const toll = () => {
    if (!instruments) {
        return
    }
    const now = Tone.now()
    instruments.bell.triggerAttackRelease([note(38), note(44)], 4, now, 0.9)
    instruments.drums.loaded && instruments.drums.triggerAttack(KICK, now, 1)
}

const silence = () => {
    heldChord = []
    ;['pad', 'you', 'them', 'bell'].forEach(name => instruments[name].releaseAll())
    instruments.bass.triggerRelease()
}

export const pauseAudio = () => {
    if (!instruments) {
        return
    }
    Tone.getTransport().pause()
    hush()
    silence()
    // pick the bar up from the top so that the chord comes back
    beat = 0
}

export const resumeAudio = () => {
    instruments && Tone.getTransport().start()
}

export const stopAudio = () => {
    if (!instruments) {
        return
    }
    const transport = Tone.getTransport()
    transport.stop()
    transport.cancel()
    loop = undefined
    hush()
    silence()
}

// stop the band and play the closing chords. resolves when they have rung out
export const playEnding = overall => new Promise(resolve => {
    if (!instruments) {
        return resolve()
    }
    const transport = Tone.getTransport()
    loop !== undefined && transport.clear(loop)
    loop = undefined
    vocal = null
    silence()

    const ending = composeEnding(overall)
    const sixteenth = 60 / ending.bpm / 4
    const isBad = overall.balance < -0.2
    const start = Tone.now() + 0.1
    colour({ valence: Math.max(-1, Math.min(1, overall.balance * 1.6)), severity: isBad ? 0.8 : 0, doom: isBad }, 0.2)
    ending.events.forEach(event => play(event, start + event.at * sixteenth, sixteenth, false))
    const seconds = ending.bars * SIXTEENTHS * sixteenth
    setTimeout(resolve, (seconds + 1.5) * 1000)
})

// 0 to 1 from the volume slider
export const setVolume = volume => {
    const output = Tone.getDestination()
    output.mute = volume <= 0
    if (volume > 0) {
        output.volume.rampTo(Tone.gainToDb(volume * volume), 0.05)
    }
}
