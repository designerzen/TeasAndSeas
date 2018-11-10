import Sentiment from "sentiment";


export const analyse = ()=>{
    return new Promise( (resolve,reject)=>{

        // Analyze sentiments!
        try{
            const sentiment = new Sentiment()
            const result = sentiment.analyze('Cats are stupid.')

            const results = [ result ]
            // , result2

            resolve(results)
        }catch(error){
            reject(error)
        }
        
    })
}
