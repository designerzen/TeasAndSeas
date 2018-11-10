
import Sentiment from 'sentiment'

import readFile from './read-file'

const textfile = "./tc-stripped.txt"

//import text from "./tx-stripped.txt"
console.log("Reading Ts and Cs")

readFile(textfile).next(
    text => {
    console.log(text)
    }
)

// Analyze sentiments!
const sentiment = new Sentiment();
const result = sentiment.analyze('Cats are stupid.');
console.dir(result);    // Score: -2, Comparative: -0.666
