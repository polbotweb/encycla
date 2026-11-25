import { describe, expect, it } from 'vitest';
import {
  indistinguishable,
  labelsOverlap,
  pickDistractors,
  picturesAlike,
  sameParentTaxon,
  seededRandom,
  taxonomicCloseness,
  shuffle,
  type Candidate,
} from '../../scripts/wikimedia/distractors';
import {
  classifyLicense,
  extractAuthor,
  isNonPhotoFilename,
} from '../../scripts/wikimedia/licenses';
import {
  buildArticleBody,
  cleanExtract,
  firstSentence,
  labelAppearsIn,
  labelFromTitle,
  slugify,
  splitSentences,
} from '../../scripts/wikimedia/text';

const meta = (license: string, artist = '<a href="x">Jane Doe</a>', extra = {}) => ({
  LicenseShortName: { value: license },
  Artist: { value: artist },
  ...extra,
});

describe('licence classification', () => {
  it.each([
    ['CC BY-SA 4.0', 'CC BY-SA 4.0'],
    ['CC BY 2.0', 'CC BY 2.0'],
    ['CC BY-SA 3.0 de', 'CC BY-SA 3.0'],
    ['CC0', 'CC0 1.0'],
    ['Public domain', 'Public domain'],
    ['PD-old-70', 'Public domain'],
  ])('accepts %s', (input, expected) => {
    const verdict = classifyLicense(meta(input));
    expect(verdict.ok).toBe(true);
    expect(verdict.license).toBe(expected);
  });

  it.each(['CC BY-NC 2.0', 'CC BY-ND 4.0', 'CC BY-NC-SA 3.0', 'GFDL', 'Fair use', 'Attribution'])(
    'rejects %s',
    (input) => {
      expect(classifyLicense(meta(input)).ok).toBe(false);
    },
  );

  it('rejects non-free files and missing metadata', () => {
    expect(classifyLicense(meta('CC BY 4.0', 'x', { NonFree: { value: 'true' } })).ok).toBe(false);
    expect(classifyLicense(undefined).ok).toBe(false);
  });

  it('extracts plain-text authors and flags unknown ones', () => {
    expect(extractAuthor(meta('CC BY 4.0', '<a href="u">Jane &amp; Co</a>'))).toEqual({
      author: 'Jane & Co',
      unknown: false,
    });
    expect(extractAuthor(meta('CC BY 4.0', 'Unknown author')).unknown).toBe(true);
    expect(extractAuthor(meta('CC BY 4.0', '')).unknown).toBe(true);
    expect(extractAuthor(meta('CC BY 4.0', 'x'.repeat(400))).author.length).toBeLessThanOrEqual(
      150,
    );
  });

  it('skips maps, diagrams and logos but allows SVG flags', () => {
    expect(isNonPhotoFilename('Lion distribution map.png', false)).toBe(true);
    expect(isNonPhotoFilename('Lion waiting in Namibia.jpg', false)).toBe(false);
    expect(isNonPhotoFilename('Flag of France.svg', false)).toBe(true);
    expect(isNonPhotoFilename('Flag of France.svg', true)).toBe(false);
    expect(isNonPhotoFilename('Orange tree.jpg', false)).toBe(false);
  });
});

describe('text helpers', () => {
  it('derives answer labels from article titles', () => {
    expect(labelFromTitle('Mars (planète)')).toBe('Mars');
    expect(labelFromTitle("Drapeau de l'Allemagne", 'flag')).toBe('Allemagne');
    expect(labelFromTitle('Drapeau de la république du Congo', 'flag')).toBe('République du Congo');
    expect(labelFromTitle('Drapeau des États-Unis', 'flag')).toBe('États-Unis');
    expect(labelFromTitle('Lion')).toBe('Lion');
  });

  it('slugifies accents and punctuation', () => {
    expect(slugify("Côte d'Ivoire")).toBe('cote-d-ivoire');
  });

  it('splits sentences without breaking abbreviations', () => {
    expect(splitSentences('Il naît en 50 av. J.-C. à Rome. Il meurt en 44.')).toEqual([
      'Il naît en 50 av. J.-C. à Rome.',
      'Il meurt en 44.',
    ]);
  });

  it('builds an article body from whole sentences within the limit', () => {
    const extract = 'Première phrase assez longue. Deuxième phrase assez longue.\n\nTroisième.';
    const body = buildArticleBody(extract, 45);
    expect(body).toBe('Première phrase assez longue.');
    expect(firstSentence(extract, 100)).toBe('Première phrase assez longue.');
    expect(
      firstSentence('Le drapeau est constitué de trois bandes de mêmes dimensions, soit :', 200),
    ).toBe('Le drapeau est constitué de trois bandes de mêmes dimensions…');
  });

  it('checks that an answer appears in its article', () => {
    expect(labelAppearsIn('Lion', 'Le lion (Panthera leo) est un félin.')).toBe(true);
    expect(labelAppearsIn('Zèbre', 'Le lion est un félin.')).toBe(false);
  });
});

describe('distractors', () => {
  const make = (
    id: string,
    label: string,
    group = 'g',
    pageId = Math.abs(hash(id)),
  ): Candidate => ({
    id,
    category: 'Fauna',
    group,
    question: 'Quel est cet animal ?',
    label,
    pageId,
    qid: `Q${pageId}`,
  });
  function hash(value: string): number {
    return [...value].reduce((total, char) => total * 31 + char.charCodeAt(0), 7) % 100_000;
  }

  it('is deterministic for a given seed', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    expect(shuffle(items, seededRandom('x'))).toEqual(shuffle(items, seededRandom('x')));
  });

  it('detects overlapping labels as whole words', () => {
    expect(labelsOverlap('Pomme', 'Pomme de terre')).toBe(true);
    expect(labelsOverlap('Pomme', 'Pommeau')).toBe(false);
  });

  it('never pairs look-alike flags', () => {
    expect(indistinguishable('Monaco', 'Indonésie')).toBe(true);
    expect(indistinguishable('Tchad', 'Andorre')).toBe(true);
    expect(indistinguishable('Monaco', 'France')).toBe(false);
  });

  it('picks three distinct real distractors, preferring the same group', () => {
    const target = make('t', 'Lion', 'felins');
    const pool = [
      target,
      make('a', 'Tigre', 'felins'),
      make('b', 'Léopard', 'felins'),
      make('c', 'Jaguar', 'felins'),
      make('d', 'Zèbre', 'ongules'),
      make('e', 'Lion de mer', 'felins'),
    ];
    const picked = pickDistractors(target, pool, seededRandom('t'));
    expect(picked?.map((item) => item.label).sort()).toEqual(['Jaguar', 'Léopard', 'Tigre']);
  });

  it('prefers the closest relatives (P171), with at most one from the same genus', () => {
    const taxon = (candidate: Candidate, lineage: string[]): Candidate => ({
      ...candidate,
      lineage: new Set(lineage),
      parents: new Set(lineage.slice(0, 1)),
    });
    const FELIDAE = ['Felidae', 'Carnivora', 'Mammalia', 'Animalia'];
    const target = taxon(make('t', 'Lion'), ['Panthera', ...FELIDAE]);
    const pool = [
      target,
      taxon(make('a', 'Tigre'), ['Panthera', ...FELIDAE]),
      taxon(make('b', 'Jaguar'), ['Panthera', ...FELIDAE]),
      taxon(make('c', 'Lynx boréal'), ['Lynx', ...FELIDAE]),
      taxon(make('d', 'Guépard'), ['Acinonyx', ...FELIDAE]),
      taxon(make('e', 'Loup'), ['Canis', 'Canidae', 'Carnivora', 'Mammalia', 'Animalia']),
      taxon(make('f', 'Zèbre'), ['Equus', 'Equidae', 'Perissodactyla', 'Mammalia', 'Animalia']),
      make('g', 'Sans taxonomie'),
    ];
    expect(taxonomicCloseness(target, pool[1] as Candidate)).toBe(5);
    expect(taxonomicCloseness(target, pool[7] as Candidate)).toBe(0);
    expect(sameParentTaxon(target, pool[2] as Candidate)).toBe(true);
    expect(sameParentTaxon(target, pool[3] as Candidate)).toBe(false);

    const picked = pickDistractors(target, pool, seededRandom('t'))?.map((item) => item.label);
    expect(picked).toHaveLength(3);
    // Other genera of the family exist (and a canid): no same-genus look-alike at all (D-120).
    expect(picked?.filter((label) => label === 'Tigre' || label === 'Jaguar')).toHaveLength(0);
    expect(picked).toEqual(expect.arrayContaining(['Lynx boréal', 'Guépard']));

    // Only same-genus relatives left in the category: exactly one of them.
    const narrow = [target, pool[1]!, pool[2]!, pool[3]!, pool[4]!];
    const fallback = pickDistractors(target, narrow, seededRandom('t'))?.map((item) => item.label);
    expect(fallback).toHaveLength(3);
    expect(fallback?.filter((label) => label === 'Tigre' || label === 'Jaguar')).toHaveLength(1);

    // A subspecies of the same genus counts as the same genus.
    const siberian = taxon(make('h', 'Tigre de Sibérie'), [
      'Panthera tigris',
      'Panthera',
      ...FELIDAE,
    ]);
    expect(sameParentTaxon(target, siberian)).toBe(true);
    expect(sameParentTaxon(siberian, target)).toBe(true);
    expect(sameParentTaxon(siberian, pool[3]!)).toBe(false);
  });

  it('never offers a subject whose picture looks like the answer', () => {
    const picture = (dhash: string, tone: number) => ({ dhash, colors: Array(27).fill(tone) });
    const target = { ...make('t', 'Tchad'), picture: picture('00ff00ff00ff00ff', 100) };
    const pool = [
      target,
      { ...make('a', 'Roumanie'), picture: picture('00ff00ff00ff00fe', 104) },
      { ...make('b', 'Mali'), picture: picture('00ff00ff00ff00ff', 200) },
      make('c', 'Japon'),
      { ...make('d', 'Népal'), picture: picture('ffffffff00000000', 100) },
    ];
    const picked = pickDistractors(target, pool, seededRandom('t'))?.map((item) => item.label);
    expect(picked?.sort()).toEqual(['Japon', 'Mali', 'Népal']);
    expect(picturesAlike(target, pool[1]!)).toBe(true);
    expect(picturesAlike(target, pool[2]!)).toBe(false);
    expect(picturesAlike(target, pool[3]!)).toBe(false);
  });

  it('never offers the same entity twice', () => {
    const target = make('t', 'Lion', 'g', 1);
    const synonym = { ...make('s', 'Panthera leo', 'g', 2), qid: target.qid };
    const pool = [target, synonym, make('a', 'Tigre'), make('b', 'Jaguar')];
    expect(pickDistractors(target, pool, seededRandom('t'))).toBeNull();
  });
});

describe('extract cleaning', () => {
  it('joins a sentence broken by a stray line break but keeps real paragraphs', () => {
    const extract =
      'Un laser (acronyme de light\namplification) est un appareil.\nDeuxième paragraphe.';
    expect(cleanExtract(extract)).toBe(
      'Un laser (acronyme de light amplification) est un appareil.\n\nDeuxième paragraphe.',
    );
  });
});
