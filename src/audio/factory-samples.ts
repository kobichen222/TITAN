/**
 * Factory samples — pure DSP generators for the 64 built-in pads
 * (4 banks × 16 pads: DRUMS / BASS / FX / LOOPS).
 *
 * The legacy renderer (public/legacy/app.js, _spVoices + loadDefaultSamples)
 * synthesises every sample from scratch on first boot so the app ships zero
 * audio files.  This module pulls the same DSP into a Web-Audio-free shape:
 * each voice returns a Float32Array of mono samples, the renderer wraps the
 * result in an AudioBuffer.
 *
 * Why split: the DSP is straight maths — exponential decays, additive sines,
 * simple band-limited saw approximations, white-noise envelopes — and is
 * trivially testable without an AudioContext.  The renderer's only remaining
 * responsibility is `audioCtx.createBuffer().getChannelData(0).set(buffer)`.
 *
 * Behaviour parity with the legacy implementation is checked in
 * src/audio/__tests__/factory-samples.test.ts.
 */

/** A pure DSP generator: receives the destination buffer + the sample-rate. */
export type Renderer = (
  dst: Float32Array,
  sampleRate: number,
  length: number,
) => void;

/** Default sample rate — matches the legacy AudioContext default on most desktops. */
export const DEFAULT_SAMPLE_RATE = 44100;

/** Trailing fade-out in seconds (legacy used 6 ms to suppress click on cut-off). */
export const TAIL_FADE_SECONDS = 0.006;

/**
 * Render `seconds` of mono audio at `sampleRate`, applying the standard
 * trailing fade-out used by every factory voice.  Pure — no AudioContext.
 */
export function renderToFloat32(
  seconds: number,
  render: Renderer,
  sampleRate: number = DEFAULT_SAMPLE_RATE,
): Float32Array {
  const length = Math.max(1, Math.floor(sampleRate * seconds));
  const dst = new Float32Array(length);
  render(dst, sampleRate, length);
  const fade = Math.min(length, Math.floor(sampleRate * TAIL_FADE_SECONDS));
  for (let i = 0; i < fade; i++) {
    dst[length - 1 - i] = (dst[length - 1 - i] ?? 0) * (i / fade);
  }
  return dst;
}

const TAU = Math.PI * 2;
const sin = Math.sin;
const exp = Math.exp;
const floor = Math.floor;

/** band-limited-ish saw approximation matching the legacy `2*(t*f - floor(t*f+0.5))` form. */
function saw(t: number, f: number): number {
  return 2 * (t * f - floor(t * f + 0.5));
}

/** White noise sample, [-1, 1]. */
function nz(): number {
  return Math.random() * 2 - 1;
}

/** Helper used by chromatic voices — MIDI note → frequency in Hz (A4=440). */
export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** Convert a MIDI note number to its scientific-pitch label (e.g. 60 → "C4"). */
export function midiToName(midi: number): string {
  return `${NOTE_NAMES[midi % 12]}${floor(midi / 12 - 1)}`;
}

/* ---------- DRUMS (Bank A) ---------- */

const drum = {
  kick808: () =>
    renderToFloat32(0.55, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const f = 55 * exp(-t * 8) + 32;
        d[i] = sin(TAU * f * t) * exp(-t * 3.2) * 0.95;
      }
    }),
  kickHouse: () =>
    renderToFloat32(0.28, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const f = 150 * exp(-t * 30) + 55;
        d[i] = sin(TAU * f * t) * exp(-t * 13) * 0.92;
        if (t < 0.003) d[i] += nz() * 0.6;
      }
    }),
  snare: () =>
    renderToFloat32(0.25, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const tone = sin(TAU * 190 * t) + 0.3 * sin(TAU * 265 * t);
        d[i] = tone * exp(-t * 16) * 0.4 + nz() * exp(-t * 9) * 0.52;
      }
    }),
  clap: () =>
    renderToFloat32(0.32, (d, sr, n) => {
      const bursts = [0, 0.012, 0.025, 0.04];
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        let env = 0;
        for (const b of bursts) {
          const dt = t - b;
          if (dt >= 0) env += exp(-dt * 38);
        }
        d[i] = nz() * Math.min(env, 1.1) * 0.55;
      }
    }),
  hatClosed: () =>
    renderToFloat32(0.06, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        d[i] = nz() * exp(-t * 85) * 0.42;
      }
    }),
  hatOpen: () =>
    renderToFloat32(0.38, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        d[i] = nz() * exp(-t * 6.5) * 0.38;
      }
    }),
  ride: () =>
    renderToFloat32(0.85, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const tone = sin(TAU * 3500 * t) + sin(TAU * 5200 * t) * 0.5;
        d[i] = (nz() * 0.55 + tone * 0.12) * exp(-t * 2.8) * 0.35;
      }
    }),
  crash: () =>
    renderToFloat32(1.7, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        d[i] = nz() * exp(-t * 2.1) * 0.42;
      }
    }),
  tomHi: () =>
    renderToFloat32(0.32, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const f = 230 * exp(-t * 6.5) + 160;
        d[i] = sin(TAU * f * t) * exp(-t * 7) * 0.75;
      }
    }),
  tomLow: () =>
    renderToFloat32(0.38, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const f = 110 * exp(-t * 6) + 75;
        d[i] = sin(TAU * f * t) * exp(-t * 6.5) * 0.8;
      }
    }),
  rim: () =>
    renderToFloat32(0.08, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const tone = sin(TAU * 1700 * t);
        d[i] = (tone * 0.7 + nz() * 0.5) * exp(-t * 48) * 0.55;
      }
    }),
  cowbell: () =>
    renderToFloat32(0.42, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const tone = sin(TAU * 540 * t) + sin(TAU * 800 * t) * 0.8;
        d[i] = tone * exp(-t * 4.6) * 0.26;
      }
    }),
  conga: () =>
    renderToFloat32(0.3, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const f = 260 * exp(-t * 10) + 180;
        d[i] = sin(TAU * f * t) * exp(-t * 9) * 0.56;
      }
    }),
  shaker: () =>
    renderToFloat32(0.1, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = exp(-t * 42) * Math.min(1, t * 60);
        d[i] = nz() * env * 0.32;
      }
    }),
  percHi: () =>
    renderToFloat32(0.18, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        d[i] = sin(TAU * 1100 * t) * exp(-t * 22) * 0.5;
      }
    }),
  percLow: () =>
    renderToFloat32(0.22, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        d[i] = sin(TAU * 420 * t) * exp(-t * 18) * 0.55;
      }
    }),
};

/* ---------- BASS (Bank B) ---------- */

function bassNote(midi: number): Float32Array {
  const f = midiToHz(midi);
  return renderToFloat32(0.7, (d, sr, n) => {
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const env = Math.min(1, t * 80) * exp(-t * 3.2);
      d[i] = (saw(t, f) * 0.55 + sin(TAU * f * 0.5 * t) * 0.5) * env * 0.7;
    }
  });
}

/* ---------- SYNTH & FX (Bank C) ---------- */

const fx = {
  stab: () =>
    renderToFloat32(0.4, (d, sr, n) => {
      const r = 220;
      const chord = [r, r * Math.pow(2, 3 / 12), r * Math.pow(2, 7 / 12), r * Math.pow(2, 10 / 12)];
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        let v = 0;
        for (const f of chord) v += saw(t, f);
        v /= chord.length;
        d[i] = v * exp(-t * 6) * Math.min(1, t * 80) * 0.55;
      }
    }),
  lead: (f: number) =>
    renderToFloat32(0.55, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        d[i] = saw(t, f) * exp(-t * 3) * Math.min(1, t * 80) * 0.55;
      }
    }),
  pluck: (f: number) =>
    renderToFloat32(0.4, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const v = sin(TAU * f * t) + sin(TAU * f * 2 * t) * 0.3;
        d[i] = v * exp(-t * 12) * 0.48;
      }
    }),
  chord: () =>
    renderToFloat32(1.4, (d, sr, n) => {
      const base = 220;
      const freqs = [base, base * Math.pow(2, 3 / 12), base * Math.pow(2, 7 / 12)];
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        let v = 0;
        for (const f of freqs) v += sin(TAU * f * t) + saw(t, f * 2) * 0.15;
        v /= freqs.length;
        d[i] = v * exp(-t * 1.5) * Math.min(1, t * 4) * 0.5;
      }
    }),
  sub: () =>
    renderToFloat32(0.9, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        d[i] = sin(TAU * 50 * t) * exp(-t * 1.5) * Math.min(1, t * 20) * 0.95;
      }
    }),
  laser: () =>
    renderToFloat32(0.35, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const f = 2000 * exp(-t * 6) + 200;
        d[i] = sin(TAU * f * t) * exp(-t * 4) * 0.5;
      }
    }),
  zap: () =>
    renderToFloat32(0.22, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const f = 800 * exp(-t * 10) + 100;
        d[i] = saw(t, f) * exp(-t * 10) * 0.55;
      }
    }),
  sweepUp: () =>
    renderToFloat32(1.2, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const f = 100 * Math.pow(16, t / 1.2);
        d[i] = (nz() * 0.45 + sin(TAU * f * t) * 0.32) * (t / 1.2) * 0.5;
      }
    }),
  sweepDn: () =>
    renderToFloat32(1.2, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const f = 1600 * exp(-t * 2.2);
        d[i] = (nz() * 0.4 + sin(TAU * f * t) * 0.3) * (1 - t / 1.2) * 0.5;
      }
    }),
  noiseUp: () =>
    renderToFloat32(1.5, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        d[i] = nz() * (t / 1.5) * 0.5;
      }
    }),
  pad: () =>
    renderToFloat32(2.0, (d, sr, n) => {
      const freqs = [220, 261.63, 329.63, 440];
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        let v = 0;
        freqs.forEach((f, j) => {
          v += sin(TAU * f * t) * (1 - j * 0.12);
        });
        v /= freqs.length;
        d[i] = v * Math.min(1, t * 1.6) * exp(-t * 0.9) * 0.48;
      }
    }),
  bell: () =>
    renderToFloat32(1.3, (d, sr, n) => {
      const f = 880;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const v =
          sin(TAU * f * t) + sin(TAU * f * 2 * t) * 0.5 + sin(TAU * f * 3 * t) * 0.25;
        d[i] = v * exp(-t * 1.9) * 0.32;
      }
    }),
  sqrLead: (f: number) =>
    renderToFloat32(0.4, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        d[i] = (sin(TAU * f * t) > 0 ? 1 : -1) * exp(-t * 5) * 0.45;
      }
    }),
  sawLead: (f: number) =>
    renderToFloat32(0.4, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        d[i] = saw(t, f) * exp(-t * 4) * 0.5;
      }
    }),
  blip: () =>
    renderToFloat32(0.08, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        d[i] = sin(TAU * 1200 * t) * exp(-t * 40) * 0.5;
      }
    }),
  whoosh: () =>
    renderToFloat32(0.9, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        d[i] = nz() * exp(-Math.pow((t - 0.45) * 3.6, 2)) * 0.55;
      }
    }),
};

/* ---------- LOOPS & VOX (Bank D) ---------- */

const loops = {
  horn: (base: number) =>
    renderToFloat32(0.45, (d, sr, n) => {
      const freqs = [base, base * Math.pow(2, 4 / 12), base * Math.pow(2, 7 / 12)];
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        let v = 0;
        for (const f of freqs) v += saw(t, f) + sin(TAU * f * t) * 0.3;
        v /= freqs.length;
        d[i] = v * Math.min(1, t * 120) * exp(-t * 3.5) * 0.58;
      }
    }),
  hit: () =>
    renderToFloat32(0.7, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const f = 60 * exp(-t * 4) + 30;
        d[i] = (sin(TAU * f * t) * 0.65 + nz() * 0.28) * exp(-t * 3);
      }
    }),
  rumble: () =>
    renderToFloat32(1.4, (d, sr, n) => {
      let p = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        p = p * 0.985 + nz() * 0.015;
        d[i] = p * exp(-t * 1.1) * 4.5;
      }
    }),
  kickLoop: () => {
    const bpm = 128;
    const step = 60 / bpm;
    return renderToFloat32(step * 4, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const local = t % step;
        const f = 150 * exp(-local * 28) + 55;
        d[i] = sin(TAU * f * local) * exp(-local * 13) * 0.85;
      }
    });
  },
  percLoop: () => {
    const bpm = 128;
    const step = 60 / bpm / 4;
    return renderToFloat32(step * 16, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const idx = floor(t / step);
        const local = t - idx * step;
        const hit = [0, 3, 5, 9, 11, 13].includes(idx % 16);
        const f = 200 + ((idx * 7) % 11) * 30;
        d[i] = hit ? sin(TAU * f * local) * exp(-local * 25) * 0.42 : 0;
      }
    });
  },
  hatLoop: () => {
    const bpm = 128;
    const beat = 60 / bpm;
    const half = beat / 2;
    return renderToFloat32(beat * 4, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const halfIdx = floor(t / half);
        const local = t - halfIdx * half;
        d[i] = halfIdx % 2 === 1 ? nz() * exp(-local * 65) * 0.5 : 0;
      }
    });
  },
  vox1: () =>
    renderToFloat32(0.35, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const f = 440 + sin(TAU * 6 * t) * 40;
        d[i] = (saw(t, f) * 0.5 + nz() * 0.15) * exp(-t * 3.5) * Math.min(1, t * 25) * 0.55;
      }
    }),
  vox2: () =>
    renderToFloat32(0.4, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const f = 660 + sin(TAU * 8 * t) * 50;
        d[i] = (sin(TAU * f * t) * 0.5 + saw(t, f) * 0.35) * exp(-t * 3) * Math.min(1, t * 30) * 0.55;
      }
    }),
  airhorn: () =>
    renderToFloat32(0.6, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const f = 330 + sin(TAU * 12 * t) * 8;
        const v = saw(t, f) + saw(t, f * 1.5) * 0.6;
        d[i] = v * Math.min(1, t * 20) * exp(-t * 1.5) * 0.45;
      }
    }),
  siren: () =>
    renderToFloat32(1.2, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const f = 500 + sin(TAU * 1.6 * t) * 200;
        d[i] = sin(TAU * f * t) * 0.45 * Math.min(1, t * 6);
      }
    }),
  scratch: () =>
    renderToFloat32(0.35, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const ph = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.2;
        const f = 300 + ph * 1400;
        d[i] =
          (sin(TAU * f * t) * 0.5 + nz() * 0.2) *
          Math.min(1, t * 20) *
          exp(-Math.max(0, t - 0.25) * 20) *
          0.55;
      }
    }),
  vinylCrackle: () =>
    renderToFloat32(1.5, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const crackle = Math.random() < 0.003 ? nz() : 0;
        d[i] = crackle * exp(-t * 0.5) * 0.7;
      }
    }),
  fxDrop: () =>
    renderToFloat32(0.8, (d, sr, n) => {
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const f = 800 * exp(-t * 5);
        d[i] = (sin(TAU * f * t) * 0.6 + nz() * exp(-t * 2) * 0.3) * 0.55;
      }
    }),
};

/* ---------- BANK REGISTRY ---------- */

export interface FactoryPad {
  name: string;
  generate: () => Float32Array;
}

const BASS_MIDI = [24, 26, 28, 29, 31, 33, 35, 36, 38, 40, 41, 43, 45, 47, 48, 50] as const;

export const BANK_DRUMS: readonly FactoryPad[] = [
  { name: 'KICK 808', generate: drum.kick808 },
  { name: 'KICK', generate: drum.kickHouse },
  { name: 'SNARE', generate: drum.snare },
  { name: 'CLAP', generate: drum.clap },
  { name: 'HAT', generate: drum.hatClosed },
  { name: 'OPEN HAT', generate: drum.hatOpen },
  { name: 'RIDE', generate: drum.ride },
  { name: 'CRASH', generate: drum.crash },
  { name: 'TOM HI', generate: drum.tomHi },
  { name: 'TOM LO', generate: drum.tomLow },
  { name: 'RIM', generate: drum.rim },
  { name: 'COWBELL', generate: drum.cowbell },
  { name: 'CONGA', generate: drum.conga },
  { name: 'SHAKER', generate: drum.shaker },
  { name: 'PERC HI', generate: drum.percHi },
  { name: 'PERC LO', generate: drum.percLow },
];

export const BANK_BASS: readonly FactoryPad[] = BASS_MIDI.map((m) => ({
  name: `BASS ${midiToName(m)}`,
  generate: () => bassNote(m),
}));

export const BANK_FX: readonly FactoryPad[] = [
  { name: 'STAB', generate: fx.stab },
  { name: 'LEAD A', generate: () => fx.lead(440) },
  { name: 'PLUCK', generate: () => fx.pluck(587) },
  { name: 'CHORD', generate: fx.chord },
  { name: 'SUB', generate: fx.sub },
  { name: 'LASER', generate: fx.laser },
  { name: 'ZAP', generate: fx.zap },
  { name: 'SWEEP UP', generate: fx.sweepUp },
  { name: 'SWEEP DN', generate: fx.sweepDn },
  { name: 'NOISE UP', generate: fx.noiseUp },
  { name: 'PAD', generate: fx.pad },
  { name: 'BELL', generate: fx.bell },
  { name: 'SQR LEAD', generate: () => fx.sqrLead(440) },
  { name: 'SAW LEAD', generate: () => fx.sawLead(660) },
  { name: 'BLIP', generate: fx.blip },
  { name: 'WHOOSH', generate: fx.whoosh },
];

export const BANK_LOOPS: readonly FactoryPad[] = [
  { name: 'HORN LO', generate: () => loops.horn(220) },
  { name: 'HORN MID', generate: () => loops.horn(277) },
  { name: 'HORN HI', generate: () => loops.horn(330) },
  { name: 'HIT', generate: loops.hit },
  { name: 'KICK LOOP', generate: loops.kickLoop },
  { name: 'PERC LOOP', generate: loops.percLoop },
  { name: 'HAT LOOP', generate: loops.hatLoop },
  { name: 'RUMBLE', generate: loops.rumble },
  { name: 'VOX 1', generate: loops.vox1 },
  { name: 'VOX 2', generate: loops.vox2 },
  { name: 'AIRHORN', generate: loops.airhorn },
  { name: 'SIREN', generate: loops.siren },
  { name: 'SCRATCH', generate: loops.scratch },
  { name: 'CRACKLE', generate: loops.vinylCrackle },
  { name: 'DROP', generate: loops.fxDrop },
  { name: 'LASER 2', generate: fx.laser },
];

export const FACTORY_BANKS: readonly (readonly FactoryPad[])[] = [
  BANK_DRUMS,
  BANK_BASS,
  BANK_FX,
  BANK_LOOPS,
];

/** Total number of pads across all banks (4 × 16 = 64). */
export const FACTORY_PAD_COUNT = FACTORY_BANKS.reduce((n, b) => n + b.length, 0);
