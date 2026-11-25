import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import {
  colorDistance,
  decodeImage,
  fingerprint,
  fingerprintOf,
  hammingDistance,
  hashThumbnailUrl,
  nearDuplicate,
  samePhoto,
  signature,
  type Raster,
} from '../../scripts/wikimedia/phash';

/** Horizontal tricolour flag, `width × height`, colours top to bottom. */
function tricolour(width: number, height: number, colours: number[][], vertical = false): Raster {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const band = Math.min(2, Math.floor(((vertical ? x : y) * 3) / (vertical ? width : height)));
      const [r, g, b] = colours[band]!;
      data.set([r!, g!, b!, 255], (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

const RED = [206, 17, 38];
const YELLOW = [252, 209, 22];
const GREEN = [20, 181, 58];
const BLUE = [0, 38, 127];

describe('perceptual hashes of pictures (D-120)', () => {
  it('sees the same picture at another size or proportion as a near duplicate', () => {
    const chad = fingerprint(tricolour(120, 80, [BLUE, YELLOW, RED], true));
    const romania = fingerprint(
      tricolour(
        90,
        60,
        [
          [0, 43, 127],
          [252, 209, 22],
          [206, 17, 38],
        ],
        true,
      ),
    );
    expect(hammingDistance(chad.dhash, romania.dhash)).toBeLessThanOrEqual(4);
    expect(nearDuplicate(chad, romania)).toBe(true);
  });

  it('keeps apart pictures with the same layout but other colours, or another layout', () => {
    const mali = fingerprint(tricolour(120, 80, [GREEN, YELLOW, RED], true));
    const guinea = fingerprint(tricolour(120, 80, [RED, YELLOW, GREEN], true));
    expect(colorDistance(mali.colors, guinea.colors)).toBeGreaterThan(24);
    expect(nearDuplicate(mali, guinea)).toBe(false);
    const horizontal = fingerprint(tricolour(120, 80, [GREEN, YELLOW, RED]));
    expect(nearDuplicate(mali, horizontal)).toBe(false);
  });

  it('only calls the same photograph a duplicate: look-alikes are merely never paired', () => {
    const chad = fingerprint(tricolour(120, 80, [BLUE, YELLOW, RED], true));
    const reencoded = fingerprint(tricolour(60, 40, [[2, 40, 125], YELLOW, RED], true));
    expect(samePhoto(chad, reencoded)).toBe(true);
    const romania = fingerprint(tricolour(90, 60, [[30, 90, 180], YELLOW, RED], true));
    expect(nearDuplicate(chad, romania)).toBe(true);
    expect(samePhoto(chad, romania)).toBe(false);
  });

  it('decodes JPEG and PNG bytes, and rejects anything else', () => {
    const raster = tricolour(32, 24, [BLUE, YELLOW, RED], true);
    const png = new PNG({ width: 32, height: 24 });
    png.data = Buffer.from(raster.data);
    const fromPng = decodeImage(new Uint8Array(PNG.sync.write(png)));
    expect(fromPng?.width).toBe(32);
    const encoded = jpeg.encode({ width: 32, height: 24, data: Buffer.from(raster.data) }, 90);
    const fromJpeg = decodeImage(new Uint8Array(encoded.data));
    expect(fromJpeg?.height).toBe(24);
    expect(nearDuplicate(fingerprint(fromPng!), fingerprint(fromJpeg!))).toBe(true);
    expect(decodeImage(new Uint8Array([0x47, 0x49, 0x46]))).toBeNull();
    expect(decodeImage(new Uint8Array([0xff, 0xd8, 0x00]))).toBeNull();
  });

  it('caches a raw signature and derives the fingerprint from it', () => {
    const raster = tricolour(60, 40, [BLUE, YELLOW, RED], true);
    const cached = signature(raster);
    expect(cached).toMatch(/^[0-9a-f]{144}:[0-9a-f]{54}$/);
    expect(fingerprintOf(cached)).toEqual(fingerprint(raster));
    expect(fingerprintOf('nope')).toBeNull();
  });

  it('treats transparent pixels as white', () => {
    const clear = { width: 9, height: 8, data: new Uint8Array(9 * 8 * 4) };
    expect(fingerprint(clear).colors.every((value) => value === 255)).toBe(true);
  });

  it('hashes the 120 px Commons thumbnail', () => {
    expect(
      hashThumbnailUrl(
        'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Lion.jpg/960px-Lion.jpg',
      ),
    ).toBe('https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Lion.jpg/120px-Lion.jpg');
    const original = 'https://upload.wikimedia.org/wikipedia/commons/6/6f/Small.jpg';
    expect(hashThumbnailUrl(original)).toBe(original);
  });
});
