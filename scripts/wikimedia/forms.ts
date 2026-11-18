/**
 * Answer labels in a game language when that language has no name for an item (D-108).
 *
 * Order, never inventing and never defaulting to French:
 *   1. title of the Wikipedia article in that language / Wikidata label (or Arabic common name);
 *   2. living things: the scientific name (Wikidata P225), shown in italics, left-to-right;
 *   3. other items: the original name (P1705 native label, P1448 official name, P1559 name in
 *      native language), else the item's label in its original language (language of the work,
 *      of the country of origin…);
 *   4. nothing: the question is not offered in that language.
 */
import { normalizeText } from './text';

export type LabelOrigin = 'wikipedia' | 'wikidata' | 'scientific-name' | 'native-name';

/** Language tag of a scientific (taxon) name. */
export const SCIENTIFIC_LANG = 'la';

export interface LabelChoice {
  label: string;
  origin: LabelOrigin;
  /** Language of `label` (the game language for Wikipedia/Wikidata names). */
  lang: string;
  /** Article title with its qualifier, to tell two identical labels apart. */
  full?: string;
}

export interface NameForms {
  /** Wikidata P225 (taxon name). */
  taxonName?: string;
  /** P1705 (native label), P1559 (name in native language), P1448 (official name) values. */
  nativeNames: { text: string; lang: string; property?: 'P1705' | 'P1559' | 'P1448' }[];
  /** Wikimedia codes of the item's original language(s), most specific first. */
  originLanguages: string[];
  /** Labels of the item in those languages. */
  originLabels: Record<string, string>;
}

export const MAX_LABEL = 80;

const VALID_LANG = /^[a-z]{2,3}(?:-[a-z0-9]+)*$/i;
const NOT_A_LANGUAGE = new Set(['mis', 'mul', 'und', 'zxx']);

export function isUsableLang(lang: string): boolean {
  return VALID_LANG.test(lang) && !NOT_A_LANGUAGE.has(lang.toLowerCase().split('-')[0] ?? '');
}

const usable = (label: string | undefined): label is string =>
  label !== undefined && label.trim().length > 0 && label.trim().length <= MAX_LABEL;

/** Base language of a tag (`zh-hans` → `zh`). */
export const baseLang = (lang: string): string => lang.toLowerCase().split('-')[0] as string;

/** The scientific name of a living thing, as a label. */
export function scientificChoice(forms: NameForms | undefined): LabelChoice | null {
  const name = forms?.taxonName?.trim();
  return usable(name) ? { label: name, origin: 'scientific-name', lang: SCIENTIFIC_LANG } : null;
}

/**
 * Original names in order of preference: the native label (P1705), the item's label in its
 * original language (the usual name, e.g. "Teatro Amazonas"), the name in native language
 * (P1559, people), then the official name (P1448, often a long formal title).
 */
function nativeCandidates(forms: NameForms): { text: string; lang: string; property?: string }[] {
  const byProperty = (property: string) =>
    forms.nativeNames.filter((name) => (name.property ?? 'P1705') === property);
  return [
    ...byProperty('P1705'),
    ...forms.originLanguages.map((lang) => ({ text: forms.originLabels[lang] ?? '', lang })),
    ...byProperty('P1559'),
    ...byProperty('P1448'),
  ].map((name) => ({ ...name, text: displayName(name.text) }));
}

/** Wikidata labels start in lowercase for common nouns ("mont Ventoux"): capitalise for display. */
export function displayName(text: string): string {
  const trimmed = text.trim();
  const first = trimmed.charAt(0);
  return first !== first.toLocaleUpperCase()
    ? first.toLocaleUpperCase() + trimmed.slice(1)
    : trimmed;
}

/** The original name of an item (never in `language` itself: that would be a real label). */
export function nativeChoice(forms: NameForms | undefined, language: string): LabelChoice | null {
  if (!forms) return null;
  const candidates = nativeCandidates(forms);
  for (const { text, lang } of candidates) {
    const label = text.trim();
    if (!usable(label) || !isUsableLang(lang)) continue;
    if (baseLang(lang) === baseLang(language)) {
      continue;
    }
    return { label, origin: 'native-name', lang };
  }
  return null;
}

/** A native name that happens to be in the game language counts as a real label. */
export function nativeInLanguage(
  forms: NameForms | undefined,
  language: string,
): LabelChoice | null {
  if (!forms) return null;
  const candidates = nativeCandidates(forms);
  const hit = candidates.find(
    ({ text, lang }) => usable(text.trim()) && baseLang(lang) === baseLang(language),
  );
  return hit ? { label: hit.text.trim(), origin: 'wikidata', lang: language } : null;
}

/** Best label of an item in `language`, or `null` when the item has no name to show. */
export function chooseLabel(input: {
  language: string;
  living: boolean;
  /** Ordered real names in the language (article title, Wikidata label, common names). */
  real: LabelChoice[];
  forms: NameForms | undefined;
}): LabelChoice | null {
  const real = input.real.find((choice) => usable(choice.label));
  if (real) return real;
  if (input.living) {
    return scientificChoice(input.forms);
  }
  return nativeInLanguage(input.forms, input.language) ?? nativeChoice(input.forms, input.language);
}

/** How an option is written, as players can see it: in the game language, Latin name, other. */
export type FormKey = 'own' | 'scientific' | 'foreign' | 'none';

export function formKey(choice: LabelChoice | null): FormKey {
  if (!choice) return 'none';
  if (choice.origin === 'scientific-name') return 'scientific';
  return choice.origin === 'native-name' ? 'foreign' : 'own';
}

export interface OptionInput {
  choice: LabelChoice | null;
  living: boolean;
  forms: NameForms | undefined;
}

export type ResolvedOptions =
  | { ok: true; labels: string[]; origins: LabelOrigin[]; langs: string[]; uniform: boolean }
  | { ok: false; reason: string };

const key = (value: string): string => normalizeText(value) || value.trim().toLowerCase();

/**
 * Option labels of one question in one language. Living things are shown uniformly as scientific
 * names as soon as one option needs it (so a Latin name never singles out an option); an option
 * that would still single out the answer by its form drops the question from that language.
 */
export function resolveOptions(
  options: readonly OptionInput[],
  correctIndex: number,
  language: string,
): ResolvedOptions {
  if (options.some((option) => option.choice === null)) {
    return { ok: false, reason: 'an option has no name in this language' };
  }
  let choices = options.map((option) => option.choice as LabelChoice);
  let uniform = false;
  if (choices.some((choice) => choice.origin === 'scientific-name')) {
    const scientific = options.map((option) =>
      option.living ? scientificChoice(option.forms) : null,
    );
    if (scientific.every((choice) => choice !== null)) {
      choices = scientific as LabelChoice[];
      uniform = true;
    }
  }

  // Identical labels: the article title with its qualifier, then the scientific / original name.
  const duplicates = (): number[] => {
    const seen = new Map<string, number[]>();
    choices.forEach((choice, index) => {
      const id = key(choice.label);
      seen.set(id, [...(seen.get(id) ?? []), index]);
    });
    return [...seen.values()].filter((list) => list.length > 1).flat();
  };
  for (const index of duplicates()) {
    const choice = choices[index] as LabelChoice;
    if (choice.full && choice.full !== choice.label && choice.full.length <= MAX_LABEL) {
      choices[index] = { ...choice, label: choice.full };
    }
  }
  for (const index of duplicates()) {
    const option = options[index] as OptionInput;
    const alternative = option.living
      ? scientificChoice(option.forms)
      : nativeChoice(option.forms, language);
    if (alternative) choices[index] = alternative;
  }
  if (duplicates().length > 0) {
    return { ok: false, reason: 'two options would have the same name' };
  }

  const keys = choices.map((choice) => formKey(choice));
  const answerKey = keys[correctIndex];
  const others = keys.filter((_, index) => index !== correctIndex);
  if (others.every((other) => other === others[0]) && others[0] !== answerKey) {
    return { ok: false, reason: 'the answer would be the only option written differently' };
  }

  return {
    ok: true,
    labels: choices.map((choice) => choice.label),
    origins: choices.map((choice) => choice.origin),
    langs: choices.map((choice) => choice.lang),
    uniform,
  };
}

/** Wikipedia languages whose extracts the text helpers can cut into sentences. */
export const ARTICLE_LANGUAGES = new Set([
  'fr',
  'en',
  'ar',
  'es',
  'it',
  'de',
  'pt',
  'nl',
  'ca',
  'pl',
  'sv',
  'da',
  'nb',
  'cs',
  'ro',
]);

/** Other large Wikipedias tried, in this order, before French. */
export const GENERIC_ARTICLE_LANGUAGES = ['de', 'es', 'it', 'pt', 'nl'];

/**
 * Article languages to try when the game language has none: Arabic rooms prefer English, then
 * the original language; English rooms prefer the original language. French comes last.
 */
export function articleFallbackOrder(
  language: string,
  originLanguages: readonly string[],
): string[] {
  const origins = originLanguages
    .map(baseLang)
    .filter((lang) => lang !== 'fr' && lang !== language && ARTICLE_LANGUAGES.has(lang));
  const order = language === 'ar' ? ['en', ...origins] : [...origins];
  // No original language (living things, …): another large Wikipedia before the French one.
  return [...new Set([...order, ...GENERIC_ARTICLE_LANGUAGES, 'fr'])].filter(
    (lang) => lang !== language,
  );
}
