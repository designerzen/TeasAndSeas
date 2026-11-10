// SAM : Software Automatic Mouth, the talking computer of 1982.
// A few kilobytes of formant synthesis with a pitch dial, which is all
// that is needed to make it sing

import SamJs from 'sam-js'
import { findSound } from '../pitch'
import { speakable } from './speakable'

const SAMPLE_RATE = 22050
// the pitch dial counts the length of the wave, so bigger numbers are lower notes
const PITCH_CONSTANT = 6790
const SPEED = 66

// two characters from the original manual
const CHARACTERS = {
    you: { throat: 110, mouth: 160, range: [46, 60] },
    them: { throat: 128, mouth: 128, range: [36, 50] }
}

const character = who => CHARACTERS[who === 'them' ? 'them' : 'you']

export const create = async () => ({
    style: 'sung',

    // the notes that this character can comfortably reach
    range: who => character(who).range,

    //  hz    : the note to sing
    //  speed : 1 is its natural pace, 2 is twice as fast
    render: (text, { hz, speed = 1, who }) => {
        const words = speakable(text)
        if (!words.length) {
            return null
        }
        const { throat, mouth } = character(who)
        const pitch = Math.max(20, Math.min(110, Math.round(PITCH_CONSTANT / hz)))
        let samples
        try {
            samples = new SamJs({
                pitch,
                throat,
                mouth,
                speed: Math.max(30, Math.min(160, Math.round(SPEED / speed))),
                // without this it adds its own idea of a tune
                singmode: true
            }).buf32(words)
        } catch (error) {
            return null
        }
        if (!samples || !samples.length) {
            return null
        }
        const { start, end } = findSound(samples, SAMPLE_RATE)
        if (end <= start) {
            return null
        }
        return {
            samples: samples.subarray(start, end),
            sampleRate: SAMPLE_RATE,
            // the dial only has whole numbers, so say which note actually came out
            hz: PITCH_CONSTANT / pitch
        }
    }
})
