import { useState } from 'react';
import { Panel } from '../components/game/Shell';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { contentAttributes, errorMessage, labelFor, useTranslation } from '../i18n';
import { ApiClientError } from '../lib/api';
import { OPTION_LETTERS, formatSeconds, truncate } from '../lib/format';
import { useRemaining } from '../lib/useRemaining';
import { useRoomFeed } from '../lib/useRoomFeed';
import { Narrator, VoiceSettingsPanel } from '../components/game/Voice';

interface LogEntry {
  at: number;
  text: string;
}

export function ControlView({
  roomCode,
  token,
  overlayToken,
}: {
  roomCode: string;
  token: string;
  overlayToken?: string;
}) {
  const { t } = useTranslation();
  const { room, status, clockOffset, capabilities, emit } = useRoomFeed('control', roomCode, token);
  const remaining = useRemaining(room, clockOffset);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'skip' | 'close' | null>(null);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);

  async function run(label: string, event: string, payload?: unknown): Promise<void> {
    setError(null);
    try {
      await emit(event, payload);
      setLog((entries) => [{ at: Date.now(), text: label }, ...entries].slice(0, 20));
    } catch (caught) {
      const message = errorMessage(caught instanceof ApiClientError ? caught.code : undefined);
      setError(message);
      setLog((entries) =>
        [
          { at: Date.now(), text: t('control.logFailed', { action: label, message }) },
          ...entries,
        ].slice(0, 20),
      );
    }
  }

  async function copyOverlayLink(): Promise<void> {
    if (!overlayToken) return;
    const url = `${window.location.origin}/?mode=overlay&room=${roomCode}&voice=1#token=${overlayToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(t('common.copyFailed'));
    }
  }

  if (status === 'unavailable') {
    return (
      <main className="mx-auto max-w-xl p-8">
        <Banner variant="error">{t('control.unavailable')}</Banner>
      </main>
    );
  }
  if (status === 'ended') {
    return (
      <main className="mx-auto max-w-xl p-8">
        <Banner variant="info">{t('control.ended')}</Banner>
      </main>
    );
  }
  if (!room) {
    return (
      <main className="p-8 text-ink-2" aria-busy="true">
        {t('control.connecting')}
      </main>
    );
  }

  const phase = room.phase === 'PAUSED' ? room.pausedFrom : room.phase;
  const paused = room.phase === 'PAUSED';
  const can = (name: string): boolean => capabilities.includes(name);
  const players = room.players.filter((player) =>
    player.displayName.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const canManual = room.phase === 'QUESTION' && can('manual_answer');

  return (
    <main className="mx-auto grid w-full max-w-shell gap-4 p-4 lg:grid-cols-2 lg:p-8">
      <header className="flex flex-wrap items-center gap-3 lg:col-span-2">
        <h1 className="text-2xl">
          {t('control.title')} ·{' '}
          <span dir="ltr" className="font-mono">
            {room.roomCode}
          </span>
        </h1>
        <span className="rounded-pill border border-line-strong px-3 py-1 text-sm">
          {labelFor('mode', room.mode)}
        </span>
        <span
          className="rounded-pill border border-line-strong px-3 py-1 text-sm"
          aria-label={t('control.phase', { phase: room.phase })}
        >
          {room.phase}
        </span>
        {remaining !== null ? (
          <span className="tabular font-mono">{formatSeconds(remaining)}s</span>
        ) : null}
        <span className="text-sm text-ink-2">
          {t('control.viewers', { count: room.players.length, max: room.settings.maxPlayers })}
        </span>
        <span
          className={`rounded-pill px-3 py-1 text-sm font-bold ${
            room.tiktokConnected ? 'bg-success text-on-accent' : 'bg-warning text-on-accent'
          }`}
        >
          {room.tiktokConnected ? t('control.live') : t('control.chatOffline')}
        </span>
        {status !== 'live' ? (
          <span role="status" className="text-warning">
            {t('connection.reconnecting')}
          </span>
        ) : null}
      </header>

      <Panel className="space-y-3">
        <h2 className="text-xl">{t('control.match')}</h2>
        <p className="text-ink-2">
          {t('control.progress', {
            level: room.level,
            total: room.totalLevels,
            index: room.questionIndex + 1,
            perLevel: room.questionsPerLevel,
          })}
        </p>
        {room.question ? (
          <p className="font-medium" {...contentAttributes(room.language)}>
            {room.question.questionText}
          </p>
        ) : null}
        <ol className="space-y-1">
          {[...room.players]
            .sort((a, b) => b.score - a.score)
            .slice(0, 10)
            .map((player, index) => (
              <li key={player.id} className="flex gap-2">
                <span className="tabular w-6 text-end text-ink-2">{index + 1}.</span>
                <bdi className="flex-1 truncate">{truncate(player.displayName)}</bdi>
                <span className="tabular font-mono">{player.score}</span>
              </li>
            ))}
        </ol>
        {overlayToken ? (
          <Button variant="secondary" size="sm" onClick={() => void copyOverlayLink()}>
            {copied ? t('common.copied') : t('control.copyOverlay')}
          </Button>
        ) : null}
      </Panel>

      <Panel className="space-y-4">
        <h2 className="text-xl">{t('control.actions')}</h2>
        {error ? <Banner variant="error">{error}</Banner> : null}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="success"
            disabled={phase !== 'LOBBY' || !room.tiktokConnected || !can('start')}
            onClick={() => void run(t('control.logStart'), 'GAME_START')}
          >
            {t('control.start')}
          </Button>
          {paused ? (
            <Button
              disabled={!can('resume')}
              onClick={() => void run(t('control.logResume'), 'HOST_RESUME')}
            >
              {t('common.resume')}
            </Button>
          ) : (
            <Button
              variant="secondary"
              disabled={
                !can('pause') ||
                !['QUESTION', 'REVEAL', 'ARTICLE', 'LEVEL_COMPLETE'].includes(room.phase)
              }
              onClick={() => void run(t('control.logPause'), 'HOST_PAUSE')}
            >
              {t('common.pause')}
            </Button>
          )}
          <Button
            variant="secondary"
            disabled={
              !can('skip') || !['QUESTION', 'ARTICLE', 'LEVEL_COMPLETE'].includes(room.phase)
            }
            onClick={() =>
              room.phase === 'QUESTION'
                ? setConfirm('skip')
                : void run(t('control.logSkip'), 'HOST_SKIP')
            }
          >
            {t('control.skip')}
          </Button>
          <Button variant="danger" disabled={!can('close')} onClick={() => setConfirm('close')}>
            {t('control.close')}
          </Button>
        </div>

        <div>
          <h3 className="label mb-2">{t('control.manualAnswer')}</h3>
          <label htmlFor="player-search" className="sr-only">
            {t('control.searchPlayer')}
          </label>
          <input
            id="player-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('control.searchPlayer')}
            className="mb-2 min-h-[44px] w-full rounded-md border border-line-strong bg-bg px-3 text-ink"
          />
          <ul className="max-h-48 space-y-1 overflow-y-auto">
            {players.slice(0, 20).map((player) => (
              <li key={player.id} className="flex items-center gap-2">
                <bdi className="min-w-0 flex-1 truncate">{truncate(player.displayName)}</bdi>
                {OPTION_LETTERS.map((letter, index) => (
                  <Button
                    key={letter}
                    size="sm"
                    variant="secondary"
                    disabled={!canManual}
                    aria-label={t('control.answerFor', { letter, name: player.displayName })}
                    onClick={() =>
                      void run(
                        t('control.logManual', { letter, name: player.displayName }),
                        'HOST_MANUAL_ANSWER',
                        {
                          playerId: player.id,
                          choiceIndex: index,
                        },
                      )
                    }
                  >
                    {letter}
                  </Button>
                ))}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="label mb-2">{t('control.latest')}</h3>
          <ol className="max-h-40 space-y-1 overflow-y-auto text-sm text-ink-2">
            {log.length === 0 ? <li>{t('control.noActions')}</li> : null}
            {log.map((entry, index) => (
              <li key={`${entry.at}-${index}`}>
                <time className="tabular me-2 font-mono">
                  {new Date(entry.at).toLocaleTimeString()}
                </time>
                {entry.text}
              </li>
            ))}
          </ol>
        </div>
      </Panel>

      <Panel className="space-y-3 lg:col-span-2">
        <h2 className="text-xl">{t('voice.title')}</h2>
        <VoiceSettingsPanel language={room.language} hint={t('voice.consoleHint')} />
      </Panel>
      <Narrator room={room} clockOffset={clockOffset} />

      <Modal
        title={confirm === 'close' ? t('control.closeTitle') : t('control.skipTitle')}
        open={confirm !== null}
        onClose={() => setConfirm(null)}
      >
        <p className="mb-4 text-ink-2">
          {confirm === 'close' ? t('control.closeBody') : t('control.skipBody')}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(null)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              const action = confirm;
              setConfirm(null);
              if (action === 'close') void run(t('control.logClose'), 'HOST_CLOSE');
              else void run(t('control.logSkip'), 'HOST_SKIP');
            }}
          >
            {t('common.confirm')}
          </Button>
        </div>
      </Modal>
    </main>
  );
}
