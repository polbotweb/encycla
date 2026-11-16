/** Text helpers: turning a Wikipedia extract into question content. */

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function slugify(value: string): string {
  return normalizeText(value)
    .replace(/'/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Capitalises the first letter, leaving the rest untouched. */
export function capitalize(value: string): string {
  return value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1);
}

/** Answer label from an article title: drops a trailing qualifier such as " (planète)". */
export function labelFromTitle(title: string, kind: 'title' | 'flag' = 'title'): string {
  let label = title.replace(/\s*\([^)]*\)\s*$/, '').trim();
  if (kind === 'flag') {
    label = label.replace(/^Drapeau\s+(?:de la |du |de l['’]|des |de |d['’])/i, '');
    label = capitalize(label);
  }
  return label;
}

/** Cleans an extract: drops headings, footnote markers, collapses whitespace, keeps paragraphs. */
export function cleanExtract(extract: string): string {
  const lines = extract
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line) => line.length > 0 && !/^=+.*=+$/.test(line));

  // A line break inside a sentence (formulas, wrapped templates) is not a paragraph break:
  // join a line that does not end a sentence with a next line that starts in lowercase.
  const paragraphs: string[] = [];
  for (const line of lines) {
    const previous = paragraphs[paragraphs.length - 1];
    if (previous !== undefined && !/[.!?…:;»)"”]$/.test(previous) && /^[a-zà-ÿ]/.test(line)) {
      paragraphs[paragraphs.length - 1] = `${previous} ${line}`;
    } else {
      paragraphs.push(line);
    }
  }

  return paragraphs
    .join('\n\n')
    .replace(/\[\d+\]/g, '')
    .replace(/ ,/g, ',')
    .replace(/\(\s*\)/g, '')
    .replace(/ {2,}/g, ' ')
    .replace(/<[^>]*>/g, '')
    .trim();
}

const ABBREVIATIONS =
  /(?:\b(?:[A-ZÀ-Ý]|St|Ste|av|apr|env|vol|fig|n°|M|Mme|Mlle|Dr|Pr|Mgr|J\.-C|J|c|p|éd|r|dir)\.)$/;

/** Splits on sentence ends followed by a capital; keeps abbreviations ("J.-C.", "M.") together. */
export function splitSentences(text: string): string[] {
  const pieces = text.split(/(?<=[.!?…])\s+(?=[A-ZÀ-ÝŒ«"„(\d])/u);
  const out: string[] = [];
  for (const piece of pieces) {
    const previous = out[out.length - 1];
    if (previous !== undefined && ABBREVIATIONS.test(previous)) {
      out[out.length - 1] = `${previous} ${piece}`;
    } else {
      out.push(piece);
    }
  }
  return out;
}

/** The longest run of whole sentences (paragraph-aware) that fits within `limit` characters. */
export function buildArticleBody(extract: string, limit: number): string {
  const paragraphs = cleanExtract(extract).split('\n\n');
  const chosen: string[] = [];
  let length = 0;

  for (const paragraph of paragraphs) {
    const sentences = splitSentences(paragraph);
    const kept: string[] = [];
    for (const sentence of sentences) {
      const extra = sentence.length + (kept.length > 0 || chosen.length > 0 ? 2 : 0);
      if (length + extra > limit) {
        break;
      }
      kept.push(sentence);
      length += extra;
    }
    if (kept.length > 0) {
      chosen.push(kept.join(' '));
    }
    if (kept.length < sentences.length) {
      break;
    }
  }

  return chosen.join('\n\n');
}

/**
 * Opening of the cleaned extract suitable for an explanation, at most `limit` characters.
 * A complete first sentence is returned as is. A sentence that is too long, or that ends on a
 * colon / without punctuation, is cut (verbatim) at its last clause boundary and ends with "…".
 */
export function firstSentence(extract: string, limit: number): string {
  const first = splitSentences(cleanExtract(extract).split('\n\n')[0] ?? '')[0] ?? '';
  const complete = /[.!?…»)]$/.test(first);
  if (first.length <= limit && complete) {
    return first;
  }

  const base = first.replace(/[\s:;,]+$/, '');
  const window = base.slice(0, limit - 1);
  const clause = Math.max(
    window.lastIndexOf(', '),
    window.lastIndexOf(' ; '),
    window.lastIndexOf(' — '),
  );
  const cut = clause > 60 ? clause : window.lastIndexOf(' ');
  if (cut < 40) {
    return '';
  }
  return `${window.slice(0, cut).replace(/[\s:;,—]+$/, '')}…`;
}

/**
 * A subject is verifiable when its label (or a significant word of it) really appears in the
 * article title or the beginning of the extract. Used as an automatic gate.
 */
export function labelAppearsIn(label: string, extractStart: string): boolean {
  const haystack = normalizeText(extractStart);
  const needle = normalizeText(label);
  if (needle.length === 0) {
    return false;
  }
  if (haystack.includes(needle)) {
    return true;
  }
  const tokens = needle.split(' ').filter((token) => token.length >= 4);
  return tokens.length > 0 && tokens.some((token) => haystack.includes(token));
}
