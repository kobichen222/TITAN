/**
 * AudioContext lifecycle wrapper.
 *
 * Three things this gives us that the bare AudioContext does not:
 *   1. Lazy creation — calling `acquire()` is safe before a user
 *      gesture; the context is built on first use, not at import time
 *      (browsers refuse to start audio without a gesture).
 *   2. State observability — `subscribe(fn)` lets React components
 *      reflect suspended/running/closed without polling.
 *   3. Idempotent shutdown — `close()` runs once; subsequent calls
 *      are no-ops.  The legacy renderer used to leak a half-closed
 *      context on hot-reload; this module makes that path safe.
 *
 * The legacy file public/legacy/app.js still owns its own audioCtx
 * for now.  This module is the React-side entry that the new Studio
 * UI (Phase 3a) and any future React component will use.
 */

export type AudioCtxState = AudioContextState | 'unloaded';

type Listener = (state: AudioCtxState) => void;
type CtxCtor = new (options?: AudioContextOptions) => AudioContext;

export interface AudioCtxLifecycleOptions {
  /** Override the constructor — used in tests with a mock implementation. */
  ctor?: CtxCtor;
  /** Initial AudioContext options forwarded to the constructor. */
  contextOptions?: AudioContextOptions;
}

export class AudioCtxLifecycle {
  private ctx: AudioContext | null = null;
  private listeners = new Set<Listener>();
  private readonly ctor: CtxCtor | null;
  private readonly contextOptions?: AudioContextOptions;
  private closed = false;

  constructor(opts: AudioCtxLifecycleOptions = {}) {
    this.ctor =
      opts.ctor ??
      (typeof globalThis !== 'undefined' &&
      typeof (globalThis as { AudioContext?: CtxCtor }).AudioContext !== 'undefined'
        ? (globalThis as { AudioContext: CtxCtor }).AudioContext
        : null);
    this.contextOptions = opts.contextOptions;
  }

  /** Current state without forcing the context to materialise. */
  get state(): AudioCtxState {
    if (this.closed) return 'closed';
    if (!this.ctx) return 'unloaded';
    return this.ctx.state;
  }

  /** True once a real AudioContext has been allocated. */
  get materialised(): boolean {
    return this.ctx != null;
  }

  /** Lazily create + return the AudioContext. Throws if no constructor is available. */
  acquire(): AudioContext {
    if (this.closed) throw new Error('AudioCtxLifecycle: already closed');
    if (this.ctx) return this.ctx;
    if (!this.ctor) {
      throw new Error('AudioCtxLifecycle: no AudioContext constructor available');
    }
    this.ctx = new this.ctor(this.contextOptions);
    this.ctx.addEventListener?.('statechange', this.onStateChange);
    this.notify();
    return this.ctx;
  }

  /** Suspend playback (battery-friendly). Returns true if a real ctx was suspended. */
  async suspend(): Promise<boolean> {
    if (!this.ctx || this.ctx.state !== 'running') return false;
    await this.ctx.suspend();
    return true;
  }

  /** Resume playback. Returns true if a real ctx was resumed. */
  async resume(): Promise<boolean> {
    if (!this.ctx || this.ctx.state !== 'suspended') return false;
    await this.ctx.resume();
    return true;
  }

  /**
   * Tear down. Idempotent — second call is a no-op.
   * After close(), `state` is "closed" and acquire() throws.
   */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    if (this.ctx) {
      this.ctx.removeEventListener?.('statechange', this.onStateChange);
      try {
        await this.ctx.close();
      } catch {
        /* already closed by the browser; not actionable */
      }
      this.ctx = null;
    }
    this.notify();
  }

  /** Subscribe to state transitions. Returns an unsubscribe function. */
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private onStateChange = (): void => {
    this.notify();
  };

  private notify(): void {
    const s = this.state;
    for (const fn of this.listeners) fn(s);
  }
}
