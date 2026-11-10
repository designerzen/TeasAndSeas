export const showElement = element => {
    element.hidden = false
}

export const hideElement = element => {
    element.hidden = true
}

export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value))

// blend two [r,g,b] colours
export const mixColours = (from, to, amount) => from.map((channel, index) =>
    Math.round(channel + (to[index] - channel) * clamp(amount))
)

export const toCSS = (colour, alpha = 1) => `rgba(${colour.join(',')},${alpha})`

// settings that survive a refresh. storage can be blocked, so never rely on it
export const remember = (key, value, storage = 'localStorage') => {
    try {
        window[storage].setItem(`teas-and-seas-${key}`, value)
    } catch (error) {}
}

export const recall = (key, fallback = null, storage = 'localStorage') => {
    try {
        const value = window[storage].getItem(`teas-and-seas-${key}`)
        return value === null ? fallback : value
    } catch (error) {
        return fallback
    }
}

export const prefersReducedMotion = () =>
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
