import { describe, expect, it } from 'vitest';
import { buildConfig } from '../../server/http/game';
import { categoryCounts, resolveSelection } from '../../server/http/modes';
import { MIN_QUESTIONS_PER_CATEGORY, type QuestionRecord } from '../../shared/schemas';
import { TEST_QUESTIONS } from '../fixtures/questions';

/** Fauna with its first question not offered in Arabic (no Arabic, Latin or original name). */
function withOneArabicGap(): QuestionRecord[] {
  let removed = false;
  return TEST_QUESTIONS.map((question) => {
    if (removed || question.category !== 'Fauna') return question;
    removed = true;
    const { ar: _ar, ...translations } = question.translations ?? {};
    void _ar;
    return {
      ...question,
      translations,
      unavailable: { ar: 'an option has no name in this language' },
    };
  });
}

describe('per-language availability (D-108)', () => {
  it('counts only the questions offered in each language', () => {
    const questions = withOneArabicGap();
    expect(categoryCounts(questions, 'fr').get('Fauna')).toBe(MIN_QUESTIONS_PER_CATEGORY);
    expect(categoryCounts(questions, 'en').get('Fauna')).toBe(MIN_QUESTIONS_PER_CATEGORY);
    expect(categoryCounts(questions, 'ar').get('Fauna')).toBe(MIN_QUESTIONS_PER_CATEGORY - 1);
  });

  it('enables SUBJECT per language in the config and the room contract', () => {
    const questions = withOneArabicGap();
    const fauna = buildConfig(questions).categories.find((entry) => entry.value === 'Fauna');
    expect(fauna?.subjectEnabled).toBe(true);
    expect(fauna?.languages.fr.subjectEnabled).toBe(true);
    expect(fauna?.languages.en.subjectEnabled).toBe(true);
    expect(fauna?.languages.ar).toEqual({
      questionCount: MIN_QUESTIONS_PER_CATEGORY - 1,
      subjectEnabled: false,
    });
    const selection = {
      mode: 'SUBJECT' as const,
      category: 'Fauna',
      difficulty: 'Novice' as const,
    };
    expect(
      resolveSelection({ ...selection, language: 'en' }, questions, { allowContest: false })
        .language,
    ).toBe('en');
    expect(() =>
      resolveSelection({ ...selection, language: 'ar' }, questions, { allowContest: false }),
    ).toThrow(/in ar/);
  });
});
