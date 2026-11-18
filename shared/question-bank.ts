import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  ALLOWED_IMAGE_LICENSE_PATTERN,
  CATEGORY_VALUES,
  MIN_QUESTIONS_PER_CATEGORY,
  TRANSLATED_LANGUAGES,
  questionBankSchema,
  type QuestionBank,
  type QuestionCategory,
  type QuestionRecord,
  type TranslatedLanguage,
} from './schemas';

/** How many answers/articles of a language are real translations and how many fall back. */
export interface TranslationStats {
  /** Questions whose answer label is the title of the article in that language. */
  labelWikipedia: number;
  /** Answer label taken from the Wikidata label (no article in that language). */
  labelWikidata: number;
  /** Answer label that is the scientific name of a living thing (P225). */
  labelScientific: number;
  /** Answer label that is the item's original name (P1705, P1448, P1559, original language). */
  labelNative: number;
  /** Article text taken from the article in that language. */
  articleWikipedia: number;
  /** Article text from another language's article (shown with a notice). */
  articleOtherLanguage: number;
  /** Questions not offered in that language (no name to show). */
  unavailable: number;
}

export interface QuestionBankReport {
  errors: string[];
  warnings: string[];
  counts: Record<QuestionCategory, number>;
  total: number;
  shortArticles: number;
  translations: Record<TranslatedLanguage, TranslationStats>;
}

export interface QuestionBankValidation {
  success: boolean;
  bank: QuestionBank | null;
  report: QuestionBankReport;
}

/**
 * Whole-word, Unicode-aware search: "Pho" is not in "Photograph" and an Arabic noun is not found
 * inside a longer word that merely shares its letters.
 */
export function containsWord(haystack: string, word: string): boolean {
  const escaped = word.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (escaped === '') {
    return false;
  }
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu').test(haystack);
}

export function normalizeContent(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function computeContentHash(
  question: Pick<QuestionRecord, 'category' | 'subject' | 'questionText' | 'options'>,
): string {
  const payload = [
    normalizeContent(question.category),
    normalizeContent(question.subject),
    normalizeContent(question.questionText),
    normalizeContent(question.options.join('|')),
  ].join('|');

  return createHash('sha256').update(payload).digest('hex');
}

export function emptyTranslationStats(): Record<TranslatedLanguage, TranslationStats> {
  const blank = (): TranslationStats => ({
    labelWikipedia: 0,
    labelWikidata: 0,
    labelScientific: 0,
    labelNative: 0,
    articleWikipedia: 0,
    articleOtherLanguage: 0,
    unavailable: 0,
  });
  return { en: blank(), ar: blank() };
}

function emptyCounts(): Record<QuestionCategory, number> {
  return Object.fromEntries(CATEGORY_VALUES.map((category) => [category, 0])) as Record<
    QuestionCategory,
    number
  >;
}

/**
 * Provenance rules: every question must trace to a Wikipedia revision and carry a picture from
 * Wikimedia Commons under an accepted free licence, with its author recorded.
 */
function provenanceIssues(question: QuestionRecord): string[] {
  const issues: string[] = [];

  if (!question.source) {
    issues.push(`${question.id}: missing source (Wikipedia article revision)`);
  }

  if (!question.image) {
    issues.push(`${question.id}: missing image`);
  } else {
    if (!ALLOWED_IMAGE_LICENSE_PATTERN.test(question.image.license)) {
      issues.push(`${question.id}: image licence "${question.image.license}" is not accepted`);
    }
    if (!question.image.author) {
      issues.push(`${question.id}: image author is missing`);
    }
    if (!question.image.sourceUrl.startsWith('https://commons.wikimedia.org/wiki/File:')) {
      issues.push(`${question.id}: image sourceUrl must be a Wikimedia Commons file page`);
    }
  }

  const answer = question.options[question.correctIndex];
  if (
    answer !== undefined &&
    question.image &&
    question.image.alt.toLowerCase().includes(answer.toLowerCase())
  ) {
    issues.push(`${question.id}: image alt text reveals the answer`);
  }

  for (const language of TRANSLATED_LANGUAGES) {
    const translation = question.translations?.[language];
    if (!translation) {
      if (!question.unavailable?.[language]) {
        issues.push(`${question.id}: missing ${language} translation (and no unavailable reason)`);
      }
      continue;
    }
    if (question.unavailable?.[language]) {
      issues.push(`${question.id}: ${language} is both translated and unavailable`);
    }
    const { provenance } = translation;
    provenance.options.forEach((origin, index) => {
      const lang = provenance.optionLanguages[index] ?? '';
      const base = lang.toLowerCase().split('-')[0];
      if ((origin === 'wikipedia' || origin === 'wikidata') && base !== language) {
        issues.push(`${question.id}: ${language} option ${index} is a ${origin} name in "${lang}"`);
      }
      if (origin === 'scientific-name' && lang !== 'la') {
        issues.push(
          `${question.id}: ${language} option ${index} scientific name must be tagged la`,
        );
      }
      if (origin === 'native-name' && base === language) {
        issues.push(`${question.id}: ${language} option ${index} original name is in ${language}`);
      }
    });
    const translatedAnswer = translation.options[question.correctIndex];
    if (translation.subject !== translatedAnswer) {
      issues.push(`${question.id}: ${language} subject is not the translated answer`);
    }
    if (containsWord(translation.imageAlt, translation.subject)) {
      issues.push(`${question.id}: ${language} image alt text reveals the answer`);
    }
    if (
      translation.provenance.article === 'wikipedia' &&
      translation.source.language !== language
    ) {
      issues.push(`${question.id}: ${language} article text must cite a ${language} revision`);
    }
    if (
      translation.provenance.article === 'other-language' &&
      translation.source.language === language
    ) {
      issues.push(
        `${question.id}: ${language} other-language article cites a ${language} revision`,
      );
    }
    if (translation.provenance.options[question.correctIndex] !== translation.provenance.label) {
      issues.push(`${question.id}: ${language} label origin does not match the answer option`);
    }
  }

  return issues;
}

export function translationStats(
  questions: readonly QuestionRecord[],
): Record<TranslatedLanguage, TranslationStats> {
  const stats = emptyTranslationStats();
  for (const question of questions) {
    for (const language of TRANSLATED_LANGUAGES) {
      const translation = question.translations?.[language];
      const entry = stats[language];
      if (!translation) {
        entry.unavailable += 1;
        continue;
      }
      const { label, article } = translation.provenance;
      if (label === 'wikipedia') entry.labelWikipedia += 1;
      else if (label === 'wikidata') entry.labelWikidata += 1;
      else if (label === 'scientific-name') entry.labelScientific += 1;
      else entry.labelNative += 1;
      if (article === 'wikipedia') entry.articleWikipedia += 1;
      else entry.articleOtherLanguage += 1;
    }
  }
  return stats;
}

function formatIssues(bank: QuestionBank): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const hashes = new Set<string>();
  const subjects = new Set<string>();

  for (const question of bank.questions) {
    if (ids.has(question.id)) {
      errors.push(`Duplicate id: ${question.id}`);
    }
    ids.add(question.id);

    const hash = computeContentHash(question);
    if (hashes.has(hash)) {
      errors.push(`Duplicate contentHash: ${question.id} (${hash.slice(0, 12)})`);
    }
    hashes.add(hash);

    const subject = normalizeContent(question.subject);
    if (subjects.has(subject)) {
      errors.push(`Duplicate subject: ${question.subject}`);
    }
    subjects.add(subject);

    errors.push(...provenanceIssues(question));
  }

  return errors;
}

export function validateQuestionBank(input: unknown): QuestionBankValidation {
  const counts = emptyCounts();
  const parsed = questionBankSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      bank: null,
      report: {
        errors: parsed.error.issues.map((issue) => {
          const path = issue.path.join('.') || '<root>';
          return `${path}: ${issue.message}`;
        }),
        warnings: [],
        counts,
        total: 0,
        shortArticles: 0,
        translations: emptyTranslationStats(),
      },
    };
  }

  const bank = parsed.data;
  for (const question of bank.questions) {
    counts[question.category] += 1;
  }

  const errors = formatIssues(bank);
  const warnings: string[] = [];

  if (bank.questions.length < 200) {
    errors.push(`CLASSIC threshold not met: ${bank.questions.length}/200 approved questions`);
  }

  if (bank.questions.length < 10) {
    errors.push(`CONTEST threshold not met: ${bank.questions.length}/10 approved questions`);
  }

  const shortArticles = bank.questions.filter(
    (question) => question.articleBody.length < 200,
  ).length;
  if (shortArticles > 0) {
    warnings.push(
      `${shortArticles} article(s) are shorter than the editorial target of 200 characters`,
    );
  }

  const disabledCategories = CATEGORY_VALUES.filter(
    (category) => counts[category] < MIN_QUESTIONS_PER_CATEGORY,
  );
  if (disabledCategories.length > 0) {
    warnings.push(
      `SUBJECT disabled for ${disabledCategories.length} categories below ${MIN_QUESTIONS_PER_CATEGORY} questions: ${disabledCategories.join(', ')}`,
    );
  }

  return {
    success: errors.length === 0,
    bank,
    report: {
      errors,
      warnings,
      counts,
      total: bank.questions.length,
      shortArticles,
      translations: translationStats(bank.questions),
    },
  };
}

export async function loadQuestionBank(file: string): Promise<QuestionBankValidation> {
  const raw = await readFile(file, 'utf8');

  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch (error) {
    return {
      success: false,
      bank: null,
      report: {
        errors: [`Unable to parse JSON: ${error instanceof Error ? error.message : String(error)}`],
        warnings: [],
        counts: emptyCounts(),
        total: 0,
        shortArticles: 0,
        translations: emptyTranslationStats(),
      },
    };
  }

  return validateQuestionBank(input);
}
