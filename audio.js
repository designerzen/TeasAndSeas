import { clip, scale, scales, midi } from "scribbletune"

// This simply takes some text and returns some music!
// export const convertTextToSound = (text, ) =>{

//     clip({ 
//         synth: "Synth", 
//         notes: "c4", 
//         pattern: "x" 
//     }).start()

//     Tone.Transport.start()
// }


export const convertSentimentToSound = (sentiment) =>{
    // Pass in a Float, get out a sound?

}

// This simply creates an entire track of music that is either
// + sentiment = happy music
// 0 sentiment = neutral sounds
// - sentiment = sad sounds
export const generateSentimentSong = (sentiment) =>{
    // Pass in a Float, get out a sound?
    const allScales = scales()
    console.table(allScales)
}

export const saveMidi = (text) =>{
    
    const clip = clip({
        notes: scale('c4 major'),
        pattern: 'x'.repeat(8)
    })

    midi(clip)
}