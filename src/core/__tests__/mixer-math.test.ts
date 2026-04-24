import { describe, it, expect } from 'vitest';
import {
  crossfaderGains,
  channelGain,
  tempoPctToRate,
  rateToTempoPct,
  effectiveBpm,
  bpmMatchPercent,
} from '../mixer-math';

describe('crossfaderGains — smooth (equal-power)', () => {
  it('returns full left at position 0', () => {
    const { left, right } = crossfaderGains(0);
    expect(left).toBeCloseTo(1);
    expect(right).toBeCloseTo(0);
  });
  it('returns full right at position 1', () => {
    const { left, right } = crossfaderGains(1);
    expect(left).toBeCloseTo(0);
    expect(right).toBeCloseTo(1);
  });
  it('sums squared gains to 1 at every position (equal-power)', () => {
    for (const p of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      const { left, right } = crossfaderGains(p);
      expect(left * left + right * right).toBeCloseTo(1, 6);
    }
  });
  it('clamps out-of-range positions', () => {
    expect(crossfaderGains(-0.5).left).toBeCloseTo(1);
    expect(crossfaderGains(1.5).right).toBeCloseTo(1);
  });
});

describe('crossfaderGains — sharp', () => {
  it('is steeper than smooth around the middle', () => {
    const smooth = crossfaderGains(0.3, 'smooth');
    const sharp = crossfaderGains(0.3, 'sharp');
    // Both attenuate the right channel, but sharp attenuates more
    expect(sharp.right).toBeLessThan(smooth.right);
  });
});

describe('crossfaderGains — cut', () => {
  it('is fully on the left until ~45%', () => {
    expect(crossfaderGains(0.3, 'cut').left).toBe(1);
    expect(crossfaderGains(0.3, 'cut').right).toBe(0);
  });
  it('is fully on the right after ~55%', () => {
    expect(crossfaderGains(0.8, 'cut').left).toBe(0);
    expect(crossfaderGains(0.8, 'cut').right).toBe(1);
  });
  it('crosses quickly in the 45-55% window', () => {
    const { left, right } = crossfaderGains(0.5, 'cut');
    expect(left).toBeGreaterThan(0);
    expect(right).toBeGreaterThan(0);
    expect(left * left + right * right).toBeCloseTo(1, 3);
  });
});

describe('channelGain', () => {
  it('THRU bypasses the crossfader entirely', () => {
    expect(channelGain(0.8, 'THRU', 0)).toBeCloseTo(0.8);
    expect(channelGain(0.8, 'THRU', 1)).toBeCloseTo(0.8);
  });
  it('A-assigned channel is muted when crossfader is hard right', () => {
    expect(channelGain(1, 'A', 1)).toBeCloseTo(0);
  });
  it('B-assigned channel is muted when crossfader is hard left', () => {
    expect(channelGain(1, 'B', 0)).toBeCloseTo(0);
  });
  it('scales by the channel volume fader', () => {
    expect(channelGain(0.5, 'A', 0)).toBeCloseTo(0.5);
    expect(channelGain(0, 'A', 0)).toBe(0);
  });
  it('clamps volume out of range', () => {
    expect(channelGain(-0.5, 'A', 0)).toBe(0);
    expect(channelGain(1.5, 'A', 0)).toBeCloseTo(1);
  });
});

describe('tempoPctToRate / rateToTempoPct', () => {
  it('0 % → rate 1', () => {
    expect(tempoPctToRate(0)).toBe(1);
  });
  it('+8 % → 1.08, -4 % → 0.96', () => {
    expect(tempoPctToRate(8)).toBeCloseTo(1.08);
    expect(tempoPctToRate(-4)).toBeCloseTo(0.96);
  });
  it('clamps absurd values', () => {
    expect(tempoPctToRate(120)).toBe(1.5); // clamped to +50 %
    expect(tempoPctToRate(-120)).toBe(0.5);
  });
  it('round-trips with rateToTempoPct', () => {
    for (const p of [-20, -8, 0, 4, 16, 50]) {
      expect(rateToTempoPct(tempoPctToRate(p))).toBeCloseTo(p, 6);
    }
  });
});

describe('effectiveBpm / bpmMatchPercent', () => {
  it('applies tempo offset to the track BPM', () => {
    expect(effectiveBpm(120, 0)).toBeCloseTo(120);
    expect(effectiveBpm(120, 10)).toBeCloseTo(132);
    expect(effectiveBpm(120, -5)).toBeCloseTo(114);
  });
  it('returns 0 for invalid inputs', () => {
    expect(effectiveBpm(0, 8)).toBe(0);
    expect(effectiveBpm(-120, 0)).toBe(0);
  });
  it('bpmMatchPercent computes the pitch shift for a sync', () => {
    expect(bpmMatchPercent(120, 128)).toBeCloseTo(((128 / 120) - 1) * 100);
    expect(bpmMatchPercent(128, 128)).toBeCloseTo(0);
  });
  it('bpmMatchPercent returns null for invalid inputs', () => {
    expect(bpmMatchPercent(0, 128)).toBeNull();
    expect(bpmMatchPercent(120, 0)).toBeNull();
  });
});
