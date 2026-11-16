import { z } from 'zod';

export const roomJoinPayload = z.object({ code: z.string().min(1).max(16) }).strict();
export const emptyPayload = z.object({}).strict().optional().default({});
export const lobbyReadyPayload = z.object({ ready: z.boolean() }).strict();
export const answerPayload = z
  .object({ questionId: z.string().min(1).max(120), choiceIndex: z.number() })
  .strict();
export const continuePayload = z.object({ phaseToken: z.string().min(1).max(128) }).strict();
export const manualAnswerPayload = z
  .object({ playerId: z.string().min(1).max(128), choiceIndex: z.number() })
  .strict();
export const smallRoomVotePayload = z
  .object({ proposalId: z.string().min(1).max(64), accept: z.boolean() })
  .strict();

export const handshakeAuth = z.object({
  role: z.enum(['player', 'overlay', 'control']).optional(),
  token: z.string().min(1).max(256).optional(),
  roomCode: z.string().min(1).max(16).optional(),
});
