import { z } from 'zod';
import {
  CATEGORY_VALUES,
  MIN_QUESTIONS_PER_CATEGORY,
  type QuestionRecord,
} from '../../shared/schemas';
import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from '../../shared/languages';
import type { Difficulty, GameMode } from '../../shared/types';
import { offeredIn } from '../game/questions';
import { AppError } from './errors';

export { MIN_QUESTIONS_PER_CATEGORY };

const modeSchema = z.enum(['CLASSIC', 'SUBJECT', 'CONTEST']);
const difficultySchema = z.enum(['Novice', 'Adventurer', 'Wizard']);
export const languageSchema = z.enum(LANGUAGES);

const selectionSchema = z
  .object({
    mode: modeSchema,
    category: z.enum(CATEGORY_VALUES).nullable().optional(),
    difficulty: difficultySchema.nullable().optional(),
    /** Language of the questions of the room (French by default). */
    language: languageSchema.optional(),
  })
  .strict();

export const createRoomSchema = selectionSchema.extend({
  maxPlayers: z.number().int().min(2).max(8).optional(),
});

export const tiktokRoomSchema = selectionSchema.extend({
  timerMs: z.number().int().min(10_000).max(30_000).optional(),
  /** Any live: the TikTok handle whose chat feeds this room (defaults to `TIKTOK_USERNAME`). */
  liveUsername: z
    .string()
    .trim()
    .regex(/^@?[A-Za-z0-9._]{2,24}$/)
    .transform((value) => value.replace(/^@/, '').toLowerCase())
    .optional(),
});

/** One simulated chat comment (`TIKTOK_ADAPTER=fake` only). */
export const tiktokChatSchema = z
  .object({
    uniqueId: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9._]{2,24}$/),
    nickname: z.string().trim().min(1).max(40).optional(),
    comment: z.string().trim().min(1).max(200),
  })
  .strict();

export interface ModeSelection {
  mode: GameMode;
  category: string | null;
  difficulty: Difficulty | null;
  language: Language;
}

/** Questions per category, among those playable in `language` (all of them in French). */
export function categoryCounts(
  questions: readonly QuestionRecord[],
  language: Language = DEFAULT_LANGUAGE,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const question of offeredIn(questions, language)) {
    counts.set(question.category, (counts.get(question.category) ?? 0) + 1);
  }
  return counts;
}

export function parseBody<S extends z.ZodType>(schema: S, body: unknown): z.infer<S> {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', 'The request body is invalid.', {
      issues: parsed.error.issues.map((issue) => issue.path.join('.') || '(root)'),
    });
  }
  return parsed.data;
}

/** Applies the per-mode contract of PROTOCOL 3.4 – 3.6. */
export function resolveSelection(
  input: {
    mode: GameMode;
    category?: string | null | undefined;
    difficulty?: Difficulty | null | undefined;
    language?: Language | undefined;
  },
  questions: readonly QuestionRecord[],
  rules: { allowContest: boolean },
): ModeSelection {
  const category = input.category ?? null;
  const difficulty = input.difficulty ?? null;
  const language = input.language ?? DEFAULT_LANGUAGE;

  if (input.mode === 'CONTEST') {
    if (!rules.allowContest) {
      throw new AppError('VALIDATION_ERROR', 'CONTEST is not available here.');
    }
    if (category !== null || difficulty !== null) {
      throw new AppError('VALIDATION_ERROR', 'CONTEST does not accept a category or difficulty.');
    }
  } else if (input.mode === 'CLASSIC') {
    if (category !== null || difficulty !== null) {
      throw new AppError('VALIDATION_ERROR', 'CLASSIC does not accept a category or difficulty.');
    }
  } else {
    if (category === null || difficulty === null) {
      throw new AppError('VALIDATION_ERROR', 'SUBJECT requires a category and a difficulty.');
    }
    const count = categoryCounts(questions, language).get(category) ?? 0;
    if (count < MIN_QUESTIONS_PER_CATEGORY) {
      throw new AppError(
        'CATEGORY_INSUFFICIENT_QUESTIONS',
        `Category ${category} needs at least ${MIN_QUESTIONS_PER_CATEGORY} questions in ${language}.`,
        { category, questionCount: count, language },
      );
    }
  }
  return { mode: input.mode, category, difficulty, language };
}
