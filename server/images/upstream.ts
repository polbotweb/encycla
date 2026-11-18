/** Widths the proxy serves; all are standard Wikimedia Commons thumbnail steps. */
export const IMAGE_WIDTHS = [330, 500, 960] as const;
export type ImageWidth = (typeof IMAGE_WIDTHS)[number];

const THUMB =
  /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/([0-9a-f])\/(\1[0-9a-f])\/([^/?#]+)\/(\d+)px-([^/?#]+)$/;
const ORIGINAL =
  /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/([0-9a-f])\/(\1[0-9a-f])\/([^/?#]+)$/;

export function parseWidth(value: unknown): ImageWidth | null {
  if (value === undefined) return 960;
  const width = Number(value);
  return (IMAGE_WIDTHS as readonly number[]).includes(width) ? (width as ImageWidth) : null;
}

/** True for the only URLs the proxy may fetch: Commons files on upload.wikimedia.org. */
export function isProxyableImage(url: string): boolean {
  // Encoded separators could be decoded upstream; `\` is a separator for WHATWG parsers.
  if (/%2f|%5c|\\/i.test(url)) return false;
  if (!THUMB.test(url) && !ORIGINAL.test(url)) return false;
  // `.`/`..` segments (plain or %2e-encoded) are normalised away by the URL parser: refuse any
  // URL the parser would rewrite, so what we fetch is exactly what the allowlist checked.
  try {
    const parsed = new URL(url);
    return parsed.href === url && parsed.host === 'upload.wikimedia.org' && !parsed.search;
  } catch {
    return false;
  }
}

/**
 * Upstream URL for a stored Commons image at a given width. Thumbnails are never enlarged past the
 * stored width; originals (narrower than 960 px) are served as they are. `null` when not allowed.
 */
export function upstreamUrl(stored: string, width: ImageWidth): string | null {
  if (!isProxyableImage(stored)) return null;
  const thumb = THUMB.exec(stored);
  if (!thumb) return stored;
  const [, a, ab, file, storedWidth, name] = thumb as unknown as string[];
  const target = Math.min(width, Number(storedWidth));
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${a}/${ab}/${file}/${target}px-${name}`;
}

/** Responsive widths worth offering for a stored image (empty: serve it at one size). */
export function availableWidths(stored: string): ImageWidth[] {
  const thumb = THUMB.exec(stored);
  if (!thumb || !isProxyableImage(stored)) return [];
  const storedWidth = Number(thumb[4]);
  const widths = IMAGE_WIDTHS.filter((width) => width <= storedWidth);
  return widths.length >= 2 ? widths : [];
}
