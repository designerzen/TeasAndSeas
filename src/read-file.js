
// export const readFile = () => {
//     read.sync('tc.txt', 'utf8', (err, string) => {
//         console.log(string.split(' ').length)
//     })
// }
export const readFile = (textFile)=>{

    //console.error("Reading file", textFile)

    return new Promise((resolve, reject) => {
        const client = new XMLHttpRequest()
        client.open("GET", textFile)
        client.onreadystatechange = state => {
            // check for state 4
            const response = client.responseText
            //console.error(state, response)
        
            if (state.currentTarget.readyState === 4 && response.length) 
            {
              resolve(response)
            } 
        }
        client.onerror = (error)=>{
            reject(error)
        }
        client.send()
    })
}
