/**
 * Licence classification for Wikimedia Commons files.
 * Allowed: CC0, public domain, CC BY, CC BY-SA. Everything else (NC, ND, GFDL-only,
 * fair use / non-free, unknown) is rejected rather than guessed.
 */

export type LicenseFamily = 'CC0' | 'PD' | 'CC BY' | 'CC BY-SA';

export interface LicenseVerdict {
  ok: boolean;
  /** Normalised licence string, e.g. "CC BY-SA 4.0", "CC0 1.0", "Public domain". */
  license: string;
  family?: LicenseFamily;
  reason?: string;
}

export interface ExtMetadataValue {
  value?: string;
}

export interface CommonsExtMetadata {
  LicenseShortName?: ExtMetadataValue;
  UsageTerms?: ExtMetadataValue;
  Artist?: ExtMetadataValue;
  Credit?: ExtMetadataValue;
  Copyrighted?: ExtMetadataValue;
  NonFree?: ExtMetadataValue;
}

export function classifyLicense(meta: CommonsExtMetadata | undefined): LicenseVerdict {
  const short = decodeEntities(stripTags(meta?.LicenseShortName?.value ?? '')).trim();
  const terms = decodeEntities(stripTags(meta?.UsageTerms?.value ?? '')).trim();
  const label = short || terms;

  if (!meta || !label) {
    return { ok: false, license: '', reason: 'no licence metadata' };
  }
  if (meta.NonFree?.value && meta.NonFree.value.toLowerCase() === 'true') {
    return { ok: false, license: label, reason: 'non-free file' };
  }
  if (/(^|[\s-])(NC|ND)([\s-]|$)/i.test(label) || /non-?commercial|no ?deriv/i.test(label)) {
    return { ok: false, license: label, reason: 'NC/ND licence' };
  }

  if (/^(CC0|CC[- ]ZERO)/i.test(label)) {
    return { ok: true, license: 'CC0 1.0', family: 'CC0' };
  }
  if (/^(public domain|pd([\s-]|$)|domaine public)/i.test(label)) {
    return { ok: true, license: 'Public domain', family: 'PD' };
  }
  const cc = /^CC[ -]BY(-SA)?[ -](\d\.\d)(?:\s+[a-z]{2,3}(?:-[A-Za-z]+)?)?$/i.exec(label);
  if (cc) {
    const sa = cc[1] ? '-SA' : '';
    return {
      ok: true,
      license: `CC BY${sa} ${cc[2]}`,
      family: sa ? 'CC BY-SA' : 'CC BY',
    };
  }

  return { ok: false, license: label, reason: 'licence not in the allowlist' };
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      return safeFromCodePoint(Number.parseInt(entity.slice(2), 16), match);
    }
    if (entity.startsWith('#')) {
      return safeFromCodePoint(Number.parseInt(entity.slice(1), 10), match);
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function safeFromCodePoint(codePoint: number, fallback: string): string {
  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return fallback;
  }
}

export function stripTags(value: string): string {
  return value
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ');
}

const UNKNOWN_AUTHOR = /^(unknown|unbekannt|inconnu|anonym(e|ous)?|n\/a|\?+|not specified)\b/i;

export interface AuthorVerdict {
  author: string;
  /** True when the author field is empty/unknown (acceptable for public domain only). */
  unknown: boolean;
}

/** Plain-text author for attribution, at most 150 characters. */
export function extractAuthor(meta: CommonsExtMetadata | undefined): AuthorVerdict {
  const raw = meta?.Artist?.value ?? '';
  let text = decodeEntities(stripTags(raw)).replace(/\s+/g, ' ').trim();
  text = text.replace(/\s*\(?\bsee (below|source)\b.*$/i, '').trim();
  // Never leak markup into the data: anything that still looks like a tag is dropped.
  if (/[<>]/.test(text)) {
    text = text.replace(/[<>]/g, '');
  }
  if (!text || UNKNOWN_AUTHOR.test(text)) {
    return { author: 'Auteur inconnu', unknown: true };
  }
  if (text.length > 150) {
    text = `${text.slice(0, 149).trimEnd()}…`;
  }
  return { author: text, unknown: false };
}

/** Filenames that are not photographs of the subject (maps, diagrams, logos…). */
const NON_PHOTO =
  /(^|[^a-z])(map|maps|carte|cartes|locator|location|diagram|diagramm|diagramme|schema|schéma|logo|signature|montage|collage|cladogram|icon|icone|icône|symbol|emblem|distribution|range|répartition|repartition|chart|graph|plan|sketch|silhouette|svg)([^a-z]|$)/i;

export function isNonPhotoFilename(filename: string, allowSvg: boolean): boolean {
  if (!allowSvg && /\.svg$/i.test(filename)) {
    return true;
  }
  return NON_PHOTO.test(filename.replace(/\.[a-z0-9]+$/i, ''));
}
