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

/**
 * How a label is written when it is not a name in the room language (D-108): a scientific name
 * (`lang: "la"`, italic, left-to-right) or the item's original name in `lang`.
 */
export interface LabelForm {
  lang: string;
  scientific?: true;
}

export interface QuestionView {
  /** Opaque round id (never the bank id, which names the answer). */
  id: string;
  questionText: string;
  options: string[];
  /** Same order as `options`; `null` for a name in the room language. Absent when all are. */
  optionForms?: (LabelForm | null)[];
  image: ImageView | null;
}

export interface RevealView {
  questionId: string;
  subject: string;
  /** Form of `subject` when it is not a name in the room language. */
  subjectForm?: LabelForm;
  questionText: string;
  options: string[];
  optionForms?: (LabelForm | null)[];
  correctIndex: number;
  /** Always in the room language (the answer inside it may be a `subjectForm` name). */
  explanation: string;
  articleTitle: string;
  articleBody: string;
  /**
   * Wikipedia language of `articleTitle` and `articleBody`: the room language, or the language of
   * the best other real article when the room language has none (shown with a notice, D-108).
   */
  textLanguage: string;
  /** Permalink of the article revision shown (any language), linked under the article. */
  articleUrl?: string;
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
