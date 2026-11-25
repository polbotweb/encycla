import 'dotenv/config';
import {
  emptyTranslationStats,
  loadQuestionBank,
  type QuestionBankValidation,
} from '../shared/question-bank';
import { CATEGORY_VALUES } from '../shared/schemas';
import { VERSION, loadConfig, validateConfig } from './config';
import { isConnectorInstalled } from './tiktok/liveAdapter';
import { tiktokOptions, tiktokSetup } from './tiktok/setup';
import { initializePersistence } from './persistence/db';
import { startBackupScheduler } from './persistence/backup';
import { createGameServer } from './server';
import { loadImageTokenSecret } from './images/secret';
import { dirname } from 'node:path';
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
  const logger = createLogger(parseLogLevel(config.logLevel));
  if (config.tiktokEnabled && config.tiktokAdapter === 'fake') {
    logger.log('warn', 'tiktok.simulated', {
      message:
        'TIKTOK_ADAPTER=fake: TikTok rooms use a simulated chat (demo / tests), not a real live.',
    });
  }
  if (config.tiktokEnabled && config.tiktokAdapter === 'live' && !(await isConnectorInstalled())) {
    const message =
      'TIKTOK_ENABLED=true but the optional package tiktok-live-connector is not installed ' +
      '(build the Docker image with WITH_TIKTOK=true, or `pnpm install` with optional dependencies).';
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Invalid configuration:\n- ${message}`);
    }
    logger.log('warn', 'tiktok.connector_missing', {
      message: `${message} TikTok rooms stay in manual mode.`,
    });
  }
  const bank = await loadBank('data/questions.json');
  const questions = bank.bank?.questions ?? [];
  const initialized = initializePersistence({
    databasePath: config.databasePath,
    questions,
  });

  if (initialized.degradedReason) {
    logger.log('warn', 'db.disabled', { reason: initialized.degradedReason });
  }
  if (initialized.questionsError) {
    logger.log('error', 'questions.import_failed', { reason: initialized.questionsError });
  }
  if (initialized.abandonedMatches > 0) {
    logger.log('info', 'matches.abandoned', { count: initialized.abandonedMatches });
  }

  const imageSecret = loadImageTokenSecret(
    config.imageTokenSecret,
    config.databasePath === ':memory:' ? null : dirname(config.databasePath),
  );
  if (imageSecret.source === 'generated') {
    logger.log('info', 'images.key_generated', {
      path: imageSecret.path,
      message: 'Keep this file with the database.',
    });
  } else if (imageSecret.source === 'ephemeral') {
    logger.log('warn', 'images.key_ephemeral', {
      message: 'Image links will not survive a restart.',
    });
  }

  const game = createGameServer({
    imageTokenSecret: imageSecret.secret,
    restoreRooms: true,
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
    logger,
    allowedOrigin: config.publicOrigin,
    ...tiktokOptions(tiktokSetup(config)),
  });
  game.httpServer.listen(config.port, () => {
    logger.log('info', 'server.listening', {
      url: `http://localhost:${config.port}`,
      version: VERSION,
      questions: questions.length,
      tiktok: config.tiktokEnabled ? config.tiktokAdapter : 'off',
    });
  });
  const purgeTimer = setInterval(() => {
    initialized.persistence.sessions.deleteExpired(Date.now());
  }, SESSION_PURGE_INTERVAL_MS);
  purgeTimer.unref();

  // Online backups of the live database (D-119), rotated in BACKUP_DIR.
  const backups =
    initialized.database &&
    config.databasePath !== ':memory:' &&
    config.backupDir &&
    config.backupIntervalMs > 0
      ? startBackupScheduler({
          db: initialized.database,
          dir: config.backupDir,
          keep: config.backupKeep,
          intervalMs: config.backupIntervalMs,
          onResult: (result) =>
            logger.log('info', 'db.backup_written', {
              path: result.path,
              bytes: result.bytes,
              rotated: result.rotated.length,
            }),
          onError: (error) =>
            logger.log('error', 'db.backup_failed', {
              message: error instanceof Error ? error.message : String(error),
            }),
        })
      : null;
  if (backups) {
    logger.log('info', 'db.backups_scheduled', {
      everyHours: config.backupIntervalMs / 3_600_000,
      dir: config.backupDir,
      keep: config.backupKeep,
    });
  }

  function shutdown(signal: string): void {
    logger.log('info', 'server.shutdown', { signal });
    clearInterval(purgeTimer);
    backups?.stop();
    void game
      .close({ preserveRooms: true })
      .catch((error: unknown) => {
        logger.log('error', 'server.shutdown_failed', {
          message: error instanceof Error ? error.message : String(error),
        });
        process.exitCode = 1;
      })
      .finally(() => initialized.persistence.close());
  }

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(
    `${JSON.stringify({ t: new Date().toISOString(), level: 'error', event: 'server.start_failed', message })}\n`,
  );
  process.exitCode = 1;
});
