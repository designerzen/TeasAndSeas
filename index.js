// Parcel requires absolute imports for lazy loaded files
//const string = fs.readFileSync(__dirname + "/test.txt", "utf8");
//import text from './assets/tc-stripped.txt'
import textFile from "./assets/tc-stripped.txt"

import {readFile} from './read-file'
import {analyse} from './sentiment-analyser'

// window.Tone = Tone
// import {convertTextToSound } from './audio'
import {
    generateSentimentSong,
    fetchScales,
    startAudio,
    createClip, 
    createLead,
    createPercussion
} from "./audio"

//const file = __dirname + text
const file = textFile

console.log("Reading Ts and Cs from", file )

const STEPS = 4
let progress = 0

const run = () =>{

    readFile(file).then(

        text => {

            // first split text by sentence...
            const sentences = text.split('.')
            const words = text.split(" ")

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

    ).then(scales => {

        progress = 3 / STEPS
        console.log("Audio READY!", scales)

        // const clip = createClip()
        // clip.start()

        createLead()
        createPercussion()
        startAudio()

    })
    .catch(error => {

        console.error(error)
    })
}


setTimeout( run, 440 )

