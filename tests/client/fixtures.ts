import type { PublicPlayer, PublicRoomState, RoomPhase } from '../../shared/types';

export const ME = 'p-me';

export function player(
  id: string,
  name: string,
  overrides: Partial<PublicPlayer> = {},
): PublicPlayer {
  return {
    id,
    pseudo: name,
    displayName: name,
    avatar: '🦊',
    score: 0,
    lives: 3,
    streak: 0,
    bestStreak: 0,
    correctCount: 0,
    wrongCount: 0,
    timeoutCount: 0,
    totalResponseMs: 0,
    isReady: false,
    status: 'CONNECTED',
    isHost: id === ME,
    joinedAt: 0,
    hasAnsweredQuestionId: null,
    ...overrides,
  };
}

export const OPTIONS = ['Carnac', 'Stonehenge', 'Avebury', 'Newgrange'];

export const QUESTION = {
  id: 'q1',
  questionText: 'What is this prehistoric monument?',
  options: OPTIONS,
  image: { url: '/img/AbCdEfGhIjKlMnOpQrStUv', alt: 'Standing stones' },
};

export const REVEAL = {
  questionId: 'q1',
  subject: 'Stonehenge',
  questionText: QUESTION.questionText,
  options: OPTIONS,
  correctIndex: 1,
  explanation: 'A ring of standing stones in Wiltshire.',
  articleTitle: 'Stonehenge',
  articleBody: 'Stonehenge is a prehistoric monument.\n\nIt was built in stages.',
  textLanguage: 'en' as const,
  image: QUESTION.image,
};

export function room(phase: RoomPhase, overrides: Partial<PublicRoomState> = {}): PublicRoomState {
  const now = Date.now();
  return {
    stateVersion: 10,
    serverNow: now,
    roomCode: 'ABCDEF',
    mode: 'CLASSIC',
    difficulty: null,
    category: null,
    language: 'en',
    isPublic: false,
    isTikTok: false,
    isSolo: false,
    tiktokConnected: false,
    phase,
    pausedFrom: null,
    level: 1,
    totalLevels: 10,
    questionIndex: 0,
    questionsPerLevel: 20,
    totalQuestionsAnswered: 0,
    phaseStartedAt: now,
    phaseEndsAt: now + 20_000,
    pausedAt: null,
    remainingMs: null,
    phaseToken: 'token-1',
    hostId: ME,
    matchId: null,
    settings: {
      maxPlayers: 8,
      timerMs: 20_000,
      lifePolicy: 'persist',
      articlePolicy: 'manual',
      autoAdvanceMs: null,
      isTikTok: false,
      isPublic: false,
    },
    players: [player(ME, 'Alice'), player('p-2', 'Bob', { score: 300 })],
    question: null,
    reveal: null,
    results: null,
    finalRanking: null,
    winnerId: null,
    ...overrides,
  };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
