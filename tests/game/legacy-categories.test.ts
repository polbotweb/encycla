import { describe, expect, it } from 'vitest';
import { CATEGORY_VALUES, categorySchema, normalizeCategory } from '../../shared/schemas';
import { selectQuestion } from '../../server/game/questions';
import { TEST_QUESTIONS } from '../fixtures/questions';

describe('Dogs & Cats merge (D-124)', () => {
  it('has one merged category and no former ids', () => {
    expect(CATEGORY_VALUES).toContain('Dogs & Cats');
    expect(CATEGORY_VALUES).not.toContain('Dogs');
    expect(CATEGORY_VALUES).not.toContain('Cats');
  });

  it('maps the former ids to the merged one and leaves the rest alone', () => {
    expect(normalizeCategory('Dogs')).toBe('Dogs & Cats');
    expect(normalizeCategory('Cats')).toBe('Dogs & Cats');
    expect(normalizeCategory('Fauna')).toBe('Fauna');
    expect(normalizeCategory(null)).toBeNull();
    expect(categorySchema.parse('Cats')).toBe('Dogs & Cats');
    expect(categorySchema.safeParse('Hamsters').success).toBe(false);
  });

  it('a saved room or old client asking for "Dogs" still gets the merged questions', () => {
    const base = TEST_QUESTIONS[0]!;
    const questions = [{ ...base, id: 'dogs-cats-x', category: 'Dogs & Cats' as const }];
    const picked = selectQuestion(questions, 'Dogs', [], () => 0);
    expect(picked?.runtime).toBeTruthy();
    expect(selectQuestion(questions, 'Fauna', [], () => 0)).toBeNull();
  });
});
