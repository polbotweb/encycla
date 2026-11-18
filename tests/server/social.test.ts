import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { socialIndex } from '../../server/http/social';

const html = readFileSync('index.html', 'utf8');

describe('social preview meta (D-111)', () => {
  it('ships a large French preview image by default, root-relative without an origin', () => {
    const out = socialIndex(html, null, undefined);
    expect(out).toContain('<meta property="og:image" content="/og/encycla-fr.png" />');
    expect(out).toContain('<meta name="twitter:image" content="/og/encycla-fr.png" />');
    expect(out).toContain('<meta name="twitter:card" content="summary_large_image" />');
    expect(out).not.toContain('og:url');
  });

  it('makes the image absolute with PUBLIC_ORIGIN and follows ?lang=', () => {
    const out = socialIndex(html, 'https://encycla.example', 'ar');
    expect(out).toContain('content="https://encycla.example/og/encycla-ar.png"');
    expect(out).toContain('<meta property="og:url" content="https://encycla.example/?lang=ar" />');
    expect(out).toContain('<meta property="og:locale" content="ar_AR" />');
    expect(out).toContain('<meta property="og:locale:alternate" content="fr_FR" />');
    expect(out).not.toContain('content="/og/');
    const fr = socialIndex(html, 'https://encycla.example/', 'xx');
    expect(fr).toContain('content="https://encycla.example/og/encycla-fr.png"');
    expect(fr).toContain('<meta property="og:url" content="https://encycla.example/" />');
  });

  it('declares the favicon set and every manifest icon exists', () => {
    for (const file of [
      'favicon.svg',
      'favicon-16.png',
      'favicon-32.png',
      'apple-touch-icon.png',
    ]) {
      expect(html, file).toContain(`/${file}`);
      expect(() => readFileSync(`public/${file}`)).not.toThrow();
    }
    const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8')) as {
      icons: { src: string; purpose: string }[];
    };
    expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
    for (const icon of manifest.icons) {
      expect(() => readFileSync(`public${icon.src}`)).not.toThrow();
    }
    for (const language of ['fr', 'en', 'ar']) {
      const png = readFileSync(`public/og/encycla-${language}.png`);
      // PNG IHDR: width and height, big-endian, at bytes 16 and 20.
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
    }
  });
});
