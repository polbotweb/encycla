import type { PublicPlayer, PublicRoomState, RoomPhase } from '../../shared/types';
import { useGameStore } from '../store/gameStore';

export interface MeView {
  playerId: string | null;
  room: PublicRoomState | null;
  me: PublicPlayer | null;
  /** Phase to render: while paused, the phase we paused from. */
  phase: RoomPhase | null;
  paused: boolean;
  isHost: boolean;
  canPause: boolean;
  canSkip: boolean;
}

export function deriveMe(room: PublicRoomState | null, playerId: string | null): MeView {
  const me = room?.players.find((player) => player.id === playerId) ?? null;
  const paused = room?.phase === 'PAUSED';
  const phase = room ? (paused ? room.pausedFrom : room.phase) : null;
  const isHost = Boolean(room && playerId && room.hostId === playerId);
  const privateWeb = Boolean(room && !room.isPublic && !room.isTikTok);
  const canPause = privateWeb && (room?.isSolo === true || isHost);
  const canSkip =
    privateWeb && !room?.isSolo && isHost && (phase === 'ARTICLE' || phase === 'LEVEL_COMPLETE');
  return { playerId, room, me, phase, paused, isHost, canPause, canSkip };
}

export function useMe(): MeView {
  const room = useGameStore((state) => state.room);
  const playerId = useGameStore((state) => state.playerId);
  return deriveMe(room, playerId);
}
