import { create } from 'zustand';
import type { GameMode } from '../../shared/types';
import { safeStorage } from '../lib/storage';

const AUDIO_KEY = 'encycla.audio.v1';

export type Screen = 'home' | 'leaderboard';

interface UiState {
  screen: Screen;
  muted: boolean;
  leaveModalOpen: boolean;
  prefilledCode: string;
  leaderboardMode: GameMode | undefined;
  setScreen(screen: Screen): void;
  toggleMuted(): void;
  setLeaveModal(open: boolean): void;
  setPrefilledCode(code: string): void;
}

function initialMuted(): boolean {
  return safeStorage.get(AUDIO_KEY) === 'muted';
}

export const useUiStore = create<UiState>((set, get) => ({
  screen: 'home',
  muted: initialMuted(),
  leaveModalOpen: false,
  prefilledCode: '',
  leaderboardMode: undefined,
  setScreen: (screen) => set({ screen }),
  toggleMuted() {
    const muted = !get().muted;
    safeStorage.set(AUDIO_KEY, muted ? 'muted' : 'on');
    set({ muted });
  },
  setLeaveModal: (leaveModalOpen) => set({ leaveModalOpen }),
  setPrefilledCode: (prefilledCode) => set({ prefilledCode }),
}));
