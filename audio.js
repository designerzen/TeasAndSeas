import { chord, clip, session, scale, scales, midi, mode } from "scribbletune";
// import Tone from 'tone'

// console.error(clip)

// sessions...
const channels = session()

// create drum track for background...
export const createPercussion = () =>{
    channels.createChannel({
      sample: "https://scribbletune.com/sounds/kick.wav",
      clips: [
        { pattern: "x" },
        { pattern: "xxx[xx]" },
        { pattern: "x" },
        { pattern: "xxx[-x]" }
      ]
    })
}

// we need to be able to flip between clips...
export const createLead = (instrument = "PolySynth") =>{
    channels.createChannel({
      synth: instrument,
      clips: [
        { 
            pattern: "x", 
            notes: 'C4 D#4'
        },
        { 
            pattern: "xxx[xx]", 
            notes: 'C2 D#4' 
        },
        { 
            pattern: "x", 
            notes: 'C3 D#4' 
        },
        { 
            pattern: "xxx[-x]", 
            notes: 'C1 D#4' 
        }
      ]
    });
}
    

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

    const note = "c4 "
    const notesInScales = {}
    allScales.forEach( scaleName => {
        try{
            const scale = mode(note + scaleName)
            console.log(scale)
            notesInScales[scaleName] = scale
        }catch(error){
            console.error(error)
        }
        
    })

    return notesInScales
}
export const fetchScales = (note = "c4") =>{
    // Pass in a Float, get out a sound?
    const allScales = scales()
    console.table(allScales)

    const notesInScales = {}
    allScales.forEach( scaleName => {
        try{
            const scale = mode(`${note} ${scaleName}`)
            console.log(scale)
            notesInScales[scaleName] = scale
        }catch(error){
            console.error(error)
        }
        
    })

    return notesInScales
    
}

export const saveMidi = (text) =>{
    
    const clip = clip({
        notes: scale('c4 major'),
        pattern: 'x'.repeat(8)
    })

    midi(clip)
}

export const createClip = (sentiment, instrument ="Synth") =>{

    // PolySynth
    // PluckSynth
    // NoiseSynth *
    // MetalSynth *
    // MembraneSynth
    // AMSynth - Good one!
    // FMSynth - Great one!
    // MonoSynth - Good one!
    // Synth - Good for bass
    return clip({
      synth: instrument,
      pattern: "-x",
      notes: "C4 D4 C4 D#4 C4 D4 C4 Bb3"
      //   notes: scale("c4 major"),
      //   pattern: "x".repeat(8)
    })
}

export const startAudio = () =>{
    channels.startRow(1)
    Tone.Transport.start()
}