// What you see.
// The karaoke words, the colours of the room and the map of the contract
// all take their cue from the same scores as the music

import { elements } from './elements'
import { mixColours, toCSS, clamp, prefersReducedMotion } from './utils'

// the room at its most neutral, most generous and most hostile
const PALETTE = {
    background: { calm: [14, 17, 24], good: [10, 62, 56], bad: [58, 6, 14], doom: [6, 0, 2] },
    ink: { calm: [226, 230, 240], good: [255, 246, 220], bad: [255, 220, 220], doom: [255, 236, 236] },
    accent: { calm: [143, 163, 199], good: [255, 209, 102], bad: [255, 82, 82], doom: [255, 24, 48] }
}

const shade = (tones, mood) => {
    const base = mood.valence >= 0
        ? mixColours(tones.calm, tones.good, mood.valence)
        : mixColours(tones.calm, tones.bad, -mood.valence)
    return mood.doom ? mixColours(base, tones.doom, 0.7) : base
}

// the colour of a single phrase or word on the scale of bad to good
export const colourFor = (valence, doom = false) => shade(PALETTE.accent, { valence: clamp(valence, -1, 1), doom })

// redecorate the room
export const paintMood = mood => {
    const { style, classList } = document.documentElement
    const accent = shade(PALETTE.accent, mood)
    style.setProperty('--background', toCSS(shade(PALETTE.background, mood)))
    style.setProperty('--ink', toCSS(shade(PALETTE.ink, mood)))
    style.setProperty('--accent', toCSS(accent))
    style.setProperty('--glow', toCSS(accent, 0.12 + mood.severity * 0.25))
    // the worse it gets the heavier the type
    style.setProperty('--weight', Math.round(mood.doom ? 900 : 480 - mood.valence * 160 + mood.severity * 200))
    classList.toggle('doom', !!mood.doom)
    classList.toggle('good', mood.valence > 0.15)
    classList.toggle('bad', mood.valence < -0.15)
}

export const clearMood = () => {
    const { style, classList } = document.documentElement
    ;['--background', '--ink', '--accent', '--glow', '--weight'].forEach(name => style.removeProperty(name))
    classList.remove('doom', 'good', 'bad')
}

const wordClasses = word => {
    const classes = ['word']
    word.score > 0.4 && classes.push('happy')
    word.score < -0.4 && classes.push('unhappy')
    word.trigger && classes.push('trigger')
    return classes.join(' ')
}

// put a phrase on screen ready to be sung
export const showPhrase = (phrases, index) => {
    const phrase = phrases[index]
    const previous = phrases[index - 1]
    const next = phrases[index + 1]

    elements.before.textContent = previous ? previous.text : ''
    elements.after.textContent = next ? next.text : ''

    const fragment = document.createDocumentFragment()
    phrase.words.forEach(word => {
        const span = document.createElement('span')
        span.className = wordClasses(word)
        span.textContent = word.text
        fragment.appendChild(span)
        fragment.appendChild(document.createTextNode(' '))
    })
    elements.ticker.replaceChildren(fragment)
    // long phrases get smaller type so that they still fit
    elements.ticker.classList.toggle('long', phrase.text.length > 90)

    // why the music sounds the way it does
    elements.data.replaceChildren()
    phrase.categories.slice(0, 3).forEach(category => {
        const chip = document.createElement('span')
        chip.className = 'chip'
        chip.textContent = category
        elements.data.appendChild(chip)
    })
    if (phrase.beneficiary !== 'neutral') {
        const who = document.createElement('span')
        who.className = 'who'
        who.textContent = phrase.beneficiary === 'you' ? 'Good for you' : phrase.doom ? 'Doom' : 'Good for them'
        elements.data.appendChild(who)
    }
}

// light up the word being spoken and everything before it
export const showWord = wordIndex => {
    const spans = elements.ticker.children
    for (let i = 0; i < spans.length; ++i) {
        spans[i].classList.toggle('sung', i < wordIndex)
        spans[i].classList.toggle('now', i === wordIndex)
    }
}

// a nudge on every beat
export const pulse = (beat, heavy) => {
    elements.ticker.classList.toggle('tick', beat % 2 === 0)
    elements.ticker.classList.toggle('tock', beat % 2 === 1)
    if (prefersReducedMotion() || !elements.ticker.animate) {
        return
    }
    const size = beat === 0 ? (heavy ? 1.04 : 1.02) : 1.008
    elements.ticker.animate(
        [{ transform: `scale(${size})` }, { transform: 'scale(1)' }],
        { duration: heavy ? 600 : 220, easing: 'ease-out' }
    )
}

// The map of the contract : every phrase is a bar, rising when it is good
// for you and sinking when it is not. It doubles as the seek bar
let layout = []

export const drawStrip = (phrases, position = -1) => {
    const canvas = elements.strip
    const ratio = window.devicePixelRatio || 1
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    if (!width || !height) {
        return
    }
    if (canvas.width !== Math.round(width * ratio)) {
        canvas.width = Math.round(width * ratio)
        canvas.height = Math.round(height * ratio)
    }
    const context = canvas.getContext('2d')
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, width, height)

    const total = phrases.reduce((sum, phrase) => sum + phrase.words.length, 0)
    const middle = height / 2
    let x = 0
    layout = []

    context.fillStyle = 'rgba(255,255,255,0.15)'
    context.fillRect(0, middle - 0.5, width, 1)

    phrases.forEach((phrase, index) => {
        const size = phrase.words.length / total * width
        const reach = Math.max(1.5, Math.abs(phrase.valence) * (middle - 2))
        const played = position < 0 || index <= position
        context.fillStyle = toCSS(colourFor(phrase.valence, phrase.doom), played ? 1 : 0.4)
        // leave a hairline between phrases when there is room for one
        const gap = size > 3 ? 1 : 0
        if (phrase.valence >= 0) {
            context.fillRect(x, middle - reach, size - gap, reach)
        } else {
            context.fillRect(x, middle, size - gap, phrase.doom ? middle : reach)
        }
        layout.push(x)
        if (index === position) {
            context.fillStyle = '#fff'
            context.fillRect(x, 0, Math.max(2, size - gap), 2)
            context.fillRect(x, height - 2, Math.max(2, size - gap), 2)
        }
        x += size
    })

    canvas.setAttribute('aria-valuemax', phrases.length - 1)
    canvas.setAttribute('aria-valuenow', Math.max(0, position))
}

// which phrase is under this point of the strip?
export const phraseAt = clientX => {
    const bounds = elements.strip.getBoundingClientRect()
    const x = clientX - bounds.left
    let index = layout.length - 1
    while (index > 0 && layout[index] > x) {
        index--
    }
    return Math.max(0, index)
}
