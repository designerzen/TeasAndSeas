// Kokoro runs in here, away from the page, so that working out how
// to say something never makes the band miss a beat

import { KokoroTTS } from 'kokoro-js'

const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX'

// two narrators : one for each side of the contract
const NARRATORS = { you: 'bf_emma', them: 'bm_george' }

let tts

const hasGraphicsCard = async () => {
    try {
        return !!navigator.gpu && !!(await navigator.gpu.requestAdapter())
    } catch (error) {
        return false
    }
}

const load = async () => {
    // the model arrives in several files, so add them all up
    const files = {}
    const progress_callback = report => {
        if (report.status !== 'progress' || !report.total) {
            return
        }
        files[report.file] = report
        const all = Object.values(files)
        const loaded = all.reduce((sum, file) => sum + file.loaded, 0)
        const total = all.reduce((sum, file) => sum + file.total, 0)
        self.postMessage({ type: 'progress', progress: loaded / total })
    }

    // With a graphics card this talks faster than it can be listened to.
    // Without one it falls back to a smaller version of the model that
    // takes several times longer to say a phrase than the phrase lasts, so
    // the band has to vamp between phrases while it catches up
    if (await hasGraphicsCard()) {
        try {
            tts = await KokoroTTS.from_pretrained(MODEL, { dtype: 'fp32', device: 'webgpu', progress_callback })
            return
        } catch (error) {
            console.warn('Kokoro could not use the graphics card', error)
        }
    }
    tts = await KokoroTTS.from_pretrained(MODEL, { dtype: 'q8', device: 'wasm', progress_callback })
}

self.onmessage = async ({ data }) => {
    try {
        if (data.type === 'load') {
            await load()
            return self.postMessage({ type: 'ready' })
        }
        const audio = await tts.generate(data.text, {
            voice: NARRATORS[data.who === 'them' ? 'them' : 'you'],
            speed: data.speed || 1
        })
        const samples = audio.audio
        self.postMessage({ type: 'done', id: data.id, result: { samples, sampleRate: audio.sampling_rate } }, [samples.buffer])
    } catch (error) {
        self.postMessage({ type: 'error', id: data.id, message: error.message || String(error) })
    }
}
