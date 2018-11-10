import { dictionary } from 'descriminator-dictionary'

const descriminate = (text) => {

    // This is resposnible for loading in a file and removing 
    // certain words listed bove in the dictionary file
    // remove all words from the strings using a loop
    dictionary.forEach(phrase => {
        text.replace(phrase,"")
    })

    return text
}

export default descriminate