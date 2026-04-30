import { describe, it, expect } from 'vitest';
import {
  DDJ400_PRESET,
  GENERIC_PRESET,
  MIDI_PRESETS,
  MIXTRACK_PRESET,
  type MidiBinding,
  isMidiPresetName,
  isValidMidiKey,
  mergePreset,
} from '../presets';

describe('preset registry', () => {
  it('exposes the three known controllers', () => {
    expect(Object.keys(MIDI_PRESETS).sort()).toEqual([
      'ddj400',
      'generic',
      'mixtrack',
    ]);
  });

  it('every preset is frozen', () => {
    for (const p of Object.values(MIDI_PRESETS)) {
      expect(Object.isFrozen(p)).toBe(true);
    }
  });

  it('every binding has a non-empty target and label', () => {
    for (const preset of Object.values(MIDI_PRESETS)) {
      for (const [k, b] of Object.entries(preset)) {
        expect(b.target.length, `${k}.target`).toBeGreaterThan(0);
        expect(b.label.length, `${k}.label`).toBeGreaterThan(0);
      }
    }
  });

  it('every binding key passes the validator', () => {
    for (const preset of Object.values(MIDI_PRESETS)) {
      for (const k of Object.keys(preset)) {
        expect(isValidMidiKey(k), k).toBe(true);
      }
    }
  });
});

describe('isMidiPresetName', () => {
  it('accepts the three known names', () => {
    expect(isMidiPresetName('generic')).toBe(true);
    expect(isMidiPresetName('ddj400')).toBe(true);
    expect(isMidiPresetName('mixtrack')).toBe(true);
  });

  it('rejects unknown names', () => {
    expect(isMidiPresetName('none')).toBe(false);
    expect(isMidiPresetName('')).toBe(false);
    expect(isMidiPresetName('GENERIC')).toBe(false);
  });
});

describe('isValidMidiKey', () => {
  it('accepts CC and NoteOn shapes', () => {
    expect(isValidMidiKey('b0_0_1')).toBe(true);
    expect(isValidMidiKey('90_15_127')).toBe(true);
    expect(isValidMidiKey('97_0_0')).toBe(true);
  });

  it('rejects malformed keys', () => {
    expect(isValidMidiKey('b0-0-1')).toBe(false);
    expect(isValidMidiKey('xx_0_1')).toBe(false);
    expect(isValidMidiKey('b0_16_0')).toBe(false); // channel > 15
    expect(isValidMidiKey('B0_0_0')).toBe(false); // upper-case
    expect(isValidMidiKey('')).toBe(false);
  });
});

describe('mergePreset', () => {
  it('overlays preset onto current mapping (preset wins on conflict)', () => {
    const current: Record<string, MidiBinding> = {
      b0_0_1: { target: 'crossfader', label: 'OLD' },
      b0_5_5: { target: 'fader:A', label: 'STAY' },
    };
    const merged = mergePreset(current, GENERIC_PRESET);
    // GENERIC_PRESET maps b0_0_1 → knob:low-A, so the new value wins.
    expect(merged.b0_0_1).toEqual({ target: 'knob:low-A', label: 'Deck A Low' });
    // Pre-existing key not in the preset survives.
    expect(merged.b0_5_5).toEqual({ target: 'fader:A', label: 'STAY' });
  });

  it('does not mutate the inputs', () => {
    const current = { x: { target: 't', label: 'L' } };
    const before = JSON.stringify(current);
    mergePreset(current, GENERIC_PRESET);
    expect(JSON.stringify(current)).toBe(before);
  });
});

describe('preset content sanity', () => {
  it('GENERIC has 4 mixer-channel volumes (incl. crossfader, A/B faders)', () => {
    const targets = Object.values(GENERIC_PRESET).map((b) => b.target);
    expect(targets).toContain('crossfader');
    expect(targets).toContain('fader:A');
    expect(targets).toContain('fader:B');
  });

  it('DDJ400 carries pad cue-bindings on channel 0', () => {
    const padKeys = Object.keys(DDJ400_PRESET).filter((k) => k.startsWith('97_0_'));
    expect(padKeys.length).toBeGreaterThanOrEqual(4);
  });

  it('MIXTRACK splits decks across MIDI channels 0 and 1', () => {
    const ch0 = Object.keys(MIXTRACK_PRESET).filter((k) => k.split('_')[1] === '0');
    const ch1 = Object.keys(MIXTRACK_PRESET).filter((k) => k.split('_')[1] === '1');
    expect(ch0.length).toBeGreaterThan(0);
    expect(ch1.length).toBeGreaterThan(0);
  });
});
