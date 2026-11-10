// eSpeak : the formant synthesiser behind many a screen reader,
// compiled to JavaScript as meSpeak. Buzzy, clear and happy to change pitch

import engineUrl from 'mespeak/src/ESpeak.js?url'
import wrapperUrl from 'mespeak/src/index.js?url'
import config from 'mespeak/src/mespeak_config.json'
import voice from 'mespeak/voices/en/en.json'
import { findSound, detectPitch } from '../pitch'
import { speakable, decodeWav } from './speakable'

const WORDS_PER_MINUTE = 175
// the pitch dial runs from 0 to 99 and doubles the note roughly every 71 steps
const LOWEST_HZ = 63
const STEPS_PER_OCTAVE = 71
// how many semitones our ears may disagree with the dial before we doubt them
const TRUST = 1.5

// the same engine wearing two hats
const CHARACTERS = {
    you: { variant: 'f2', lift: 1.93, range: [47, 62] },
    them: { variant: undefined, lift: 1, range: [36, 51] }
}

const character = who => CHARACTERS[who === 'them' ? 'them' : 'you']

// The engine is five megabytes of machine made code from another era that
// modern build tools refuse to read, so it is fetched and run as it comes
const run = async (url, require) => {
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`Could not fetch eSpeak (${response.status})`)
    }
    const module = { exports: {} }
    new Function('module', 'exports', 'require', await response.text())(module, module.exports, require)
    return module.exports
}

const fetchEngine = async () => {
    const engine = await run(engineUrl)
    return run(wrapperUrl, () => engine)
}

//  load : resolves with the meSpeak module (swapped out by the tests)
export const create = async (load = fetchEngine) => {
    const meSpeak = await load()
    if (!meSpeak.isConfigLoaded()) {
        meSpeak.loadConfig(config)
    }
    meSpeak.loadVoice(voice)

    return {
        style: 'sung',

        range: who => character(who).range,

        render: (text, { hz, speed = 1, who }) => {
            const words = speakable(text)
            if (!words.length) {
                return null
            }
            const { variant, lift } = character(who)
            const dial = wanted => Math.max(0, Math.min(99, Math.round(STEPS_PER_OCTAVE * Math.log2(wanted / (LOWEST_HZ * lift)))))

            const attempt = pitch => {
                let sound
                try {
                    const wav = meSpeak.speak(words, {
                        rawdata: 'array',
                        pitch,
                        variant,
                        speed: Math.max(80, Math.min(450, Math.round(WORDS_PER_MINUTE * speed)))
                    })
                    sound = wav && decodeWav(Uint8Array.from(wav))
                } catch (error) {
                    return null
                }
                if (!sound || !sound.samples.length) {
                    return null
                }
                const { samples, sampleRate } = sound
                const { start, end } = findSound(samples, sampleRate)
                if (end <= start) {
                    return null
                }
                const trimmed = samples.subarray(start, end)
                // it has its own ideas about intonation, so listen to what it actually
                // did. but a word that swoops about has no single note to hear, so if
                // our ears disagree wildly with the dial, believe the dial
                const expected = LOWEST_HZ * lift * Math.pow(2, pitch / STEPS_PER_OCTAVE)
                const heard = detectPitch(trimmed, sampleRate)
                const isBelievable = heard && Math.abs(Math.log2(heard / expected)) < TRUST / 12
                return { samples: trimmed, sampleRate, hz: isBelievable ? heard : expected }
            }

            const pitch = dial(hz)
            const first = attempt(pitch)
            if (!first) {
                return null
            }
            // every word leans sharp or flat in its own way, so if the first
            // go missed, turn the dial by the size of the miss and go again
            const miss = Math.round(STEPS_PER_OCTAVE * Math.log2(hz / first.hz))
            const corrected = Math.max(0, Math.min(99, pitch + miss))
            if (Math.abs(miss) < 3 || corrected === pitch) {
                return first
            }
            const second = attempt(corrected)
            return second && Math.abs(Math.log2(hz / second.hz)) < Math.abs(Math.log2(hz / first.hz)) ? second : first
        }
    }
}
