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
});
