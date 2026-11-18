import { useState, type FormEvent } from 'react';
import { LANGUAGES, LANGUAGE_NAMES, isLanguage, type Language } from '../../shared/languages';
import type { Difficulty } from '../../shared/types';
import { VoiceSettingsPanel } from '../components/game/Voice';
import { Panel } from '../components/game/Shell';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { Logo } from '../components/ui/Logo';
import { LanguageSwitcher } from '../i18n/LanguageSwitcher';
import { errorMessage, labelFor, useTranslation, type MessageKey } from '../i18n';
import { OPTION_LETTERS } from '../lib/format';
import {
  ApiClientError,
  adminApi,
  type TikTokRoomCreated,
  type TikTokStatusView,
} from '../lib/api';
import { useConfig } from '../lib/useConfig';

const DIFFICULTIES: Difficulty[] = ['Novice', 'Adventurer', 'Wizard'];
const TIMERS = [10, 15, 20, 25, 30];
const HANDLE = /^@?[A-Za-z0-9._]{2,24}$/;
const FIELD = 'min-h-[44px] w-full rounded-md border border-line-strong bg-bg px-3 text-ink';

/** Links for OBS (overlay) and for the streamer (control console); tokens stay in the fragment. */
export function roomLinks(
  origin: string,
  room: TikTokRoomCreated,
): { overlay: string; control: string } {
  const code = encodeURIComponent(room.roomCode);
  return {
    overlay: `${origin}/?mode=overlay&room=${code}&voice=1#token=${room.overlayToken}`,
    control: `${origin}/?mode=control&room=${code}#token=${room.controlToken}&overlay=${room.overlayToken}`,
  };
}

/**
 * Streamer console (`/?mode=admin`): unlock with ADMIN_TOKEN (kept in memory only), pick any
 * live and a game, get the overlay and control links, close the room. With the simulated chat
 * (`TIKTOK_ADAPTER=fake`) it also sends test comments A/B/C/D.
 */
export function AdminView() {
  const { t, language: interfaceLanguage } = useTranslation();
  const { config } = useConfig();
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<TikTokStatusView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [room, setRoom] = useState<TikTokRoomCreated | null>(null);
  const [live, setLive] = useState('');
  const [mode, setMode] = useState<'CLASSIC' | 'SUBJECT'>('CLASSIC');
  const [questionLanguage, setQuestionLanguage] = useState<Language>(interfaceLanguage);
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('Novice');
  const [timer, setTimer] = useState(15);
  const [copied, setCopied] = useState<'overlay' | 'control' | null>(null);
  const [viewer, setViewer] = useState('viewer_1');
  const [sent, setSent] = useState<string | null>(null);

  function fail(caught: unknown): void {
    if (caught instanceof ApiClientError && (caught.status === 401 || caught.status === 403)) {
      setError(t('admin.badToken'));
    } else if (caught instanceof ApiClientError && caught.code === 'ROOM_IN_PROGRESS') {
      setError(t('admin.roomOpen'));
    } else {
      setError(errorMessage(caught instanceof ApiClientError ? caught.code : undefined));
    }
  }

  async function guarded(action: () => Promise<void>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(false);
    }
  }

  const refresh = () =>
    guarded(async () => {
      const next = await adminApi.tiktokStatus(token.trim());
      setStatus(next);
      if (!live && next.liveUsername) setLive(`@${next.liveUsername}`);
    });

  const categories = config?.categories ?? [];
  const enabledIn = (entry: (typeof categories)[number]): boolean =>
    entry.languages?.[questionLanguage]?.subjectEnabled ?? entry.subjectEnabled;
  const liveOk = live.trim() === '' ? status?.liveUsername != null : HANDLE.test(live.trim());
  const canCreate =
    liveOk && (mode !== 'SUBJECT' || categories.some((e) => e.value === category && enabledIn(e)));

  function create(event: FormEvent): void {
    event.preventDefault();
    if (!canCreate || busy) return;
    void guarded(async () => {
      const created = await adminApi.createTikTokRoom(token.trim(), {
        mode,
        category: mode === 'SUBJECT' ? category : null,
        difficulty: mode === 'SUBJECT' ? difficulty : null,
        language: questionLanguage,
        timerMs: timer * 1000,
        ...(live.trim() ? { liveUsername: live.trim() } : {}),
      });
      setRoom(created);
      setStatus(await adminApi.tiktokStatus(token.trim()));
    });
  }

  const closeRoom = (code: string) =>
    guarded(async () => {
      await adminApi.closeRoom(token.trim(), code);
      setRoom(null);
      setStatus(await adminApi.tiktokStatus(token.trim()));
    });

  async function copy(kind: 'overlay' | 'control', url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError(t('common.copyFailed'));
    }
  }

  const say = (letter: string) =>
    guarded(async () => {
      await adminApi.simulateChat(token.trim(), { uniqueId: viewer.trim(), comment: letter });
      setSent(t('admin.simSent', { name: viewer.trim(), letter }));
    });

  const links = room ? roomLinks(window.location.origin, room) : null;
  const openCode = room?.roomCode ?? status?.activeRoomCode ?? null;

  return (
    <main className="mx-auto grid w-full max-w-shell gap-4 p-4 lg:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Logo height={36} tagline={false} />
          <h1 className="text-2xl">{t('admin.title')}</h1>
        </div>
        <LanguageSwitcher />
      </header>

      {error ? <Banner variant="error">{error}</Banner> : null}

      <Panel>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (token.trim()) void refresh();
          }}
        >
          <div className="min-w-[16rem] flex-1">
            <label htmlFor="admin-token" className="label mb-1 block">
              {t('admin.token')}
            </label>
            <input
              id="admin-token"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={token}
              onChange={(event) => setToken(event.target.value)}
              className={FIELD}
            />
            <p className="mt-1 text-sm text-ink-2">{t('admin.tokenHint')}</p>
          </div>
          <Button type="submit" disabled={!token.trim() || busy}>
            {status ? t('admin.refresh') : t('admin.unlock')}
          </Button>
        </form>
      </Panel>

      {status && !status.enabled ? <Banner variant="warning">{t('admin.disabled')}</Banner> : null}

      {status?.enabled ? (
        <Panel>
          <h2 className="mb-3 text-xl">{t('admin.status')}</h2>
          <div className="flex flex-wrap gap-2 text-sm" data-testid="tiktok-status">
            <span
              className={`rounded-pill px-3 py-1 font-bold ${
                status.connected ? 'bg-success text-on-accent' : 'bg-warning text-on-accent'
              }`}
            >
              {status.connected ? t('control.live') : t('control.chatOffline')}
            </span>
            <span className="rounded-pill border border-line-strong px-3 py-1" dir="ltr">
              {status.liveUsername ? `@${status.liveUsername}` : t('admin.noLive')}
            </span>
            {status.simulated ? (
              <span className="rounded-pill border border-accent px-3 py-1">
                {t('admin.simulated')}
              </span>
            ) : null}
          </div>
        </Panel>
      ) : null}

      {status?.enabled && !openCode ? (
        <Panel>
          <h2 className="mb-3 text-xl">{t('admin.create')}</h2>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={create}>
            <div className="sm:col-span-2">
              <label htmlFor="live-username" className="label mb-1 block">
                {t('admin.live')}
              </label>
              <input
                id="live-username"
                dir="ltr"
                placeholder={t('admin.livePlaceholder')}
                autoComplete="off"
                value={live}
                onChange={(event) => setLive(event.target.value)}
                aria-invalid={!liveOk}
                className={FIELD}
              />
              <p className="mt-1 text-sm text-ink-2">{t('admin.liveHint')}</p>
            </div>
            <fieldset className="space-y-2 sm:col-span-2">
              <legend className="label mb-1">{t('setup.mode')}</legend>
              {(['CLASSIC', 'SUBJECT'] as const).map((value) => (
                <label
                  key={value}
                  className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md border border-line px-3 py-2 has-[:checked]:border-accent"
                >
                  <input
                    type="radio"
                    name="admin-mode"
                    value={value}
                    checked={mode === value}
                    onChange={() => setMode(value)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  <span>{t(`mode.${value}.desc` as MessageKey)}</span>
                </label>
              ))}
            </fieldset>
            <div>
              <label htmlFor="admin-language" className="label mb-1 block">
                {t('setup.questionLanguage')}
              </label>
              <select
                id="admin-language"
                value={questionLanguage}
                onChange={(event) => {
                  if (isLanguage(event.target.value)) setQuestionLanguage(event.target.value);
                }}
                className={FIELD}
              >
                {LANGUAGES.map((code) => (
                  <option key={code} value={code} lang={code}>
                    {LANGUAGE_NAMES[code]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="admin-timer" className="label mb-1 block">
                {t('admin.timer')}
              </label>
              <select
                id="admin-timer"
                value={timer}
                onChange={(event) => setTimer(Number(event.target.value))}
                className={FIELD}
              >
                {TIMERS.map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {t('common.seconds', { seconds })}
                  </option>
                ))}
              </select>
            </div>
            {mode === 'SUBJECT' ? (
              <>
                <div>
                  <label htmlFor="admin-category" className="label mb-1 block">
                    {t('setup.category')}
                  </label>
                  <select
                    id="admin-category"
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className={FIELD}
                  >
                    <option value="">{t('setup.chooseCategory')}</option>
                    {categories.map((entry) => (
                      <option key={entry.value} value={entry.value} disabled={!enabledIn(entry)}>
                        {labelFor('category', entry.value)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="admin-difficulty" className="label mb-1 block">
                    {t('setup.difficulty')}
                  </label>
                  <select
                    id="admin-difficulty"
                    value={difficulty}
                    onChange={(event) => setDifficulty(event.target.value as Difficulty)}
                    className={FIELD}
                  >
                    {DIFFICULTIES.map((value) => (
                      <option key={value} value={value}>
                        {labelFor('difficulty', value)}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : null}
            <div className="flex justify-end sm:col-span-2">
              <Button type="submit" disabled={!canCreate || busy}>
                {t('admin.createButton')}
              </Button>
            </div>
          </form>
        </Panel>
      ) : null}

      {openCode ? (
        <Panel>
          <h2 className="mb-3 text-xl">
            {t('admin.room')} ·{' '}
            <span dir="ltr" className="font-mono" data-testid="admin-room-code">
              {openCode}
            </span>
          </h2>
          {links ? (
            <div className="space-y-4">
              {(['overlay', 'control'] as const).map((kind) => (
                <div key={kind}>
                  <label htmlFor={`link-${kind}`} className="label mb-1 block">
                    {t(kind === 'overlay' ? 'admin.overlayLink' : 'admin.controlLink')}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <input
                      id={`link-${kind}`}
                      readOnly
                      dir="ltr"
                      value={links[kind]}
                      onFocus={(event) => event.target.select()}
                      className={`${FIELD} min-w-0 flex-1 font-mono text-sm`}
                    />
                    <Button variant="secondary" onClick={() => void copy(kind, links[kind])}>
                      {copied === kind ? t('common.copied') : t('admin.copy')}
                    </Button>
                    <a
                      href={links[kind]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] items-center rounded-md border border-line-strong px-4"
                      data-testid={`open-${kind}`}
                    >
                      {t('admin.open')}
                    </a>
                  </div>
                  <p className="mt-1 text-sm text-ink-2">
                    {t(kind === 'overlay' ? 'admin.overlayHint' : 'admin.controlHint')}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-ink-2">{t('admin.roomElsewhere')}</p>
          )}
          <div className="mt-4 flex justify-end">
            <Button variant="danger" disabled={busy} onClick={() => void closeRoom(openCode)}>
              {t('admin.closeRoom')}
            </Button>
          </div>
        </Panel>
      ) : null}

      {status?.simulated && openCode ? (
        <Panel>
          <h2 className="mb-1 text-xl">{t('admin.simTitle')}</h2>
          <p className="mb-3 text-sm text-ink-2">{t('admin.simHint')}</p>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor="sim-viewer" className="label mb-1 block">
                {t('admin.simViewer')}
              </label>
              <input
                id="sim-viewer"
                dir="ltr"
                value={viewer}
                onChange={(event) => setViewer(event.target.value)}
                className={FIELD}
              />
            </div>
            {OPTION_LETTERS.map((letter) => (
              <Button
                key={letter}
                variant="secondary"
                disabled={busy || !/^[A-Za-z0-9._]{2,24}$/.test(viewer.trim())}
                onClick={() => void say(letter)}
                aria-label={t('admin.simSay', { letter })}
              >
                {letter}
              </Button>
            ))}
          </div>
          {sent ? (
            <p className="mt-2 text-sm" role="status">
              {sent}
            </p>
          ) : null}
        </Panel>
      ) : null}

      <Panel>
        <details data-testid="voice-details">
          <summary className="cursor-pointer text-xl font-bold">{t('voice.title')}</summary>
          <div className="mt-3">
            <VoiceSettingsPanel language={questionLanguage} hint={t('voice.consoleHint')} />
          </div>
        </details>
      </Panel>
    </main>
  );
}
