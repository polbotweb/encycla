import { create } from 'zustand';
import { isLanguage, type Language } from '../../shared/languages';
import type { LabelForm, PublicRoomState } from '../../shared/types';
import { translate } from '../i18n';
import { OPTION_LETTERS } from './format';
import { safeStorage } from './storage';

/**
 * Automatic voice (D-115): the browser's own speech synthesis (Web Speech API, `speechSynthesis`)
 * reads the question, the four answers with their letters, the time marks and the correct answer.
 * No paid service, no network call, no secret. Optional next to the screen-reader announcements
 * (aria-live), which stay as they are.
 */

/** Where the voice runs: each place keeps its own settings and default. */
export type VoiceScope = 'player' | 'overlay' | 'console';

export interface VoiceSettings {
  enabled: boolean;
  /** 0.5–2, 1 = normal speed. */
  rate: number;
  /** 0–1. */
  volume: number;
  /** Also read the first sentence of the article after the answer. */
  readArticle: boolean;
  /** Chosen voice (`voiceURI`) per question language; absent: the best voice of the device. */
  voices: Partial<Record<Language, string>>;
}

/** ON for the TikTok overlay and the streamer console, OFF for players (they turn it on). */
export function defaultVoiceSettings(scope: VoiceScope): VoiceSettings {
  return { enabled: scope !== 'player', rate: 1, volume: 1, readArticle: false, voices: {} };
}

export const VOICE_RATE = { min: 0.5, max: 2, step: 0.1 } as const;

function storageKey(scope: VoiceScope): string {
  return `encycla.voice.${scope}.v1`;
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

/** Saved settings, then the URL (`?voice=1|0&rate=1.2&volume=0.8`, not saved: OBS sets them). */
export function loadVoiceSettings(scope: VoiceScope, search = ''): VoiceSettings {
  const settings = defaultVoiceSettings(scope);
  const raw = safeStorage.get(storageKey(scope));
  if (raw) {
    try {
      const saved = JSON.parse(raw) as Partial<VoiceSettings>;
      if (typeof saved.enabled === 'boolean') settings.enabled = saved.enabled;
      settings.rate = clamp(saved.rate, VOICE_RATE.min, VOICE_RATE.max, 1);
      settings.volume = clamp(saved.volume, 0, 1, 1);
      settings.readArticle = saved.readArticle === true;
      if (saved.voices && typeof saved.voices === 'object') {
        for (const [language, uri] of Object.entries(saved.voices)) {
          if (isLanguage(language) && typeof uri === 'string') settings.voices[language] = uri;
        }
      }
    } catch {
      /* corrupted: defaults */
    }
  }
  const query = new URLSearchParams(search);
  const voice = query.get('voice');
  if (voice === '1' || voice === 'on') settings.enabled = true;
  if (voice === '0' || voice === 'off') settings.enabled = false;
  if (query.has('rate'))
    settings.rate = clamp(query.get('rate'), VOICE_RATE.min, VOICE_RATE.max, 1);
  if (query.has('volume')) settings.volume = clamp(query.get('volume'), 0, 1, 1);
  if (query.get('article') === '1') settings.readArticle = true;
  return settings;
}

export function saveVoiceSettings(scope: VoiceScope, settings: VoiceSettings): void {
  safeStorage.set(storageKey(scope), JSON.stringify(settings));
}

// ---------------------------------------------------------------------------------------------
// Voices

/** The parts of `SpeechSynthesisVoice` used here (tests pass plain objects). */
export interface VoiceInfo {
  voiceURI: string;
  name: string;
  lang: string;
  default?: boolean;
  localService?: boolean;
}

export function baseLanguage(tag: string): string {
  return tag.toLowerCase().replace('_', '-').split('-')[0] ?? '';
}

/**
 * Voice for `language`: the chosen one when it speaks that language, else the device default for
 * it, else a local voice, else the first one. `null` when the device has no voice for it: the
 * text is then not read, never in a voice of another language.
 */
export function pickVoice<V extends VoiceInfo>(
  voices: readonly V[],
  language: string,
  preferredUri?: string | null,
): V | null {
  const base = baseLanguage(language);
  const candidates = voices.filter((voice) => baseLanguage(voice.lang) === base);
  if (candidates.length === 0) return null;
  return (
    candidates.find((voice) => voice.voiceURI === preferredUri) ??
    candidates.find((voice) => voice.default) ??
    candidates.find((voice) => voice.localService) ??
    candidates[0] ??
    null
  );
}

// ---------------------------------------------------------------------------------------------
// What is said (pure)

/**
 * One piece of speech. `lang` is the language it is written in; `fallback` is a language whose
 * voice may read it when the device has none for `lang` (a scientific name written in Latin script
 * read by a French or English voice); without a voice for either, the piece is skipped.
 */
export interface SpeechSegment {
  text: string;
  lang: string;
  fallback?: string;
}

export interface Narration {
  segments: SpeechSegment[];
  /** Stop what is being read first (a new question, the reveal, a pause). */
  interrupt: boolean;
  /** Said only when nothing else is being read (time marks). */
  skipIfBusy?: boolean;
}

/** Room languages written in Latin script: their voices can read a Latin scientific name. */
const LATIN_SCRIPT_LANGUAGES = new Set<string>(['fr', 'en']);

function nameSegments(
  text: string,
  form: LabelForm | null | undefined,
  room: Language,
): SpeechSegment[] {
  if (!form) return [{ text, lang: room }];
  const segment: SpeechSegment = { text, lang: form.lang };
  const latinScript = !/[^\p{Script=Latin}\p{N}\p{P}\p{Zs}]/u.test(text);
  if (latinScript && LATIN_SCRIPT_LANGUAGES.has(room)) segment.fallback = room;
  return [segment];
}

/** Answer `index` with its letter: "A : Lion." (a non-room-language name is its own piece). */
function optionSegments(
  options: string[],
  forms: (LabelForm | null)[] | undefined,
  index: number,
  room: Language,
  key: 'speech.option' | 'speech.correct',
): SpeechSegment[] {
  const letter = OPTION_LETTERS[index] ?? '';
  const text = options[index] ?? '';
  const form = forms?.[index] ?? null;
  if (!form) return [{ text: translate(key, { letter, text }, room), lang: room }];
  return [
    { text: translate(`${key}Letter` as const, { letter }, room), lang: room },
    ...nameSegments(text, form, room),
  ];
}

/** First sentence of the article, at most ~200 characters. */
export function articleIntro(body: string): string {
  const trimmed = body.trim();
  const sentence = /^.+?[.!?؟。](?=\s|$)/u.exec(trimmed)?.[0] ?? trimmed;
  if (sentence.length <= 200) return sentence;
  const cut = sentence.slice(0, 200);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 120))}…`;
}

/**
 * What to say when the room moves from `previous` to `next`, in the room language: the question
 * and its four answers, the correct answer, optionally the article intro, the level and the end.
 */
export function narrationFor(
  previous: PublicRoomState | null,
  next: PublicRoomState,
  options: { readArticle?: boolean } = {},
): Narration | null {
  const room = next.language;
  // Back from a pause into the same phase: what is on screen was already read.
  const resumed = previous?.phase === 'PAUSED' && previous.pausedFrom === next.phase;
  const samePhase = previous !== null && previous.phase === next.phase;
  switch (next.phase) {
    case 'QUESTION': {
      const question = next.question;
      if (!question) return null;
      if (samePhase && previous.question?.id === question.id) return null;
      if (resumed && previous.question?.id === question.id) return null;
      return {
        interrupt: true,
        segments: [
          {
            text: translate(
              'speech.question',
              {
                index: next.questionIndex + 1,
                total: next.questionsPerLevel,
                text: question.questionText,
              },
              room,
            ),
            lang: room,
          },
          ...question.options.flatMap((_, index) =>
            optionSegments(question.options, question.optionForms, index, room, 'speech.option'),
          ),
        ],
      };
    }
    case 'REVEAL': {
      const reveal = next.reveal;
      if (!reveal || (samePhase && previous.reveal?.questionId === reveal.questionId)) return null;
      if (resumed) return null;
      return {
        interrupt: true,
        segments: optionSegments(
          reveal.options,
          reveal.optionForms,
          reveal.correctIndex,
          room,
          'speech.correct',
        ),
      };
    }
    case 'ARTICLE': {
      const reveal = next.reveal;
      if (!options.readArticle || !reveal || samePhase || resumed) return null;
      const intro = articleIntro(reveal.articleBody);
      return intro
        ? { interrupt: false, segments: [{ text: intro, lang: reveal.textLanguage }] }
        : null;
    }
    case 'LEVEL_COMPLETE':
      if (samePhase || resumed) return null;
      return {
        interrupt: false,
        segments: [
          { text: translate('announce.levelComplete', { level: next.level }, room), lang: room },
        ],
      };
    case 'MATCH_OVER':
      if (samePhase) return null;
      return {
        interrupt: false,
        segments: [{ text: translate('announce.matchComplete', {}, room), lang: room }],
      };
    case 'PAUSED':
    case 'CLOSED':
    case 'LOBBY':
      return samePhase ? null : { interrupt: true, segments: [] };
    default:
      return null;
  }
}

const TIME_MARKS = [10_000, 5_000] as const;

/** "10 secondes", "5 secondes", "Temps écoulé" when the timer crosses a mark (never each second). */
export function timeCue(
  previousMs: number | null,
  currentMs: number | null,
  language: Language,
): Narration | null {
  if (previousMs === null || currentMs === null || currentMs >= previousMs) return null;
  if (previousMs > 0 && currentMs <= 0) {
    return {
      interrupt: false,
      skipIfBusy: true,
      segments: [{ text: translate('announce.timeUp', {}, language), lang: language }],
    };
  }
  const mark = TIME_MARKS.find((value) => previousMs > value && currentMs <= value);
  if (mark === undefined) return null;
  return {
    interrupt: false,
    skipIfBusy: true,
    segments: [
      { text: translate('speech.seconds', { count: mark / 1000 }, language), lang: language },
    ],
  };
}

// ---------------------------------------------------------------------------------------------
// The speaker (browser)

type Synth = Pick<
  SpeechSynthesis,
  | 'speak'
  | 'cancel'
  | 'getVoices'
  | 'speaking'
  | 'pending'
  | 'addEventListener'
  | 'removeEventListener'
>;
type UtteranceCtor = new (text: string) => SpeechSynthesisUtterance;

export type SpeakResult =
  'spoken' | 'disabled' | 'unsupported' | 'missing-voice' | 'busy' | 'empty';

function browserSynth(): { synth: Synth | null; Utterance: UtteranceCtor | null } {
  const synth = (globalThis as { speechSynthesis?: Synth }).speechSynthesis ?? null;
  const Utterance =
    (globalThis as { SpeechSynthesisUtterance?: UtteranceCtor }).SpeechSynthesisUtterance ?? null;
  return synth && Utterance ? { synth, Utterance } : { synth: null, Utterance: null };
}

interface VoiceState {
  scope: VoiceScope;
  settings: VoiceSettings;
  supported: boolean;
  voices: VoiceInfo[];
  /** Language last asked for with no voice on this device (a notice is shown). */
  missing: Language | null;
  /** The browser refused to speak before a user gesture (autoplay policy). */
  blocked: boolean;
  /** The browser exposes no voice at all (e.g. the OBS browser source, D-115). */
  noVoices: boolean;
  init(scope: VoiceScope, search?: string): void;
  update(patch: Partial<VoiceSettings>): void;
  setVoice(language: Language, uri: string | null): void;
  toggle(): void;
  refreshVoices(): void;
  speak(narration: Narration, roomLanguage: Language): SpeakResult;
  cancel(): void;
  /** Called from a click: speaks a short confirmation, which unlocks speech for the page. */
  unlock(language: Language): void;
}

let generation = 0;

export const useVoiceStore = create<VoiceState>((set, get) => ({
  scope: 'player',
  settings: defaultVoiceSettings('player'),
  supported: browserSynth().synth !== null,
  voices: [],
  missing: null,
  blocked: false,
  noVoices: false,
  init(scope, search = typeof window === 'undefined' ? '' : window.location.search) {
    set({
      scope,
      settings: loadVoiceSettings(scope, search),
      supported: browserSynth().synth !== null,
    });
    get().refreshVoices();
  },
  update(patch) {
    const settings = { ...get().settings, ...patch };
    saveVoiceSettings(get().scope, settings);
    set({ settings });
    if (patch.enabled === false) get().cancel();
  },
  setVoice(language, uri) {
    const voices = { ...get().settings.voices };
    if (uri) voices[language] = uri;
    else delete voices[language];
    get().update({ voices });
  },
  toggle() {
    get().update({ enabled: !get().settings.enabled });
  },
  refreshVoices() {
    const { synth } = browserSynth();
    if (!synth) return;
    try {
      const voices = synth.getVoices();
      if (voices.length > 0 && get().noVoices) set({ noVoices: false });
      set({
        voices: voices.map((voice) => ({
          voiceURI: voice.voiceURI,
          name: voice.name,
          lang: voice.lang,
          default: voice.default,
          localService: voice.localService,
        })),
      });
    } catch {
      /* optional */
    }
  },
  speak(narration, roomLanguage) {
    const { settings } = get();
    if (!settings.enabled) return 'disabled';
    const { synth, Utterance } = browserSynth();
    if (!synth || !Utterance) return 'unsupported';
    if (narration.interrupt) get().cancel();
    if (narration.segments.length === 0) return 'empty';
    if (narration.skipIfBusy && (synth.speaking || synth.pending)) return 'busy';
    let available = synth.getVoices();
    if (available.length === 0) {
      get().refreshVoices();
      available = synth.getVoices();
    }
    if (available.length === 0) {
      set({ noVoices: true });
      return 'unsupported';
    }
    if (!pickVoice(available, roomLanguage, settings.voices[roomLanguage])) {
      set({ missing: roomLanguage, noVoices: false });
      return 'missing-voice';
    }
    if (get().missing || get().noVoices) set({ missing: null, noVoices: false });
    const current = generation;
    for (const segment of narration.segments) {
      const preferred = isLanguage(segment.lang) ? settings.voices[segment.lang] : undefined;
      let voice = pickVoice(available, segment.lang, preferred);
      if (!voice && segment.fallback) {
        const fallback = segment.fallback;
        voice = pickVoice(
          available,
          fallback,
          isLanguage(fallback) ? settings.voices[fallback] : null,
        );
      }
      if (!voice || !segment.text.trim()) continue;
      const utterance = new Utterance(segment.text);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = settings.rate;
      utterance.volume = settings.volume;
      utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
        if (event.error === 'not-allowed' && current === generation) set({ blocked: true });
      };
      utterance.onstart = () => {
        if (get().blocked) set({ blocked: false });
      };
      synth.speak(utterance);
    }
    return 'spoken';
  },
  cancel() {
    generation += 1;
    try {
      browserSynth().synth?.cancel();
    } catch {
      /* optional */
    }
  },
  unlock(language) {
    set({ blocked: false });
    get().speak(
      {
        interrupt: true,
        segments: [{ text: translate('speech.enabled', {}, language), lang: language }],
      },
      language,
    );
  },
}));

/** Keeps the voice list fresh: browsers load voices asynchronously (`voiceschanged`). */
export function watchVoices(): () => void {
  const { synth } = browserSynth();
  if (!synth) return () => undefined;
  const refresh = (): void => useVoiceStore.getState().refreshVoices();
  refresh();
  synth.addEventListener('voiceschanged', refresh);
  return () => synth.removeEventListener('voiceschanged', refresh);
}
