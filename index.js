

import readFile from './read-file'

const textfile = "./tc-stripped.txt"

//import text from "./tx-stripped.txt"
console.log("Reading Ts and Cs")

readFile(textfile).next(
    text => {
    console.log(text)
    }
)
