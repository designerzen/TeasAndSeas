// Parcel requires absolute imports for lazy loaded files
//const string = fs.readFileSync(__dirname + "/test.txt", "utf8");
//import text from './assets/tc-stripped.txt'
import text from "./assets/tc-stripped.txt"

import {readFile} from './read-file'
import {analyse} from './sentiment-analyser'

// import {convertTextToSound } from './audio'
import { generateSentimentSong } from "./audio"
//const file = __dirname + text
const file = text
console.log("Reading Ts and Cs from", file )

readFile(file).then(
    text => {
        console.log(text)
        return analyse(text)
    }
).then(

    analysedText=>{

        // first split text by sentence...
        const sentences = text.split('.')
        const words = text.split(" ")

        console.table(analysedText)

        console.error("Text > ", sentences, words)

        return generateSentimentSong(0)
    }

).catch( error =>{

    console.error(error)
})