import 'dotenv/config';
import {
  emptyTranslationStats,
  loadQuestionBank,
  type QuestionBankValidation,
} from '../shared/question-bank';
import { CATEGORY_VALUES } from '../shared/schemas';
import { loadConfig, validateConfig } from './config';
import { isConnectorInstalled } from './tiktok/liveAdapter';
import { tiktokOptions, tiktokSetup } from './tiktok/setup';
import { initializePersistence } from './persistence/db';
import { createGameServer } from './server';
import { createLogger, parseLogLevel } from './util/logger';

const SESSION_PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000;

function emptyCounts(): QuestionBankValidation['report']['counts'] {
  return Object.fromEntries(
    CATEGORY_VALUES.map((category) => [category, 0]),
  ) as QuestionBankValidation['report']['counts'];
}

async function loadBank(path: string): Promise<QuestionBankValidation> {
  try {
    return await loadQuestionBank(path);
  } catch (error) {
    return {
      success: false,
      bank: null,
      report: {
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
        counts: emptyCounts(),
        total: 0,
        shortArticles: 0,
        translations: emptyTranslationStats(),
      },
    };
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  const problems = validateConfig(config);
  if (problems.length > 0) {
    throw new Error(`Invalid configuration:\n- ${problems.join('\n- ')}`);
  }
  if (config.tiktokEnabled && config.tiktokAdapter === 'fake') {
    console.warn(
      'TIKTOK_ADAPTER=fake: TikTok rooms use a simulated chat (demo / tests), not a real live.',
    );
  }
  if (config.tiktokEnabled && config.tiktokAdapter === 'live' && !(await isConnectorInstalled())) {
    const message =
      'TIKTOK_ENABLED=true but the optional package tiktok-live-connector is not installed ' +
      '(build the Docker image with WITH_TIKTOK=true, or `pnpm install` with optional dependencies).';
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Invalid configuration:\n- ${message}`);
    }
    console.warn(`${message} TikTok rooms stay in manual mode.`);
  }
  const bank = await loadBank('data/questions.json');
  const questions = bank.bank?.questions ?? [];
  const initialized = initializePersistence({
    databasePath: config.databasePath,
    questions,
  });

  if (initialized.degradedReason) {
    console.warn(`Persistence disabled: ${initialized.degradedReason}`);
  }
  if (initialized.questionsError) {
    console.error(`Question import failed: ${initialized.questionsError}`);
  }
  if (initialized.abandonedMatches > 0) {
    console.info(`Abandoned ${initialized.abandonedMatches} in-progress match(es) at startup.`);
  }

  const game = createGameServer({
    persistence: initialized.persistence,
    questionList: questions,
    questions: bank.success ? 'ok' : 'degraded',
    questionsUsable: questions.length > 0 && initialized.questionsError === null,
    adminToken: config.adminToken,
    staticDir: config.staticDir,
    publicOrigin: config.publicOrigin,
    trustProxy: config.trustProxy,
    rateLimit: config.rateLimit,
    imageCacheDir: config.imageCacheDir,
    imageCacheMaxBytes: config.imageCacheMaxBytes,
    logger: createLogger(parseLogLevel(config.logLevel)),
    allowedOrigin: config.publicOrigin,
    ...tiktokOptions(tiktokSetup(config)),
  });
  game.httpServer.listen(config.port, () => {
    console.info(`Encycla server listening on http://localhost:${config.port}`);
  });
  const purgeTimer = setInterval(() => {
    initialized.persistence.sessions.deleteExpired(Date.now());
  }, SESSION_PURGE_INTERVAL_MS);
  purgeTimer.unref();

  function shutdown(signal: string): void {
    console.info(`${signal} received, shutting down.`);
    clearInterval(purgeTimer);
    void game
      .close()
      .catch((error: unknown) => {
        console.error(error);
        process.exitCode = 1;
      })
      .finally(() => initialized.persistence.close());
  }

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
