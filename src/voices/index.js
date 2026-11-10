// The narrators that can be put through the music.
// Unlike the voices built into the browser these hand over the sound itself,
// so it can be tuned, put on the beat and sent through the same effects as
// the band. Each one is only downloaded if somebody asks for it
//
//  sung   : small synthesisers that say one word at a time on any note we like.
//           they sing the melody
//             arrange(phrase, mood, pace) resolves with a performance (see singer.js)
//  spoken : neural voices that say a whole phrase naturally.
//           they are nudged into key, word by word
//             render(text, { speed, who }) resolves with { samples, sampleRate }

import { connect } from './remote'

const singer = id => async onProgress => {
    const worker = new Worker(new URL('./singer.worker.js', import.meta.url), { type: 'module' })
    const ask = await connect(worker, { voice: id }, onProgress)
    return {
        style: 'sung',
        arrange: (phrase, mood, pace) => ask({ type: 'arrange', phrase, mood, pace })
    }
}

const speaker = createWorker => async onProgress => {
    const ask = await connect(createWorker(), {}, onProgress)
    return {
        style: 'spoken',
        render: (text, { speed = 1, who }) => ask({ type: 'render', text, speed, who })
    }
}

export const VOICES = [
    {
        id: 'sam',
        name: 'SAM, the 1982 robot',
        style: 'sung',
        load: singer('sam')
    },
    {
        id: 'espeak',
        name: 'eSpeak, the buzzy synth',
        style: 'sung',
        load: singer('espeak')
    },
    {
        id: 'kokoro',
        name: 'Kokoro, natural (big download)',
        style: 'spoken',
        load: speaker(() => new Worker(new URL('./kokoro.worker.js', import.meta.url), { type: 'module' }))
    },
    {
        id: 'piper',
        name: 'Piper, natural (big download)',
        style: 'spoken',
        load: speaker(() => new Worker(new URL('./piper.worker.js', import.meta.url), { type: 'module' }))
    }
]

const loaded = {}

export const findVoice = id => VOICES.find(voice => voice.id === id)

// resolves with the voice once it is ready to make a noise
export const loadVoice = (id, onProgress) => {
    if (!loaded[id]) {
        loaded[id] = findVoice(id).load(onProgress).catch(error => {
            // let them try again later
            delete loaded[id]
            throw error
        })
    }
    return loaded[id]
}
