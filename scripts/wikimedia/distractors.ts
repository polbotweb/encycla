import { createHash } from 'node:crypto';
import type { FormKey } from './forms';
import { nearDuplicate, type ImageFingerprint } from './phash';
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
   * How the item is written in each translated language (`own` name, `scientific` name, `foreign`
   * original name, `none`). Distractors written like the answer come first, so no option stands
   * out by its form (D-108); items with no name in a language come last.
   */
  forms?: Readonly<Record<string, FormKey>>;
  /** Living things: every ancestor taxon (Wikidata P171, transitively). */
  lineage?: ReadonlySet<string>;
  /** Living things: direct parent taxa (P171), usually the genus. */
  parents?: ReadonlySet<string>;
  /** Perceptual fingerprint of the subject's picture (D-120). */
  picture?: ImageFingerprint;
}

/** Pictures that look alike (same layout and colours): never offered together. */
export function picturesAlike(a: Candidate, b: Candidate): boolean {
  return a.picture !== undefined && b.picture !== undefined && nearDuplicate(a.picture, b.picture);
}

/** Number of ancestor taxa two living things share (0 when either has no taxonomy). */
export function taxonomicCloseness(a: Candidate, b: Candidate): number {
  if (!a.lineage || !b.lineage) return 0;
  let shared = 0;
  for (const taxon of a.lineage) if (b.lineage.has(taxon)) shared += 1;
  return shared;
}

/** Languages where `candidate` is written like `target`; -1 when it has no name somewhere. */
export function formAffinity(target: Candidate, candidate: Candidate): number {
  if (!candidate.forms) return 0;
  const languages = Object.keys(candidate.forms);
  if (languages.some((language) => candidate.forms?.[language] === 'none')) return -1;
  return languages.filter((language) => candidate.forms?.[language] === target.forms?.[language])
    .length;
}

/**
 * True when two living things are in the same genus: same direct parent taxon, or one's parent is
 * an ancestor of the other (a subspecies such as "Tigre de Sibérie" next to "Lion", both Panthera).
 */
export function sameParentTaxon(a: Candidate, b: Candidate): boolean {
  if (!a.parents || !b.parents) return false;
  for (const taxon of a.parents) if (b.parents.has(taxon) || b.lineage?.has(taxon)) return true;
  for (const taxon of b.parents) if (a.lineage?.has(taxon)) return true;
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
 * For living things, candidates sharing more ancestor taxa (Wikidata P171) come first; one from
 * the answer's own genus only when the category offers no other candidate (D-120).
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
      !indistinguishable(candidate.label, target.label) &&
      !picturesAlike(candidate, target),
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
  // Tier orders are computed lazily, in tier order, so the random sequence (and therefore every
  // question that never needed a later tier) stays the same as with a single pass.
  const orders: Candidate[][] = [];
  const orderOf = (index: number): Candidate[] => {
    for (let next = orders.length; next <= index; next += 1) {
      const shuffled = shuffle(tiers[next] as Candidate[], random);
      // Living things: closest relatives first (most shared ancestor taxa); stable, so the random
      // order is kept among equally close candidates and for subjects without a taxonomy.
      const byKinship = target.lineage
        ? [...shuffled].sort(
            (a, b) => taxonomicCloseness(target, b) - taxonomicCloseness(target, a),
          )
        : shuffled;
      // Stable: written like the answer in the most languages first, unnamed items last.
      orders.push([...byKinship].sort((a, b) => formAffinity(target, b) - formAffinity(target, a)));
    }
    return orders[index] as Candidate[];
  };

  const picked: Candidate[] = [];
  const fill = (tierIndex: number, sameGenusAllowed: boolean): void => {
    for (const candidate of orderOf(tierIndex)) {
      if (picked.length === 3) return;
      if (picked.includes(candidate)) continue;
      if (
        picked.some(
          (existing) =>
            labelsOverlap(existing.label, candidate.label) ||
            indistinguishable(existing.label, candidate.label),
        )
      ) {
        continue;
      }
      // Same genus (direct parent taxon): photos often near-identical. Only when the category
      // has no other candidate left, and then at most one (D-120).
      if (
        sameParentTaxon(target, candidate) &&
        (!sameGenusAllowed || picked.some((existing) => sameParentTaxon(target, existing)))
      ) {
        continue;
      }
      picked.push(candidate);
    }
  };

  // 1. The answer's category without same-genus look-alikes (a different genus of the same
  //    family ranks first through the kinship order).
  for (let tier = 0; tier < 2 && picked.length < 3; tier += 1) fill(tier, false);
  // 2. No alternative in the category: at most one from the same genus.
  for (let tier = 0; tier < 2 && picked.length < 3; tier += 1) fill(tier, true);
  // 3. Other categories (same question text).
  if (picked.length < 3) fill(2, false);
  if (picked.length < 3) fill(2, true);

  return picked.length === 3 ? picked : null;
}
