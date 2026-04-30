import { describe, it, expect, beforeEach } from 'vitest';
import {
  STORAGE_KEYS,
  readJSON,
  readString,
  remove,
  writeJSON,
  writeString,
} from '../storage';

class MemStorage {
  private map = new Map<string, string>();
  private throwOnSet = false;
  private throwOnGet = false;

  reset() {
    this.map.clear();
    this.throwOnSet = false;
    this.throwOnGet = false;
  }
  failNextSet() {
    this.throwOnSet = true;
  }
  failNextGet() {
    this.throwOnGet = true;
  }

  getItem(key: string): string | null {
    if (this.throwOnGet) {
      this.throwOnGet = false;
      throw new Error('quota');
    }
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    if (this.throwOnSet) {
      this.throwOnSet = false;
      throw new Error('quota');
    }
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

const mem = new MemStorage();
beforeEach(() => mem.reset());

describe('STORAGE_KEYS — registry', () => {
  it('is frozen so keys cannot drift accidentally', () => {
    expect(Object.isFrozen(STORAGE_KEYS)).toBe(true);
  });

  it('every value is a non-empty string', () => {
    for (const v of Object.values(STORAGE_KEYS)) {
      expect(typeof v).toBe('string');
      expect(v.length).toBeGreaterThan(0);
    }
  });

  it('keys are unique (no two aliases for the same string)', () => {
    const values = Object.values(STORAGE_KEYS);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('readJSON / writeJSON', () => {
  it('round-trips arbitrary JSON', () => {
    const data = { a: 1, b: [2, 3], c: 'hi' };
    expect(writeJSON(STORAGE_KEYS.crates, data, mem)).toBe(true);
    expect(readJSON(STORAGE_KEYS.crates, null, mem)).toEqual(data);
  });

  it('returns fallback on missing key', () => {
    expect(readJSON(STORAGE_KEYS.appState, 'fallback', mem)).toBe('fallback');
    expect(readJSON(STORAGE_KEYS.appState, { x: 1 }, mem)).toEqual({ x: 1 });
  });

  it('returns fallback on malformed JSON', () => {
    mem.setItem(STORAGE_KEYS.appState, 'not-json{{{');
    expect(readJSON(STORAGE_KEYS.appState, null, mem)).toBeNull();
  });

  it('returns fallback when getItem throws (quota / disabled)', () => {
    mem.failNextGet();
    expect(readJSON(STORAGE_KEYS.appState, 42, mem)).toBe(42);
  });

  it('returns false (does not throw) when setItem throws', () => {
    mem.failNextSet();
    expect(writeJSON(STORAGE_KEYS.appState, { x: 1 }, mem)).toBe(false);
  });

  it('handles values that cannot be serialised by returning false', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(writeJSON(STORAGE_KEYS.appState, cyclic, mem)).toBe(false);
  });
});

describe('readString / writeString / remove', () => {
  it('round-trips string values', () => {
    expect(writeString(STORAGE_KEYS.deckPair, 'CD', mem)).toBe(true);
    expect(readString(STORAGE_KEYS.deckPair, 'AB', mem)).toBe('CD');
  });

  it('returns the fallback for missing keys', () => {
    expect(readString(STORAGE_KEYS.deckPair, 'AB', mem)).toBe('AB');
    expect(readString(STORAGE_KEYS.deckPair, null, mem)).toBeNull();
  });

  it('remove() drops the key', () => {
    writeString(STORAGE_KEYS.deckPair, 'CD', mem);
    expect(remove(STORAGE_KEYS.deckPair, mem)).toBe(true);
    expect(readString(STORAGE_KEYS.deckPair, null, mem)).toBeNull();
  });
});

describe('graceful fallback when no storage is available', () => {
  it('readJSON / readString / writeJSON / writeString / remove never throw', () => {
    // Pass a custom storage that is undefined to force the no-storage branch.
    const noLs = undefined as unknown as Parameters<typeof readJSON>[2];
    expect(() => readJSON(STORAGE_KEYS.appState, null, noLs)).not.toThrow();
    expect(() => writeJSON(STORAGE_KEYS.appState, {}, noLs)).not.toThrow();
    // The no-arg call hits whatever globalThis.localStorage exposes — in the
    // vitest jsdom-less runner that is undefined and the helper returns null.
    expect(readJSON(STORAGE_KEYS.appState, 'fallback')).toBe('fallback');
  });
});
