import type { Language } from './languages';

export type GameMode = 'CLASSIC' | 'SUBJECT' | 'CONTEST';

export type Difficulty = 'Novice' | 'Adventurer' | 'Wizard';

export type RoomPhase =
  | 'LOBBY'
  | 'COUNTDOWN'
  | 'QUESTION'
  | 'REVEAL'
  | 'ARTICLE'
  | 'LEVEL_COMPLETE'
  | 'MATCH_OVER'
  | 'PAUSED'
  | 'CLOSED';

export type PlayerStatus = 'CONNECTED' | 'DISCONNECTED' | 'ELIMINATED' | 'FORFEITED' | 'LEFT';

export interface ImageView {
  /** Same-origin `/img/<opaque token>` (D-107); never the Commons file URL. */
  url: string;
  alt: string;
  /** Widths the proxy serves through `?w=` (responsive `srcset`); absent: a single size. */
  widths?: number[];
  credit?: string;
  license?: string;
  sourceUrl?: string;
}

export interface QuestionView {
  /** Opaque round id (never the bank id, which names the answer). */
  id: string;
  questionText: string;
  options: string[];
  image: ImageView | null;
}

export interface RevealView {
  questionId: string;
  subject: string;
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  articleTitle: string;
  articleBody: string;
  /**
   * Language of `explanation`, `articleTitle` and `articleBody`. It is the room language, except
   * when the article does not exist in that language and the French text is shown instead.
   */
  textLanguage: Language;
  image: ImageView | null;
}

export interface PlayerResult {
  playerId: string;
  choiceIndex: number | null;
  correct: boolean;
  timedOut: boolean;
  responseTimeMs: number | null;
  pointsAwarded: number;
}

export interface FinalRankingEntry {
  playerId: string;
  rank: number;
  tied: boolean;
}

export interface PublicPlayer {
  id: string;
  pseudo: string;
  displayName: string;
  avatar: string;
  score: number;
  lives: number;
  streak: number;
  /** Longest run of correct answers in this match (SPECIFICATION §7.4). */
  bestStreak: number;
  correctCount: number;
  wrongCount: number;
  timeoutCount: number;
  totalResponseMs: number;
  isReady: boolean;
  status: PlayerStatus;
  isHost: boolean;
  joinedAt: number;
  hasAnsweredQuestionId: string | null;
}

export interface RoomSettings {
  maxPlayers: number;
  timerMs: number;
  lifePolicy: 'persist' | 'refill_on_level';
  articlePolicy: 'manual' | 'auto';
  autoAdvanceMs: number | null;
  isTikTok: boolean;
  isPublic: boolean;
}

export interface PublicRoomState {
  stateVersion: number;
  serverNow: number;
  roomCode: string;
  mode: GameMode;
  difficulty: Difficulty | null;
  category: string | null;
  /** Language of the questions of this room (the UI language of each player is their own). */
  language: Language;
  isPublic: boolean;
  isTikTok: boolean;
  isSolo: boolean;
  tiktokConnected: boolean;
  phase: RoomPhase;
  pausedFrom: RoomPhase | null;
  level: number;
  totalLevels: number;
  questionIndex: number;
  questionsPerLevel: number;
  totalQuestionsAnswered: number;
  phaseStartedAt: number | null;
  phaseEndsAt: number | null;
  pausedAt: number | null;
  remainingMs: number | null;
  phaseToken: string | null;
  hostId: string | null;
  matchId: string | null;
  settings: RoomSettings;
  players: PublicPlayer[];
  question: QuestionView | null;
  reveal: RevealView | null;
  results: PlayerResult[] | null;
  finalRanking: FinalRankingEntry[] | null;
  winnerId: string | null;
}
