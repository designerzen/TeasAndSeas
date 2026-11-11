# Teas&Seas
Teas and Seas is a tool that generates music from legal documents.

It reads a contract out loud, karaoke style, over music that follows what the words do to the person signing: bright when a term is on your side, uneasy when it is not, and doom when it is exploitative. At the end it delivers a verdict.

Pick one of the built in contracts, upload your own (text, PDF or Word), or paste the words in.

The tool is built using web technology and runs entirely in the browser.

Licensed under the Apache License, Version 2.0.


## Installation

```npm install```

## Running

```npm start``` then open the address it prints

```npm test``` runs the tests

```npm run build``` builds the site into `dist`

Pushing to `master` tests, builds and publishes the site to GitHub Pages (`.github/workflows/deploy.yml`)


## How it works

### 1. Reading
`src/text.js` splits the contract into sentences and then into phrases short enough to speak and show in one go. Phrases break where the direction changes, such as at "provided that".

### 2. Understanding
General sentiment word lists rate how words *feel*, but contracts are written to feel like nothing at all. What matters is who carries the burden, so `src/analyser.js` looks for kinds of clause (`src/lexicon.js`) and works out who each one lands on:

| Kind | Example | Good for |
|---|---|---|
| Burden | "*you* waive" / "*we* shall pay" | whoever is **not** the subject |
| Power | "*we* may terminate" / "*you* may cancel" | whoever **is** the subject |
| Harm | "binding arbitration", "non-refundable" | them |
| Protection | "refund", "right to erasure" | you |

Every phrase ends up with a **valence** (-1 bad for you, +1 good for you) and a **severity** (0 harmless, 1 exploitative). Phrases above 0.6 severity are *doom*.

To teach it new tricks, add a pattern to `CATEGORIES`, a party to `PARTY_YOU` / `PARTY_THEM` or a word to `WORDS` in `src/lexicon.js`.

Optionally, paste an Anthropic API key into "Get a second opinion from Claude" and Claude will read the contract and score the phrases instead (`src/second-opinion.js`). The key stays in the browser tab and the contract is sent directly to Anthropic.

### 3. Composing
`src/composer.js` turns the mood of each phrase into bars of music:

| Contract | Music |
|---|---|
| Valence | Mode, from darkest to brightest: Locrian, Phrygian, Aeolian, Dorian, Mixolydian, Ionian, Lydian. The home note never moves so the change is heard as light, not key |
| Severity | Tempo, drum pattern, distortion, reverb and a closing filter |
| Doom | 60 bpm half-time drums, a sub drone, a cluster chord and a tolling bell |
| "Provided that..." | A surprise chord |
| Who benefits | *You* are a high bell-like voice, *they* are low brass. Whoever is winning carries the tune |
| The words | The melody: syllables set the rhythm, good words climb and bad words fall |
| The verdict | The ending: a full cadence, a suspended chord left hanging, or a tritone and three tolls of the bell |

`src/audio.js` plays it live with [Tone.js](https://tonejs.github.io/), a beat at a time so that the music can turn as soon as the words do. `src/midi.js` writes the same notes to a MIDI file.

### 4. Performing
`src/visuals.js` lights the words up, colours the room to match the mood and draws the map of the whole contract, which is also the seek bar.

The narrator is chosen from the voice menu. There are three kinds:

| Kind | Voices | What happens |
|---|---|---|
| Sings the tune | SAM (the talking computer of 1982), eSpeak | Every word is rendered on its note of the melody and squeezed or stretched to fill that note, so the words land on the beat. The best words get a harmony above and the worst a shadow below |
| Speaks in key | Kokoro, Piper | The phrase is spoken naturally, starting on a beat, with each word nudged to the nearest note of the home chord |
| Just speaks | Whatever the browser has | The browser plays these itself, so the band cannot hear them and follows along instead |

The first two kinds hand over the sound itself, so they share the band's reverb, get distorted as the terms get worse and are joined by a second voice an octave below for doom. Each has two characters, one for terms that favour you and one for terms that favour them.

`src/voices` holds the voices, which all run in workers so that they never make the band miss a beat. `src/singer.js` turns a voice and a phrase into a performance, using `src/pitch.js` to hear what note a voice is on. `src/speech.js` drives the browser's own voices.

Things to know about the voices:

- Kokoro (about 330MB with a graphics card, 90MB without) and Piper (about 120MB) download their models from Hugging Face the first time they are chosen. Without WebGPU, Kokoro takes several times longer to say a phrase than the phrase lasts, so the band vamps in between.
- The natural voices do not say where each word is, so the karaoke timing for them is an estimate lined up with the pauses.
- eSpeak is licensed under the GPL, and SAM is reverse engineered abandonware with no licence at all. Take both into account before distributing a build.

Space pauses, the arrow keys skip between phrases and escape goes back to the list.


## Adding a contract

Drop a text file into `src/presets` and describe it in `src/presets/index.js`. Link straight to one with `?contract=its-id`.


## Disclaimer

This is a musical instrument, not a lawyer. Nothing it plays is legal advice.
