const URL_PATTERN = /https?:\/\/|www\./i;
const LEADING_MENTIONS = /^(?:@\S+\s+)+/u;
const NON_ALPHANUMERIC = /[^\p{L}\p{N}]/gu;

const LETTER_TO_INDEX: Readonly<Record<string, number>> = { a: 0, b: 1, c: 2, d: 3 };

/**
 * Strict chat parsing (SPECIFICATION 14.3). Returns the displayed option index (A=0 … D=3)
 * or null when the comment is not an unambiguous single-letter answer.
 */
export function parseAnswerComment(raw: unknown): number | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 500) {
    return null;
  }
  const normalized = raw.normalize('NFKC').trim().replace(LEADING_MENTIONS, '');
  if (URL_PATTERN.test(normalized)) {
    return null;
  }
  const letter = normalized.replace(NON_ALPHANUMERIC, '').toLowerCase();
  return Object.hasOwn(LETTER_TO_INDEX, letter) ? (LETTER_TO_INDEX[letter] as number) : null;
}
