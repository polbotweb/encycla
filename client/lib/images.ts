/**
 * Responsive pictures served by our own image proxy (D-107).
 *
 * Snapshots only carry `/img/<opaque token>` plus the widths the proxy offers for that picture
 * (standard Commons thumbnail steps). Pictures without widths (originals narrower than 960 px)
 * get no `srcset`: a candidate wider than the original does not exist.
 */
import type { ImageView } from '../../shared/types';

/** Same `sizes` everywhere so the question, reveal and article reuse one cached candidate. */
export const IMAGE_SIZES = '(min-width: 1024px) 55vw, 100vw';

export interface ImageSources {
  src: string;
  srcSet: string | null;
}

const PROXIED = /^\/img\/[A-Za-z0-9_-]{22,100}$/;

export function imageSources(image: Pick<ImageView, 'url' | 'widths'>): ImageSources {
  const widths = image.widths ?? [];
  if (!PROXIED.test(image.url) || widths.length < 2) return { src: image.url, srcSet: null };
  const largest = Math.max(...widths);
  return {
    src: `${image.url}?w=${largest}`,
    srcSet: widths.map((width) => `${image.url}?w=${width} ${width}w`).join(', '),
  };
}
