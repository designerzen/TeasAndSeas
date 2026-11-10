// The list of contracts that ship with the app.
// To add one, drop a text file in this folder and describe it here.

const files = import.meta.glob('./*.txt', { query: '?url', import: 'default', eager: true })

const list = [
    { id: 'hackathon', file: 'tc-full.txt', title: 'Hackathon T&C’s', note: 'The one that started it all' },
    { id: 'hackathon-short', file: 'tc-stripped.txt', title: 'Hackathon T&C’s (shouty bit)', note: 'Just the capital letters' },
    { id: 'record-deal', file: 'record-deal.txt', title: 'Record deal', note: 'Fictional, sadly familiar' },
    { id: 'social-app', file: 'social-app.txt', title: 'Social app terms', note: 'Fictional' },
    { id: 'tenancy', file: 'tenancy.txt', title: 'Tenancy agreement', note: 'Fictional' },
    { id: 'fair-freelance', file: 'fair-freelance.txt', title: 'Fair freelance agreement', note: 'Fictional, how it could be' },
    { id: 'brexit', file: 'brexit.txt', title: 'Brexit', note: 'Draft withdrawal agreement. Bring snacks' }
]

export const presets = list
    .map(preset => ({ ...preset, url: files[`./${preset.file}`] }))
    .filter(preset => preset.url)
