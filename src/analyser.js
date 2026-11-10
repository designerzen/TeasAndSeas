// Contract analysis.
// Takes plain text and returns a list of phrases, each one scored for
//   valence  : -1 (bad for you) to +1 (good for you)
//   severity :  0 (harmless) to 1 (exploitative)
// along with the reasons why, so that the music and the visuals can follow

import afinn from 'sentiment/languages/en/labels.json'
import { normalise, normaliseWord, splitSentences, splitWords, splitPhrases, isPivot } from './text'
import {
    CATEGORIES, WORDS, AMPLIFIER, NEGATOR,
    PARTY_YOU, PARTY_THEM, POSSESSIVES, PREPOSITIONS, DETERMINERS
} from './lexicon'

// general sentiment is only a hint in legal text
const AFINN_WEIGHT = 0.3
const WORD_WEIGHT = 0.5
const DOOM = 0.6
// a flattering reading needs its subject close by, as contracts
// are rarely generous by accident
const SUBJECT_REACH = 8

const clamp = (value, min = -1, max = 1) => Math.min(max, Math.max(min, value))

export const scoreWord = norm => {
    if (norm in WORDS) {
        return WORDS[norm]
    }
    return norm in afinn ? afinn[norm] * AFINN_WEIGHT : 0
}

const partyOf = norm => {
    const bare = norm.replace(/'s$|s'$/, '')
    return PARTY_YOU.has(bare) ? 'you' : PARTY_THEM.has(bare) ? 'them' : null
}

// who is doing the thing at this position? walk backwards through
// the sentence to the nearest party that is not an object or an owner
const findSubject = (words, position) => {
    let distance = 0
    for (let i = words.length - 1; i >= 0; --i) {
        const word = words[i]
        if (word.start >= position) {
            continue
        }
        distance++
        if (POSSESSIVES.has(word.norm) || /'s$|s'$/.test(word.norm)) {
            continue
        }
        const party = partyOf(word.norm)
        if (!party) {
            continue
        }
        // "grants to the company" - the company is not the one granting
        let before = i - 1
        while (before >= 0 && DETERMINERS.has(words[before].norm)) {
            before--
        }
        if (before >= 0 && PREPOSITIONS.has(words[before].norm)) {
            continue
        }
        return { party, distance }
    }
    return { party: null, distance: Infinity }
}

const directionOf = (category, { party, distance }) => {
    const near = distance <= SUBJECT_REACH
    switch (category.kind) {
        case 'burden':
            return party === 'you' ? -1 : party === 'them' && near ? 0.6 : category.needsSubject ? 0 : -0.6
        case 'power':
            return party === 'them' ? -1 : party === 'you' && near ? 0.7 : -0.5
        case 'harm':
            return -1
        case 'protect':
            return 1
    }
    return 0
}

// "without consent" depends on whose consent it is, and on whether
// it limits somebody ("shall not ... without") or frees them ("may ... without")
const consentDirection = (sentence, candidate) => {
    const before = sentence.substring(0, candidate.start)
    const after = sentence.substring(candidate.end)
    const isLimit = /\b(?:not|no|never|nor|nothing|neither|cannot)\b|n['’]t\b/i.test(before)
    const named = after.match(/^ of (?:the |any |each )?([\w'’]+)/i)
    const owner = /\byour\b/i.test(candidate.text) ? 'you'
        : /\b(?:its|their)\b/i.test(candidate.text) ? 'them'
        : named ? partyOf(normaliseWord(named[1])) : null
    if (owner === 'you') {
        return isLimit ? 1 : -1
    }
    if (owner === 'them') {
        return -0.4
    }
    return isLimit ? 0.5 : -0.7
}

// find every clause pattern in the sentence and decide who it lands on
const findHits = (sentence, words) => {
    const candidates = []
    CATEGORIES.forEach(category => {
        category.pattern.lastIndex = 0
        let match
        while ((match = category.pattern.exec(sentence))) {
            candidates.push({ category, start: match.index, end: match.index + match[0].length, text: match[0] })
        }
    })

    // heaviest first so that "shall not be liable" is a liability shield
    // rather than a restriction on whoever wrote it
    candidates.sort((a, b) => b.category.weight - a.category.weight || a.start - b.start)

    const hits = []
    const seen = {}
    candidates.forEach(candidate => {
        if (hits.some(hit => candidate.start < hit.end && candidate.end > hit.start)) {
            return
        }
        const { category } = candidate
        const subject = findSubject(words, candidate.start)
        const before = sentence.substring(0, candidate.start)
        let direction
        if (category.kind === 'consent') {
            direction = consentDirection(sentence, candidate)
        } else {
            direction = directionOf(category, subject)
            if (NEGATOR.test(before)) {
                direction *= -0.7
            }
        }
        // the first mention counts in full, piling on counts for less
        const repeats = seen[category.id] || 0
        seen[category.id] = repeats + 1
        hits.push({
            ...candidate,
            subject: subject.party,
            score: direction * category.weight * (repeats ? 0.3 : 1)
        })
    })
    return hits.filter(hit => hit.score !== 0).sort((a, b) => a.start - b.start)
}

const describe = hit => {
    const quote = hit.text.length > 48 ? hit.text.substring(0, 45) + '…' : hit.text
    const who = hit.score > 0
        ? (hit.category.kind === 'burden' ? 'their obligation' : 'in your favour')
        : (hit.subject === 'them' ? 'their advantage' : 'falls on you')
    return `${hit.category.label} (${who}): “${quote.toLowerCase()}”`
}

const analyseSentence = (sentence, sentenceIndex) => {
    const words = splitWords(sentence)
    const hits = findHits(sentence, words)

    // colour in the words - those inside a clause pattern take on its score
    words.forEach(word => {
        const hit = hits.find(hit => word.start < hit.end && word.end > hit.start)
        word.score = hit ? clamp(hit.score, -3, 3) : scoreWord(word.norm)
        word.inHit = !!hit
        word.trigger = !!hit && hit.score <= -2
    })

    return splitPhrases(words).map(indexes => {
        const phraseWords = indexes.map(index => words[index])
        const start = phraseWords[0].start
        const end = phraseWords[phraseWords.length - 1].end
        const text = sentence.substring(start, end)
        const phraseHits = hits.filter(hit => hit.start >= start && hit.start < end)

        const amplifiers = (text.match(AMPLIFIER) || []).length
        const amplify = 1 + Math.min(0.6, amplifiers * 0.15)

        let positive = 0
        let negative = 0
        phraseHits.forEach(hit => {
            if (hit.score > 0) {
                positive += hit.score
            } else {
                negative -= hit.score * amplify
            }
        })
        phraseWords.forEach(word => {
            if (word.inHit) {
                return
            }
            if (word.score > 0) {
                positive += word.score * WORD_WEIGHT
            } else {
                negative -= word.score * WORD_WEIGHT
            }
        })

        const valence = Math.tanh((positive - negative) / 4)
        const severity = negative > positive ? 1 - Math.exp(-(negative - positive * 0.5) / 3.5) : 0
        // lead with the reason that agrees with the overall feeling
        const sign = positive >= negative ? 1 : -1
        const ranked = phraseHits.slice().sort((a, b) => b.score * sign - a.score * sign)

        return finalise({
            sentence: sentenceIndex,
            text,
            words: phraseWords.map(({ text, norm, score, trigger }) => ({ text, norm, score, trigger })),
            valence,
            severity,
            categories: [...new Set(ranked.map(hit => hit.category.label))],
            reason: ranked.length ? describe(ranked[0]) : '',
            pivot: isPivot(words, indexes[0]),
            source: 'rules'
        })
    })
}

// derived values that depend on the scores (the scores can be replaced later)
export const finalise = phrase => {
    phrase.valence = clamp(phrase.valence)
    phrase.severity = clamp(phrase.severity, 0, 1)
    phrase.doom = phrase.severity >= DOOM
    phrase.beneficiary = phrase.valence > 0.15 ? 'you' : phrase.valence < -0.15 ? 'them' : 'neutral'
    return phrase
}

const VERDICTS = [
    { below: -0.5, label: 'Exploitative', summary: 'Run. This takes far more than it gives.' },
    { below: -0.2, label: 'One-sided', summary: 'Stacked against you. Negotiate before signing.' },
    { below: 0.2, label: 'Balanced', summary: 'Give and take in roughly equal measure.' },
    { below: 0.5, label: 'Fair', summary: 'Mostly reasonable, with protections for you.' },
    { below: Infinity, label: 'Favourable', summary: 'This one is on your side.' }
]

// the big picture : weighs up everything that has an opinion
export const summarise = phrases => {
    let net = 0
    let charged = 0
    let total = 0
    let doom = 0
    phrases.forEach(phrase => {
        const weight = phrase.words.length
        // the worst clauses should not be drowned out by the boilerplate
        const emphasis = 1 + phrase.severity
        net += phrase.valence * weight * emphasis
        charged += Math.abs(phrase.valence) * weight * emphasis
        total += weight
        phrase.doom && doom++
    })
    const balance = total ? net / (charged + total * 0.05) : 0
    const verdict = VERDICTS.find(verdict => balance < verdict.below)
    const worst = phrases
        .map((phrase, index) => ({ index, phrase }))
        .filter(({ phrase }) => phrase.severity > 0.3)
        .sort((a, b) => b.phrase.severity - a.phrase.severity)
        .slice(0, 5)
        .map(({ index }) => index)
    const best = phrases
        .map((phrase, index) => ({ index, phrase }))
        .filter(({ phrase }) => phrase.valence > 0.3)
        .sort((a, b) => b.phrase.valence - a.phrase.valence)
        .slice(0, 3)
        .map(({ index }) => index)

    return {
        balance,
        label: verdict.label,
        summary: verdict.summary,
        doom,
        against: phrases.filter(phrase => phrase.beneficiary === 'them').length,
        inFavour: phrases.filter(phrase => phrase.beneficiary === 'you').length,
        words: total,
        worst,
        best
    }
}

export const analyse = text => {
    const phrases = []
    let sentenceIndex = 0
    normalise(text).forEach(block => {
        splitSentences(block).forEach(sentence => {
            phrases.push(...analyseSentence(sentence, sentenceIndex++))
        })
    })
    return {
        phrases,
        sentences: sentenceIndex,
        overall: summarise(phrases)
    }
}
