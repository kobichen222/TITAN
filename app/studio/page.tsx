"use client";

/**
 * Phase 3a — Studio scaffold.
 *
 * This route does not host the live DJ engine yet — that still lives
 * in public/legacy/app.js, reachable via "Launch DJ Studio".  What it
 * does provide is the React-side scaffold the rest of Phase 3 (3b…3z)
 * will grow into: a real Next.js page that consumes the extracted
 * src/* modules (format, storage, midi presets) so we prove the
 * cross-boundary import path works before any heavy UI lands.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { fmtClock, fmtDate } from "@/src/lib/format";
import { STORAGE_KEYS, readJSON } from "@/src/lib/storage";
import { MIDI_PRESETS } from "@/src/midi/presets";
import { AudioCtxLifecycle, type AudioCtxState } from "@/src/audio/context";
import {
  BANK_BASS,
  BANK_DRUMS,
  BANK_FX,
  BANK_LOOPS,
  FACTORY_PAD_COUNT,
} from "@/src/audio/factory-samples";
import styles from "./studio.module.css";

interface SignedLicensePeek {
  payload?: { tier?: string; email?: string; expiresAt?: number | null };
}

interface Diagnostics {
  hasLicense: boolean;
  licenseTier: string | null;
  licenseExpiresAt: number | null;
  hasSupabase: boolean;
  midiBindings: number;
  deckPair: string | null;
}

const EMPTY_DIAG: Diagnostics = {
  hasLicense: false,
  licenseTier: null,
  licenseExpiresAt: null,
  hasSupabase: false,
  midiBindings: 0,
  deckPair: null,
};

function useNow(intervalMs = 1000): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * Browse + control the AudioContext from React.
 * The context is only allocated on the first user gesture (browsers
 * block autoplay), so the hook returns a `start` callback the page
 * wires to a button. State transitions are observed via subscribe()
 * so the card re-renders without polling.
 */
function useAudioEngine(): {
  state: AudioCtxState;
  start: () => void;
  suspend: () => Promise<void>;
  resume: () => Promise<void>;
} {
  const lifeRef = useRef<AudioCtxLifecycle | null>(null);
  const [state, setState] = useState<AudioCtxState>("unloaded");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const life = new AudioCtxLifecycle();
    lifeRef.current = life;
    const off = life.subscribe(setState);
    return () => {
      off();
      void life.close();
      lifeRef.current = null;
    };
  }, []);

  return {
    state,
    start: () => {
      try {
        lifeRef.current?.acquire();
      } catch {
        /* no AudioContext in this browser */
      }
    },
    suspend: async () => {
      await lifeRef.current?.suspend();
    },
    resume: async () => {
      await lifeRef.current?.resume();
    },
  };
}

function useDiagnostics(): Diagnostics {
  const [diag, setDiag] = useState<Diagnostics>(EMPTY_DIAG);
  useEffect(() => {
    const lic = readJSON<SignedLicensePeek | null>(STORAGE_KEYS.licensePayload, null);
    const supa = readJSON<{ url?: string; anon?: string } | null>(
      STORAGE_KEYS.supabaseConfig,
      null,
    );
    const midi = readJSON<Record<string, unknown>>(STORAGE_KEYS.midiMap, {});
    const pair = readJSON<string | null>(STORAGE_KEYS.deckPair, null);
    setDiag({
      hasLicense: !!lic?.payload,
      licenseTier: lic?.payload?.tier ?? null,
      licenseExpiresAt: lic?.payload?.expiresAt ?? null,
      hasSupabase: !!(supa?.url && supa?.anon),
      midiBindings: midi && typeof midi === "object" ? Object.keys(midi).length : 0,
      deckPair: typeof pair === "string" ? pair : null,
    });
  }, []);
  return diag;
}

function audioStateLabel(s: AudioCtxState): string {
  switch (s) {
    case "unloaded":
      return "TAP TO START";
    case "suspended":
      return "SUSPENDED";
    case "running":
      return "RUNNING";
    case "closed":
      return "CLOSED";
    default:
      // "interrupted" (Safari-only) — same UX as suspended.
      return "INTERRUPTED";
  }
}

export default function StudioPage() {
  const now = useNow();
  const diag = useDiagnostics();
  const audio = useAudioEngine();
  const presets = Object.keys(MIDI_PRESETS);

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Phase 3a · scaffold</div>
          <div className={styles.brand}>
            TITAN <b>STUDIO</b>
          </div>
        </div>
        <div className={styles.clock} aria-label="Local time">
          {now ? fmtClock(now) : "--:--:--"}
        </div>
      </header>

      <section className={styles.grid} aria-label="System diagnostics">
        <div className={styles.card}>
          <span className={styles.cardLabel}>License</span>
          {diag.hasLicense ? (
            <>
              <span className={`${styles.cardValue} ${styles.cardOk}`}>
                {diag.licenseTier?.toUpperCase() ?? "ACTIVE"}
              </span>
              <span className={styles.cardLabel}>
                Expires{" "}
                {diag.licenseExpiresAt
                  ? fmtDate(new Date(diag.licenseExpiresAt).toISOString())
                  : "never"}
              </span>
            </>
          ) : (
            <span className={`${styles.cardValue} ${styles.cardDim}`}>
              FREE TIER
            </span>
          )}
        </div>

        <div className={styles.card}>
          <span className={styles.cardLabel}>Supabase</span>
          <span
            className={`${styles.cardValue} ${
              diag.hasSupabase ? styles.cardOk : styles.cardWarn
            }`}
          >
            {diag.hasSupabase ? "CONFIGURED" : "NOT CONFIGURED"}
          </span>
        </div>

        <div className={styles.card}>
          <span className={styles.cardLabel}>MIDI Bindings</span>
          <span
            className={`${styles.cardValue} ${
              diag.midiBindings > 0 ? styles.cardOk : styles.cardDim
            }`}
          >
            {diag.midiBindings} mapped
          </span>
          <span className={styles.cardLabel}>
            Presets: {presets.join(" · ")}
          </span>
        </div>

        <div className={styles.card}>
          <span className={styles.cardLabel}>Deck Focus</span>
          <span className={styles.cardValue}>
            {diag.deckPair ?? "AB"}
          </span>
        </div>

        <div className={styles.card}>
          <span className={styles.cardLabel}>Audio Engine</span>
          <span
            className={`${styles.cardValue} ${
              audio.state === "running"
                ? styles.cardOk
                : audio.state === "suspended"
                  ? styles.cardWarn
                  : styles.cardDim
            }`}
          >
            {audioStateLabel(audio.state)}
          </span>
          <div className={styles.cardActions}>
            {audio.state === "unloaded" && (
              <button
                type="button"
                className={styles.cardBtn}
                onClick={audio.start}
              >
                ⏻ ACQUIRE
              </button>
            )}
            {audio.state === "running" && (
              <button
                type="button"
                className={styles.cardBtn}
                onClick={() => void audio.suspend()}
              >
                ⏸ SUSPEND
              </button>
            )}
            {audio.state === "suspended" && (
              <button
                type="button"
                className={styles.cardBtn}
                onClick={() => void audio.resume()}
              >
                ▶ RESUME
              </button>
            )}
          </div>
        </div>

        <div className={styles.card}>
          <span className={styles.cardLabel}>Factory Samples</span>
          <span className={`${styles.cardValue} ${styles.cardOk}`}>
            {FACTORY_PAD_COUNT} pads
          </span>
          <span className={styles.cardLabel}>
            {BANK_DRUMS.length} drums · {BANK_BASS.length} bass ·{" "}
            {BANK_FX.length} fx · {BANK_LOOPS.length} loops
          </span>
        </div>
      </section>

      <section className={styles.actions}>
        <a className={styles.launchPrimary} href="/index.html">
          Launch DJ Studio →
        </a>
        <Link className={styles.launchSecondary} href="/office">
          Office Admin
        </Link>
        <Link className={styles.launchSecondary} href="/">
          Back to Landing
        </Link>
      </section>

      <footer className={styles.legend}>
        This is the React-side shell that Phase 3 will grow into the
        full studio. Today the live engine still lives at{" "}
        <code>public/legacy/app.js</code> (reachable via{" "}
        <code>/index.html</code>); over time, decks, mixer, sampler and
        library will be reimplemented as React components consuming the{" "}
        <code>src/audio</code>, <code>src/decks</code>,{" "}
        <code>src/sampler</code> and <code>src/midi</code> modules.
      </footer>
    </main>
  );
}
