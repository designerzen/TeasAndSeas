import { readFileSync } from 'fs'
import { describe, expect, test } from 'vitest'
import { analyse } from '../src/analyser'
import { normalise, splitSentences, splitWords, splitPhrases } from '../src/text'

const preset = name => readFileSync(new URL(`../src/presets/${name}.txt`, import.meta.url), 'utf8')
const one = text => analyse(text).phrases
const find = (phrases, words) => phrases.find(phrase => phrase.text.includes(words))

describe('text', () => {
    test('sentences survive abbreviations, numbers and list markers', () => {
        expect(splitSentences('1. You pay 3.5 percent, e.g. monthly. We do not.')).toEqual([
            '1. You pay 3.5 percent, e.g. monthly.',
            'We do not.'
        ])
    })

    test('wrapped lines are joined but headings are kept apart', () => {
        expect(normalise('Article 1\nObjective\nThis Agreement sets out the arrangements for the withdrawal of the\nUnited Kingdom.')).toEqual([
            'Article 1',
            'Objective',
            'This Agreement sets out the arrangements for the withdrawal of the United Kingdom.'
        ])
    })

    test('windows line endings and curly quotes do not glue words together', () => {
        const words = splitWords(normalise('(THE “COMPETITION”),\r\nYOU').join(' '))
        expect(words.map(word => word.norm)).toEqual(['the', 'competition', 'you'])
    })

    test('phrases break at a change of direction', () => {
        const words = splitWords('The Company does not claim any rights, provided that each Contestant grants a licence.')
        const phrases = splitPhrases(words).map(indexes => indexes.map(index => words[index].norm).join(' '))
        expect(phrases[1]).toMatch(/^provided that/)
    })

    test('every word ends up in exactly one phrase', () => {
        const text = preset('tc-full')
        const quantity = normalise(text).reduce((sum, block) =>
            sum + splitSentences(block).reduce((total, sentence) => total + splitWords(sentence).length, 0), 0)
        expect(analyse(text).overall.words).toBe(quantity)
    })
})

describe('who carries the burden', () => {
    test('the same clause flips with its subject', () => {
        expect(one('You shall indemnify the Company against all claims.')[0].valence).toBeLessThan(-0.3)
        expect(one('The Company shall indemnify you against all claims.')[0].valence).toBeGreaterThan(0.2)
    })

    test('power is good when it is yours', () => {
        expect(one('We may terminate your account at any time.')[0].valence).toBeLessThan(-0.3)
        expect(one('You may terminate this agreement at any time.')[0].valence).toBeGreaterThan(0.2)
    })

    test('the object of a sentence is not its subject', () => {
        const phrases = one('The Artist hereby grants to the Label a perpetual and irrevocable licence.')
        expect(phrases[0].beneficiary).toBe('them')
        expect(phrases[0].doom).toBe(true)
    })

    test('negation turns a waiver around', () => {
        expect(one('You do not waive any of your statutory rights.')[0].valence).toBeGreaterThan(0)
    })

    test('consent depends on whose it is', () => {
        expect(one('We will not share your details without your consent.')[0].valence).toBeGreaterThan(0.3)
        expect(one('We may use your recordings without your consent.')[0].valence).toBeLessThan(-0.3)
    })

    test('a liability shield is not mistaken for a restriction on them', () => {
        const [phrase] = one('The Landlord shall not be liable for any loss.')
        expect(phrase.categories[0]).toBe('Liability shield')
        expect(phrase.valence).toBeLessThan(-0.3)
    })

    test('neutral boilerplate stays neutral', () => {
        const [phrase] = one('This agreement is between the Landlord and the Tenant.')
        expect(Math.abs(phrase.valence)).toBeLessThan(0.15)
        expect(phrase.severity).toBe(0)
    })
})

describe('the presets', () => {
    test('the hackathon terms pivot from generous to doom', () => {
        const { phrases } = analyse(preset('tc-full'))
        expect(find(phrases, 'YOU HEREBY WAIVE').doom).toBe(true)
        expect(find(phrases, 'does not claim any rights').beneficiary).toBe('you')
        expect(find(phrases, 'provided that').pivot).toBe(true)
        expect(find(phrases, 'perpetual').doom).toBe(true)
        expect(find(phrases, 'prior written consent of the Contestant').beneficiary).toBe('you')
    })

    test('verdicts match the contracts', () => {
        const verdict = name => analyse(preset(name)).overall
        expect(verdict('record-deal').label).toBe('Exploitative')
        expect(verdict('fair-freelance').label).toBe('Favourable')
        expect(verdict('fair-freelance').doom).toBe(0)
        expect(verdict('record-deal').balance).toBeLessThan(verdict('tenancy').balance)
        expect(verdict('tenancy').balance).toBeLessThan(verdict('fair-freelance').balance)
    })

    test('a very long document is read in good time', () => {
        const started = Date.now()
        const { phrases } = analyse(preset('brexit'))
        expect(phrases.length).toBeGreaterThan(1000)
        expect(Date.now() - started).toBeLessThan(5000)
    })
})
