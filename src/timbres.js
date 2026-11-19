// The colours of the band.
// Each emotion dresses the chords and the arpeggio in a different sound, so
// that a change of heart is heard in the instruments as well as the notes.
// Partials are harmonic amplitudes starting at the fundamental. These are
// synthesised sketches, not imitations of real instruments
//
// program is the general midi instrument written to the MIDI file

export const TIMBRES = {
    // wide, bright strings and a sparkling pluck
    celebrating: {
        pad: {
            oscillator: { type: 'fatsawtooth', count: 3, spread: 32 },
            envelope: { attack: 0.25, decay: 0.4, sustain: 0.8, release: 1.6 }
        },
        arp: {
            oscillator: { type: 'custom', partials: [1, 0.5, 0.33, 0.25, 0.12, 0.08] },
            envelope: { attack: 0.002, decay: 0.18, sustain: 0.05, release: 0.3 }
        },
        programs: { pad: 48, arp: 46 }
    },
    // warm and rounded
    happy: {
        pad: {
            oscillator: { type: 'fattriangle', count: 3, spread: 20 },
            envelope: { attack: 0.2, decay: 0.4, sustain: 0.75, release: 1.4 }
        },
        arp: {
            oscillator: { type: 'custom', partials: [1, 0.5, 0.16, 0.25, 0.07, 0.1] },
            envelope: { attack: 0.003, decay: 0.14, sustain: 0.06, release: 0.25 }
        },
        programs: { pad: 89, arp: 24 }
    },
    // soft air that breathes in and out, and glass
    calm: {
        pad: {
            oscillator: { type: 'fatcustom', partials: [1, 0.08, 0.22, 0.04, 0.1, 0.025, 0.04], count: 3, spread: 18 },
            envelope: { attack: 0.8, decay: 0.5, sustain: 0.7, release: 2.4 }
        },
        arp: {
            oscillator: { type: 'custom', partials: [1, 0, 0.1, 0, 0.04] },
            envelope: { attack: 0.004, decay: 0.6, sustain: 0.02, release: 1.2 }
        },
        programs: { pad: 91, arp: 98 }
    },
    // a reedy organ that holds its breath
    uncertain: {
        pad: {
            oscillator: { type: 'custom', partials: [1, 0.7, 0.45, 0.6, 0.08, 0.2, 0.03, 0.15] },
            envelope: { attack: 0.06, decay: 0.1, sustain: 0.85, release: 0.6 }
        },
        arp: {
            oscillator: { type: 'custom', partials: [1, 0.12, 0.65, 0.08, 0.32, 0.05, 0.15] },
            envelope: { attack: 0.02, decay: 0.12, sustain: 0.3, release: 0.2 }
        },
        programs: { pad: 19, arp: 71 }
    },
    // slow bowed strings and a muted pluck
    sad: {
        pad: {
            oscillator: { type: 'fatcustom', partials: [1, 0.65, 0.45, 0.3, 0.2, 0.14, 0.1, 0.07], count: 3, spread: 12 },
            envelope: { attack: 0.6, decay: 0.5, sustain: 0.7, release: 2 }
        },
        arp: {
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.005, decay: 0.3, sustain: 0.05, release: 0.5 }
        },
        programs: { pad: 49, arp: 46 }
    },
    // nasal and buzzing, with a clav that nags
    frustrated: {
        pad: {
            oscillator: { type: 'fatsquare', count: 2, spread: 24 },
            envelope: { attack: 0.04, decay: 0.3, sustain: 0.6, release: 0.5 }
        },
        arp: {
            oscillator: { type: 'custom', partials: [1, 0.8, 0.2, 0.45, 0.1, 0.25] },
            envelope: { attack: 0.001, decay: 0.05, sustain: 0.03, release: 0.05 }
        },
        programs: { pad: 81, arp: 7 }
    },
    // a vast, slow, out of tune choir of saws
    doom: {
        pad: {
            oscillator: { type: 'fatsawtooth', count: 4, spread: 45 },
            envelope: { attack: 1, decay: 0.5, sustain: 0.9, release: 3 }
        },
        arp: {
            oscillator: { type: 'sine' },
            envelope: { attack: 0.01, decay: 0.4, sustain: 0, release: 0.4 }
        },
        programs: { pad: 95, arp: 88 }
    }
}
