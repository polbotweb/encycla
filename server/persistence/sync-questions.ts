import type Database from 'better-sqlite3';
import { computeContentHash } from '../../shared/question-bank';
import type { QuestionRecord } from '../../shared/schemas';

export interface QuestionImportResult {
  total: number;
  counts: Record<string, number>;
}

export function syncQuestions(
  db: Database.Database,
  questions: readonly QuestionRecord[],
  now = Date.now(),
): QuestionImportResult {
  const table = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'questions'")
    .get();

  if (!table) {
    throw new Error('questions table is missing; run the database migrations before importing');
  }

  if (questions.length === 0) {
    throw new Error('Cannot import an empty question bank');
  }

  const ids = questions.map((question) => question.id);
  const placeholders = ids.map(() => '?').join(', ');

  const removeMissing = db.prepare(`DELETE FROM questions WHERE id NOT IN (${placeholders})`);

  const upsert = db.prepare(`
    INSERT INTO questions (
      id,
      category,
      subject,
      question_text,
      options_json,
      correct_index,
      explanation,
      article_title,
      article_body,
      image_url,
      image_alt,
      image_credit,
      image_license,
      image_source_url,
      content_hash,
      imported_at,
      updated_at
    ) VALUES (
      @id,
      @category,
      @subject,
      @questionText,
      @optionsJson,
      @correctIndex,
      @explanation,
      @articleTitle,
      @articleBody,
      @imageUrl,
      @imageAlt,
      @imageCredit,
      @imageLicense,
      @imageSourceUrl,
      @contentHash,
      @importedAt,
      @updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      category = excluded.category,
      subject = excluded.subject,
      question_text = excluded.question_text,
      options_json = excluded.options_json,
      correct_index = excluded.correct_index,
      explanation = excluded.explanation,
      article_title = excluded.article_title,
      article_body = excluded.article_body,
      image_url = excluded.image_url,
      image_alt = excluded.image_alt,
      image_credit = excluded.image_credit,
      image_license = excluded.image_license,
      image_source_url = excluded.image_source_url,
      content_hash = excluded.content_hash,
      updated_at = excluded.updated_at
  `);

  const counts: Record<string, number> = {};
  for (const question of questions) {
    counts[question.category] = (counts[question.category] ?? 0) + 1;
  }

  const importAll = db.transaction(() => {
    removeMissing.run(...ids);

    for (const question of questions) {
      upsert.run({
        id: question.id,
        category: question.category,
        subject: question.subject,
        questionText: question.questionText,
        optionsJson: JSON.stringify(question.options),
        correctIndex: question.correctIndex,
        explanation: question.explanation,
        articleTitle: question.articleTitle,
        articleBody: question.articleBody,
        imageUrl: question.image?.url ?? null,
        imageAlt: question.image?.alt ?? null,
        imageCredit: question.image?.credit ?? null,
        imageLicense: question.image?.license ?? null,
        imageSourceUrl: question.image?.sourceUrl ?? null,
        contentHash: computeContentHash(question),
        importedAt: now,
        updatedAt: now,
      });
    }
  });

  importAll();

  return { total: questions.length, counts };
}
