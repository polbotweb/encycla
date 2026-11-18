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
  /**
   * True when the item has a real label in every game language (Wikipedia or Wikidata). Items
   * that would fall back to French are only used as distractors when nothing else is available.
   */
  complete?: boolean;
  /** Living things: every ancestor taxon (Wikidata P171, transitively). */
  lineage?: ReadonlySet<string>;
  /** Living things: direct parent taxa (P171), usually the genus. */
  parents?: ReadonlySet<string>;
}

/** Number of ancestor taxa two living things share (0 when either has no taxonomy). */
export function taxonomicCloseness(a: Candidate, b: Candidate): number {
  if (!a.lineage || !b.lineage) return 0;
  let shared = 0;
  for (const taxon of a.lineage) if (b.lineage.has(taxon)) shared += 1;
  return shared;
}

/** True when two living things have the same direct parent taxon (typically the same genus). */
export function sameParentTaxon(a: Candidate, b: Candidate): boolean {
  if (!a.parents || !b.parents) return false;
  for (const taxon of a.parents) if (b.parents.has(taxon)) return true;
  return false;
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
 * For living things, candidates sharing more ancestor taxa (Wikidata P171) come first, with at
 * most one distractor from the answer's own genus.
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
    const shuffled = shuffle(tier, random);
    // Living things: closest relatives first (most shared ancestor taxa); stable, so the random
    // order is kept among equally close candidates and for subjects without a taxonomy.
    const byKinship = target.lineage
      ? [...shuffled].sort((a, b) => taxonomicCloseness(target, b) - taxonomicCloseness(target, a))
      : shuffled;
    // Stable partition: fully translated items first (identical order when all are complete).
    const ordered = [
      ...byKinship.filter((candidate) => candidate.complete !== false),
      ...byKinship.filter((candidate) => candidate.complete === false),
    ];
    for (const candidate of ordered) {
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
      // At most one distractor from the answer's own genus: close, but not four look-alikes.
      if (
        sameParentTaxon(target, candidate) &&
        picked.some((existing) => sameParentTaxon(target, existing))
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
