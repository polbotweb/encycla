import { useUiStore } from '../store/uiStore';

/**
 * Original synthesized cues (WebAudio): no licensed files to ship, silent when muted,
 * and never played before the first user interaction (autoplay policy).
 */
export type Cue = 'lobby-join' | 'countdown-tick' | 'correct' | 'wrong' | 'level-up';

interface Tone {
  freq: number;
  start: number;
  duration: number;
  gain: number;
  type?: OscillatorType;
}

const CUES: Record<Cue, Tone[]> = {
  'lobby-join': [{ freq: 660, start: 0, duration: 0.12, gain: 0.05 }],
  'countdown-tick': [{ freq: 440, start: 0, duration: 0.08, gain: 0.04, type: 'square' }],
  correct: [
    { freq: 523, start: 0, duration: 0.12, gain: 0.08 },
    { freq: 784, start: 0.12, duration: 0.2, gain: 0.08 },
  ],
  wrong: [
    { freq: 220, start: 0, duration: 0.18, gain: 0.08, type: 'sawtooth' },
    { freq: 165, start: 0.18, duration: 0.25, gain: 0.08, type: 'sawtooth' },
  ],
  'level-up': [
    { freq: 523, start: 0, duration: 0.1, gain: 0.06 },
    { freq: 659, start: 0.1, duration: 0.1, gain: 0.06 },
    { freq: 784, start: 0.2, duration: 0.2, gain: 0.06 },
  ],
};

let context: AudioContext | null = null;
let unlocked = false;

export function unlockAudio(): void {
  unlocked = true;
}

function getContext(): AudioContext | null {
  if (context) return context;
  const Ctor =
    globalThis.AudioContext ??
    (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    context = new Ctor();
  } catch {
    context = null;
  }
  return context;
}

export function playCue(cue: Cue, options: { force?: boolean } = {}): void {
  if (!unlocked || (useUiStore.getState().muted && !options.force)) return;
  const audio = getContext();
  if (!audio) return;
  try {
    void audio.resume();
    const now = audio.currentTime;
    for (const tone of CUES[cue]) {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = tone.type ?? 'sine';
      oscillator.frequency.value = tone.freq;
      gain.gain.setValueAtTime(tone.gain, now + tone.start);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.start + tone.duration);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(now + tone.start);
      oscillator.stop(now + tone.start + tone.duration + 0.02);
    }
  } catch {
    /* audio is optional */
  }
}
