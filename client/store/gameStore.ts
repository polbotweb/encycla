import { create } from 'zustand';
import type { ApiError, TimerSync } from '../../shared/protocol';
import type { PublicRoomState } from '../../shared/types';
import { announcementFor } from '../lib/announce';

export type ConnectionStatus = 'offline' | 'connecting' | 'connected' | 'reconnecting';

export interface QueueView {
  position: number;
  targetPlayers: number;
  queuedAt: number;
  proposal: {
    proposalId: string;
    playerCount: number;
    expiresAt: number;
    serverNow: number;
  } | null;
}

export interface ProposalView {
  proposalId: string;
  playerCount: number;
  expiresAt: number;
  voted: boolean;
}

interface GameStoreState {
  connection: ConnectionStatus;
  playerId: string | null;
  room: PublicRoomState | null;
  /** serverNow - Date.now(), refreshed on every snapshot and timer sync. */
  clockOffset: number;
  queue: QueueView | null;
  proposal: ProposalView | null;
  closedReason: string | null;
  replaced: boolean;
  protocolMismatch: boolean;
  sessionInvalid: boolean;
  lastError: ApiError | null;
  /** Local-only: the option this player locked for the current question (never a correctness hint). */
  lockedChoice: { questionId: string; index: number } | null;
  announcement: string;
  timer: TimerSync | null;
  setConnection(status: ConnectionStatus): void;
  setPlayer(playerId: string | null): void;
  applyRoomState(state: PublicRoomState, receivedAt?: number): void;
  applyTimerSync(sync: TimerSync, receivedAt?: number): void;
  setQueue(queue: QueueView | null): void;
  setProposal(proposal: ProposalView | null): void;
  markVoted(): void;
  setClosed(reason: string | null): void;
  setReplaced(): void;
  setProtocolMismatch(): void;
  setSessionInvalid(): void;
  setError(error: ApiError | null): void;
  /** Sets the polite screen-reader announcement (timer marks). */
  announce(message: string): void;
  lockChoice(questionId: string, index: number): void;
  leaveRoomLocal(): void;
  reset(): void;
}

const initial = {
  connection: 'offline' as ConnectionStatus,
  playerId: null,
  room: null,
  clockOffset: 0,
  queue: null,
  proposal: null,
  closedReason: null,
  replaced: false,
  protocolMismatch: false,
  sessionInvalid: false,
  lastError: null,
  lockedChoice: null,
  announcement: '',
  timer: null,
};

export const useGameStore = create<GameStoreState>((set, get) => ({
  ...initial,
  setConnection: (connection) => set({ connection }),
  setPlayer: (playerId) => set({ playerId }),
  applyRoomState(state, receivedAt = Date.now()) {
    const current = get();
    const previous = current.room;
    // Ignore stale snapshots of the same room (PROTOCOL 1.6).
    if (
      previous &&
      previous.roomCode === state.roomCode &&
      state.stateVersion <= previous.stateVersion
    ) {
      return;
    }
    // The locked choice only matters for the question currently shown or revealed.
    const currentQuestionId = state.question?.id ?? state.reveal?.questionId ?? null;
    const lockedChoice =
      current.lockedChoice && current.lockedChoice.questionId === currentQuestionId
        ? current.lockedChoice
        : null;
    const announcement = announcementFor(
      previous?.roomCode === state.roomCode ? previous : null,
      state,
      current.playerId,
    );
    set({
      room: state,
      clockOffset: state.serverNow - receivedAt,
      lockedChoice,
      closedReason:
        state.phase === 'CLOSED'
          ? (current.closedReason ?? 'MATCH_CANCELLED')
          : current.closedReason,
      queue: null,
      proposal: null,
      announcement: announcement ?? current.announcement,
    });
  },
  applyTimerSync(sync, receivedAt = Date.now()) {
    set({ timer: sync, clockOffset: sync.serverNow - receivedAt });
  },
  setQueue: (queue) =>
    set((state) => ({
      queue,
      proposal: queue?.proposal
        ? {
            proposalId: queue.proposal.proposalId,
            playerCount: queue.proposal.playerCount,
            expiresAt: queue.proposal.expiresAt,
            voted: state.proposal?.proposalId === queue.proposal.proposalId && state.proposal.voted,
          }
        : null,
    })),
  setProposal: (proposal) => set({ proposal }),
  markVoted: () =>
    set((state) => (state.proposal ? { proposal: { ...state.proposal, voted: true } } : {})),
  setClosed: (closedReason) => set({ closedReason }),
  setReplaced: () => set({ replaced: true }),
  setProtocolMismatch: () => set({ protocolMismatch: true }),
  setSessionInvalid: () => set({ sessionInvalid: true }),
  setError: (lastError) => set({ lastError }),
  announce: (announcement) => set({ announcement }),
  lockChoice: (questionId, index) => set({ lockedChoice: { questionId, index } }),
  leaveRoomLocal: () =>
    set({
      room: null,
      closedReason: null,
      lockedChoice: null,
      queue: null,
      proposal: null,
      timer: null,
    }),
  reset: () => set({ ...initial }),
}));
