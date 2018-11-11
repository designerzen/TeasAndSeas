import Sentiment from "./external/sentiment";


export const analyse = (sentences)=>{
    return new Promise( (resolve,reject)=>{

        const sentiment = new Sentiment()
        const results = []
        let success = true

        console.error(sentences)

        sentences.forEach(sentence => {

            console.error(sentence);

            // Analyze sentiments!
            try {

                const result = sentiment.analyze(sentence)
                //console.error(result);

                results.push(result)

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
