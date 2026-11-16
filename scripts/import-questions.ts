import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { migrate } from '../server/db/migrate';
import { loadConfig } from '../server/config';
import { loadQuestionBank } from '../shared/question-bank';
import { syncQuestions } from '../server/persistence/sync-questions';

export { syncQuestions, type QuestionImportResult } from '../server/persistence/sync-questions';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const file = args.find((arg) => !arg.startsWith('--')) ?? 'data/questions.json';
  const config = loadConfig();

  const { success, bank, report } = await loadQuestionBank(file);
  if (!success || !bank) {
    for (const error of report.errors) {
      console.error(`ERROR ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  await mkdir(dirname(config.databasePath), { recursive: true });

  const db = new Database(config.databasePath);
  try {
    db.pragma('journal_mode = WAL');
    migrate(db);
    const result = syncQuestions(db, bank.questions);
    console.log(`Imported ${result.total} questions into ${config.databasePath}`);
    for (const [category, count] of Object.entries(result.counts)) {
      console.log(`  ${category}: ${count}`);
    }
  } finally {
    db.close();
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
