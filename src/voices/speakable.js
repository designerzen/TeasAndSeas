// the old synthesisers fall over when given brackets, curly quotes and
// the like, so only hand them what they can pronounce
export const speakable = text => text
    .replace(/[’‘]/g, "'")
    .replace(/&/g, ' and ')
    .replace(/[^A-Za-z0-9' ]+/g, ' ')
    .replace(/(^| )'+|'+( |$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

// reads the samples out of a WAV file
export const decodeWav = bytes => {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const channels = view.getUint16(22, true)
    const sampleRate = view.getUint32(24, true)
    const format = view.getUint16(20, true)
    const bits = view.getUint16(34, true)

    // skip any chunks that are not the sound itself
    let offset = 12
    while (offset + 8 <= view.byteLength && view.getUint32(offset, false) !== 0x64617461) {
        offset += 8 + view.getUint32(offset + 4, true)
    }
    if (offset + 8 > view.byteLength) {
        throw new Error('That is not a sound file')
    }
    const start = offset + 8
    const bytesPerSample = bits / 8
    const quantity = Math.floor(Math.min(view.getUint32(offset + 4, true), view.byteLength - start) / bytesPerSample / channels)
    const samples = new Float32Array(quantity)
    for (let i = 0; i < quantity; ++i) {
        // only the first channel - nobody speaks in stereo
        const at = start + i * bytesPerSample * channels
        samples[i] = format === 3 ? view.getFloat32(at, true)
            : bits === 16 ? view.getInt16(at, true) / 32768
            : bits === 32 ? view.getInt32(at, true) / 2147483648
            : (view.getUint8(at) - 128) / 128
    }
    return { samples, sampleRate }
}
