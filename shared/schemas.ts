import { z } from 'zod';
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  TRANSLATED_LANGUAGES,
  isLanguage,
  type Language,
  type TranslatedLanguage,
} from './languages';

export const CATEGORY_VALUES = [
  'Fauna',
  'Flora',
  'Flags',
  'Birds',
  'Trees',
  'Insects',
  'Mushrooms',
  'Architecture',
  'Inventions',
  'Arts & Literature',
  'Geography',
  'Space & Astronomy',
  'History',
  'Mythology',
  'Gastronomy',
  'Music',
  'Sports',
  'Science',
] as const;

/** SUBJECT mode is only offered for a category with at least this many approved questions. */
export const MIN_QUESTIONS_PER_CATEGORY = 100;

/** Image licences accepted for questions (normalised names, see scripts/wikimedia/licenses.ts). */
export const ALLOWED_IMAGE_LICENSE_PATTERN = /^(CC0 1\.0|Public domain|CC BY(?:-SA)? \d\.\d)$/;

export const ALLOWED_IMAGE_HOSTS = ['upload.wikimedia.org', 'commons.wikimedia.org'] as const;

export {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  TRANSLATED_LANGUAGES,
  isLanguage,
  type Language,
  type TranslatedLanguage,
};

export const categorySchema = z.enum(CATEGORY_VALUES);

const htmlPattern = /<[^>]*>/;

const safeText = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((value) => !htmlPattern.test(value), 'HTML is not allowed');

const httpsUrl = z
  .string()
  .url()
  .refine((value) => value.startsWith('https://'), 'HTTPS is required');

export function isAllowedImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ALLOWED_IMAGE_HOSTS.some((host) => url.hostname === host);
  } catch {
    return false;
  }
}

export const questionImageSchema = z.object({
  url: httpsUrl.refine((value) => isAllowedImageUrl(value), 'Image host is not allowlisted'),
  alt: safeText(5, 200),
  credit: safeText(1, 200),
  license: safeText(1, 200),
  sourceUrl: httpsUrl,
  /** Plain-text author of the image, as required by CC BY / CC BY-SA attribution. */
  author: safeText(1, 200).optional(),
});

/** Where the question content comes from: a precise revision of a Wikipedia article. */
export const questionSourceSchema = z.object({
  /** Permalink of the article revision (…/w/index.php?title=…&oldid=…). */
  url: httpsUrl,
  revisionId: z.number().int().positive(),
  language: z.string().regex(/^[a-z]{2,3}$/),
  /** Licence of the article text (Wikipedia text is CC BY-SA). */
  license: safeText(1, 60),
  retrievedAt: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), 'retrievedAt must be an ISO date'),
});

/**
 * Where a translated label really comes from (D-108). Nothing is invented and French is never a
 * default: the article title in that language, else its Wikidata label (or common name), else the
 * scientific name of a living thing (P225), else the item's original name (P1705, P1448, P1559,
 * label in its original language). Without any of them the question is not offered in that
 * language (`unavailable`).
 */
/** BCP 47-like language tag of a label (`ar`, `la`, `zh-hans`…). */
export const LANGUAGE_TAG = /^[a-z]{2,3}(?:-[a-z0-9]+)*$/i;

export const TRANSLATION_ORIGINS = [
  'wikipedia',
  'wikidata',
  'scientific-name',
  'native-name',
] as const;
export type TranslationOrigin = (typeof TRANSLATION_ORIGINS)[number];

/** The same question in another language: same item, same picture, same option order. */
export const questionTranslationSchema = z.object({
  subject: safeText(1, 80),
  questionText: safeText(1, 300),
  options: z.array(safeText(1, 120)).length(4),
  explanation: safeText(1, 500),
  articleTitle: safeText(1, 120),
  articleBody: safeText(20, 5000),
  imageAlt: safeText(5, 200),
  imageCredit: safeText(1, 200),
  /** Revision the article text comes from (another language when `article` is `other-language`). */
  source: questionSourceSchema,
  provenance: z.object({
    /** Origin of the answer label and of each option label (same order as `options`). */
    label: z.enum(TRANSLATION_ORIGINS),
    options: z.array(z.enum(TRANSLATION_ORIGINS)).length(4),
    /** Language of each option label: this language, `la` for scientific names, else the original one. */
    optionLanguages: z.array(z.string().regex(LANGUAGE_TAG)).length(4),
    /**
     * `wikipedia` when the article is in this language; `other-language` when the best other real
     * article is shown instead (language in `source.language`, with a notice).
     */
    article: z.enum(['wikipedia', 'other-language']),
  }),
});

export const questionSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'id must be a lowercase dash-separated slug'),
    category: categorySchema,
    subject: safeText(1, 80),
    questionText: safeText(1, 300),
    options: z.array(safeText(1, 120)).length(4),
    correctIndex: z.number().int().min(0).max(3),
    explanation: safeText(1, 500),
    articleTitle: safeText(1, 120),
    articleBody: safeText(20, 5000),
    image: questionImageSchema.optional(),
    source: questionSourceSchema.optional(),
    translations: z
      .object({
        en: questionTranslationSchema.optional(),
        ar: questionTranslationSchema.optional(),
      })
      .optional(),
    /** Languages the question is not offered in, with the reason (no name to show, D-108). */
    unavailable: z
      .object({ en: safeText(1, 200).optional(), ar: safeText(1, 200).optional() })
      .optional(),
  })
  .superRefine((question, context) => {
    const normalizedOptions = question.options.map((option) =>
      option.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' '),
    );

    if (new Set(normalizedOptions).size !== question.options.length) {
      context.addIssue({
        code: 'custom',
        message: 'options must be distinct after normalization',
        path: ['options'],
      });
    }

    for (const language of TRANSLATED_LANGUAGES) {
      const translation = question.translations?.[language];
      if (!translation) {
        continue;
      }
      const translated = translation.options.map((option) =>
        option.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' '),
      );
      if (new Set(translated).size !== translated.length) {
        context.addIssue({
          code: 'custom',
          message: `${language} options must be distinct after normalization`,
          path: ['translations', language, 'options'],
        });
      }
    }
  });

export const questionBankSchema = z.object({
  version: z.literal(1),
  generatedAt: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), 'generatedAt must be an ISO date'),
  questions: z.array(questionSchema).min(1),
});

export type QuestionCategory = (typeof CATEGORY_VALUES)[number];
export type QuestionTranslation = z.infer<typeof questionTranslationSchema>;
export type QuestionSource = z.infer<typeof questionSourceSchema>;
export type QuestionImage = z.infer<typeof questionImageSchema>;
export type QuestionRecord = z.infer<typeof questionSchema>;
export type QuestionBank = z.infer<typeof questionBankSchema>;
