// import read from 'read-file'


// export const readFile = () => {
//     read.sync('tc.txt', 'utf8', (err, string) => {
//         console.log(string.split(' ').length)
//     })
// }

export const readFile = (textFile)=>{

    return new Promise((resolve, reject) => {
        const client = new XMLHttpRequest()
        client.open("GET", textFile)
        client.onreadystatechange = () => {
            resolve(client.responseText)
        }
        client.onerror = (error)=>{
            reject(error)
        }
        client.send()
    })
}
