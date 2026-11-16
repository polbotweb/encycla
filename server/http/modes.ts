import { z } from 'zod';
import {
  CATEGORY_VALUES,
  MIN_QUESTIONS_PER_CATEGORY,
  type QuestionRecord,
} from '../../shared/schemas';
import type { Difficulty, GameMode } from '../../shared/types';
import { AppError } from './errors';

export { MIN_QUESTIONS_PER_CATEGORY };

const modeSchema = z.enum(['CLASSIC', 'SUBJECT', 'CONTEST']);
const difficultySchema = z.enum(['Novice', 'Adventurer', 'Wizard']);

const selectionSchema = z
  .object({
    mode: modeSchema,
    category: z.enum(CATEGORY_VALUES).nullable().optional(),
    difficulty: difficultySchema.nullable().optional(),
  })
  .strict();

export const createRoomSchema = selectionSchema.extend({
  maxPlayers: z.number().int().min(2).max(8).optional(),
});

export const tiktokRoomSchema = selectionSchema.extend({
  timerMs: z.number().int().min(10_000).max(30_000).optional(),
});

export interface ModeSelection {
  mode: GameMode;
  category: string | null;
  difficulty: Difficulty | null;
}

export function categoryCounts(questions: readonly QuestionRecord[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const question of questions) {
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
  },
  questions: readonly QuestionRecord[],
  rules: { allowContest: boolean },
): ModeSelection {
  const category = input.category ?? null;
  const difficulty = input.difficulty ?? null;

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
    const count = categoryCounts(questions).get(category) ?? 0;
    if (count < MIN_QUESTIONS_PER_CATEGORY) {
      throw new AppError(
        'CATEGORY_INSUFFICIENT_QUESTIONS',
        `Category ${category} needs at least ${MIN_QUESTIONS_PER_CATEGORY} questions.`,
        { category, questionCount: count },
      );
    }
  }
  return { mode: input.mode, category, difficulty };
}
