import { DEFAULT_LANGUAGE, type Language } from '../../shared/languages';
import type { QuestionRecord } from '../../shared/schemas';
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
 * The question as shown in `language`: same id, same picture, same option order, with the text
 * of that language. French is the base record; a missing translation falls back to French (the
 * bank validation requires every question to have one, so this is only a safety net).
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

/** Language the explanation and the article of a localized question are really written in. */
export function textLanguageOf(question: QuestionRecord, language: Language): Language {
  if (language === 'fr') {
    return 'fr';
  }
  return question.translations?.[language]?.provenance.article === 'wikipedia' ? language : 'fr';
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
  return {
    ...shuffleOptions(localizeQuestion(question, language), random),
    textLanguage: textLanguageOf(question, language),
  };
}

export function selectQuestion(
  questions: readonly QuestionRecord[],
  category: string | null,
  usedQuestionIds: readonly string[],
  random: () => number,
  language: Language = DEFAULT_LANGUAGE,
): QuestionSelection | null {
  const eligible =
    category === null ? questions : questions.filter((question) => question.category === category);

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
