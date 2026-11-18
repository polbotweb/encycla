import { isProxyableImage } from '../../server/images/upstream';
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
      // Served through the same-origin proxy (D-107): it must accept every bank file.
      expect(isProxyableImage(question.image?.url ?? ''), question.id).toBe(true);
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

  it('has an English and an Arabic version of every question, or says why not', async () => {
    for (const question of await loadQuestions()) {
      for (const language of TRANSLATED) {
        const translation = question.translations?.[language];
        const reason = question.unavailable?.[language];
        // Exactly one of the two (D-108): a translated question or a recorded reason.
        expect(Boolean(translation) !== Boolean(reason), `${question.id} ${language}`).toBe(true);
        if (!translation) continue;
        expect(translation.options, question.id).toHaveLength(4);
        expect(new Set(translation.options).size, `${question.id} ${language}`).toBe(4);
        expect(translation.options[question.correctIndex], question.id).toBe(translation.subject);
        expect(translation.provenance.options, question.id).toHaveLength(4);
        expect(translation.provenance.optionLanguages, question.id).toHaveLength(4);
        // The label of the answer and its provenance agree.
        expect(translation.provenance.options[question.correctIndex], question.id).toBe(
          translation.provenance.label,
        );
      }
    }
  });

  it('keeps enough questions per category and language to enable SUBJECT, with one known gap', async () => {
    const questions = await loadQuestions();
    const short: string[] = [];
    for (const language of TRANSLATED) {
      for (const category of CATEGORY_VALUES) {
        const offered = questions.filter(
          (question) => question.category === category && question.translations?.[language],
        ).length;
        if (offered < MIN_QUESTIONS_PER_CATEGORY) short.push(`${category} ${language}`);
      }
    }
    // Four mushrooms have no Arabic, scientific or original name (D-108): 99 Arabic mushroom
    // questions, so the SUBJECT mode is off for Mushrooms in Arabic rooms only.
    expect(short).toEqual(['Mushrooms ar']);
  });

  it('keeps provenance honest: an article is a permalink in the language it cites', async () => {
    for (const question of await loadQuestions()) {
      for (const language of TRANSLATED) {
        const translation = question.translations?.[language];
        if (!translation) continue;
        const cited = translation.source.language;
        expect(translation.source.url, question.id).toContain(
          `https://${cited}.wikipedia.org/w/index.php?title=`,
        );
        if (translation.provenance.article === 'wikipedia') {
          expect(cited, question.id).toBe(language);
        } else {
          expect(cited, question.id).not.toBe(language);
        }
      }
    }
  });

  it('never shows French text in an Arabic room (D-108)', async () => {
    for (const question of await loadQuestions()) {
      const ar = question.translations?.ar;
      if (!ar) continue;
      const { options, optionLanguages } = ar.provenance;
      ar.options.forEach((label, index) => {
        const origin = options[index];
        const lang = optionLanguages[index];
        const where = `${question.id} option ${index}: ${label}`;
        if (origin === 'wikipedia' || origin === 'wikidata') {
          // A real Arabic name, written in Arabic.
          expect(lang, where).toBe('ar');
          expect(label, where).toMatch(ARABIC);
        } else if (origin === 'scientific-name') {
          expect(lang, where).toBe('la');
          expect(label, where).not.toMatch(ARABIC);
        } else {
          // An item's own name in its original language, never the room language.
          expect(origin, where).toBe('native-name');
          expect(lang, where).not.toBe('ar');
        }
        // The French label may only reappear as the item's own name (French, or identical in
        // its original language, e.g. a Spanish tower known in French by its Spanish name).
        if (label === question.options[index] && origin !== 'scientific-name') {
          expect(origin, where).toBe('native-name');
        }
      });
      // The sentences of the room are Arabic; only the article itself may be another Wikipedia.
      expect(ar.questionText, question.id).toMatch(ARABIC);
      expect(ar.explanation, question.id).toMatch(ARABIC);
      expect(ar.explanation, question.id).not.toContain(question.explanation);
      if (ar.provenance.article === 'wikipedia') {
        expect(ar.articleBody, question.id).toMatch(ARABIC);
      }
    }
  });

  it('uses real English names in English rooms', async () => {
    for (const question of await loadQuestions()) {
      const en = question.translations?.en;
      if (!en) continue;
      en.provenance.options.forEach((origin, index) => {
        const lang = en.provenance.optionLanguages[index];
        if (origin === 'wikipedia' || origin === 'wikidata') expect(lang, question.id).toBe('en');
        if (origin === 'scientific-name') expect(lang, question.id).toBe('la');
        if (origin === 'native-name') expect(lang, question.id).not.toBe('en');
      });
      expect(en.explanation, question.id).not.toContain(question.explanation);
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
          // An entity may be written in its own language in one question and by its scientific
          // or original name in another (uniform options, D-108): compare like with like.
          const key = `${label}\u0000${translation.provenance.options[index]}`;
          const set = seen.get(key) ?? new Set<string>();
          set.add(translated);
          seen.set(key, set);
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
      if (ar) {
        expect(ar.imageAlt, question.id).toMatch(ARABIC);
        expect(ar.imageCredit, question.id).toMatch(ARABIC);
      }
      if (en) {
        expect(en.imageAlt, question.id).not.toBe(question.image?.alt);
        expect(en.imageCredit, question.id).toContain('Wikimedia Commons');
      }
    }
  });
});
