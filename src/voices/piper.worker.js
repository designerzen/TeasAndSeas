// Piper runs in here, away from the page, so that working out how
// to say something never makes the band miss a beat

import * as tts from '@diffusionstudio/vits-web'
import { decodeWav } from './speakable'

// two narrators : one for each side of the contract
const NARRATORS = { you: 'en_GB-jenny_dioco-medium', them: 'en_GB-alan-medium' }

const fetched = {}

// each narrator is a separate download, kept by the browser for next time
const fetchNarrator = async (voiceId, share, offset) => {
    if (!fetched[voiceId]) {
        fetched[voiceId] = tts.download(voiceId, report => {
            report.total && self.postMessage({ type: 'progress', progress: offset + report.loaded / report.total * share })
        })
    }
    return fetched[voiceId]
}

self.onmessage = async ({ data }) => {
    try {
        if (data.type === 'load') {
            await fetchNarrator(NARRATORS.you, 0.5, 0)
            await fetchNarrator(NARRATORS.them, 0.5, 0.5)
            return self.postMessage({ type: 'ready' })
        }
        const voiceId = NARRATORS[data.who === 'them' ? 'them' : 'you']
        const wav = await tts.predict({ text: data.text, voiceId })
        const { samples, sampleRate } = decodeWav(new Uint8Array(await wav.arrayBuffer()))
        self.postMessage({ type: 'done', id: data.id, result: { samples, sampleRate } }, [samples.buffer])
    } catch (error) {
        self.postMessage({ type: 'error', id: data.id, message: error.message || String(error) })
    }
}
