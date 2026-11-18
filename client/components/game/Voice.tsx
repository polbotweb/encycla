import { useEffect, useId, useRef, useState } from 'react';
import type { Language } from '../../../shared/languages';
import type { PublicRoomState } from '../../../shared/types';
import { languageName, translate, useTranslation } from '../../i18n';
import {
  narrationFor,
  pickVoice,
  timeCue,
  useVoiceStore,
  VOICE_RATE,
  baseLanguage,
} from '../../lib/speech';
import { safeStorage } from '../../lib/storage';
import { useRemaining } from '../../lib/useRemaining';
import { Banner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { VoiceOffIcon, VoiceOnIcon } from '../ui/Icons';

/**
 * Reads the room aloud (D-115): the question and its answers, the time marks, the correct answer.
 * Renders nothing; the screen-reader announcements (aria-live) are unchanged.
 */
export function Narrator({
  room,
  clockOffset,
  timeCues = true,
  silenced = false,
}: {
  room: PublicRoomState | null;
  clockOffset: number;
  /** Speak "10 seconds", "5 seconds", "time's up" during the question. */
  timeCues?: boolean;
  /** Player mute (`M`): the voice stops too. */
  silenced?: boolean;
}) {
  const enabled = useVoiceStore((state) => state.settings.enabled) && !silenced;
  const readArticle = useVoiceStore((state) => state.settings.readArticle);
  const previous = useRef<PublicRoomState | null>(null);
  const remaining = useRemaining(room?.phase === 'QUESTION' ? room : null, clockOffset, 250);
  const lastReading = useRef<{ questionId: string | null; ms: number | null }>({
    questionId: null,
    ms: null,
  });

  useEffect(() => {
    const before = previous.current;
    previous.current = room;
    if (!room || !enabled) return;
    const narration = narrationFor(before, room, { readArticle });
    if (narration) useVoiceStore.getState().speak(narration, room.language);
  }, [room, enabled, readArticle]);

  const questionId = room?.phase === 'QUESTION' ? (room.question?.id ?? null) : null;
  useEffect(() => {
    const reading = lastReading.current;
    const before = reading.questionId === questionId ? reading.ms : null;
    lastReading.current = { questionId, ms: remaining };
    if (!room || !enabled || !timeCues || questionId === null) return;
    const cue = timeCue(before, remaining, room.language);
    if (cue) useVoiceStore.getState().speak(cue, room.language);
  }, [questionId, remaining, enabled, timeCues, room]);

  useEffect(() => {
    if (!enabled) useVoiceStore.getState().cancel();
  }, [enabled]);
  useEffect(() => () => useVoiceStore.getState().cancel(), []);
  return null;
}

/** Header button: turns the automatic voice on or off (aria-pressed). */
export function VoiceToggleButton() {
  const { t, language } = useTranslation();
  const enabled = useVoiceStore((state) => state.settings.enabled);
  const supported = useVoiceStore((state) => state.supported);
  if (!supported) return null;
  return (
    <button
      type="button"
      data-testid="voice-toggle"
      onClick={() => {
        const store = useVoiceStore.getState();
        store.toggle();
        if (!enabled) store.unlock(language);
      }}
      aria-pressed={enabled}
      aria-label={enabled ? t('voice.on') : t('voice.off')}
      title={t('voice.title')}
      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-ink-2 hover:bg-raised hover:text-ink"
    >
      {enabled ? <VoiceOnIcon /> : <VoiceOffIcon />}
    </button>
  );
}

/** No voice for the question language, speech blocked until a click, or no speech at all. */
export function VoiceNotice({
  language,
  overlay = false,
}: {
  language: Language;
  overlay?: boolean;
}) {
  const { t, language: ui } = useTranslation();
  const enabled = useVoiceStore((state) => state.settings.enabled);
  const supported = useVoiceStore((state) => state.supported);
  const missing = useVoiceStore((state) => state.missing);
  const blocked = useVoiceStore((state) => state.blocked);
  const voices = useVoiceStore((state) => state.voices);
  const noVoices = useVoiceStore((state) => state.noVoices);
  if (!enabled) return null;
  const pill = 'rounded-pill bg-warning px-3 py-1 text-sm font-bold text-on-accent';
  // No speech at all in this browser (often the OBS browser source): said in the overlay lobby
  // (VoiceStatus), never as a warning on stream during the game.
  if (!supported || noVoices) {
    return overlay ? null : <Banner variant="warning">{t('voice.unsupported')}</Banner>;
  }
  const noVoice = missing === language || (voices.length > 0 && !pickVoice(voices, language));
  if (blocked) {
    const action = (
      <Button
        size="sm"
        variant="secondary"
        onClick={() => useVoiceStore.getState().unlock(language)}
      >
        {t('voice.enable')}
      </Button>
    );
    return overlay ? (
      <button
        type="button"
        className={pill}
        onClick={() => useVoiceStore.getState().unlock(language)}
      >
        {t('voice.blocked')} {t('voice.enable')}
      </button>
    ) : (
      <Banner variant="warning" action={action}>
        {t('voice.blocked')}
      </Banner>
    );
  }
  if (noVoice) {
    const message = t('voice.missing', { language: languageName(language, ui) });
    return overlay ? (
      <span className={pill} data-testid="voice-missing">
        {message}
      </span>
    ) : (
      <div data-testid="voice-missing">
        <Banner variant="warning">{message}</Banner>
      </div>
    );
  }
  return null;
}

/**
 * Overlay lobby only: which voice will read, or that this browser has none (OBS browser sources
 * often expose no voice; docs/TIKTOK.md explains the console fallback).
 */
export function VoiceStatus({ language }: { language: Language }) {
  const { t } = useTranslation();
  const enabled = useVoiceStore((state) => state.settings.enabled);
  const supported = useVoiceStore((state) => state.supported);
  const voices = useVoiceStore((state) => state.voices);
  const preferred = useVoiceStore((state) => state.settings.voices[language]);
  if (!enabled) return null;
  const voice = supported ? pickVoice(voices, language, preferred) : null;
  return (
    <span
      data-testid="voice-status"
      className="rounded-pill border border-ink/20 bg-bg/90 px-3 py-1 text-sm text-ink-2"
    >
      {voice ? t('voice.statusReady', { name: voice.name }) : t('voice.statusNone')}
    </span>
  );
}

/** Toggle, voice, speed, volume, article intro, test (UI-UX 21.6). */
export function VoiceSettingsPanel({
  language,
  hint,
}: {
  /** Language whose voice is chosen here (the questions' language). */
  language: Language;
  hint?: string;
}) {
  const { t, language: ui } = useTranslation();
  const id = useId();
  const settings = useVoiceStore((state) => state.settings);
  const supported = useVoiceStore((state) => state.supported);
  const voices = useVoiceStore((state) => state.voices);
  const store = useVoiceStore.getState;
  const own = voices.filter((voice) => baseLanguage(voice.lang) === language);
  const chosen = pickVoice(voices, language, settings.voices[language]);
  return (
    <div className="space-y-3" data-testid="voice-settings">
      <p className="text-sm text-ink-2">{t('voice.description')}</p>
      {hint ? <p className="text-sm text-ink-2">{hint}</p> : null}
      <label className="flex min-h-[44px] items-center gap-3">
        <input
          type="checkbox"
          role="switch"
          checked={settings.enabled}
          disabled={!supported}
          onChange={(event) => {
            store().update({ enabled: event.target.checked });
            if (event.target.checked) store().unlock(language);
          }}
          className="h-5 w-5 accent-accent"
        />
        <span>{t('voice.toggle')}</span>
      </label>
      {supported ? (
        <>
          <div className="grid gap-1">
            <label htmlFor={`${id}-voice`} className="label">
              {t('voice.voice', { language: languageName(language, ui) })}
            </label>
            <select
              id={`${id}-voice`}
              value={settings.voices[language] ?? ''}
              disabled={own.length === 0}
              onChange={(event) => store().setVoice(language, event.target.value || null)}
              className="min-h-[44px] rounded-md border border-line-strong bg-bg px-3 text-ink"
            >
              <option value="">
                {t('voice.auto')}
                {chosen ? ` · ${chosen.name}` : ''}
              </option>
              {own.map((voice) => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="label">
                {t('voice.rate')} · <span dir="ltr">×{settings.rate.toFixed(1)}</span>
              </span>
              <input
                type="range"
                min={VOICE_RATE.min}
                max={VOICE_RATE.max}
                step={VOICE_RATE.step}
                value={settings.rate}
                onChange={(event) => store().update({ rate: Number(event.target.value) })}
                className="accent-accent"
              />
            </label>
            <label className="grid gap-1">
              <span className="label">
                {t('voice.volume')} · <span dir="ltr">{Math.round(settings.volume * 100)} %</span>
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={settings.volume}
                onChange={(event) => store().update({ volume: Number(event.target.value) })}
                className="accent-accent"
              />
            </label>
          </div>
          <label className="flex min-h-[44px] items-center gap-3">
            <input
              type="checkbox"
              checked={settings.readArticle}
              onChange={(event) => store().update({ readArticle: event.target.checked })}
              className="h-5 w-5 accent-accent"
            />
            <span>{t('voice.readArticle')}</span>
          </label>
          <Button
            size="sm"
            variant="secondary"
            disabled={!settings.enabled}
            onClick={() =>
              store().speak(
                {
                  interrupt: true,
                  segments: [{ text: translate('speech.sample', {}, language), lang: language }],
                },
                language,
              )
            }
          >
            {t('voice.test')}
          </Button>
        </>
      ) : null}
      <VoiceNotice language={language} />
      <p className="text-sm text-ink-2">{t('voice.screenReaderHint')}</p>
    </div>
  );
}

const SUGGESTION_ITEM = 'encycla.voice.suggestion.v1';

/**
 * A one-time offer on the home screen. Browsers do not tell a page whether a screen reader is
 * running, so the voice is never turned on by itself for players: it is offered, once.
 */
export function VoiceSuggestion() {
  const { t, language } = useTranslation();
  const enabled = useVoiceStore((state) => state.settings.enabled);
  const supported = useVoiceStore((state) => state.supported);
  const [dismissed, setDismissed] = useState(() => safeStorage.get(SUGGESTION_ITEM) === 'dismissed');
  if (!supported || enabled || dismissed) return null;
  const dismiss = (): void => {
    safeStorage.set(SUGGESTION_ITEM, 'dismissed');
    setDismissed(true);
  };
  return (
    <section
      aria-labelledby="voice-suggestion-title"
      className="space-y-2 rounded-md border border-line bg-surface p-4"
      data-testid="voice-suggestion"
    >
      <h2 id="voice-suggestion-title" className="text-lg">
        {t('voice.suggestTitle')}
      </h2>
      <p className="text-sm text-ink-2">{t('voice.suggest')}</p>
      <p className="text-sm text-ink-2">{t('voice.screenReaderHint')}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => {
            useVoiceStore.getState().update({ enabled: true });
            useVoiceStore.getState().unlock(language);
            dismiss();
          }}
        >
          {t('voice.enable')}
        </Button>
        <Button size="sm" variant="ghost" onClick={dismiss}>
          {t('voice.dismiss')}
        </Button>
      </div>
    </section>
  );
}
