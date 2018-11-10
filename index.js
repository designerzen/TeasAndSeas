// Parcel requires absolute imports for lazy loaded files
//const string = fs.readFileSync(__dirname + "/test.txt", "utf8");
//import text from './assets/tc-stripped.txt'
import textFile from "./assets/tc-stripped.txt"


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
    convertScaleToChord,
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
let clips

const c4 = fetchScales("c4")
const g4 = fetchScales("g4")

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
            // so now we create our various scales...
            
            return {
                c4,g4
            }
        }

    ).then( allScales => {

        progress = 3 / STEPS

        // Here we create our scales from super sad to not too bad...
        const bluesMajor = allScales["g4"]["major blues"]
        const bluesMinor = allScales["g4"]["minor blues"]
        const augmented = allScales["c4"]["augmented"]

        const scaleRange = [
            convertScaleToChord(bluesMinor), 
            convertScaleToChord(bluesMajor), 
            convertScaleToChord(augmented)
        ]

        clips = [
            // SAD
            {
                pattern: "xxxxx",
                notes: scaleRange[0]
            },
            {
                pattern: "xxx[xx]",
                notes: scaleRange[1]
            },
            {
                pattern: "x-x-x-x",
                notes: scaleRange[2]
            },
            // HAPPY
            {
                pattern: "xxx[-x]",
                notes: 'C1 D#4'
            }
        ]


        console.table(scaleRange);
        console.table(clips);

        lead = createLead(
            SYNTH_AM,
           clips
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

