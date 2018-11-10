// import {chord } from "./external/scribbletune/src/chord"
// import { clip } from "./external/scribbletune/src/clip"
// import { session } from "./external/scribbletune/src/session"
// import { scale } from "./external/scribbletune/src/scale"
// import { scales} from "./external/scribbletune/src/scales"
// import { midi } from "./external/scribbletune/src/midi"
// import { mode } from "./external/scribbletune/src/mode"
import { chord, clip, session, scale, scales, midi, mode } from "./external/scribbletune/src"

export const SYNTH_AM = "AMSynth"
export const SYNTH_FM = "FMSynth"
export const SYNTH_MONO = "MonoSynth"
export const SYNTH_GENERIC = "Synth"
 
import Tone from 'tone'

window.Tone = Tone

// sessions...
const channels = session()

// create drum track for background...
export const createKicks = () =>{
    return channels.createChannel({
      sample: "https://scribbletune.com/sounds/snare.wav",
      clips: [
          { pattern: "x-x-" },
          { pattern: "x[xx]x" },
          { pattern: "x-x-x-x" },
          { pattern: "x_x_x_x" }
      ]
    })
}
export const createSnares = () =>{
    return channels.createChannel({
      sample: "https://scribbletune.com/sounds/kick.wav",
      clips: [
        { pattern: "___x" },
        { pattern: "-x-x" },
        { pattern: "x-x-" },
        { pattern: "_x_x" }
      ]
    });
}

// we need to be able to flip between clips...
export const createLead = (instrument = "PolySynth", clips=[] ) =>{
    return channels.createChannel({
      synth: instrument,
      clips
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

export const startAudio = ( row=1, bpm=90, callback, signature="8n" ) =>{

    channels.startRow(row)

    Tone.Transport.bpm.value = bpm
    Tone.Transport.start()

    Tone.Transport.scheduleRepeat( (time)=> {

        //do something with the time
        callback(time)

    }, signature)
}

export const changeRow = (row=1) =>{
    channels.startRow(row)
}