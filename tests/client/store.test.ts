import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from '../../client/store/gameStore';
import type { PublicRoomState } from '../../shared/types';

function snapshot(version: number, overrides: Partial<PublicRoomState> = {}): PublicRoomState {
  return {
    stateVersion: version,
    serverNow: 10_000,
    roomCode: 'ABCDEF',
    phase: 'LOBBY',
    question: null,
    reveal: null,
    players: [],
    ...overrides,
  } as unknown as PublicRoomState;
}

describe('gameStore', () => {
  beforeEach(() => useGameStore.getState().reset());

  it('ignores stale snapshots of the same room', () => {
    const store = useGameStore.getState();
    store.applyRoomState(snapshot(5, { phase: 'COUNTDOWN' }));
    store.applyRoomState(snapshot(4, { phase: 'LOBBY' }));
    expect(useGameStore.getState().room?.phase).toBe('COUNTDOWN');
    store.applyRoomState(snapshot(6, { phase: 'LOBBY' }));
    expect(useGameStore.getState().room?.stateVersion).toBe(6);
  });

  it('accepts a lower version for a different room', () => {
    const store = useGameStore.getState();
    store.applyRoomState(snapshot(9));
    store.applyRoomState(snapshot(1, { roomCode: 'ZZZZZZ' }));
    expect(useGameStore.getState().room?.roomCode).toBe('ZZZZZZ');
  });

  it('computes the clock offset from serverNow', () => {
    useGameStore.getState().applyRoomState(snapshot(1, { serverNow: 5_000 }), 4_000);
    expect(useGameStore.getState().clockOffset).toBe(1_000);
  });

  it('keeps the locked choice only for the current question', () => {
    const store = useGameStore.getState();
    store.applyRoomState(
      snapshot(1, { phase: 'QUESTION', question: { id: 'q1' } as PublicRoomState['question'] }),
    );
    store.lockChoice('q1', 2);
    store.applyRoomState(
      snapshot(2, { phase: 'QUESTION', question: { id: 'q1' } as PublicRoomState['question'] }),
    );
    expect(useGameStore.getState().lockedChoice).toEqual({ questionId: 'q1', index: 2 });
    store.applyRoomState(
      snapshot(3, { phase: 'QUESTION', question: { id: 'q2' } as PublicRoomState['question'] }),
    );
    expect(useGameStore.getState().lockedChoice).toBeNull();
  });

  it('clears the queue when a room snapshot arrives', () => {
    const store = useGameStore.getState();
    store.setQueue({ position: 1, targetPlayers: 4, queuedAt: 0, proposal: null });
    store.applyRoomState(snapshot(1));
    expect(useGameStore.getState().queue).toBeNull();
  });
});
