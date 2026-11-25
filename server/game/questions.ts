import { DEFAULT_LANGUAGE, type Language } from '../../shared/languages';
import { normalizeCategory, type QuestionRecord } from '../../shared/schemas';
import type { LabelForm } from '../../shared/types';
import type { QuestionRuntime } from './types';

export interface QuestionSelection {
  runtime: QuestionRuntime;
  recycled: boolean;
}

function randomIndex(length: number, random: () => number): number {
  if (length <= 1) {
    return 0;
  }
  const value = Math.floor(random() * length);
  return Math.min(length - 1, Math.max(0, value));
}

/**
 * True when the question can be played in `language` (D-108): French always; another language
 * only with a translation, never by showing the French text instead.
 */
export function isOfferedIn(question: QuestionRecord, language: Language): boolean {
  return language === 'fr' || question.translations?.[language] !== undefined;
}

/** Questions playable in `language`. */
export function offeredIn(
  questions: readonly QuestionRecord[],
  language: Language,
): readonly QuestionRecord[] {
  return language === 'fr' ? questions : questions.filter((q) => isOfferedIn(q, language));
}

/**
 * The question as shown in `language`: same id, same picture, same option order, with the text
 * of that language. French is the base record. A question without a translation is never
 * selected for that language (`isOfferedIn`); it is returned unchanged here only as a guard.
 */
export function localizeQuestion(question: QuestionRecord, language: Language): QuestionRecord {
  if (language === 'fr') {
    return question;
  }
  const translation = question.translations?.[language];
  if (!translation) {
    return question;
  }
  const { translations: _translations, ...base } = question;
  void _translations;
  return {
    ...base,
    subject: translation.subject,
    questionText: translation.questionText,
    options: [...translation.options],
    explanation: translation.explanation,
    articleTitle: translation.articleTitle,
    articleBody: translation.articleBody,
    ...(question.image
      ? {
          image: {
            ...question.image,
            alt: translation.imageAlt,
            credit: translation.imageCredit,
          },
        }
      : {}),
    source: translation.source,
  };
}

/** Wikipedia language the article of a localized question is really written in. */
export function textLanguageOf(question: QuestionRecord, language: Language): string {
  if (language === 'fr') {
    return 'fr';
  }
  return question.translations?.[language]?.source.language ?? 'fr';
}

/** Form of each option (bank order) that is not a name in `language`; `null` otherwise. */
export function optionFormsOf(
  question: QuestionRecord,
  language: Language,
): (LabelForm | null)[] | undefined {
  const provenance = language === 'fr' ? undefined : question.translations?.[language]?.provenance;
  if (!provenance) return undefined;
  const forms = provenance.options.map((origin, index): LabelForm | null => {
    if (origin === 'scientific-name') return { lang: 'la', scientific: true };
    if (origin === 'native-name') return { lang: provenance.optionLanguages[index] ?? 'und' };
    return null;
  });
  return forms.some((form) => form !== null) ? forms : undefined;
}

export function shuffleOptions(question: QuestionRecord, random: () => number): QuestionRuntime {
  const optionOrder = question.options.map((_, index) => index);

  for (let index = optionOrder.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1, random);
    const current = optionOrder[index] as number;
    optionOrder[index] = optionOrder[swapIndex] as number;
    optionOrder[swapIndex] = current;
  }

  return {
    question,
    optionOrder,
    options: optionOrder.map((index) => question.options[index] as string),
    correctIndex: optionOrder.indexOf(question.correctIndex),
  };
}

function withTextLanguage(
  question: QuestionRecord,
  language: Language,
  random: () => number,
): QuestionRuntime {
  const runtime = shuffleOptions(localizeQuestion(question, language), random);
  const forms = optionFormsOf(question, language);
  return {
    ...runtime,
    textLanguage: textLanguageOf(question, language),
    ...(forms ? { optionForms: runtime.optionOrder.map((index) => forms[index] ?? null) } : {}),
  };
}

export function selectQuestion(
  questions: readonly QuestionRecord[],
  category: string | null,
  usedQuestionIds: readonly string[],
  random: () => number,
  language: Language = DEFAULT_LANGUAGE,
): QuestionSelection | null {
  const playable = offeredIn(questions, language);
  const wanted = normalizeCategory(category);
  const eligible =
    wanted === null ? playable : playable.filter((question) => question.category === wanted);

  if (eligible.length === 0) {
    return null;
  }

  const used = new Set(usedQuestionIds);
  const unused = eligible.filter((question) => !used.has(question.id));

  if (unused.length > 0) {
    const question = unused[randomIndex(unused.length, random)] as QuestionRecord;
    return { runtime: withTextLanguage(question, language, random), recycled: false };
  }

  const oldestUsedId = usedQuestionIds.find((id) =>
    eligible.some((question) => question.id === id),
  );
  if (oldestUsedId === undefined) {
    return null;
  }

  const question = eligible.find((candidate) => candidate.id === oldestUsedId);
  if (!question) {
    return null;
  }

  return { runtime: withTextLanguage(question, language, random), recycled: true };
}
