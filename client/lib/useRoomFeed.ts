import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { GAME_NAMESPACE, type Ack, type ErrorCode } from '../../shared/protocol';
import type { PublicRoomState } from '../../shared/types';
import { ApiClientError } from './api';

export type FeedStatus = 'connecting' | 'live' | 'reconnecting' | 'unavailable' | 'ended';

export interface RoomFeed {
  room: PublicRoomState | null;
  status: FeedStatus;
  clockOffset: number;
  capabilities: string[];
  emit<T = unknown>(event: string, payload?: unknown): Promise<T>;
}

/** Socket feed for the overlay (read-only) and the control console. Token comes from the URL fragment. */
export function useRoomFeed(role: 'overlay' | 'control', roomCode: string, token: string): RoomFeed {
  const [room, setRoom] = useState<PublicRoomState | null>(null);
  const [status, setStatus] = useState<FeedStatus>('connecting');
  const [clockOffset, setClockOffset] = useState(0);
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const versionRef = useRef(0);

  useEffect(() => {
    if (!roomCode || !token) {
      setStatus('unavailable');
      return undefined;
    }
    const socket = io(GAME_NAMESPACE, {
      auth: { role, roomCode, token },
      transports: ['websocket', 'polling'],
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;
    versionRef.current = 0;

    socket.on('connect', () => setStatus('live'));
    socket.on('connect_error', (error: Error & { data?: { code?: ErrorCode } }) => {
      const code = error.data?.code;
      if (code === 'AUTH_INVALID' || code === 'AUTH_REQUIRED' || code === 'FORBIDDEN') {
        setStatus('unavailable');
        socket.disconnect();
      } else if (code === 'ROOM_NOT_FOUND') {
        setStatus('ended');
        socket.disconnect();
      } else {
        setStatus('reconnecting');
      }
    });
    socket.on('disconnect', () => setStatus((current) => (current === 'ended' ? current : 'reconnecting')));
    socket.on('ROOM_STATE', (state: PublicRoomState) => {
      if (state.stateVersion <= versionRef.current) return;
      versionRef.current = state.stateVersion;
      setClockOffset(state.serverNow - Date.now());
      setRoom(state);
    });
    socket.on('CONTROL_READY', (payload: { capabilities: string[] }) => setCapabilities(payload.capabilities));
    socket.on('ROOM_CLOSED', () => {
      setStatus('ended');
      socket.disconnect();
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [role, roomCode, token]);

  const emit = useCallback(<T,>(event: string, payload: unknown = {}): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const socket = socketRef.current;
      if (!socket || !socket.connected) {
        reject(new ApiClientError('NOT_CONNECTED', 'Not connected', 0));
        return;
      }
      socket.timeout(8000).emit(event, payload, (timeoutError: Error | null, ack: Ack<T>) => {
        if (timeoutError) reject(new ApiClientError('INTERNAL_ERROR', 'The server did not answer', 0));
        else if (ack.ok) resolve(ack.data);
        else reject(new ApiClientError(ack.error.code, ack.error.message, 0, ack.error.requestId));
      });
    });
  }, []);

  return { room, status, clockOffset, capabilities, emit };
}
