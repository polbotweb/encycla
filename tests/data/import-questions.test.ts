import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { syncQuestions } from '../../scripts/import-questions';
import { computeContentHash } from '../../shared/question-bank';
import type { QuestionRecord } from '../../shared/schemas';

const QUESTION_TABLE_SQL = `
  CREATE TABLE questions (
    id               TEXT PRIMARY KEY,
    category         TEXT NOT NULL,
    subject          TEXT NOT NULL,
    question_text    TEXT NOT NULL,
    options_json     TEXT NOT NULL,
    correct_index    INTEGER NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
    explanation      TEXT NOT NULL,
    article_title    TEXT NOT NULL,
    article_body     TEXT NOT NULL,
    image_url        TEXT,
    image_alt        TEXT,
    image_credit     TEXT,
    image_license    TEXT,
    image_source_url TEXT,
    image_author     TEXT,
    source_url       TEXT,
    source_revision  INTEGER,
    source_language  TEXT,
    source_license   TEXT,
    source_retrieved_at TEXT,
    content_hash     TEXT NOT NULL UNIQUE,
    imported_at      INTEGER NOT NULL,
    updated_at       INTEGER NOT NULL
  );
`;

const question = (id: string, subject: string): QuestionRecord => ({
  id,
  category: 'Fauna',
  subject,
  questionText: `Which animal is ${subject}?`,
  options: [subject, 'Other', 'Third', 'Fourth'],
  correctIndex: 0,
  explanation: `${subject} is the answer.`,
  articleTitle: subject,
  articleBody: `${subject} is a valid test subject with enough characters for the schema.`,
  image: {
    url: 'https://upload.wikimedia.org/example.jpg',
    alt: `${subject} image`,
    credit: 'Wikimedia Commons',
    license: 'CC BY-SA 4.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Example.jpg',
    author: 'Example Author',
  },
  source: {
    url: `https://fr.wikipedia.org/w/index.php?title=${subject}&oldid=1`,
    revisionId: 1,
    language: 'fr',
    license: 'CC BY-SA 4.0',
    retrievedAt: '2026-11-16T09:00:00.000Z',
  },
});

describe('syncQuestions', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(QUESTION_TABLE_SQL);
  });

  afterEach(() => {
    db.close();
  });

  it('inserts and updates questions atomically', () => {
    const first = question('fauna-lion-01', 'Lion');
    const second = question('fauna-tiger-01', 'Tiger');

    expect(syncQuestions(db, [first, second], 1_000)).toEqual({
      total: 2,
      counts: { Fauna: 2 },
    });
    expect(db.prepare('SELECT COUNT(*) AS count FROM questions').get()).toEqual({ count: 2 });

    expect(syncQuestions(db, [first], 2_000).total).toBe(1);

    const row = db
      .prepare('SELECT id, content_hash, imported_at, updated_at FROM questions')
      .get() as {
      id: string;
      content_hash: string;
      imported_at: number;
      updated_at: number;
    };

    expect(row.id).toBe(first.id);
    expect(row.content_hash).toBe(computeContentHash(first));
    expect(row.imported_at).toBe(1_000);
    expect(row.updated_at).toBe(2_000);
  });

  it('rolls back when a content hash collides', () => {
    const first = question('fauna-lion-01', 'Lion');
    const duplicate = question('fauna-lion-02', 'Lion');
    syncQuestions(db, [first], 1_000);

    expect(() => syncQuestions(db, [first, duplicate], 2_000)).toThrow();

    expect(db.prepare('SELECT COUNT(*) AS count FROM questions').get()).toEqual({ count: 1 });
  });
});

describe('syncQuestions provenance', () => {
  it('stores the Wikipedia revision and the image author', () => {
    const db = new Database(':memory:');
    db.exec(QUESTION_TABLE_SQL);
    syncQuestions(db, [question('fauna-lion-01', 'Lion')], 1_000);

    expect(
      db
        .prepare(
          'SELECT image_author, source_revision, source_language, source_license FROM questions',
        )
        .get(),
    ).toEqual({
      image_author: 'Example Author',
      source_revision: 1,
      source_language: 'fr',
      source_license: 'CC BY-SA 4.0',
    });
    db.close();
  });
});
