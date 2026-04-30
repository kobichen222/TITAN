/**
 * MIDI controller presets — one entry per supported controller.
 *
 * Mapping key shape: "<status>_<channel>_<data1>"
 *   status:  hex byte for the MIDI status (b0 = CC, 90 = NoteOn, 97 = pad-NoteOn).
 *   channel: 0-based MIDI channel (0..15).
 *   data1:   CC number for "b*" status, or note number for "9*" status.
 *
 * The mapping value names a target inside the renderer:
 *   "knob:<eq>-<deck>"  e.g. knob:low-A, knob:hi-B  (EQ rotaries)
 *   "fader:<deck>"      e.g. fader:A                (channel volume)
 *   "crossfader"        the master crossfader
 *   "btn:<selector>"    a CSS selector for the button to click on NoteOn
 *
 * Extracted from public/legacy/app.js (Phase 2). The legacy file
 * still has its inline copy; once Phase 3 brings the MIDI subsystem
 * into a real module, the inline literal can be replaced with an
 * import from here.
 */

export interface MidiBinding {
  /** Selector or symbolic target name (knob:low-A, fader:B, btn:..., crossfader). */
  target: string;
  /** Human-readable label shown in the UI mapping list. */
  label: string;
}

/** Map of `<status>_<channel>_<data1>` → binding. */
export type MidiPreset = Readonly<Record<string, MidiBinding>>;

/** Generic 2-deck minimal layout — works on any class-compliant controller. */
export const GENERIC_PRESET: MidiPreset = Object.freeze({
  b0_0_1: { target: 'knob:low-A', label: 'Deck A Low' },
  b0_0_2: { target: 'knob:mid-A', label: 'Deck A Mid' },
  b0_0_3: { target: 'knob:hi-A', label: 'Deck A Hi' },
  b0_0_4: { target: 'fader:A', label: 'Deck A Volume' },
  b0_0_5: { target: 'knob:low-B', label: 'Deck B Low' },
  b0_0_6: { target: 'knob:mid-B', label: 'Deck B Mid' },
  b0_0_7: { target: 'knob:hi-B', label: 'Deck B Hi' },
  b0_0_8: { target: 'fader:B', label: 'Deck B Volume' },
  b0_0_9: { target: 'crossfader', label: 'Crossfader' },
  '90_0_24': { target: 'btn:.big-btn.play[data-deck="A"]', label: 'Deck A PLAY' },
  '90_0_25': { target: 'btn:.big-btn.cue[data-deck="A"]', label: 'Deck A CUE' },
  '90_1_24': { target: 'btn:.big-btn.play[data-deck="B"]', label: 'Deck B PLAY' },
  '90_1_25': { target: 'btn:.big-btn.cue[data-deck="B"]', label: 'Deck B CUE' },
});

/** Pioneer DDJ-400 — main mixer + pads 1-4 on Deck A. */
export const DDJ400_PRESET: MidiPreset = Object.freeze({
  b0_0_11: { target: 'knob:mid-A', label: 'Deck A EQ Mid' },
  b0_1_11: { target: 'knob:mid-B', label: 'Deck B EQ Mid' },
  b0_6_31: { target: 'crossfader', label: 'Crossfader' },
  b0_0_7: { target: 'knob:low-A', label: 'Deck A EQ Low' },
  b0_0_15: { target: 'knob:hi-A', label: 'Deck A EQ Hi' },
  b0_1_7: { target: 'knob:low-B', label: 'Deck B EQ Low' },
  b0_1_15: { target: 'knob:hi-B', label: 'Deck B EQ Hi' },
  '90_0_11': { target: 'btn:.big-btn.play[data-deck="A"]', label: 'Deck A PLAY' },
  '90_0_12': { target: 'btn:.big-btn.cue[data-deck="A"]', label: 'Deck A CUE' },
  '90_1_11': { target: 'btn:.big-btn.play[data-deck="B"]', label: 'Deck B PLAY' },
  '90_1_12': { target: 'btn:.big-btn.cue[data-deck="B"]', label: 'Deck B CUE' },
  '97_0_0': {
    target: 'btn:.hot-cues[data-deck="A"] .cue-btn[data-cue="1"]',
    label: 'Deck A Cue 1',
  },
  '97_0_1': {
    target: 'btn:.hot-cues[data-deck="A"] .cue-btn[data-cue="2"]',
    label: 'Deck A Cue 2',
  },
  '97_0_2': {
    target: 'btn:.hot-cues[data-deck="A"] .cue-btn[data-cue="3"]',
    label: 'Deck A Cue 3',
  },
  '97_0_3': {
    target: 'btn:.hot-cues[data-deck="A"] .cue-btn[data-cue="4"]',
    label: 'Deck A Cue 4',
  },
});

/** Numark Mixtrack Pro — channel 1 = deck A, channel 2 = deck B. */
export const MIXTRACK_PRESET: MidiPreset = Object.freeze({
  b0_0_1: { target: 'fader:A', label: 'Deck A Volume' },
  b0_1_1: { target: 'fader:B', label: 'Deck B Volume' },
  b0_0_8: { target: 'crossfader', label: 'Crossfader' },
  b0_0_5: { target: 'knob:low-A', label: 'Deck A EQ Low' },
  b0_0_6: { target: 'knob:mid-A', label: 'Deck A EQ Mid' },
  b0_0_7: { target: 'knob:hi-A', label: 'Deck A EQ Hi' },
  b0_1_5: { target: 'knob:low-B', label: 'Deck B EQ Low' },
  b0_1_6: { target: 'knob:mid-B', label: 'Deck B EQ Mid' },
  b0_1_7: { target: 'knob:hi-B', label: 'Deck B EQ Hi' },
  '90_0_23': { target: 'btn:.big-btn.play[data-deck="A"]', label: 'Deck A PLAY' },
  '90_0_22': { target: 'btn:.big-btn.cue[data-deck="A"]', label: 'Deck A CUE' },
  '90_1_23': { target: 'btn:.big-btn.play[data-deck="B"]', label: 'Deck B PLAY' },
  '90_1_22': { target: 'btn:.big-btn.cue[data-deck="B"]', label: 'Deck B CUE' },
});

/** Registry of all built-in presets. */
export const MIDI_PRESETS: Readonly<Record<string, MidiPreset>> = Object.freeze({
  generic: GENERIC_PRESET,
  ddj400: DDJ400_PRESET,
  mixtrack: MIXTRACK_PRESET,
});

export type MidiPresetName = keyof typeof MIDI_PRESETS;

/** Type guard — useful when accepting a preset name from user input. */
export function isMidiPresetName(name: string): name is MidiPresetName {
  return Object.prototype.hasOwnProperty.call(MIDI_PRESETS, name);
}

/**
 * Merge a preset into an existing mapping table.
 * Preset entries overwrite existing keys (last write wins, like the
 * legacy `{...current, ...preset}` spread).
 */
export function mergePreset(
  current: Readonly<Record<string, MidiBinding>>,
  preset: MidiPreset,
): Record<string, MidiBinding> {
  return { ...current, ...preset };
}

const VALID_KEY = /^[0-9a-f]{2}_(?:[0-9]|1[0-5])_\d+$/;

/** Validate a binding key shape. Used by the office panel + MIDI learn. */
export function isValidMidiKey(key: string): boolean {
  return VALID_KEY.test(key);
}
