// Listening to the voice.
// Pure number crunching on raw samples : finding the note somebody is
// speaking on, and working out how far it is from the note we want

const LOWEST = 60
const HIGHEST = 420
const FRAME = 0.045
const THRESHOLD = 0.2

export const midiToHz = midi => 440 * Math.pow(2, (midi - 69) / 12)
export const hzToMidi = hz => 69 + 12 * Math.log2(hz / 440)

// The pitch of one short slice of sound, or 0 if it has none (a "s" or a "t").
// This is the YIN method : look for the delay at which the wave repeats itself
const detectFrame = (samples, from, size, sampleRate) => {
    const shortest = Math.floor(sampleRate / HIGHEST)
    const longest = Math.min(Math.floor(sampleRate / LOWEST), size >> 1)
    const window = size - longest
    let running = 0
    let best = 0
    let bestValue = Infinity
    let previous = 1

    for (let lag = 1; lag <= longest; ++lag) {
        let difference = 0
        for (let i = 0; i < window; ++i) {
            const delta = samples[from + i] - samples[from + i + lag]
            difference += delta * delta
        }
        running += difference
        const normalised = running ? difference * lag / running : 1
        if (lag >= shortest) {
            // take the first proper dip rather than the deepest,
            // otherwise we end up an octave too low
            if (best && bestValue < THRESHOLD && normalised > previous) {
                break
            }
            if (normalised < bestValue) {
                bestValue = normalised
                best = lag
            }
        }
        previous = normalised
    }
    return best && bestValue < THRESHOLD ? sampleRate / best : 0
}

// The note that a stretch of speech sits on : the middle value of all the
// slices that have a pitch. Returns 0 for whispers, clicks and silence
export const detectPitch = (samples, sampleRate, start = 0, end = samples.length) => {
    const size = Math.floor(FRAME * sampleRate)
    const hop = size >> 1
    const found = []
    for (let from = start; from + size <= end; from += hop) {
        let energy = 0
        for (let i = 0; i < size; i += 4) {
            energy += samples[from + i] * samples[from + i]
        }
        if (energy / (size / 4) < 0.0004) {
            continue
        }
        const hz = detectFrame(samples, from, size, sampleRate)
        hz && found.push(hz)
    }
    if (!found.length) {
        return 0
    }
    found.sort((a, b) => a - b)
    return found[found.length >> 1]
}

// where the sound actually starts and stops
export const findSound = (samples, sampleRate, floor = 0.02) => {
    const margin = Math.floor(sampleRate * 0.004)
    let start = 0
    let end = samples.length
    while (start < end && Math.abs(samples[start]) < floor) {
        start++
    }
    while (end > start && Math.abs(samples[end - 1]) < floor) {
        end--
    }
    return { start: Math.max(0, start - margin), end: Math.min(samples.length, end + margin) }
}

// move a note by whole octaves until it sits inside a comfortable range
export const foldIntoRange = (midi, low, high) => {
    while (midi > high) {
        midi -= 12
    }
    while (midi < low) {
        midi += 12
    }
    return midi
}

// the nearest note of the scale to a pitch. scale is a list of semitone
// steps above the root (in any octave)
export const snapToScale = (hz, root, steps) => {
    const midi = hzToMidi(hz)
    let nearest = midi
    let distance = Infinity
    for (let octave = -5; octave <= 5; ++octave) {
        steps.forEach(step => {
            const candidate = root + octave * 12 + step
            if (Math.abs(candidate - midi) < distance) {
                distance = Math.abs(candidate - midi)
                nearest = candidate
            }
        })
    }
    return nearest
}

// how much faster or slower a sound must be played to land on a note,
// kept within a limit so that nobody turns into a chipmunk
export const tuningRate = (hz, targetMidi, limit = 3) => {
    if (!hz) {
        return 1
    }
    const semitones = Math.max(-limit, Math.min(limit, targetMidi - hzToMidi(hz)))
    return Math.pow(2, semitones / 12)
}
