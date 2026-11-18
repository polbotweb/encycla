/**
 * Responsive Wikimedia Commons images.
 *
 * Commons only serves thumbnails at its standard widths (20, 40, 60, 120, 250, 330, 500, 960,
 * 1280, 1920, 3840 px); other widths are refused by the CDN. The bank stores 960 px thumbnails,
 * or the original file when it is narrower than that: originals get no srcset, because a
 * thumbnail wider than the original does not exist.
 */
export const COMMONS_WIDTHS = [330, 500, 960, 1280] as const;

const THUMB =
  /^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/[^?#]+\/)(\d+)px-([^/?#]+)$/;

/** Same `sizes` everywhere so the question, reveal and article reuse one cached candidate. */
export const IMAGE_SIZES = '(min-width: 1024px) 55vw, 100vw';

export interface ImageSources {
  src: string;
  srcSet: string | null;
}

export function commonsSources(url: string): ImageSources {
  const match = THUMB.exec(url);
  if (!match) return { src: url, srcSet: null };
  const [, base, width, name] = match as unknown as [string, string, string, string];
  const stored = Number(width);
  const widths = COMMONS_WIDTHS.filter((candidate) => candidate <= stored);
  if (widths.length < 2) return { src: url, srcSet: null };
  return {
    src: url,
    srcSet: widths.map((candidate) => `${base}${candidate}px-${name} ${candidate}w`).join(', '),
  };
}
