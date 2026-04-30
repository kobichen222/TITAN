import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioCtxLifecycle } from '../context';

class MockAudioContext extends EventTarget {
  state: AudioContextState = 'running';
  closed = false;
  constructor(public options?: AudioContextOptions) {
    super();
  }
  async suspend() {
    this.state = 'suspended';
    this.dispatchEvent(new Event('statechange'));
  }
  async resume() {
    this.state = 'running';
    this.dispatchEvent(new Event('statechange'));
  }
  async close() {
    if (this.closed) throw new Error('already closed');
    this.closed = true;
    this.state = 'closed';
    this.dispatchEvent(new Event('statechange'));
  }
}

const ctor = MockAudioContext as unknown as new (
  options?: AudioContextOptions,
) => AudioContext;

let life: AudioCtxLifecycle;

beforeEach(() => {
  life = new AudioCtxLifecycle({ ctor });
});

describe('AudioCtxLifecycle — initial state', () => {
  it('starts in unloaded state without materialising the ctx', () => {
    expect(life.state).toBe('unloaded');
    expect(life.materialised).toBe(false);
  });

  it('throws when no constructor is available and acquire() is called', () => {
    const empty = new AudioCtxLifecycle({ ctor: undefined });
    // ctor: undefined falls back to globalThis.AudioContext which is unset in vitest node env.
    expect(() => empty.acquire()).toThrow(/no AudioContext constructor/);
  });
});

describe('acquire', () => {
  it('creates a real ctx on first call', () => {
    const ctx = life.acquire();
    expect(ctx).toBeInstanceOf(MockAudioContext);
    expect(life.materialised).toBe(true);
    expect(life.state).toBe('running');
  });

  it('returns the same ctx on every subsequent call', () => {
    const a = life.acquire();
    const b = life.acquire();
    expect(a).toBe(b);
  });

  it('forwards contextOptions to the constructor', () => {
    const opts: AudioContextOptions = { sampleRate: 48000 };
    const inst = new AudioCtxLifecycle({ ctor, contextOptions: opts });
    const ctx = inst.acquire() as unknown as MockAudioContext;
    expect(ctx.options).toEqual(opts);
  });

  it('throws after close()', async () => {
    life.acquire();
    await life.close();
    expect(() => life.acquire()).toThrow(/already closed/);
  });
});

describe('suspend / resume', () => {
  it('suspend returns false if no ctx exists yet', async () => {
    expect(await life.suspend()).toBe(false);
  });

  it('suspend returns false if not running', async () => {
    const ctx = life.acquire() as unknown as MockAudioContext;
    ctx.state = 'suspended';
    expect(await life.suspend()).toBe(false);
  });

  it('round-trips a running ctx through suspend → resume', async () => {
    life.acquire();
    expect(await life.suspend()).toBe(true);
    expect(life.state).toBe('suspended');
    expect(await life.resume()).toBe(true);
    expect(life.state).toBe('running');
  });

  it('resume returns false if not suspended', async () => {
    life.acquire();
    expect(await life.resume()).toBe(false);
  });
});

describe('close', () => {
  it('is idempotent — second call is a no-op', async () => {
    life.acquire();
    await life.close();
    expect(life.state).toBe('closed');
    // Second close — should not throw despite the mock rejecting double-close.
    await expect(life.close()).resolves.toBeUndefined();
  });

  it('safely handles a browser that double-closes the ctx', async () => {
    const ctx = life.acquire() as unknown as MockAudioContext;
    // Pretend the browser already closed the ctx out from under us.
    ctx.closed = true;
    await expect(life.close()).resolves.toBeUndefined();
    expect(life.state).toBe('closed');
  });
});

describe('subscribe', () => {
  it('emits the current state immediately', () => {
    const seen: string[] = [];
    life.subscribe((s) => seen.push(s));
    expect(seen).toEqual(['unloaded']);
  });

  it('emits on state transitions', async () => {
    const seen: string[] = [];
    life.subscribe((s) => seen.push(s));
    life.acquire(); // -> running
    await life.suspend(); // -> suspended
    await life.resume(); // -> running
    await life.close(); // -> closed
    expect(seen).toEqual([
      'unloaded',
      'running',
      'suspended',
      'running',
      'closed',
    ]);
  });

  it('returns an unsubscribe function that stops further notifications', async () => {
    const fn = vi.fn();
    const off = life.subscribe(fn);
    expect(fn).toHaveBeenCalledTimes(1); // initial emit
    off();
    life.acquire();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
