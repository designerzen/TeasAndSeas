// Parcel requires absolute imports for lazy loaded files
//const string = fs.readFileSync(__dirname + "/test.txt", "utf8");
//import text from './assets/tc-stripped.txt'
import textFile from "./assets/tc-stripped.txt"


import {readFile} from './read-file'
import {analyse} from './sentiment-analyser'

// window.Tone = Tone
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

// Settings
const BPM = 72
const STEPS = 4

// holder of data
let words = []
let sentences = []
let sentiments = []

// counters
let progress = 0
let bar = 0
let word = 0
let sentence = 0
let smoothSentiment = 0

let lead
let kicks
let snares
let clips

const c4 = fetchScales("c3")
const g2 = fetchScales("g2")
const d3 = fetchScales("d3")

const elements = {
    ticker: document.getElementById('ticker'),
    data: document.getElementById('data')
}

const run = () =>{

    console.log("Reading Ts and Cs from", file)


    readFile(file).then(

        text => {

            // first split text by sentence...
            sentences = text.split(/[.|,]/)
            words = text.split(" ")

            console.error("Text > ", { text, sentences, words })

            progress = 1 / STEPS

            return analyse(sentences)
        }

    ).then(

        // This is an array of sentiments...
        analysedText => {

           
            sentiments = analysedText

            console.table(sentiments)
            console.table(sentences)


            //console.table(analysedText)
            progress = 2 / STEPS
            // so now we create our various scales...
            
            return {
                c4, g2, d3
            }
        }

    ).then( allScales => {

        progress = 3 / STEPS

        // Here we create our scales from super sad to not too bad...
        const bluesMajor = allScales["g2"]["major blues"]
        const bluesMinor = allScales["g2"]["minor blues"]
        const augmented = allScales["c4"]["augmented"]
        const augmentedLow = allScales["d3"]["augmented"]

        const scaleRange = [
            convertScaleToChord(bluesMinor), 
            convertScaleToChord(bluesMajor), 
            convertScaleToChord(augmented),
            convertScaleToChord(augmentedLow)
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
                notes: scaleRange[3]
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
            const currentWord = words[word++]

            // sentiments[word]

            const currentSentence = sentences[sentence]
            const currentSentiment = sentiments[sentence]

            sentence++

            smoothSentiment += currentSentiment.score > 0 ? 1 : -1

            // if (sentiment === happy)
            // {
            //     changeRow(0)
            // }else if (sentiment === sad)
            // {
            //     changeRow(4)
            // }

            // to change sentiment...
            // changeRow(test++)

            // TODO: 
            // When sentence > sentences.length : RESET!

            console.log("Timestamp:", time, currentSentence, currentSentiment.score, smoothSentiment);
            // update the sentiment obect...
            //elements.data.innerHTML = JSON.stringify( currentSentiment )
            elements.data.innerHTML = currentSentiment.score + " -> " + smoothSentiment
            //.score

            //elements.ticker.innerHTML = currentWord
            elements.ticker.innerHTML = currentSentence
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

