// The small synthesisers live in here. Each word is said two or three times
// before it fits its note, which is quick, but not quick enough to do in
// front of an audience

import { arrangeSung } from '../singer'

const VOICES = {
    sam: async () => (await import('./sam')).create(),
    espeak: async () => (await import('./espeak')).create()
}

let voice

self.onmessage = async ({ data }) => {
    try {
        if (data.type === 'load') {
            voice = await VOICES[data.voice]()
            return self.postMessage({ type: 'ready' })
        }
        const result = arrangeSung(voice, data.phrase, data.mood, data.pace)
        // hand the sounds over rather than copying them
        const sounds = []
        result.melody.forEach(note => note.layers.forEach(layer => {
            layer.samples = layer.samples.slice()
            sounds.push(layer.samples.buffer)
        }))
        self.postMessage({ type: 'done', id: data.id, result }, sounds)
    } catch (error) {
        self.postMessage({ type: 'error', id: data.id, message: error.message || String(error) })
    }
}
