// The page's side of a voice that lives in a worker.
// Every voice does its thinking away from the page, so that working out
// how to say something never makes the band miss a beat

// resolves with a way of asking the worker for things once it is ready
export const connect = async (worker, options, onProgress) => {
    const waiting = {}
    let counter = 0

    await new Promise((resolve, reject) => {
        worker.onmessage = ({ data }) => {
            const request = waiting[data.id]
            switch (data.type) {
                case 'progress':
                    onProgress && onProgress(data.progress)
                    break
                case 'ready':
                    resolve()
                    break
                case 'done':
                    request && request.resolve(data.result)
                    delete waiting[data.id]
                    break
                case 'error':
                    if (request) {
                        request.reject(new Error(data.message))
                        delete waiting[data.id]
                    } else {
                        reject(new Error(data.message))
                    }
                    break
            }
        }
        worker.onerror = event => reject(new Error(event.message || 'The voice failed to start'))
        worker.postMessage({ type: 'load', ...options })
    })

    return message => new Promise((resolve, reject) => {
        const id = ++counter
        waiting[id] = { resolve, reject }
        worker.postMessage({ ...message, id })
    })
}
