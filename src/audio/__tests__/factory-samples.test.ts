import { describe, it, expect } from 'vitest';
import {
  BANK_BASS,
  BANK_DRUMS,
  BANK_FX,
  BANK_LOOPS,
  DEFAULT_SAMPLE_RATE,
  FACTORY_BANKS,
  FACTORY_PAD_COUNT,
  TAIL_FADE_SECONDS,
  midiToHz,
  midiToName,
  renderToFloat32,
} from '../factory-samples';

describe('renderToFloat32 — pure DSP host', () => {
  it('produces a Float32Array of the expected length', () => {
    const buf = renderToFloat32(0.5, (d) => d.fill(0.25), 48000);
    expect(buf).toBeInstanceOf(Float32Array);
    expect(buf.length).toBe(24000);
  });

  it('clamps zero / negative seconds to a 1-sample buffer', () => {
    expect(renderToFloat32(0, () => undefined, 44100).length).toBe(1);
    expect(renderToFloat32(-1, () => undefined, 44100).length).toBe(1);
  });

  it('applies a 6 ms fade at the tail (last sample is silent, just-before-tail is full)', () => {
    const sr = 44100;
    const seconds = 0.1;
    const buf = renderToFloat32(seconds, (d) => d.fill(1), sr);
    expect(buf[buf.length - 1]).toBe(0); // very last sample multiplied by 0/fade
    const fadeLen = Math.floor(sr * TAIL_FADE_SECONDS);
    // Just before the fade window the signal should still be at its full value.
    expect(buf[buf.length - 1 - fadeLen]).toBe(1);
  });

  it('uses the default sample rate when the third arg is omitted', () => {
    const buf = renderToFloat32(0.01, () => undefined);
    expect(buf.length).toBe(Math.floor(DEFAULT_SAMPLE_RATE * 0.01));
  });
});

describe('midiToHz / midiToName', () => {
  it('A4 → 440 Hz', () => {
    expect(midiToHz(69)).toBeCloseTo(440, 6);
  });

  it('C4 → 261.625 Hz', () => {
    expect(midiToHz(60)).toBeCloseTo(261.625565, 4);
  });

  it('names octaves correctly', () => {
    expect(midiToName(60)).toBe('C4');
    expect(midiToName(69)).toBe('A4');
    expect(midiToName(24)).toBe('C1');
    expect(midiToName(50)).toBe('D3');
  });
});

describe('factory bank registry', () => {
  it('has exactly 64 pads across 4 banks', () => {
    expect(FACTORY_BANKS.length).toBe(4);
    expect(FACTORY_PAD_COUNT).toBe(64);
    for (const bank of FACTORY_BANKS) expect(bank.length).toBe(16);
  });

  it('every pad has a non-empty name', () => {
    for (const bank of FACTORY_BANKS) {
      for (const pad of bank) {
        expect(pad.name.length).toBeGreaterThan(0);
      }
    }
  });

  it('the four banks line up with the legacy DRUMS / BASS / FX / LOOPS labels', () => {
    expect(FACTORY_BANKS[0]).toBe(BANK_DRUMS);
    expect(FACTORY_BANKS[1]).toBe(BANK_BASS);
    expect(FACTORY_BANKS[2]).toBe(BANK_FX);
    expect(FACTORY_BANKS[3]).toBe(BANK_LOOPS);
  });

  it('BANK_BASS labels are scientific-pitch names (BASS C1..D3)', () => {
    expect(BANK_BASS[0]?.name).toBe('BASS C1');
    expect(BANK_BASS[15]?.name).toBe('BASS D3');
  });
});

describe('every pad generator produces valid audio', () => {
  for (const bank of FACTORY_BANKS) {
    for (const pad of bank) {
      it(`${pad.name} renders a non-empty Float32Array`, () => {
        const buf = pad.generate();
        expect(buf).toBeInstanceOf(Float32Array);
        expect(buf.length).toBeGreaterThan(0);
        // Look for at least one non-zero sample so we know the DSP ran
        // (rumble + crackle have very low amplitude — scan generously).
        let anyNonZero = false;
        for (let i = 0; i < buf.length; i++) {
          if (buf[i] !== 0) {
            anyNonZero = true;
            break;
          }
        }
        expect(anyNonZero).toBe(true);
      });

      it(`${pad.name} stays within sane amplitude bounds`, () => {
        const buf = pad.generate();
        // Allow a generous headroom — the renderer's compressor handles
        // anything up to ±5 (rumble + airhorn approach this).
        for (let i = 0; i < buf.length; i++) {
          expect(Math.abs(buf[i] ?? 0)).toBeLessThan(6);
        }
      });
    }
  }
});
