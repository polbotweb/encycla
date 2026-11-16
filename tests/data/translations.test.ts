import { describe, expect, it } from 'vitest';
import {
  ALT_TEXT,
  PHRASES,
  QUESTION_TEXT,
  creditLine,
  translatedLabel,
} from '../../scripts/wikimedia/languages';
import { SEEDS } from '../../scripts/wikimedia/seeds';
import { containsWord } from '../../shared/question-bank';
import { CATEGORY_VALUES } from '../../shared/schemas';
import { LANGUAGES, isLanguage } from '../../shared/languages';

const ARABIC = /[\u0600-\u06FF]/;

describe('languages', () => {
  it('knows French, English and Arabic, French first', () => {
    expect(LANGUAGES).toEqual(['fr', 'en', 'ar']);
    expect(isLanguage('ar')).toBe(true);
    expect(isLanguage('de')).toBe(false);
    expect(isLanguage(null)).toBe(false);
  });
});

describe('seed phrases', () => {
  const groups = CATEGORY_VALUES.flatMap((category) => SEEDS[category]);

  it('translate every question and alt text of every seed group', () => {
    for (const group of groups) {
      const question = QUESTION_TEXT[group.question];
      const alt = ALT_TEXT[group.alt];
      expect(question, group.question).toBeDefined();
      expect(alt, group.alt).toBeDefined();
      expect(question?.en.trim(), group.question).not.toBe('');
      expect(alt?.en.trim(), group.alt).not.toBe('');
      expect(question?.ar, group.question).toMatch(ARABIC);
      expect(alt?.ar, group.alt).toMatch(ARABIC);
      expect(question?.en, group.question).not.toBe(group.question);
    }
  });

  it('has no translation without a seed that uses it', () => {
    const questions = new Set(groups.map((group) => group.question));
    const alts = new Set(groups.map((group) => group.alt));
    for (const key of Object.keys(QUESTION_TEXT)) expect(questions.has(key), key).toBe(true);
    for (const key of Object.keys(ALT_TEXT)) expect(alts.has(key), key).toBe(true);
  });
});

describe('translatedLabel', () => {
  it('drops the disambiguation suffix', () => {
    expect(translatedLabel('Mercury (planet)', 'title', 'en')).toBe('Mercury');
    expect(translatedLabel('عطارد (كوكب)', 'title', 'ar')).toBe('عطارد');
  });

  it('drops the "flag of" prefix for flags', () => {
    expect(translatedLabel('Flag of Brazil', 'flag', 'en')).toBe('Brazil');
    expect(translatedLabel('Flag of the Netherlands', 'flag', 'en')).toBe('Netherlands');
    expect(translatedLabel('flag of japan', 'flag', 'en')).toBe('Japan');
    expect(translatedLabel('علم البرازيل', 'flag', 'ar')).toBe('البرازيل');
  });
});

describe('creditLine', () => {
  it('reads naturally in each language', () => {
    expect(creditLine('Jane', 'fr')).toBe(`Jane, ${PHRASES.viaCommons.fr}`);
    expect(creditLine('Jane', 'en')).toBe('Jane, via Wikimedia Commons');
    expect(creditLine('Jane', 'ar')).toBe('Jane – عبر ويكيميديا كومنز');
  });
});

describe('containsWord', () => {
  it('matches whole words only, in any script', () => {
    expect(containsWord('Photograph of a dish', 'Pho')).toBe(false);
    expect(containsWord('A bowl of pho', 'Pho')).toBe(true);
    expect(containsWord('Sun (star)', 'sun')).toBe(true);
    expect(containsWord('جرم من المجموعة الشمسية', 'الشمس')).toBe(false);
    expect(containsWord('صورة الشمس', 'الشمس')).toBe(true);
    expect(containsWord('anything', '  ')).toBe(false);
    expect(containsWord('C++ (language)', 'C++')).toBe(true);
  });
});
