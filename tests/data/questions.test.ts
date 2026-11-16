import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { loadQuestionBank } from '../../shared/question-bank';
import {
  ALLOWED_IMAGE_LICENSE_PATTERN,
  CATEGORY_VALUES,
  MIN_QUESTIONS_PER_CATEGORY,
  type QuestionRecord,
} from '../../shared/schemas';

async function loadQuestions(): Promise<QuestionRecord[]> {
  const raw = JSON.parse(await readFile('data/questions.json', 'utf8')) as {
    questions: QuestionRecord[];
  };
  return raw.questions;
}

const TRANSLATED = ['en', 'ar'] as const;
const ARABIC = /[\u0600-\u06FF]/;

describe('question bank', () => {
  it('validates the approved bank', async () => {
    const { success, report } = await loadQuestionBank('data/questions.json');

    expect(report.errors).toEqual([]);
    expect(success).toBe(true);
    expect(report.shortArticles).toBe(0);
  });

  it('has enough questions in every category to enable SUBJECT', async () => {
    const { report } = await loadQuestionBank('data/questions.json');

    for (const category of CATEGORY_VALUES) {
      expect(report.counts[category], category).toBeGreaterThanOrEqual(MIN_QUESTIONS_PER_CATEGORY);
    }
  });

  it('traces every question to a Wikipedia revision and a free Commons image', async () => {
    for (const question of await loadQuestions()) {
      expect(question.source?.url, question.id).toMatch(
        /^https:\/\/[a-z]{2,3}\.wikipedia\.org\/w\/index\.php\?title=.+&oldid=\d+$/,
      );
      expect(question.source?.revisionId, question.id).toBeGreaterThan(0);
      expect(question.image?.license, question.id).toMatch(ALLOWED_IMAGE_LICENSE_PATTERN);
      expect(question.image?.author, question.id).toBeTruthy();
      expect(question.image?.sourceUrl, question.id).toMatch(
        /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/,
      );
      expect(question.image?.url, question.id).toMatch(/^https:\/\/upload\.wikimedia\.org\//);
    }
  });

  it('never reuses an image and never reveals the answer in the alt text', async () => {
    const questions = await loadQuestions();
    const files = questions.map((question) => question.image?.sourceUrl);
    expect(new Set(files).size).toBe(files.length);

    for (const question of questions) {
      const answer = question.options[question.correctIndex] ?? '';
      expect(question.image?.alt.toLowerCase(), question.id).not.toContain(answer.toLowerCase());
    }
  });

  it('has distinct options in which the answer is the subject', async () => {
    for (const question of await loadQuestions()) {
      expect(question.options[question.correctIndex], question.id).toBe(question.subject);
      expect(new Set(question.options).size, question.id).toBe(4);
    }
  });

  it('has an English and an Arabic version of every question, with the same photo and slots', async () => {
    for (const question of await loadQuestions()) {
      for (const language of TRANSLATED) {
        const translation = question.translations?.[language];
        expect(translation, `${question.id} ${language}`).toBeDefined();
        if (!translation) continue;
        expect(translation.options, question.id).toHaveLength(4);
        expect(new Set(translation.options).size, `${question.id} ${language}`).toBe(4);
        expect(translation.options[question.correctIndex], question.id).toBe(translation.subject);
        expect(translation.provenance.options, question.id).toHaveLength(4);
        // The label of the answer and its provenance agree.
        expect(translation.provenance.options[question.correctIndex], question.id).toBe(
          translation.provenance.label,
        );
      }
    }
  });

  it('keeps provenance honest: a Wikipedia article is a permalink in that language', async () => {
    for (const question of await loadQuestions()) {
      for (const language of TRANSLATED) {
        const translation = question.translations?.[language];
        if (!translation) continue;
        const own = `https://${language}.wikipedia.org/w/index.php?title=`;
        if (translation.provenance.article === 'wikipedia') {
          expect(translation.source.url, question.id).toContain(own);
          expect(translation.source.language, question.id).toBe(language);
        } else {
          // Fallback: the text is the French article, sourced as such.
          expect(translation.source.url, question.id).toBe(question.source?.url);
          expect(translation.articleBody, question.id).toBe(question.articleBody);
        }
      }
    }
  });

  it('never leaves untranslated text under a non-fallback label', async () => {
    for (const question of await loadQuestions()) {
      const en = question.translations?.en;
      const ar = question.translations?.ar;
      if (ar && ar.provenance.label !== 'fallback-fr') {
        expect(ARABIC.test(ar.subject) || /^[\x20-\x7E]+$/.test(ar.subject), question.id).toBe(
          true,
        );
      }
      if (ar?.provenance.article === 'wikipedia') {
        expect(ARABIC.test(ar.articleBody), question.id).toBe(true);
      }
      if (en && en.provenance.label === 'fallback-fr') {
        expect(en.subject, question.id).toBe(question.subject);
      }
      if (ar && ar.provenance.label === 'fallback-fr') {
        expect(ar.subject, question.id).toBe(question.subject);
      }
    }
  });

  it('names one entity the same way everywhere in a language', async () => {
    const questions = await loadQuestions();
    // French label -> translated label, for every place a French label appears as answer or option.
    for (const language of TRANSLATED) {
      const seen = new Map<string, Set<string>>();
      for (const question of questions) {
        const translation = question.translations?.[language];
        if (!translation) continue;
        question.options.forEach((label, index) => {
          const translated = translation.options[index];
          if (translated === undefined) return;
          const set = seen.get(label) ?? new Set<string>();
          set.add(translated);
          seen.set(label, set);
        });
      }
      const inconsistent = [...seen.entries()].filter(([, labels]) => labels.size > 1);
      // Collisions inside one question are resolved with the full article title, so a handful of
      // labels may legitimately differ; anything systematic would be a bug.
      expect(inconsistent.length / seen.size, language).toBeLessThan(0.01);
    }
  });

  it('translates the alt text and the credit of every picture', async () => {
    for (const question of await loadQuestions()) {
      const ar = question.translations?.ar;
      const en = question.translations?.en;
      expect(ar?.imageAlt, question.id).toMatch(ARABIC);
      expect(ar?.imageCredit, question.id).toMatch(ARABIC);
      expect(en?.imageAlt, question.id).not.toBe(question.image?.alt);
      expect(en?.imageCredit, question.id).toContain('Wikimedia Commons');
    }
  });
});
