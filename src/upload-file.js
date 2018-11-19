
export const uploadFile = (textFile) => {

    console.error("Reading file", textFile)

    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = (event) =>{
            if (event.target.readyState !== FileReader.DONE) {
                return;
            }

            // At this point the file data is loaded to event.target.result
            resolve(event.target.result)
        }
        reader.onload = event => resolve(event.target.result)
        reader.onerror = error => reject(error)
        reader.readAsText(textFile)
    })

}