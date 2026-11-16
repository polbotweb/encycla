import type { QuestionCategory } from '../../../shared/schemas';

/**
 * A seed group lists Wikipedia article titles (French edition) that form one kind of subject.
 * Only the *title* comes from this file: the article text, the image, the licence and the
 * revision are all fetched from Wikipedia / Wikimedia Commons by the generator.
 * Distractors are drawn from groups that share the same `question` (same kind of subject).
 */
export interface SeedGroup {
  /** Human label, used for reports and to prefer same-group distractors (similar items). */
  group: string;
  /** Question shown to the player (French). */
  question: string;
  /** Alt text of the picture. Must never contain the answer. */
  alt: string;
  /** How the answer label is derived from the article title. Defaults to the title minus "(…)". */
  label?: 'title' | 'flag';
  titles: string[];
}

export type SeedMap = Record<QuestionCategory, SeedGroup[]>;

/** Splits a `;`-separated list into trimmed, non-empty titles. */
export function t(list: string): string[] {
  return list
    .split(';')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}
