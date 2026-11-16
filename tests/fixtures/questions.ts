import {
  CATEGORY_VALUES,
  MIN_QUESTIONS_PER_CATEGORY,
  type QuestionCategory,
  type QuestionRecord,
  type QuestionTranslation,
} from '../../shared/schemas';
import type { QuestionProvider } from '../../server/game/types';

const CATEGORY_COUNTS: Record<QuestionCategory, number> = Object.fromEntries(
  CATEGORY_VALUES.map((category) => [category, 10]),
) as Record<QuestionCategory, number>;

// Exactly enough for SUBJECT in Fauna and Flora; every other category stays below the threshold.
CATEGORY_COUNTS.Fauna = MIN_QUESTIONS_PER_CATEGORY;
CATEGORY_COUNTS.Flora = MIN_QUESTIONS_PER_CATEGORY;

function slug(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function makeQuestion(
  category: QuestionCategory,
  categoryIndex: number,
  questionIndex: number,
): QuestionRecord {
  const subject = `${category} subject ${questionIndex + 1}`;
  const translation = (tag: 'EN' | 'AR'): QuestionTranslation => ({
    subject: `${tag} ${subject}`,
    questionText: `${tag} Which statement matches ${subject}?`,
    options: [1, 2, 3, 4].map((n) => `${tag} option ${n} for ${subject}`),
    explanation: `${tag} explanation for ${subject}.`,
    articleTitle: `${tag} story of ${subject}`,
    articleBody: `${tag} deterministic fixture article about ${subject}. `.repeat(5),
    imageAlt: `${tag} picture to identify`,
    imageCredit: `${tag} credit`,
    source: {
      url: `https://${tag.toLowerCase()}.wikipedia.org/w/index.php?title=Fixture&oldid=1`,
      revisionId: 1,
      language: tag.toLowerCase(),
      license: 'CC BY-SA 4.0',
      retrievedAt: '2026-01-01T00:00:00.000Z',
    },
    provenance: {
      label: 'wikipedia',
      options: ['wikipedia', 'wikipedia', 'wikipedia', 'wikipedia'],
      article: 'wikipedia',
    },
  });
  return {
    id: `${slug(category)}-q-${String(questionIndex + 1).padStart(2, '0')}`,
    category,
    subject,
    questionText: `Which statement matches ${subject}?`,
    options: [
      `First option for ${subject}`,
      `Second option for ${subject}`,
      `Third option for ${subject}`,
      `Fourth option for ${subject}`,
    ],
    correctIndex: (categoryIndex + questionIndex) % 4,
    explanation: `Explanation for ${subject}.`,
    articleTitle: `The story of ${subject}`,
    articleBody: `This is a deterministic fixture article about ${subject}. `.repeat(5),
    translations: { en: translation('EN'), ar: translation('AR') },
  };
}

export const TEST_QUESTIONS: readonly QuestionRecord[] = CATEGORY_VALUES.flatMap(
  (category, categoryIndex) =>
    Array.from({ length: CATEGORY_COUNTS[category] }, (_, questionIndex) =>
      makeQuestion(category, categoryIndex, questionIndex),
    ),
);

export function makeProvider(
  questions: readonly QuestionRecord[] = TEST_QUESTIONS,
): QuestionProvider {
  return {
    getQuestions: () => questions,
  };
}

export function makeQuestionBank(count: number): QuestionRecord[] {
  return Array.from({ length: count }, (_, index) => {
    const base = TEST_QUESTIONS[index % TEST_QUESTIONS.length] as QuestionRecord;
    return {
      ...base,
      id: `${base.id}-${index}`,
      subject: `${base.subject} ${index}`,
    };
  });
}
