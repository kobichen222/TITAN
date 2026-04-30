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
import { useEffect, useState } from "react";
import { fmtClock, fmtDate } from "@/src/lib/format";
import { STORAGE_KEYS, readJSON } from "@/src/lib/storage";
import { MIDI_PRESETS } from "@/src/midi/presets";
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

export default function StudioPage() {
  const now = useNow();
  const diag = useDiagnostics();
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
