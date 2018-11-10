

import {readFile} from './read-file'
import {analyse} from './sentiment-analyser'

//import text from "./assets/tc-stripped.js"

const textfile = "./assets/tc-stripped.js"

//import text from "./tx-stripped.txt"
console.log("Reading Ts and Cs")
console.log("readFile", readFile)
console.log("analyse", analyse)

readFile(textfile).then(
    text => {
        console.log(text)
        return analyse(text)
    }
).then(
    analysedText=>{

    }
)

analyse().then( results =>{
    console.table(results)
})

// console.dir(result)    // Score: -2, Comparative: -0.666
