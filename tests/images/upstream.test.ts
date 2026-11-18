import { describe, expect, it } from 'vitest';
import {
  availableWidths,
  isProxyableImage,
  parseWidth,
  upstreamUrl,
} from '../../server/images/upstream';
import { ORIGINAL_URL, THUMB_URL } from './fixtures';

const THUMB_BASE =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Lion_waiting_in_Namibia.jpg/';

describe('image widths', () => {
  it('accepts only the three proxy widths and defaults to 960', () => {
    expect(parseWidth(undefined)).toBe(960);
    expect(parseWidth('330')).toBe(330);
    expect(parseWidth('500')).toBe(500);
    expect(parseWidth('960')).toBe(960);
    for (const bad of ['0', '20', '1280', '961', 'abc', '', ['330', '500'], '330.0x']) {
      expect(parseWidth(bad), String(bad)).toBeNull();
    }
  });

  it('offers responsive widths only for thumbnails wide enough', () => {
    expect(availableWidths(THUMB_URL)).toEqual([330, 500, 960]);
    expect(availableWidths(`${THUMB_BASE}500px-Lion_waiting_in_Namibia.jpg`)).toEqual([330, 500]);
    expect(availableWidths(`${THUMB_BASE}330px-Lion_waiting_in_Namibia.jpg`)).toEqual([]);
    expect(availableWidths(ORIGINAL_URL)).toEqual([]);
    expect(availableWidths('https://example.com/960px-x.jpg')).toEqual([]);
  });
});

describe('upstream allowlist (no open proxy)', () => {
  it('accepts Commons thumbnails and originals on upload.wikimedia.org', () => {
    expect(isProxyableImage(THUMB_URL)).toBe(true);
    expect(isProxyableImage(ORIGINAL_URL)).toBe(true);
    // Real bank files whose names contain dots.
    expect(
      isProxyableImage(
        'https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Ramaria_sp..jpg/960px-Ramaria_sp..jpg',
      ),
    ).toBe(true);
    expect(
      isProxyableImage(
        'https://upload.wikimedia.org/wikipedia/commons/a/a4/Paul_C%C3%A9zanne_O.I..jpg',
      ),
    ).toBe(true);
  });

  it.each([
    'http://upload.wikimedia.org/wikipedia/commons/a/ab/X.png',
    'https://upload.wikimedia.org.evil.com/wikipedia/commons/a/ab/X.png',
    'https://evil.com/https://upload.wikimedia.org/wikipedia/commons/a/ab/X.png',
    'https://user@upload.wikimedia.org/wikipedia/commons/a/ab/X.png',
    'https://upload.wikimedia.org:8443/wikipedia/commons/a/ab/X.png',
    'https://upload.wikimedia.org/wikipedia/en/a/ab/X.png',
    'https://upload.wikimedia.org/wikipedia/commons/a/cd/X.png',
    'https://upload.wikimedia.org/wikipedia/commons/a/ab/../../../X.png',
    'https://upload.wikimedia.org/wikipedia/commons/a/ab/%2e%2e%2fX.png',
    'https://upload.wikimedia.org/wikipedia/commons/a/ab/%2e%2e',
    'https://upload.wikimedia.org/wikipedia/commons/a/ab/..',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/..',
    'https://upload.wikimedia.org/wikipedia/commons/a/ab/X Y.png',
    'https://upload.wikimedia.org/wikipedia/commons/a/ab/X.png?redirect=https://evil.com',
    'https://upload.wikimedia.org/wikipedia/commons/a/ab/X.png#x',
    'https://upload.wikimedia.org/wikipedia/commons/a/ab/X\\Y.png',
    'https://169.254.169.254/latest/meta-data/',
    'file:///etc/passwd',
    '/img/AbCdEfGhIjKlMnOpQrStUv',
  ])('refuses %s', (url) => {
    expect(isProxyableImage(url)).toBe(false);
    expect(upstreamUrl(url, 960)).toBeNull();
  });

  it('maps widths onto Commons thumbnail steps without enlarging', () => {
    expect(upstreamUrl(THUMB_URL, 330)).toBe(`${THUMB_BASE}330px-Lion_waiting_in_Namibia.jpg`);
    expect(upstreamUrl(THUMB_URL, 960)).toBe(THUMB_URL);
    const small = `${THUMB_BASE}500px-Lion_waiting_in_Namibia.jpg`;
    expect(upstreamUrl(small, 960)).toBe(small);
    expect(upstreamUrl(ORIGINAL_URL, 330)).toBe(ORIGINAL_URL);
  });
});
