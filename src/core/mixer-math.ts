/**
 * Mixer math — crossfader curves, channel gain, tempo conversions.
 *
 * The live mixer code in public/index.html applies these formulas over
 * and over (once per audio-graph update). Extracting them into a pure
 * module lets us tighten the math (fewer branches, equal-power curves
 * that round-trip correctly) and catch regressions with tests.
 */

export type XFaderCurve = 'smooth' | 'sharp' | 'cut';

/**
 * Standard crossfader curve. pos is 0..1 (left..right).
 * Returns { left, right } gain factors in 0..1.
 *
 *   smooth — equal-power curve (typical at home / mashup / background)
 *   sharp  — steeper equal-power, classic club scratch / quick blend
 *   cut    — near-instant cut at the ends, used by hip-hop/turntablists
 */
export function crossfaderGains(pos: number, curve: XFaderCurve = 'smooth'): { left: number; right: number } {
  const p = Math.max(0, Math.min(1, pos));
  if (curve === 'cut') {
    // Hard center: essentially off past ~20% either side
    if (p < 0.05) return { left: 1, right: 0 };
    if (p > 0.95) return { left: 0, right: 1 };
    // Quick cross in the middle 10%
    if (p < 0.45) return { left: 1, right: 0 };
    if (p > 0.55) return { left: 0, right: 1 };
    const t = (p - 0.45) / 0.1;
    return { left: Math.cos(t * Math.PI / 2), right: Math.sin(t * Math.PI / 2) };
  }
  if (curve === 'sharp') {
    // Equal-power with a power-of-2 skew → steeper in the middle
    const l = Math.cos(p * Math.PI / 2);
    const r = Math.sin(p * Math.PI / 2);
    return { left: l * l, right: r * r };
  }
  // smooth — equal-power cosine/sine
  return { left: Math.cos(p * Math.PI / 2), right: Math.sin(p * Math.PI / 2) };
}

/**
 * Full channel gain factoring in:
 *   - channel volume fader (0..1)
 *   - crossfader assignment ('A' | 'B' | 'THRU') — THRU bypasses the xfader
 *   - crossfader position (0..1) with a curve
 *
 * Returns a single gain multiplier in 0..1.
 */
export function channelGain(
  channelVol: number,
  assignment: 'A' | 'B' | 'THRU',
  xfaderPos: number,
  curve: XFaderCurve = 'smooth',
): number {
  const v = Math.max(0, Math.min(1, channelVol));
  if (assignment === 'THRU') return v;
  const { left, right } = crossfaderGains(xfaderPos, curve);
  return v * (assignment === 'A' ? left : right);
}

/**
 * Convert a tempo percentage (±range) into a playback-rate multiplier.
 * +8 % → 1.08, -4 % → 0.96. Clamped to 10..400 BPM equivalents
 * so a rogue value can't make audio stop dead or overflow.
 */
export function tempoPctToRate(pct: number, clamp = 50): number {
  const p = Math.max(-clamp, Math.min(clamp, pct));
  return 1 + p / 100;
}

/**
 * Convert playback-rate back to percent (used by MIDI knobs that deliver
 * a 0..1 normalized value and want to round-trip).
 */
export function rateToTempoPct(rate: number): number {
  return (rate - 1) * 100;
}

/**
 * True BPM after applying tempo offset, with guard rails against negatives.
 * 0 BPM track → 0 (caller decides whether to show "—" or fall back).
 */
export function effectiveBpm(trackBpm: number, tempoPct: number): number {
  if (!trackBpm || trackBpm <= 0) return 0;
  return trackBpm * tempoPctToRate(tempoPct);
}

/** Percent change needed to bring self onto the target BPM. */
export function bpmMatchPercent(selfBpm: number, targetBpm: number): number | null {
  if (!selfBpm || !targetBpm || selfBpm <= 0 || targetBpm <= 0) return null;
  return (targetBpm / selfBpm - 1) * 100;
}
