import { create } from 'zustand';
import { safeStorage } from '../lib/storage';

const STORAGE_KEY = 'encycla.session.v1';
const PSEUDO_KEY = 'encycla.pseudo.v1';

export interface StoredSession {
  playerId: string;
  pseudo: string;
  token: string;
  expiresAt: number;
}

interface SessionState {
  session: StoredSession | null;
  savedPseudo: string;
  status: 'idle' | 'creating' | 'ready' | 'error';
  errorCode: string | null;
  setSession(session: StoredSession): void;
  setStatus(status: SessionState['status'], errorCode?: string | null): void;
  setPseudo(pseudo: string): void;
  clear(): void;
}

function readStored(): StoredSession | null {
  const raw = safeStorage.get(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (
      typeof parsed.token === 'string' &&
      typeof parsed.playerId === 'string' &&
      typeof parsed.pseudo === 'string' &&
      typeof parsed.expiresAt === 'number' &&
      parsed.expiresAt > Date.now()
    ) {
      return parsed as StoredSession;
    }
  } catch {
    /* fall through */
  }
  safeStorage.remove(STORAGE_KEY);
  return null;
}

export const useSessionStore = create<SessionState>((set) => {
  const stored = readStored();
  return {
    session: stored,
    savedPseudo: stored?.pseudo ?? safeStorage.get(PSEUDO_KEY) ?? '',
    status: stored ? 'ready' : 'idle',
    errorCode: null,
    setSession(session) {
      safeStorage.set(STORAGE_KEY, JSON.stringify(session));
      safeStorage.set(PSEUDO_KEY, session.pseudo);
      set({ session, savedPseudo: session.pseudo, status: 'ready', errorCode: null });
    },
    setStatus(status, errorCode = null) {
      set({ status, errorCode });
    },
    setPseudo(pseudo) {
      safeStorage.set(PSEUDO_KEY, pseudo);
      set({ savedPseudo: pseudo });
    },
    clear() {
      safeStorage.remove(STORAGE_KEY);
      set({ session: null, status: 'idle', errorCode: null });
    },
  };
});
