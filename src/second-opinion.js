// An optional second opinion.
// The built in analyser spots known clause patterns. Given an API key, Claude
// reads the contract properly and replaces the scores for each phrase.
// The key stays in this browser tab and is only ever sent to Anthropic

import { finalise, summarise } from './analyser'

const MODEL = 'claude-opus-5-5'
const BATCH = 120
// long enough for any contract a person would actually sign
const LIMIT = 1200

const SYSTEM = `You assess contract terms on behalf of the person being asked to sign: the weaker party, such as the user, tenant, artist, employee or contestant.

You will be given consecutive numbered phrases from one contract. Score every phrase from that person's point of view, reading each in the context of the phrases around it, because one sentence is often split across several phrases.

For each phrase return:
- index: the number of the phrase
- valence: from -1 (takes something from them or exposes them to risk) to 1 (protects or benefits them). Use 0 for headings, definitions and neutral boilerplate.
- severity: from 0 (harmless) to 1 (exploitative). Reserve values above 0.6 for terms a careful adviser would warn against signing, such as perpetual or irrevocable rights grabs, waivers of legal rights, uncapped indemnities and unilateral powers.
- category: two or three words naming the kind of term, such as "Rights waiver", "Liability shield", "Protection" or "Boilerplate".
- reason: one short plain sentence saying what the phrase does to the signer. Leave it empty for neutral phrases.

Judge what the words do, not how politely they are put.`

const FORMAT = {
    type: 'json_schema',
    schema: {
        type: 'object',
        properties: {
            phrases: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        index: { type: 'integer' },
                        valence: { type: 'number' },
                        severity: { type: 'number' },
                        category: { type: 'string' },
                        reason: { type: 'string' }
                    },
                    required: ['index', 'valence', 'severity', 'category', 'reason'],
                    additionalProperties: false
                }
            }
        },
        required: ['phrases'],
        additionalProperties: false
    }
}

const describeError = (Anthropic, error) => {
    if (error instanceof Anthropic.AuthenticationError) {
        return 'That API key was not accepted.'
    }
    if (error instanceof Anthropic.PermissionDeniedError) {
        return 'That API key is not allowed to use this model.'
    }
    if (error instanceof Anthropic.RateLimitError) {
        return 'Rate limited by the API. Try again in a minute.'
    }
    if (error instanceof Anthropic.APIConnectionError) {
        return 'Could not reach the API. Check your connection.'
    }
    if (error instanceof Anthropic.APIError) {
        return `The API returned an error (${error.status}).`
    }
    return error.message
}

// Rescores the analysis in place. Resolves with how many phrases were read
export const getSecondOpinion = async (analysis, apiKey, onProgress) => {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
    const quantity = Math.min(analysis.phrases.length, LIMIT)
    let read = 0

    for (let start = 0; start < quantity; start += BATCH) {
        const batch = analysis.phrases.slice(start, Math.min(start + BATCH, quantity))
        const numbered = batch.map((phrase, offset) => `${start + offset}: ${phrase.text}`).join('\n')

        let message
        try {
            // streamed as a full batch of scores takes a while to write
            message = await client.beta.messages.stream({
                model: MODEL,
                max_tokens: 32000,
                // if the model declines a request another one picks it up
                betas: ['server-side-fallback-2026-07-01'],
                fallbacks: 'default',
                system: SYSTEM,
                output_config: { effort: 'medium', format: FORMAT },
                messages: [{ role: 'user', content: `<phrases>\n${numbered}\n</phrases>` }]
            }).finalMessage()
        } catch (error) {
            throw new Error(describeError(Anthropic, error))
        }

        if (message.stop_reason === 'refusal') {
            throw new Error('The model declined to read this contract.')
        }
        if (message.stop_reason === 'max_tokens') {
            throw new Error('The reply was cut short. Try a shorter contract.')
        }

        const text = message.content.filter(block => block.type === 'text').map(block => block.text).join('')
        JSON.parse(text).phrases.forEach(opinion => {
            const phrase = analysis.phrases[opinion.index]
            // only trust answers about the phrases that were asked about
            if (!phrase || opinion.index < start || opinion.index >= start + batch.length) {
                return
            }
            phrase.valence = opinion.valence
            phrase.severity = opinion.severity
            phrase.categories = opinion.reason ? [opinion.category] : []
            phrase.reason = opinion.reason
            phrase.source = 'claude'
            finalise(phrase)
            read++
        })
        onProgress && onProgress(Math.min(start + BATCH, quantity) / quantity)
    }

    analysis.overall = summarise(analysis.phrases)
    return { read, skipped: analysis.phrases.length - quantity }
}
