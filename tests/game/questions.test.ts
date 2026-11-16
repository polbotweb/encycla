import { describe, expect, it } from 'vitest';
import {
  localizeQuestion,
  selectQuestion,
  shuffleOptions,
  textLanguageOf,
} from '../../server/game/questions';
import { TEST_QUESTIONS } from '../fixtures/questions';

function sequence(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index % values.length] as number;
    index += 1;
    return value;
  };
}

describe('question selection', () => {
  it('shuffles options deterministically and remaps the correct index', () => {
    const question = TEST_QUESTIONS[0] as (typeof TEST_QUESTIONS)[number];
    const first = shuffleOptions(question, sequence([0.1, 0.4, 0.8]));
    const second = shuffleOptions(question, sequence([0.1, 0.4, 0.8]));

    expect(first).toEqual(second);
    expect(first.options).toHaveLength(4);
    expect(new Set(first.options).size).toBe(4);
    expect(first.options[first.correctIndex]).toBe(question.options[question.correctIndex]);
    expect([...first.optionOrder].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
  });

  it('draws without replacement inside a room', () => {
    const first = selectQuestion(TEST_QUESTIONS, 'Fauna', [], sequence([0.2, 0.5, 0.5, 0.5]));
    expect(first).not.toBeNull();
    const second = selectQuestion(
      TEST_QUESTIONS,
      'Fauna',
      [first?.runtime.question.id ?? ''],
      sequence([0.2, 0.5, 0.5, 0.5]),
    );

    expect(second).not.toBeNull();
    expect(second?.runtime.question.id).not.toBe(first?.runtime.question.id);
    expect(second?.recycled).toBe(false);
  });

  it('only selects the requested category', () => {
    const selected = selectQuestion(TEST_QUESTIONS, 'Flora', [], sequence([0.5, 0.5, 0.5, 0.5]));
    expect(selected?.runtime.question.category).toBe('Flora');
  });

  it('recycles the oldest used question when the eligible pool is exhausted', () => {
    const fauna = TEST_QUESTIONS.filter((question) => question.category === 'Fauna');
    const used = fauna.map((question) => question.id);
    const selected = selectQuestion(TEST_QUESTIONS, 'Fauna', used, sequence([0.5, 0.5, 0.5, 0.5]));

    expect(selected?.recycled).toBe(true);
    expect(selected?.runtime.question.id).toBe(used[0]);
  });

  it('returns null when a category has no questions', () => {
    expect(selectQuestion(TEST_QUESTIONS, 'Unknown', [], sequence([0.5]))).toBeNull();
    expect(selectQuestion([], null, [], sequence([0.5]))).toBeNull();
  });
});

describe('question language', () => {
  const question = TEST_QUESTIONS[0] as (typeof TEST_QUESTIONS)[number];

  it('keeps the French record for French and falls back when a translation is missing', () => {
    expect(localizeQuestion(question, 'fr')).toBe(question);
    const { translations: _translations, ...untranslated } = question;
    void _translations;
    expect(localizeQuestion(untranslated, 'ar')).toEqual(untranslated);
  });

  it('swaps every text of the question and keeps the id, the picture and the answer slot', () => {
    for (const language of ['en', 'ar'] as const) {
      const translation = question.translations?.[language];
      const localized = localizeQuestion(question, language);
      expect(localized.id).toBe(question.id);
      expect(localized.category).toBe(question.category);
      expect(localized.correctIndex).toBe(question.correctIndex);
      expect(localized.subject).toBe(translation?.subject);
      expect(localized.questionText).toBe(translation?.questionText);
      expect(localized.options).toEqual(translation?.options);
      expect(localized.explanation).toBe(translation?.explanation);
      expect(localized.articleTitle).toBe(translation?.articleTitle);
      expect(localized.articleBody).toBe(translation?.articleBody);
      expect(localized.image).toBeUndefined();
    }
  });

  it('keeps the picture and translates its alt text and credit', () => {
    const withImage = {
      ...question,
      image: {
        url: 'https://upload.wikimedia.org/x.jpg',
        alt: 'Photographie à identifier',
        credit: 'Auteur, via Wikimedia Commons',
        license: 'CC BY-SA 4.0',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:X.jpg',
        author: 'Auteur',
      },
    };
    const localized = localizeQuestion(withImage, 'ar');
    expect(localized.image?.url).toBe(withImage.image.url);
    expect(localized.image?.license).toBe('CC BY-SA 4.0');
    expect(localized.image?.alt).toBe(withImage.translations?.ar?.imageAlt);
    expect(localized.image?.credit).toBe(withImage.translations?.ar?.imageCredit);
  });

  it('shuffles every language with the same permutation (same options, same answer slot)', () => {
    const picks = (language: 'fr' | 'en' | 'ar') =>
      selectQuestion(TEST_QUESTIONS, 'Fauna', [], sequence([0.3, 0.7, 0.1, 0.9]), language);
    const [fr, en, ar] = [picks('fr'), picks('en'), picks('ar')];
    expect(fr?.runtime.question.id).toBe(en?.runtime.question.id);
    expect(fr?.runtime.question.id).toBe(ar?.runtime.question.id);
    expect(en?.runtime.optionOrder).toEqual(fr?.runtime.optionOrder);
    expect(ar?.runtime.correctIndex).toBe(fr?.runtime.correctIndex);
    expect(ar?.runtime.options[ar.runtime.correctIndex]).toBe(
      fr?.runtime.question.translations?.ar?.options[fr.runtime.question.correctIndex],
    );
    expect(ar?.runtime.options[0]).toMatch(/^AR /);
    expect(en?.runtime.options[0]).toMatch(/^EN /);
  });

  it('reports the language of the article text, which is French when it falls back', () => {
    expect(textLanguageOf(question, 'fr')).toBe('fr');
    expect(textLanguageOf(question, 'ar')).toBe('ar');
    const ar = question.translations?.ar;
    expect(ar).toBeDefined();
    const fallback = {
      ...question,
      translations: {
        ...question.translations,
        ar: { ...ar!, provenance: { ...ar!.provenance, article: 'fallback-fr' as const } },
      },
    };
    expect(textLanguageOf(fallback, 'ar')).toBe('fr');
    expect(textLanguageOf(fallback, 'en')).toBe('en');
    const { translations: _translations, ...untranslated } = question;
    void _translations;
    expect(textLanguageOf(untranslated, 'en')).toBe('fr');
    const pick = selectQuestion([fallback], null, [], sequence([0.5]), 'ar');
    expect(pick?.runtime.textLanguage).toBe('fr');
    expect(pick?.runtime.options[0]).toMatch(/^AR /);
  });
});
