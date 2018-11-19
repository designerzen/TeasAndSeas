import { readFile } from './read-file'
import { uploadFile } from './upload-file'
import { analyse } from './sentiment-analyser'
import { elements } from './elements'

// import {convertTextToSound } from './audio'
import {
  SYNTH_AM,
  SYNTH_FM,
  SYNTH_MONO,
  SYNTH_GENERIC,
determineNotesFromSentiment,
    determinePatternFromWord,
  generateSentimentSong,
  fetchScales,
  startAudio,
  createClip,
  createPiano,
  createLead,
  createKicks,
  createSnares,
  convertScaleToChord,
  changeRow,
    saveMidi,
  setVolume,
  setBPM
} from "./audio";

import { say, stopSpeaking, isVoiceActive } from "./speech"

import { showElement, hideElement } from './utils'

// Settings
const BPM = 72
const STEPS = 4
const SPEECH_VOLUME = 1
// In decibels!
const audioVolume = -140

// holder of data
let text = ''

let words = []
let sentences = []
let wordSentiments = []
let overallSentiment

// flags
let isSpeaking = false

// counters
let progress = 0
let bar = 0
let word = 0
let sentence = 0
let smoothSentiment = 0

// musical bits
let lead
let kicks
let snares
let piano
let clips
let scales = []

const scaleC2 = fetchScales("c2")
const scaleG1 = fetchScales("g1")
const scaleD2 = fetchScales("d2")




// Set the status of the indicator
const setStatus = status =>{

    elements.busy.innerHTML =status
    showElement(elements.busy)
}

// For local file not preloaded...
const load = (file) =>{
    return readFile(file)
}

// Creates a MIDI file in memory then adds it to the DOM
// to allow the user to download the song as a MIDI file
// to play on their syhtns at home
const download = () =>{
    // send over the clips!?
    const midi = saveMidi(clips);
    console.log({midi})

    const uri = 'data:audio/midi;base64,' + midi
    const link = document.createElement('a')
    link.href = uri;
    link.download = 'music.mid'
    link.click(); // this will start a download of the MIDI byte string as a file called "music.mid"
}

const present = () =>{
    // we hide the selections and show the presentations
    showElement(elements.ticker)
    showElement(elements.words)
    hideElement(elements.presets)
}

// EVENT: 
const onAnalysisProgress = (progress, sentence, result) => {

    const percent = Math.ceil(progress * 100)
    setStatus(`${percent}% Analysing sentence ${sentences.length} length and ${result.score} score.`);
    console.log("Analysing sentence", { progress, sentence, result})
    // set the progress bar too?
    elements.progress.setAttribute('value', percent)
}

const REGEX_SENTENCES = new RegExp( "(S.+?[.!?])(?=s+|$)" )
// This is the first part of the AI application
// We take in a text file from memory then do our
// magic
const prepare = () =>{

    // console.log("Reading contract :", { text })
    
    // overall sentiment score
    let overall = 0
    
    // first split text by sentence...
    sentences = text.split(REGEX_SENTENCES)
    // sentences = text.split(/[.|,]/)
    words = text.split(" ")

    setStatus(`Reading contract containing approx ${sentences.length} sentences and ${words.length} words.`)

    // a few steps...
    // 1. We analyse the entire work and cache the sentiment
    //    this will be used to choose which key the music is in
    return analyse([text], onAnalysisProgress )
        .then(analysis => {

            overallSentiment = analysis[0]

            // this is the overall feeling of this text
            overall = overallSentiment.score

            // we clamp it to find which scale should be used
            // positive numbers give happy scales
            // negative numbers give negative scales
            // so first we create our 
            if (overall > 0) {

                // HAPPY CONTRACT OVERALL! - overall lighter tones
                const c4 = fetchScales("c4")
                const a4 = fetchScales("a4")
                console.log("Overall sentiment is happy!", overall)
                
                setStatus(`Overall contract sentiment is positive (${sentences.length} sentences, ${words.length} words).` )

                scales.push(c4["augmented"], a4["augmented"])

            } else if (overall === 0) {

                // NEUTRAL - overall MOR
                const c3 = fetchScales("c3")
                console.log("Overall sentiment is neutral", overall)
                setStatus( `Overall contract sentiment is neutral (${sentences.length} sentences, ${words.length} words).` )

                scales.push(c3["augmented"])

            } else {

                // BAD CONTRACT - overall deeper tones 
                const g1 = fetchScales("g1")
                const d2 = fetchScales("d2")

                console.log("Overall sentiment is sour!", overall)
                
                setStatus( `Overall contract sentiment is ${overall} negative (${sentences.length} sentences, ${words.length} words).`)

                scales.push(g1["major blues"], g1["minor blues"], d2["major blues"], d2["minor blues"])
            }

            console.log("General Review", { overallSentiment, scales })

            return analyse(words, onAnalysisProgress)

            // 2. Now we analyse all individual words to determine our melody
            //    extra consideration is taken for length of word with percussion
            //    whereby long words make faster harsher beats
        }).then(analysedText => {

            // This is an array of sentiments...
            // that relate one-to-one to the sentences
            wordSentiments = analysedText
            clips = wordSentiments.map((wordSentiment, index) => {

                const word = words[index]
                const score = wordSentiment.score
                const scale = scales[index % scales.length]
                const clip = {
                    // feed this 
                    pattern: determinePatternFromWord(word, score),
                    // feed this a sentiment and it will give you a chord from the current scale
                    notes: determineNotesFromSentiment(score, scale)
                }
                
                return clip
            })

            console.log(clips)

           
            // Create our instruments and their tracks
            kicks = createKicks()
            snares = createSnares()
            //piano = createPiano(clips)

            lead = createLead(
                SYNTH_FM,
                clips
            )

            // now display the GO button...
            showElement( elements.goButton)
            setStatus(`Contract sentiment established (${overall} overall score, ${sentences.length} sentences, ${words.length} words).`)
                
            // Song generation complete!
            console.log("Audio READY!", { lead, kicks, clips });
        })

}


// Now run this!
const run = () => {

    console.log("Beginning Pop Video")

    // now trigger certain parts...
    //lead.startRow(1)
    //console.log(lead)

    // show the words div
    showElement(elements.words)

    // sometimes a speech cannot complete within one bar
    // so we store this live
    let speakBarCount = 0
    // we also have a rolling total
    let skippedBeat = 0

    const quantityOfWords = words.length
    // as we have the overall sentiment already, we can set the tempo
    // according to the overall score where faster than 120 is negative
    // and < 90 is positive just because it is mosre interesting that way
    // the slow nice melodies should be more passive and enjoyable anyways
    const tempo = BPM + overallSentiment.score

    // LOOP - This happens every bar
    startAudio(1, tempo, audioVolume, time => {

        const beat = bar%16
        const tock = beat % 2 === 0
        const ending = word === quantityOfWords - 1
        
        if (ending) {

            // no words left so reset all for next bar!
            word = 0
            bar = 0
            sentence = 0

        } else {

            const currentWord = words[word].replace(/[\,|\.|\(|\)|“|”]/, "")
            const currentWordLength = currentWord.length


            const currentSentence = sentences[sentence]
            //const currentSentiment = sentiments[sentence]
            const currentSentiment = wordSentiments[word]
            const score = currentSentiment ? currentSentiment.score : 0

            // general feeling...
            const happy = score > 0
            const unhappy = score < 0

            // absolute feeling...
            const veryHappy = score > 1
            const veryUnhappy = score < -1

            // smoothing
            smoothSentiment += score > 0 ? 1 : -1

            // if (sentiment === happy)
            // {
            //     changeRow(0)
            // }else if (sentiment === sad)
            // {
            //     changeRow(4)
            // }

            // to change sentiment...
            // const step = smoothSentiment < 0 ? 0 : smoothSentiment > 3 ? 3 : smoothSentiment
            // changeRow(smoothSentiment)

            // update the sentiment obect...
            //elements.data.innerHTML = JSON.stringify( currentSentiment )
            elements.data.innerHTML = currentSentiment.score + " -> " + smoothSentiment
            elements.ticker.innerHTML = currentWord
            // elements.ticker.innerHTML = currentSentence

            const classes = ["beat-" + bar, tock ? 'tock' : 'tick']
            let pitch = 1

            if (veryHappy) {
                classes.push("happy")
                pitch = 2
            }

            if (veryUnhappy) {
                classes.push("unhappy")
                pitch = 0
            }

            const lowerCased = currentWord.toLowerCase()

            // extra special modes!
            switch (lowerCased)
            {
                case "exploited":
                case "waive":
                    classes.push("fuck-you")
                    break
            }

            elements.ticker.className = classes.join(" ");

            // lower bound 2 higher bound 9
            const rate = currentWordLength < 4 ? 4 : currentWordLength > 9 ? 9 : currentWordLength
            //console.log("speech", { rate, pitch, SPEECH_VOLUME }, currentWord);

            // if we always want to ensure that the words line up with the music,
            // we must ensure that each phrase completes in 1 bar!
            // that means clearing things...
            if (isVoiceActive())
            {
                console.log("interupting speech")
            }   

            // first hit,                    
            if (beat === 0 )
            {

            }

            const SHORT_WORD_LENGTH = 5
            if (currentWord.length < SHORT_WORD_LENGTH && word < quantityOfWords )
            {
                 // check to see if we are behind...
                if (speakBarCount > 0)
                {
                    // sentiments[word]
                    const nextWord = words[word]
                    const nextWordLength = nextWord.length;

                    // if the current word and the next word are both short...
                    if (nextWordLength < SHORT_WORD_LENGTH)
                    {
                        // consolodate both!#
                        currentWord = currentWord + " " + nextWord

                        // speed up to fastest rate
                        rate = 9

                        // and ensure we don't repeat the next word either...
                        word++
                        sentence++
                    }
                }
            }

            // only speak the next phrase if the last one has finished
            if (!isSpeaking) 
            {
                console.log("speech", { time, score, rate, pitch, SPEECH_VOLUME }, currentWord);
                say(currentWord, false, SPEECH_VOLUME, rate, pitch).then(
                    p => {
                        // increment list items
                        word++
                        sentence++
                        speakBarCount = 1
                        isSpeaking = false
                        console.log("speech complete", currentWord)
                    }
                ).catch(error => {
                    console.log("speech failed", { error }, currentWord)
                    // increment list items
                    word++
                    sentence++
                    isSpeaking = false
                })

                isSpeaking = true

            }else{

                // Speaking has not occured for X times...
                speakBarCount++

                if (speakBarCount > 0)
                {
                    // probably safe to say that this utterance failed
                    // to send back it's callback of completition
                    isSpeaking = false
                    speakBarCount = 0
                    skippedBeat++

                    // this will resolve the previous promise!
                    stopSpeaking()
                }
            }
            bar++
        }
        

    })

    elements.words.classList.add("playing")
}


// This analysises the text, creates all of the required
// sentiment data then kicks off the playback
const begin = () => {
    prepare().then(p => run())
}

// Create interactions ============================
export const init = (file)=>{

    hideElement(elements.words)

    // This is the UL of presets in LI -> A
    const presets = elements.presets.querySelectorAll("A") 
  
    // Load a preset from vthe file system....
    presets.forEach(preset=>{

        /////////////////////////////////////////////////////////////////////////////////////
        // EVENT : Download button 
        // as these are hrefs we need to intercept click to prevent
        // the default behaviour of showing that text
        /////////////////////////////////////////////////////////////////////////////////////
        preset.addEventListener('click', (event,some) => {
            const {target} = event

            target.attributes

            console.log(event, target)

            readFile(target.href).then( d =>{
                text = d 
                console.log(text)
                present()
                prepare()
            })

            event.preventDefault()
        })

    })

    /////////////////////////////////////////////////////////////////////////////////////
    // EVENT : Upload button 
    // Upload custom contract as TXT file
    /////////////////////////////////////////////////////////////////////////////////////
    elements.uploadField.addEventListener('change', event => {
        console.log("Uploading custom contract", event)
        const file = elements.uploadField.files[0]
        // test if it is text...
        if (file.type.match(/text.*/)) {
            console.log("Uploading...", file);
            // fetch the url from the input field...
            uploadFile(file).then( uploadedText=>{

                // start with this text!
                text = uploadedText
                console.log("Uploaded.", text);
               
                //run(text)
                present()
                prepare()
            })
        }
    })

    // elements.uploadButton.addEventListener('mousedown', event => {
    //     // fetch the url from the input field...
    //     uploadFile(elements.uploadField.files[0]).then(text => {
    //         console.log("Uploaded.", text);
    //         // start with this text!
    //         //run(text)
    //         present()
    //     })
    // })


    /////////////////////////////////////////////////////////////////////////////////////
    // EVENT : Download button 
    // Start button (requires a text to already be loaded)
    // and for the sentiment to be available
    /////////////////////////////////////////////////////////////////////////////////////
    elements.goButton.addEventListener("mousedown", event => {

        // hide button?
        hideElement(elements.goButton)
        run()
    })

    
    /////////////////////////////////////////////////////////////////////////////////////
    // EVENT : Download button 
    // (requires a text to already be loaded and for the sentiment track to be generated)
    /////////////////////////////////////////////////////////////////////////////////////
    elements.downloadButton.addEventListener("mousedown", event => {
        download()
    })


    /////////////////////////////////////////////////////////////////////////////////////
    // EVENT : Key press
    /////////////////////////////////////////////////////////////////////////////////////
    window.addEventListener('keydown', e => {

        // if (lead) {
        //     lead.startClip(test++)
        //     console.log("Testing row", test);
        // }else{
        //     console.error('fucked')
        // }

        console.error("key",e);
        switch(e.keyCode)
        {
            case 25:
                break

            default:
                // go!
        }

    })

}
