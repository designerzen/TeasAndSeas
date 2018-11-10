// Parcel requires absolute imports for lazy loaded files
//const string = fs.readFileSync(__dirname + "/test.txt", "utf8");
//import text from './assets/tc-stripped.txt'
import textFile from "./assets/tc-stripped.txt"

import {readFile} from './read-file'
import {analyse} from './sentiment-analyser'

// import {convertTextToSound } from './audio'
import {
  generateSentimentSong,
  fetchScales,
  startAudio,
  createClip,
  createLead,
  createPercussion,
  changeRow
} from "./audio"

//const file = __dirname + text
const file = textFile

console.log("Reading Ts and Cs from", file )

const STEPS = 4
let progress = 0

let lead
let drums

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
        

        // const clip = createClip()
        // clip.start()

        lead = createLead()
        drums = createPercussion()

        console.log("Audio READY!", {scales, lead, drums});

        // now trigger certain parts...
        //lead.startRow(1)
//console.log(lead)


        startAudio(1, 10, time=>{
            console.log("Beat", time)
        })
        

        let test = 1
        window.addEventListener('keydown', e => {

            // if (lead) {
            //     lead.startClip(test++)
            //     console.log("Testing row", test);
            // }else{
            //     console.error('fucked')
            // }
            
            changeRow(test++)
            
        })

    })
    .catch(error => {

        console.error(error)
    })
}


setTimeout( run, 0 )

