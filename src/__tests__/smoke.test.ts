/**
 * Smoke test — load the post-Phase-1 shell at public/index.html and the
 * external legacy bundles it links to, verify each JS file parses, and
 * spot-check the high-value markers (decks, transport, mastering chain,
 * Supabase auth, library virtualization, MIDI subsystem).
 *
 * Phase 1 of the refactor extracted the inline <style> and <script>
 * blocks into public/legacy/{styles.css,bootstrap.js,app.js,init.js}.
 * This test is the gate that verifies that mechanical split didn't
 * drop or corrupt any content — the assertions track the same markers
 * that lived in the monolithic file, just routed to whichever artifact
 * now owns them.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const HTML_PATH = resolve(ROOT, 'public/index.html');
const CSS_PATH = resolve(ROOT, 'public/legacy/styles.css');
const BOOT_PATH = resolve(ROOT, 'public/legacy/bootstrap.js');
const APP_PATH = resolve(ROOT, 'public/legacy/app.js');
const INIT_PATH = resolve(ROOT, 'public/legacy/init.js');

const HTML = readFileSync(HTML_PATH, 'utf8');
const CSS = readFileSync(CSS_PATH, 'utf8');
const APP = readFileSync(APP_PATH, 'utf8');
const BOOT = readFileSync(BOOT_PATH, 'utf8');
const INIT = readFileSync(INIT_PATH, 'utf8');

describe('public/index.html — post-split shell structure', () => {
  it('all four legacy artifacts exist on disk', () => {
    expect(existsSync(CSS_PATH)).toBe(true);
    expect(existsSync(BOOT_PATH)).toBe(true);
    expect(existsSync(APP_PATH)).toBe(true);
    expect(existsSync(INIT_PATH)).toBe(true);
  });

  it('shell links the external CSS bundle', () => {
    expect(HTML).toMatch(/<link[^>]+href="legacy\/styles\.css"/);
  });

  it('shell loads bootstrap, YouTube IFrame API, app, and init in that order', () => {
    const order = [
      HTML.indexOf('legacy/bootstrap.js'),
      HTML.indexOf('youtube.com/iframe_api'),
      HTML.indexOf('legacy/app.js'),
      HTML.indexOf('legacy/init.js'),
    ];
    expect(order.every((i) => i > 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('shell has no inline <script> bodies anymore', () => {
    const inlineScripts = HTML.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g) || [];
    const nonEmpty = inlineScripts.filter((s) => s.replace(/<\/?script[^>]*>/g, '').trim());
    expect(nonEmpty).toEqual([]);
  });

  it('has the TITAN brand in the <title>', () => {
    expect(HTML).toMatch(/<title>[^<]*TITAN[^<]*<\/title>/);
  });
});

describe('public/legacy/*.js — parse & content checks', () => {
  it('every legacy JS file parses as valid JavaScript', () => {
    expect(() => new Function(BOOT)).not.toThrow();
    expect(() => new Function(APP)).not.toThrow();
    expect(() => new Function(INIT)).not.toThrow();
  });

  it('declares the four decks A, B, C, D', () => {
    expect(APP).toMatch(/decks\s*=\s*\{\s*A:\s*createDeck\('A'\)\s*,\s*B:\s*createDeck\('B'\)/);
  });

  it('CUE + PLAY transport handlers are wired', () => {
    // Deck buttons are produced by buildDeckHTML() inside app.js, not the shell.
    expect(APP).toMatch(/data-action="cue"/);
    expect(APP).toMatch(/data-action="play"/);
    expect(APP).toMatch(/function cueDeck/);
    expect(APP).toMatch(/function togglePlay/);
  });

  it('SOUND tab mastering chain is present', () => {
    expect(HTML).toMatch(/STUDIO MASTERING/);
    expect(HTML).toMatch(/id="ampVuNeedleL"/);
    expect(HTML).toMatch(/id="ampPpmL"/);
    expect(HTML).toMatch(/id="ampGonio"/);
  });

  it('Supabase auth modal is wired (sign-in gate for downloads)', () => {
    expect(HTML).toMatch(/id="authGoogleBtn"/);
    expect(APP).toMatch(/_supa\.auth\.signInWithOAuth/);
  });

  it('library virtualization is in place (not the old forEach bloat)', () => {
    expect(APP).toMatch(/_libRenderWindow/);
    expect(APP).toMatch(/_libView/);
  });

  it('MIDI subsystem has hot-plug + preset support', () => {
    expect(APP).toMatch(/midiAccess\.onstatechange/);
    expect(APP).toMatch(/MIDI_PRESETS/);
    expect(APP).toMatch(/applyMidiPreset/);
  });
});

/**
 * Regression guards for the deck-pair selector + 6-DECK LINEUP overlay —
 * the screens the user reported looked broken after the Phase 1 split.
 * Mechanical-split bugs would show up as missing buttons, missing CSS
 * rules, or missing wiring; if any of these go red, an update has
 * dropped a piece of the deck switch bar / lineup view by mistake.
 */
describe('deck-pair selector — every focus button survives the split', () => {
  const PAIRS = ['AB', 'CD', 'AC', 'BD', 'ALL', 'DJAB', 'DJCD'] as const;
  it.each(PAIRS)('shell carries data-pair="%s" button', (pair) => {
    expect(HTML).toContain(`data-pair="${pair}"`);
  });

  it('applyDeckPair handles the ALL branch (full-console layout)', () => {
    expect(APP).toMatch(/function applyDeckPair/);
    expect(APP).toMatch(/show-all['"]\s*,\s*pair\s*===\s*['"]ALL['"]/);
  });

  it('CSS still defines body.show-all layout for the 4-deck console', () => {
    expect(CSS).toMatch(/body\.show-all/);
  });
});

describe('TITAN 6-DECK LINEUP overlay — DOM, CSS, and init wiring', () => {
  it('shell carries the open button and the lineup overlay', () => {
    expect(HTML).toMatch(/id="t3dOpenBtn"/);
    expect(HTML).toMatch(/id="t3dOverlay"/);
    expect(HTML).toMatch(/id="t3dCloseBtn"/);
    expect(HTML).toContain('6-DECK LINEUP');
  });

  it('lineup SVG renders all six deck slots + the central mixer', () => {
    // The SVG mockup uses <use href="#t3dDeck"> six times and <use href="#t3dMix"> once.
    const deckUses = HTML.match(/href="#t3dDeck"/g) || [];
    const mixUses = HTML.match(/href="#t3dMix"/g) || [];
    expect(deckUses.length).toBe(6);
    expect(mixUses.length).toBe(1);
  });

  it('CSS defines .t3d-overlay and the open-state class', () => {
    expect(CSS).toMatch(/\.t3d-overlay\s*\{/);
    expect(CSS).toMatch(/\.t3d-overlay\.open/);
    expect(CSS).toMatch(/\.t3d-rig/);
  });

  it('init.js wires open / close / Esc handlers for the overlay', () => {
    expect(INIT).toMatch(/getElementById\('t3dOpenBtn'\)/);
    expect(INIT).toMatch(/getElementById\('t3dOverlay'\)/);
    expect(INIT).toMatch(/classList\.add\('open'\)/);
    expect(INIT).toMatch(/key\s*===\s*'Escape'/);
  });
});

describe('Service Worker shell precache covers the new external bundles', () => {
  const SW = readFileSync(resolve(ROOT, 'public/sw.js'), 'utf8');

  it('cache version was bumped past v127 so old clients re-precache', () => {
    expect(SW).not.toMatch(/djtitan-shell-v127/);
    expect(SW).toMatch(/djtitan-shell-v\d{3,}/);
  });

  it('SHELL precache includes every legacy bundle the new index.html links to', () => {
    expect(SW).toMatch(/\.\/legacy\/styles\.css/);
    expect(SW).toMatch(/\.\/legacy\/bootstrap\.js/);
    expect(SW).toMatch(/\.\/legacy\/app\.js/);
    expect(SW).toMatch(/\.\/legacy\/init\.js/);
  });
});
