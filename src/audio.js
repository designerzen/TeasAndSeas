import { shuffleArray } from "./utils";
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
export const convertScaleToChord = (scale, filler=undefined, random=false)=>{
   
    filler = filler || ''
    //const collection = chord()
    // CM-5
    
    // Then make chords of the others using the filler...
    // Split after letters
    //let output = ''
    const key = /[0-9]/
    const output = []

    // drop first one as it is *always* going to be the C4?
    // loop through scales from index 1
    for (let i = 1, q = scale.length; i <q; ++i)
    {
        const note = scale[i]
        const isSharp = note.indexOf("#") > -1
       
        if (isSharp)
        {
            output.push(note)

        }else{

            // Turn into a chord!
            const parts = note.match(key)
            
            const numericalIndex = parts.index
            
            const wordPart = note.substring(0,numericalIndex)
            const numberPart = note.substring(numericalIndex)

            // console.log({
            //   parts,
            //   wordPart,
            //   numberPart,numericalIndex
            // });

            output.push( wordPart + filler + numberPart )
        }
    }

    // if randomise...
    if (random)
    {
        shuffleArray(output)
    }

    return output.join(" ")
}

///////////////////////////////////////////////////////////////////////////
// Save MIDI!
///////////////////////////////////////////////////////////////////////////
export const saveMidi = (notes="c4",pattern="x") =>{
    const data = clip({
        notes,
        pattern
    })
    const bytes = midi(data, null)
    // Encode byte string from Scribbletune as base64
    const b64 = btoa(midi(data, bytes))
    return b64
}

///////////////////////////////////////////////////////////////////////////
//
// Word from pattern
// As there are potentially sixteen beats in a bar (ignoring semi stuff)
// we can use the length of the word to determine the pattern of play
///////////////////////////////////////////////////////////////////////////
export const determinePatternFromWord = (word,score=0) =>{

    const {length} = word
    const letters = word.split('')

    /*
    // if it is too long make it go like a machine gun!
    if (length>16)
    {
        return "x-x-".repeat(4)
    } 

    // short like : the of an I we as am and are get etc
    if (length < 4)
    {
        return "x___x__-".repeat(2)
        // return "x___-".repeat(4)
    }*/
   
    // loop through the letters of the word to determine the pattern
    let isNotePlaying = false
    const pattern = letters.map( (letter, index)=>{

        const position = index%16
        letter = letter.toLowerCase()

        // is this letter a vowel?
        // vowels we use as bridges and sustain the note
        // they are the glue that binds words together
        const isVowel = (letter === 'a' || letter === 'e' || letter === 'o' || letter === 'u')
        
        /*
        // always start the sixteen on a downbeat
        // (this just makes the following easier)
        if (index === 0)
        {
            isNotePlaying = true
            return "x"
        }
*/
        // return a sustain of the previous note
        if (isNotePlaying && isVowel)
        {
          return "_";
        }

        // hit it if it's a constonant
        // if it is in a sad pattern
        if (score > 0) 
        {

            // HAPPY WORD!
            // convert vowels into gaps!
            //console.log("word sentiment is happy!", score)
            isNotePlaying = true
            return "x"
        } 
        // else if (score < 0) {
          
        //     // BAD WORD
        //     //console.log("word sentiment is sour!", score)
        //     //return 'x-'.repeat(word.length)
        //     return "x"
        // }

        // NEUTRAL - whitespace
        // get as much of this as you can!
        //console.log("word sentiment is neutral", score)
        //return "x---x---x---x---"
        // else stop it!
        isNotePlaying = false
        return "-"
    })
    return pattern.join('')
}

///////////////////////////////////////////////////////////////////////////
//
// feed this a sentiment and it will give you a chord from the current
// scale that in some way represents that emotion  
//
///////////////////////////////////////////////////////////////////////////
export  const determineNotesFromSentiment = (score, scale) => {

    if (score > 0) 
    {
        // HAPPY WORD!
        //console.log("word sentiment is happy!", score)
        return convertScaleToChord(scale, "M-")

    } else if (score === 0) {

        // NEUTRAL
        //console.log("word sentiment is neutral", score)
        return convertScaleToChord(scale)

    } else {

        // BAD WORD
        //console.log("word sentiment is sour!", score)
        return convertScaleToChord(scale, "m-")
    }
}



export const startAudio = (row = 1, bpm = 90, volume=1, callback, signature="8n" ) =>{

    channels.startRow(row)

    setBPM(bpm)
    setVolume(volume)

    Tone.Transport.scheduleRepeat( (time)=> {

        //do something with the time
        callback(time)

    }, signature)

    // immediately call the callback...
    callback(0)

    Tone.Transport.start()
    setVolume(volume)
}

export const setVolume = (volume) =>{
    Tone.Master.volume.value = volume
    console.log("Setting volume to", volume, "dB ->", Tone.Master.volume.value)
}

export const setBPM = (bpm) =>{
    Tone.Transport.bpm.value = bpm
}

export const changeRow = (row=1) =>{
    channels.startRow(row)
}