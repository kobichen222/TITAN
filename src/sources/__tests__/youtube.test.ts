import { describe, it, expect } from 'vitest';
import {
  extractSpotifyTrackId,
  extractYouTubeId,
  isSpotifyTrackUrl,
} from '../youtube';

describe('extractYouTubeId', () => {
  it('accepts bare 11-character IDs', () => {
    expect(extractYouTubeId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeId('aaaaaaaaaaa')).toBe('aaaaaaaaaaa');
    expect(extractYouTubeId('aBc-DeF_GhI')).toBe('aBc-DeF_GhI');
  });

  it('rejects bare strings of the wrong length', () => {
    expect(extractYouTubeId('short')).toBeNull();
    expect(extractYouTubeId('aaaaaaaaaaaa')).toBeNull(); // 12 chars
    expect(extractYouTubeId('')).toBeNull();
  });

  it('parses the four canonical URL shapes', () => {
    expect(extractYouTubeId('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ',
    );
    expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeId('https://youtube.com/embed/dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ',
    );
    expect(extractYouTubeId('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ',
    );
  });

  it('handles URLs with extra query parameters', () => {
    expect(
      extractYouTubeId('https://youtube.com/watch?v=dQw4w9WgXcQ&list=PLxx'),
    ).toBe('dQw4w9WgXcQ');
    expect(
      extractYouTubeId('https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s'),
    ).toBe('dQw4w9WgXcQ');
  });

  it('returns null for URLs that do not match', () => {
    expect(extractYouTubeId('https://example.com')).toBeNull();
    expect(extractYouTubeId('https://soundcloud.com/foo')).toBeNull();
    expect(extractYouTubeId('https://vimeo.com/123456789')).toBeNull();
  });
});

describe('isSpotifyTrackUrl', () => {
  it('recognises the canonical track URL', () => {
    expect(isSpotifyTrackUrl('https://open.spotify.com/track/abc123XYZ')).toBe(
      true,
    );
  });

  it('recognises locale-prefixed track URLs', () => {
    expect(
      isSpotifyTrackUrl('https://open.spotify.com/intl-de/track/abc123XYZ'),
    ).toBe(true);
    expect(
      isSpotifyTrackUrl('https://open.spotify.com/intl-pt-br/track/abc123XYZ'),
    ).toBe(true);
  });

  it('rejects non-track Spotify URLs', () => {
    expect(
      isSpotifyTrackUrl('https://open.spotify.com/album/abc123XYZ'),
    ).toBe(false);
    expect(
      isSpotifyTrackUrl('https://open.spotify.com/playlist/abc123XYZ'),
    ).toBe(false);
    expect(isSpotifyTrackUrl('https://open.spotify.com/')).toBe(false);
  });

  it('rejects unrelated URLs', () => {
    expect(isSpotifyTrackUrl('https://example.com')).toBe(false);
    expect(isSpotifyTrackUrl('')).toBe(false);
  });
});

describe('extractSpotifyTrackId', () => {
  it('pulls the ID out of a track URL', () => {
    expect(
      extractSpotifyTrackId('https://open.spotify.com/track/abc123XYZ'),
    ).toBe('abc123XYZ');
  });

  it('works on locale-prefixed URLs', () => {
    expect(
      extractSpotifyTrackId('https://open.spotify.com/intl-de/track/abc123XYZ'),
    ).toBe('abc123XYZ');
  });

  it('returns null when no track segment is present', () => {
    expect(extractSpotifyTrackId('https://open.spotify.com/album/x')).toBeNull();
    expect(extractSpotifyTrackId('')).toBeNull();
  });
});
