import Sentiment from "./external/sentiment";


export const analyse = (sentences, progressCallback)=>{
    return new Promise( (resolve,reject)=>{

        const sentiment = new Sentiment()
        const results = []
        const quantity = sentences.length

        let success = true

        console.error(sentences)

        sentences.forEach((sentence,index) => {

            console.error(sentence);

            // Analyze sentiments!
            try {

                const result = sentiment.analyze(sentence)
                //console.error(result);

                results.push(result)

                progressCallback && progressCallback(results.length / quantity, sentence, result )

            } catch (error) {

                success = false
                
            }
        })

        if (success)
        {

            resolve(results)
        }else{

            reject("Couldn't analyse sentence")
        }
       
        
    })
}
