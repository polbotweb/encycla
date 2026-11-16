import { randomUUID } from 'node:crypto';
import type { Difficulty, GameMode } from '../../shared/types';
import type { PlayerIdentity } from '../game/events';
import { AppError } from '../http/errors';
import type { RoomManager } from '../rooms/RoomManager';
import type { Logger } from '../util/logger';
import { silentLogger } from '../util/logger';

export const SMALL_ROOM_AFTER_MS = 120_000;
export const SMALL_ROOM_VOTE_MS = 15_000;

export interface QueueSelection {
  mode: GameMode;
  category: string | null;
  difficulty: Difficulty | null;
}

export interface QueueStatePayload {
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

export interface SmallRoomProposalPayload {
  proposalId: string;
  playerCount: number;
  expiresAt: number;
  serverNow: number;
}

/** Outbound port, implemented by the socket gateway. */
export interface QueueEmitter {
  queueState(playerId: string, state: QueueStatePayload): void;
  matchFound(playerId: string, roomCode: string): void;
  smallRoomProposal(playerId: string, proposal: SmallRoomProposalPayload): void;
}

export interface QueueManagerOptions {
  manager: RoomManager;
  emitter: QueueEmitter;
  isConnected: (playerId: string) => boolean;
  identityOf: (playerId: string) => PlayerIdentity | null;
  now?: () => number;
  logger?: Logger;
}

interface Entry {
  identity: PlayerIdentity;
  key: string;
  selection: QueueSelection;
  queuedAt: number;
  /** Small-room timer origin; reset to now whenever a vote fails. */
  waitingSince: number;
}

interface Proposal {
  id: string;
  key: string;
  voters: string[];
  votes: Map<string, boolean>;
  expiresAt: number;
}

export function queueKey(selection: QueueSelection): string {
  return `${selection.mode}|${selection.difficulty ?? ''}|${selection.category ?? ''}`;
}

export function targetFor(mode: GameMode): number {
  return mode === 'CONTEST' ? 2 : 4;
}

export class QueueManager {
  private readonly entries = new Map<string, Entry>();
  private readonly proposals = new Map<string, Proposal>();
  private readonly now: () => number;
  private readonly logger: Logger;
  private sweeper: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly options: QueueManagerOptions) {
    this.now = options.now ?? Date.now;
    this.logger = options.logger ?? silentLogger;
  }

  start(): void {
    if (this.sweeper === null) {
      this.sweeper = setInterval(() => this.sweep(), 1000);
      this.sweeper.unref();
    }
  }

  stop(): void {
    if (this.sweeper !== null) {
      clearInterval(this.sweeper);
      this.sweeper = null;
    }
    this.entries.clear();
    this.proposals.clear();
  }

  size(key?: string): number {
    return key === undefined ? this.entries.size : this.queueFor(key).length;
  }

  snapshot(playerId: string): QueueStatePayload | null {
    return this.stateFor(playerId);
  }

  isQueued(playerId: string): boolean {
    return this.entries.has(playerId);
  }

  join(identity: PlayerIdentity, selection: QueueSelection): QueueStatePayload {
    if (this.entries.has(identity.id)) {
      throw new AppError('QUEUE_ALREADY_JOINED', 'You are already in the queue.');
    }
    if (this.options.manager.isInRoom(identity.id)) {
      throw new AppError('ALREADY_IN_ROOM', 'You are already in a room.');
    }
    if (!this.options.isConnected(identity.id)) {
      throw new AppError('NOT_CONNECTED', 'Open the game socket before joining the queue.');
    }
    const now = this.now();
    const key = queueKey(selection);
    this.entries.set(identity.id, {
      identity,
      key,
      selection,
      queuedAt: now,
      waitingSince: now,
    });
    this.logger.log('info', 'queue.joined', { key, size: this.queueFor(key).length });
    this.afterChange(key);
    // The entry may already have been consumed by an immediate match.
    return (
      this.stateFor(identity.id) ?? {
        position: 0,
        targetPlayers: targetFor(selection.mode),
        queuedAt: now,
        proposal: null,
      }
    );
  }

  /** Idempotent. */
  leave(playerId: string): void {
    const entry = this.entries.get(playerId);
    if (!entry) {
      return;
    }
    this.entries.delete(playerId);
    this.cancelProposalIfBroken(entry.key);
    this.afterChange(entry.key);
  }

  /** Players of a cancelled public room go back to the front of their queue. */
  requeue(playerIds: string[], selection: QueueSelection): void {
    const now = this.now();
    const key = queueKey(selection);
    for (const id of playerIds) {
      const identity = this.options.identityOf(id);
      if (!identity || this.entries.has(id) || !this.options.isConnected(id)) {
        continue;
      }
      this.entries.set(id, { identity, key, selection, queuedAt: now, waitingSince: now });
    }
    this.afterChange(key);
  }

  vote(playerId: string, proposalId: string, accept: boolean): void {
    const proposal = [...this.proposals.values()].find((candidate) => candidate.id === proposalId);
    if (!proposal || !proposal.voters.includes(playerId)) {
      throw new AppError('PROPOSAL_NOT_FOUND', 'Proposal not found.');
    }
    if (this.now() >= proposal.expiresAt) {
      throw new AppError('PROPOSAL_EXPIRED', 'The vote is over.');
    }
    proposal.votes.set(playerId, accept);
    if (proposal.votes.size >= proposal.voters.length) {
      this.resolveProposal(proposal);
    }
  }

  /** Time-driven transitions: expire votes, open small-room proposals. */
  sweep(): void {
    const now = this.now();
    for (const proposal of [...this.proposals.values()]) {
      if (now >= proposal.expiresAt) {
        this.resolveProposal(proposal);
      }
    }
    for (const key of this.activeKeys()) {
      if (this.proposals.has(key)) {
        continue;
      }
      const queue = this.queueFor(key);
      const first = queue[0];
      if (!first) {
        continue;
      }
      const target = targetFor(first.selection.mode);
      const oldestWait = Math.min(...queue.map((entry) => entry.waitingSince));
      if (queue.length >= 2 && queue.length < target && now - oldestWait >= SMALL_ROOM_AFTER_MS) {
        this.openProposal(key, queue);
      }
    }
  }

  // ---- internals -----------------------------------------------------------

  private activeKeys(): string[] {
    return [...new Set([...this.entries.values()].map((entry) => entry.key))];
  }

  private queueFor(key: string): Entry[] {
    return [...this.entries.values()]
      .filter((entry) => entry.key === key)
      .sort((a, b) => a.queuedAt - b.queuedAt || a.identity.id.localeCompare(b.identity.id));
  }

  private afterChange(key: string): void {
    this.dropDisconnected(key);
    const queue = this.queueFor(key);
    const first = queue[0];
    if (first) {
      const target = targetFor(first.selection.mode);
      if (queue.length >= target) {
        this.proposals.delete(key);
        this.launch(first.selection, queue.slice(0, target));
      }
    }
    this.broadcastState(key);
  }

  private dropDisconnected(key: string): void {
    for (const entry of this.queueFor(key)) {
      if (!this.options.isConnected(entry.identity.id)) {
        this.entries.delete(entry.identity.id);
      }
    }
  }

  private launch(selection: QueueSelection, group: Entry[]): void {
    for (const entry of group) {
      this.entries.delete(entry.identity.id);
    }
    try {
      const state = this.options.manager.createPublicRoom(
        selection,
        group.map((entry) => entry.identity),
      );
      for (const entry of group) {
        this.options.emitter.matchFound(entry.identity.id, state.roomCode);
      }
      this.logger.log('info', 'queue.match_found', {
        roomCode: state.roomCode,
        players: group.length,
      });
    } catch (error) {
      this.logger.log('error', 'queue.launch_failed', {
        message: error instanceof Error ? error.message : String(error),
      });
      const now = this.now();
      for (const entry of group) {
        if (
          this.options.isConnected(entry.identity.id) &&
          !this.options.manager.isInRoom(entry.identity.id)
        ) {
          this.entries.set(entry.identity.id, { ...entry, waitingSince: now });
        }
      }
    }
  }

  private openProposal(key: string, queue: Entry[]): void {
    const now = this.now();
    const proposal: Proposal = {
      id: randomUUID(),
      key,
      voters: queue.map((entry) => entry.identity.id),
      votes: new Map(),
      expiresAt: now + SMALL_ROOM_VOTE_MS,
    };
    this.proposals.set(key, proposal);
    for (const playerId of proposal.voters) {
      this.options.emitter.smallRoomProposal(playerId, {
        proposalId: proposal.id,
        playerCount: proposal.voters.length,
        expiresAt: proposal.expiresAt,
        serverNow: now,
      });
    }
    this.broadcastState(key);
  }

  private resolveProposal(proposal: Proposal): void {
    if (this.proposals.get(proposal.key) !== proposal) {
      return;
    }
    this.proposals.delete(proposal.key);
    const total = proposal.voters.length;
    const accepted = proposal.voters.filter(
      (id) => proposal.votes.get(id) === true && this.entries.has(id),
    );
    // Strict majority of the voters present at proposal time; silence counts as a refusal.
    const approved = accepted.length * 2 > total && accepted.length >= 2;
    const queue = this.queueFor(proposal.key);
    const first = queue[0];

    if (approved && first) {
      const group = queue.filter((entry) => accepted.includes(entry.identity.id));
      this.launch(first.selection, group);
    } else {
      const now = this.now();
      for (const entry of queue) {
        entry.waitingSince = now;
      }
    }
    this.broadcastState(proposal.key);
  }

  private cancelProposalIfBroken(key: string): void {
    const proposal = this.proposals.get(key);
    if (!proposal) {
      return;
    }
    const remaining = proposal.voters.filter((id) => this.entries.has(id));
    if (remaining.length < 2) {
      this.proposals.delete(key);
      const now = this.now();
      for (const entry of this.queueFor(key)) {
        entry.waitingSince = now;
      }
    }
  }

  private stateFor(playerId: string): QueueStatePayload | null {
    const entry = this.entries.get(playerId);
    if (!entry) {
      return null;
    }
    const queue = this.queueFor(entry.key);
    const proposal = this.proposals.get(entry.key);
    return {
      position: queue.findIndex((candidate) => candidate.identity.id === playerId) + 1,
      targetPlayers: targetFor(entry.selection.mode),
      queuedAt: entry.queuedAt,
      proposal:
        proposal && proposal.voters.includes(playerId)
          ? {
              proposalId: proposal.id,
              playerCount: proposal.voters.length,
              expiresAt: proposal.expiresAt,
              serverNow: this.now(),
            }
          : null,
    };
  }

  private broadcastState(key: string): void {
    for (const entry of this.queueFor(key)) {
      const state = this.stateFor(entry.identity.id);
      if (state) {
        this.options.emitter.queueState(entry.identity.id, state);
      }
    }
  }
}
