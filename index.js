// Parcel requires absolute imports for lazy loaded files
//const string = fs.readFileSync(__dirname + "/test.txt", "utf8");
//import text from './assets/tc-stripped.txt'
import textFile from "./assets/tc-stripped.txt"
import snareFile from "./assets/snare.wav"
import kickFile from "./assets/kick.wav"

import {readFile} from './read-file'
import {analyse} from './sentiment-analyser'

// import {convertTextToSound } from './audio'
import {
    SYNTH_AM, SYNTH_FM, SYNTH_MONO, SYNTH_GENERIC,
  generateSentimentSong,
  fetchScales,
  startAudio,
  createClip,
  createLead,
    createKicks,
    createSnares,
  changeRow
} from "./audio"

//const file = __dirname + text
const file = textFile

console.log("Reading Ts and Cs from", file )

const BPM = 100
const STEPS = 4
let progress = 0
let bar = 0
let words = []
let word = 0

let lead
let kicks
let snares

const elements = {
    ticker: document.getElementById('ticker'),
    data: document.getElementById('data')
}

const run = () =>{

    readFile(file).then(

        text => {

            // first split text by sentence...
            const sentences = text.split('.')
            words = text.split(" ")

            console.error("Text > ", { text, sentences, words })

            progress = 1 / STEPS

            return analyse(text)
        }

    ).then(

        // This is an array of sentiments...
        analysedText => {

            //console.table(analysedText)
            progress = 2 / STEPS
            // so now we create our 
            return fetchScales()
        }

    ).then( allScales => {

        progress = 3 / STEPS

        lead = createLead(
            
            [

                // SAD
                {
                    pattern: "xxxxx",
                    notes: 'C4 D#4'
                },
                {
                    pattern: "xxx[xx]",
                    notes: 'C2 D#4'
                },
                {
                    pattern: "x-x-x-x",
                    notes: 'C3 D#4'
                },
                // HAPPY
                {
                    pattern: "xxx[-x]",
                    notes: 'C1 D#4'
                }
            ]
        )
        kicks = createKicks()
        snares = createSnares()

        console.log("Audio READY!", { allScales, lead, kicks});

        // now trigger certain parts...
        //lead.startRow(1)
        //console.log(lead)

        startAudio(1, BPM, time=>{
            const tock = bar++%2 === 0
            const nextWord = words[word++]

            // to change sentiment...
            //changeRow(test++)

            console.log("Beat", time, nextWord)
            // update the sentiment obect...
            elements.data.innerHTML = nextWord

            elements.ticker.innerHTML = nextWord
            elements.ticker.className = "beat-" + bar + " " + (tock? 'tock' : 'tick')
        })
        

        let test = 1
        window.addEventListener('keydown', e => {

            // if (lead) {
            //     lead.startClip(test++)
            //     console.log("Testing row", test);
            // }else{
            //     console.error('fucked')
            // }
            
            
            
        })

    })
    .catch(error => {

        console.error(error)
    })
}


setTimeout( run, 0 )

