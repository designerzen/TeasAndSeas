// import {chord } from "./external/scribbletune/src/chord"
// import { clip } from "./external/scribbletune/src/clip"
// import { session } from "./external/scribbletune/src/session"
// import { scale } from "./external/scribbletune/src/scale"
// import { scales} from "./external/scribbletune/src/scales"
// import { midi } from "./external/scribbletune/src/midi"
// import { mode } from "./external/scribbletune/src/mode"
import { chord, clip, session, scale, scales, midi, mode } from "./external/scribbletune/src"
import snareFile from "./assets/snare.wav"
import kickFile from "./assets/kick.wav"
// PolySynth
// PluckSynth
// NoiseSynth *
// MetalSynth *
// MembraneSynth
// AMSynth - Good one!
// FMSynth - Great one!
// MonoSynth - Good one!
// Synth - Good for bass
export const SYNTH_AM = "AMSynth"
export const SYNTH_FM = "FMSynth"
export const SYNTH_MONO = "MonoSynth"
export const SYNTH_GENERIC = "Synth"

const piano = {
    'C3': 'https://scribbletune.com/sounds/piano/piano48.wav',
    'C#3': 'https://scribbletune.com/sounds/piano/piano49.wav',
    'D3': 'https://scribbletune.com/sounds/piano/piano50.wav',
    'D#3': 'https://scribbletune.com/sounds/piano/piano51.wav',
    'E3': 'https://scribbletune.com/sounds/piano/piano52.wav',
    'F3': 'https://scribbletune.com/sounds/piano/piano53.wav',
    'F#3': 'https://scribbletune.com/sounds/piano/piano54.wav',
    'G3': 'https://scribbletune.com/sounds/piano/piano55.wav',
    'G#3': 'https://scribbletune.com/sounds/piano/piano56.wav',
    'A4': 'https://scribbletune.com/sounds/piano/piano57.wav',
    'A#4': 'https://scribbletune.com/sounds/piano/piano58.wav',
    'B4': 'https://scribbletune.com/sounds/piano/piano59.wav',
    'C4': 'https://scribbletune.com/sounds/piano/piano60.wav'
};
// sessions...
const channels = session()

// create drum track for background...
export const createKicks = () =>{
    return channels.createChannel({
        sample: kickFile,
        clips: [
            // SAD
            { pattern: "[xxxx][xxxx][xxxx][xxxx]" },
            { pattern: "[xxxx][xx][xxxx][xx]" },
            { pattern: "[xxxx][xx][xxxx][xx]" },
          { pattern: "xxxx" }
          // HAPPY
      ]
    })
}
export const createSnares = () =>{
    return channels.createChannel({
    sample: snareFile,
      clips: [
          // SAD
        { pattern: "xxxx" },
        { pattern: "x_x_" },
          { pattern: "_x_x" },
        { pattern: "[xxxx]" }
        // HAPPY
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
// we need to be able to flip between clips...
export const createPiano = ( clips=[] ) =>{
    return channels.createChannel({
        samples: piano,
      clips
    })
}
  
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
            //console.log(scale)
            notesInScales[scaleName] = scale
        }catch(error){
            console.error(error)
        }
        
    })

    return notesInScales
}

// Give it a scale full of notes... return some chords in
// that scale!
export const convertScaleToChord = (scale, filler='')=>{
    // CM-5
    //const collection = chord()
    // drop first one as it is *always* going to be the C4
    // Then make chords of the others using the filler...
    // Split after letters
    let output = ''
    const key = /[0-9]/
    // loop through scales from index 1
    for (let i = 1, q = scale.length; i <q; ++i)
    {
        const note = scale[i]
        const isSharp = note.indexOf("#") > -1
       
        if (isSharp)
        {
            output += note

        }else{

            // Turn into a chord!
            const parts = note.match(key)
            
            const numericalIndex = parts.index
            
            const wordPart = note.substring(0,numericalIndex)
            const numberPart = note.substring(numericalIndex)

            console.log({
              parts,
              wordPart,
              numberPart,numericalIndex
            });

            output += wordPart + filler + numberPart

        }

        if (i < q-1)
        {
           // const numberPart = 
            output += " "
        }
    }
    return output
    //return scale.slice(1,-1).join(" ")
}

export const saveMidi = (text) =>{
    
    const clip = clip({
        notes: scale('c4 major'),
        pattern: 'x'.repeat(8)
    })

    midi(clip)
}

export const createClip = (sentiment, instrument ="Synth") =>{

    
    return clip({
      synth: instrument,
      pattern: "-x",
      notes: "C4 D4 C4 D#4 C4 D4 C4 Bb3"
      //   notes: scale("c4 major"),
      //   pattern: "x".repeat(8)
    })
}

export const startAudio = (row = 1, bpm = 90, volume=1, callback, signature="8n" ) =>{

    channels.startRow(row)

    Tone.Transport.bpm.value = bpm
    Tone.Master.volume.value = volume
    Tone.Transport.start()

    Tone.Transport.scheduleRepeat( (time)=> {

        //do something with the time
        callback(time)

    }, signature)
}

export const changeRow = (row=1) =>{
    channels.startRow(row)
}