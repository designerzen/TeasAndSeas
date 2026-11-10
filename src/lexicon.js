// The contract lexicon.
// General sentiment lists rate how words *feel*, but contracts are written to
// feel like nothing at all. What matters is who carries the burden, so the
// clause categories below describe risk and the analyser works out who it
// lands on. The word lists only colour the individual words.

// who is who - "you" is the person being asked to sign
export const PARTY_YOU = new Set([
    'you', 'yourself', 'user', 'users', 'customer', 'customers', 'subscriber', 'subscribers',
    'member', 'members', 'tenant', 'tenants', 'artist', 'employee', 'contractor', 'freelancer',
    'contestant', 'contestants', 'participant', 'participants', 'licensee', 'borrower', 'buyer',
    'consumer', 'guest', 'creator', 'author', 'writer', 'performer', 'individual', 'applicant'
])

export const PARTY_THEM = new Set([
    'we', 'company', 'landlord', 'label', 'employer', 'licensor', 'lender', 'seller',
    'provider', 'sponsor', 'sponsors', 'organiser', 'organizer', 'publisher', 'platform',
    'supplier', 'operator', 'agency', 'bank', 'client', 'management', 'controller'
])

// these mention a party without making it the subject of the sentence
export const POSSESSIVES = new Set(['your', 'yours', 'our', 'ours', 'its', 'their'])
export const PREPOSITIONS = new Set(['to', 'of', 'by', 'against', 'from', 'with', 'for', 'on', 'upon', 'between'])
export const DETERMINERS = new Set(['the', 'a', 'an', 'any', 'each', 'such', 'said', 'every', 'other', 'all'])

// kind decides how the subject of the sentence changes the meaning :
//   burden  - bad for whoever is the subject        ("you waive" / "we shall pay")
//   power   - good for whoever is the subject       ("we may terminate" / "you may cancel")
//   harm    - bad for you whoever the subject is
//   protect - good for you whoever the subject is
export const CATEGORIES = [
    {
        id: 'waiver', label: 'Rights waiver', kind: 'burden', weight: 3,
        pattern: /\b(?:waiv(?:e|es|ed|er|ing)|forfeit\w*|relinquish\w*|surrender\w*|releas(?:e|es|ed|ing)\b[^.;]{0,40}\bclaims?)\b/gi
    },
    {
        id: 'ip', label: 'Rights grab', kind: 'burden', weight: 2.6,
        pattern: /\b(?:perpetual(?:ly)?|in perpetuity|irrevocabl[ey]|royalty[- ]free|sub-?licens\w*|assigns? (?:all|any|to)\b|assignment of|moral rights|throughout the (?:world|universe)|worldwide licen[cs]e|in any media|now known or hereafter|fully transferable|exclusive (?:licen[cs]e|rights?))/gi
    },
    {
        id: 'indemnity', label: 'Indemnity', kind: 'burden', weight: 2.6,
        pattern: /\b(?:indemnif\w*|indemnity|hold\w* harmless)\b/gi
    },
    {
        id: 'liability', label: 'Liability shield', kind: 'power', weight: 2.4,
        pattern: /\b(?:(?:not|no|nor|never)\b[^.;]{0,60}\b(?:liable|liability|responsib\w+)|limitation of liability|disclaim\w*|as[- ]is\b|without warrant(?:y|ies)|exclu\w+ (?:all |any )?(?:liability|warranties))/gi
    },
    {
        id: 'unilateral', label: 'One-sided power', kind: 'power', weight: 2.2,
        pattern: /\b(?:at any time|for any reason(?: or no reason)?|reserves? the right|may (?:modify|change|amend|alter|update|revise|suspend|remove|delete|increase))\b/gi
    },
    {
        id: 'unchecked', label: 'One-sided power', kind: 'harm', weight: 2.2,
        pattern: /\b(?:sole (?:and absolute )?discretion|without (?:prior |further |any )?notice|from time to time|final and binding|decisions? (?:is|are) final)\b/gi
    },
    {
        id: 'termination', label: 'Termination', kind: 'power', weight: 1.8,
        pattern: /\b(?:terminat\w+|evict\w*)\b/gi
    },
    {
        id: 'lockin', label: 'Lock-in and fees', kind: 'harm', weight: 1.9,
        pattern: /\b(?:automatic(?:ally)? renew\w*|auto-?renew\w*|non-?refundable|(?:cancellation|early termination|late|administration|exit) fees?|penalt(?:y|ies)|minimum term|recoup\w*|deduct\w*|interest at|at (?:\w+['’]?s? ){1,2}own (?:risk|cost|expense))\b/gi
    },
    {
        id: 'dispute', label: 'Dispute limits', kind: 'harm', weight: 2,
        pattern: /\b(?:arbitrat\w+|class[- ]action|jury trial|exclusive jurisdiction)\b/gi
    },
    {
        id: 'data', label: 'Data use', kind: 'harm', weight: 1.8,
        pattern: /\b(?:(?:shar|sell|disclos|transferr?)(?:e|es|ing)?\b[^.;]{0,40}\b(?:data|information)\b[^.;]{0,30}\bthird part(?:y|ies)|(?:data|information)\b[^.;]{0,40}\b(?:shared|sold) (?:to|with)|track\w* your|monitor\w* your|targeted advertis\w+)/gi
    },
    {
        id: 'restrict', label: 'Restriction', kind: 'burden', weight: 1.4,
        pattern: /\b(?:shall not|may not|must not|will not|not permitted|prohibited|non-?compete|exclusiv(?:e|ely|ity)|solely responsible)\b/gi
    },
    {
        id: 'grant', label: 'Licence grant', kind: 'burden', weight: 1.2,
        pattern: /\b(?:hereby )?grants?\b/gi
    },
    {
        id: 'obligation', label: 'Obligation', kind: 'burden', weight: 1, needsSubject: true,
        pattern: /\b(?:shall|must|agrees? to|(?:is|are) required to|undertakes? to|(?:is|are) responsible for|acknowledges? and agrees?|represents? and warrants?|warrants? that)\b/gi
    },
    {
        // "without your consent" protects you when it limits somebody
        // ("shall not ... without your consent") and hurts you when it frees them
        id: 'consent', label: 'Consent', kind: 'consent', weight: 2.2,
        pattern: /\bwithout (?:the |your |their |its )?(?:prior |express |explicit )*(?:written )?(?:consent|permission|approval)\b/gi
    },
    {
        id: 'protect', label: 'Protection', kind: 'protect', weight: 2.2,
        pattern: /\b(?:refund\w*|your (?:total |maximum |entire )?liability\b[^.;]{0,40}\b(?:limited|capped)|right to (?:cancel|withdraw|terminate|access|erasure|rectif\w+|object|opt[- ]out|a refund|be forgotten|portability)|do(?:es)? not claim|(?:will|shall) (?:not|never) (?:sell|share)|never (?:sell|share)|free of charge|at no (?:cost|charge)|money[- ]back|cooling[- ]off|opt[- ]out|good faith|remains? (?:yours|your property|the property of)|retains? (?:all |full )?(?:ownership|rights|copyright)|nothing (?:contained )?(?:herein|in this agreement) (?:will|shall) give)/gi
    },
    {
        id: 'notice', label: 'Fair warning', kind: 'protect', weight: 0.9,
        pattern: /\b(?:reasonable (?:prior )?notice|(?:prior )?written notice|\d+ (?:calendar |business |working )?days['’]? (?:prior |written )*notice|notify you|promptly notify)\b/gi
    }
]

// words that widen the scope of whatever they are attached to
export const AMPLIFIER = /\b(?:any and all|all|any|every|whatsoever|unlimited|absolute|entire|fully|forever|sole|solely|unconditional\w*)\b/gi

// turns the meaning of the thing that follows it around
export const NEGATOR = /(?:\b(?:not|no|never|nor|neither|cannot)|n['’]t|\bnon)[\s-]+(?:\w+\s+){0,2}$/i

// how individual words read on their own, from minus three to plus three
export const WORDS = {}

const rate = (score, words) => words.split(' ').forEach(word => WORDS[word] = score)

rate(-3, 'waive waives waived waiver forfeit forfeits forfeited forfeiture irrevocable irrevocably perpetuity indemnify indemnifies indemnification indemnity penalty penalties surrender relinquish exploited exploitation evict eviction non-refundable nonrefundable unilaterally non-compete')
rate(-2, 'perpetual liable liability liabilities breach terminate terminated termination suspend suspension damages arbitration deduct deducted recoup recoupable unrecouped disclaim disclaims disclaimer exploit prohibited default royalty-free sublicense sublicensable withhold lien sue infringement revoke harmless universe')
rate(-1, 'exclusive exclusively binding bound assign assigns obligation obligations must restrict restricted restriction restrictions sole discretion transferable worldwide void monitor track unlimited whatsoever notwithstanding cease')
rate(1, 'consent retain retains own owns ownership reasonable reasonably notify notice warranty royalty royalties privacy secure free remedy benefit benefits right rights promptly cancel')
rate(2, 'refund refunds refundable protect protects protected protection entitled entitlement guarantee guarantees guaranteed fair fairly mutual mutually compensate compensation reimburse safeguard opt-out')

// general sentiment lists think these are emotional. in a contract they are not
rate(0, 'agree agrees agreed agreement party parties share shares shared interest interests united union justice like matter matters legal kind natural certain grant grants granted claim claims limited no yes allow please solution top support careful award awarded competition judges want wants fee fees charge charges')
