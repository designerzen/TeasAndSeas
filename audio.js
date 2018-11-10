// import {chord } from "./external/scribbletune/src/chord"
// import { clip } from "./external/scribbletune/src/clip"
// import { session } from "./external/scribbletune/src/session"
// import { scale } from "./external/scribbletune/src/scale"
// import { scales} from "./external/scribbletune/src/scales"
// import { midi } from "./external/scribbletune/src/midi"
// import { mode } from "./external/scribbletune/src/mode"
import { chord, clip, session, scale, scales, midi, mode } from "./external/scribbletune/src"


import Tone from 'tone'

window.Tone = Tone

console.error(clip)

// sessions...
const channels = session()

// create drum track for background...
export const createPercussion = () =>{
    return channels.createChannel({
      sample: "https://scribbletune.com/sounds/kick.wav",
      clips: [
          clip({ pattern: "xxxx", callback:(e)=>{console.log('1--->',e) } }),
          clip({ pattern: "x-x-", callback:(e)=>{console.log('2--->',e) } }),
          clip({ pattern: "-x-x", callback:(e)=>{console.log('3--->',e) } }),
          clip({ pattern: "x_x_", callback:(e)=>{console.log('4--->',e) } })

      ]
    })
}

// we need to be able to flip between clips...
export const createLead = (instrument = "PolySynth") =>{
    return channels.createChannel({
      synth: instrument,
      clips: [
          // SAD
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
        // HAPPY
        { 
            pattern: "xxx[-x]", 
            notes: 'C1 D#4' 
        }
      ]
    })
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

export const startAudio = ( row=1, bpm=90, callback ) =>{
    channels.startRow(row)

    Tone.Transport.bpm.value = bpm
    Tone.Transport.start()

    Tone.Transport.scheduleRepeat( (time)=> {
        //do something with the time
        
        callback(time);

    }, "8n");

}

export const changeRow = (row=1) =>{
    channels.startRow(row)
}