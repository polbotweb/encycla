import { createHash } from 'node:crypto';
import { normalizeText } from './text';

export interface Candidate {
  id: string;
  category: string;
  group: string;
  /** Subjects sharing the same question text are interchangeable as distractors. */
  question: string;
  label: string;
  pageId: number;
  qid: string | undefined;
}

/** Deterministic PRNG (mulberry32) seeded from a string, so the generator is reproducible. */
export function seededRandom(seed: string): () => number {
  const digest = createHash('sha256').update(seed).digest();
  let state = digest.readUInt32LE(0);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap] as T, copy[index] as T];
  }
  return copy;
}

/**
 * Subjects whose pictures are practically indistinguishable (e.g. the flags of Monaco and
 * Indonesia are identical up to proportions): never offered together as options.
 */
const INDISTINGUISHABLE: string[][] = [
  ['Monaco', 'Indonésie'],
  ['Tchad', 'Roumanie', 'Andorre'],
];

export function indistinguishable(a: string, b: string): boolean {
  const left = normalizeText(a);
  const right = normalizeText(b);
  return INDISTINGUISHABLE.some((set) => {
    const names = set.map(normalizeText);
    return names.includes(left) && names.includes(right);
  });
}

/**
 * True when one label is contained in the other as whole words ("Pomme" / "Pomme de terre"):
 * such pairs are never offered together, since the picture could fit both.
 */
export function labelsOverlap(a: string, b: string): boolean {
  const left = ` ${normalizeText(a)} `;
  const right = ` ${normalizeText(b)} `;
  return left.includes(right) || right.includes(left);
}

/**
 * Picks three distractors for `target`: real subjects of the same kind (same question), never the
 * same entity (page id / Wikidata item), never an overlapping label. Same-group subjects (similar
 * items: same family, same continent, same era…) come first when the group is large enough.
 */
export function pickDistractors(
  target: Candidate,
  pool: readonly Candidate[],
  random: () => number,
): Candidate[] | null {
  const comparable = pool.filter(
    (candidate) =>
      candidate.id !== target.id &&
      candidate.question === target.question &&
      candidate.pageId !== target.pageId &&
      (target.qid === undefined || candidate.qid !== target.qid) &&
      !labelsOverlap(candidate.label, target.label) &&
      !indistinguishable(candidate.label, target.label),
  );

  const sameGroup = comparable.filter(
    (candidate) => candidate.category === target.category && candidate.group === target.group,
  );
  const sameCategory = comparable.filter(
    (candidate) => candidate.category === target.category && candidate.group !== target.group,
  );
  const elsewhere = comparable.filter((candidate) => candidate.category !== target.category);

  // Similar items first (same group), then the rest of the category, then other categories.
  const tiers = [sameGroup, sameCategory, elsewhere];

  const picked: Candidate[] = [];
  for (const tier of tiers) {
    for (const candidate of shuffle(tier, random)) {
      if (picked.length === 3) {
        break;
      }
      if (
        picked.some(
          (existing) =>
            labelsOverlap(existing.label, candidate.label) ||
            indistinguishable(existing.label, candidate.label),
        )
      ) {
        continue;
      }
      picked.push(candidate);
    }
    if (picked.length === 3) {
      break;
    }
  }

  return picked.length === 3 ? picked : null;
}
