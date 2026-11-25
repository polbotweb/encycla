/**
 * Perceptual hashes of the question pictures (D-120), to catch near-duplicate images: the same
 * photograph (or a crop) used by two subjects, or two flags that only differ by proportions.
 *
 * Fingerprint = 64-bit difference hash (dHash) of the luminance on a 9×8 grid, plus the mean
 * colour of a 3×3 grid, so pictures that only differ by colour (Mali / Guinea flags: same
 * layout, other colours) are not taken for duplicates. Small thumbnails (120 px) are hashed;
 * results are cached in `data/sources/image-hashes.json` so `--offline` runs stay reproducible.
 */
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

export interface Raster {
  width: number;
  height: number;
  /** RGBA, 4 bytes per pixel. */
  data: Uint8Array;
}

export interface ImageFingerprint {
  /** dHash, 16 hex digits. */
  dhash: string;
  /** Mean RGB of a 3×3 grid, 27 values (0–255). */
  colors: number[];
}

/**
 * What is cached: the raw 9×8 luminance grid and the 3×3 colour grid, one byte per value, as
 * hex (`<144 hex>:<54 hex>`). The dHash is derived when loading, so tuning it needs no download.
 */
export type ImageSignature = string;

/** Hamming distance (bits) between two dHashes; at most this many bits = same layout. */
export const NEAR_DUPLICATE_BITS = 4;
/** Mean per-channel colour gap (0–255) under which two same-layout pictures look alike. */
export const NEAR_DUPLICATE_COLOR = 24;

export function decodeImage(bytes: Uint8Array): Raster | null {
  try {
    if (bytes[0] === 0xff && bytes[1] === 0xd8) {
      const decoded = jpeg.decode(bytes, { useTArray: true, maxMemoryUsageInMB: 64 });
      return { width: decoded.width, height: decoded.height, data: decoded.data };
    }
    if (bytes[0] === 0x89 && bytes[1] === 0x50) {
      const png = PNG.sync.read(Buffer.from(bytes));
      return { width: png.width, height: png.height, data: new Uint8Array(png.data) };
    }
  } catch {
    return null;
  }
  return null;
}

/** Area-averaged RGB of a `columns × rows` grid; transparent pixels count as white. */
function grid(raster: Raster, columns: number, rows: number): number[][] {
  const cells: number[][] = [];
  for (let row = 0; row < rows; row += 1) {
    const y0 = Math.floor((row * raster.height) / rows);
    const y1 = Math.max(y0 + 1, Math.floor(((row + 1) * raster.height) / rows));
    for (let column = 0; column < columns; column += 1) {
      const x0 = Math.floor((column * raster.width) / columns);
      const x1 = Math.max(x0 + 1, Math.floor(((column + 1) * raster.width) / columns));
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const offset = (y * raster.width + x) * 4;
          const alpha = (raster.data[offset + 3] ?? 255) / 255;
          r += (raster.data[offset] ?? 0) * alpha + 255 * (1 - alpha);
          g += (raster.data[offset + 1] ?? 0) * alpha + 255 * (1 - alpha);
          b += (raster.data[offset + 2] ?? 0) * alpha + 255 * (1 - alpha);
          count += 1;
        }
      }
      cells.push([r / count, g / count, b / count]);
    }
  }
  return cells;
}

/** Luminance gap (0–255) under which two neighbouring cells count as equal. */
const FLAT_MARGIN = 3;

const toHex = (values: readonly number[]): string =>
  values
    .map((value) =>
      Math.max(0, Math.min(255, Math.round(value)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
const fromHex = (hex: string): number[] =>
  Array.from({ length: hex.length / 2 }, (_, index) =>
    parseInt(hex.slice(index * 2, index * 2 + 2), 16),
  );

export function signature(raster: Raster): ImageSignature {
  const luma = grid(raster, 9, 8).map(([r, g, b]) => 0.299 * r! + 0.587 * g! + 0.114 * b!);
  return `${toHex(luma)}:${toHex(grid(raster, 3, 3).flat())}`;
}

export function fingerprintOf(value: ImageSignature): ImageFingerprint | null {
  const match = /^([0-9a-f]{144}):([0-9a-f]{54})$/.exec(value);
  if (!match) return null;
  const cells = fromHex(match[1] as string);
  let bits = 0n;
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const left = cells[row * 9 + column] as number;
      const right = cells[row * 9 + column + 1] as number;
      // A margin keeps flat areas (flags, sky) stable under JPEG noise.
      bits = (bits << 1n) | (left - right > FLAT_MARGIN ? 1n : 0n);
    }
  }
  return { dhash: bits.toString(16).padStart(16, '0'), colors: fromHex(match[2] as string) };
}

export function fingerprint(raster: Raster): ImageFingerprint {
  return fingerprintOf(signature(raster)) as ImageFingerprint;
}

export function hammingDistance(a: string, b: string): number {
  let value = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let count = 0;
  while (value > 0n) {
    count += Number(value & 1n);
    value >>= 1n;
  }
  return count;
}

export function colorDistance(a: readonly number[], b: readonly number[]): number {
  let sum = 0;
  for (let index = 0; index < a.length; index += 1) {
    sum += Math.abs((a[index] ?? 0) - (b[index] ?? 0));
  }
  return a.length === 0 ? 0 : sum / a.length;
}

export function nearDuplicate(a: ImageFingerprint, b: ImageFingerprint): boolean {
  return (
    hammingDistance(a.dhash, b.dhash) <= NEAR_DUPLICATE_BITS &&
    colorDistance(a.colors, b.colors) <= NEAR_DUPLICATE_COLOR
  );
}

/** At most this many bits and this colour gap: the same photograph (or a crop / re-encode). */
export const SAME_PHOTO_BITS = 2;
export const SAME_PHOTO_COLOR = 8;

/**
 * Stricter than `nearDuplicate`: only the same picture. Used to drop a subject illustrated by
 * another subject's photograph; mere look-alikes are kept and just never offered together.
 */
export function samePhoto(a: ImageFingerprint, b: ImageFingerprint): boolean {
  return (
    hammingDistance(a.dhash, b.dhash) <= SAME_PHOTO_BITS &&
    colorDistance(a.colors, b.colors) <= SAME_PHOTO_COLOR
  );
}

/** 120 px Commons thumbnail of a picture URL (the bank stores the 960 px step or the original). */
export function hashThumbnailUrl(url: string): string {
  return url.includes('/thumb/') ? url.replace(/\/\d+px-([^/]+)$/, '/120px-$1') : url;
}
