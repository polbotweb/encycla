import { useState } from 'react';
import { LeaveButton } from '../components/game/LeaveControls';
import { Panel, ViewTitle } from '../components/game/Shell';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { PlayerChip } from '../components/ui/PlayerChip';
import { LANGUAGE_NAMES } from '../../shared/languages';
import { errorMessage, labelFor, useTranslation } from '../i18n';
import { ApiClientError } from '../lib/api';
import { gameActions } from '../lib/realtime';
import { useMe } from '../lib/useMe';

export function LobbyView() {
  const { t } = useTranslation();
  const { room, me, isHost, playerId } = useMe();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!room) return null;

  const total = room.questionsPerLevel * room.totalLevels;
  const connected = room.players.filter((player) => player.status === 'CONNECTED');
  const allReady = connected.length >= 2 && connected.every((player) => player.isReady);

  async function run(action: () => Promise<unknown>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(errorMessage(caught instanceof ApiClientError ? caught.code : undefined));
    } finally {
      setBusy(false);
    }
  }

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(room?.roomCode ?? '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(t('common.copyFailed'));
    }
  }

  const modeLine = [
    labelFor('mode', room.mode),
    room.category ? labelFor('category', room.category) : null,
    room.difficulty ? labelFor('difficulty', room.difficulty) : null,
    t('lobby.levels', { count: room.totalLevels }),
    t('lobby.perLevel', { count: room.questionsPerLevel }),
    t('lobby.total', { count: total }),
    t('lobby.language', { language: LANGUAGE_NAMES[room.language] }),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <main className="mx-auto w-full max-w-shell space-y-4 p-4 lg:p-8">
      <Panel className="space-y-2">
        <p className="label">{room.isPublic ? t('lobby.public') : t('lobby.private')}</p>
        <ViewTitle>
          {t('lobby.room')}{' '}
          <span
            className="select-all font-mono tracking-[0.15em]"
            data-testid="room-code"
            dir="ltr"
          >
            {room.roomCode}
          </span>
        </ViewTitle>
        <p className="text-ink-2">{modeLine}</p>
        {!room.isPublic ? (
          <Button variant="secondary" size="sm" onClick={() => void copy()}>
            {copied ? t('common.copied') : t('common.copyCode')}
          </Button>
        ) : null}
      </Panel>

      <Panel>
        <h2 className="mb-3 text-xl">
          {t('lobby.players', { count: room.players.length, max: room.settings.maxPlayers })}
        </h2>
        <ul className="grid gap-2 md:grid-cols-2">
          {room.players.map((player) => (
            <PlayerChip key={player.id} player={player} you={player.id === playerId} showReady />
          ))}
        </ul>
      </Panel>

      {error ? <Banner variant="error">{error}</Banner> : null}

      <Panel className="flex flex-wrap items-center gap-3">
        {room.isPublic ? (
          <p className="flex-1 text-ink-2" role="status">
            {room.players.length < 2 ? t('lobby.waiting') : t('lobby.startingAuto')}
          </p>
        ) : (
          <>
            <Button
              variant={me?.isReady ? 'secondary' : 'primary'}
              loading={busy}
              onClick={() => void run(() => gameActions.setReady(!me?.isReady))}
              aria-pressed={me?.isReady ?? false}
            >
              {me?.isReady ? t('lobby.notReady') : t('lobby.ready')}
            </Button>
            {isHost ? (
              <Button
                variant="success"
                disabled={!allReady}
                loading={busy}
                onClick={() => void run(() => gameActions.start())}
              >
                {t('lobby.start')}
              </Button>
            ) : (
              <span className="text-ink-2" role="status">
                {t('lobby.waitingForHost')}
              </span>
            )}
            {isHost && !allReady ? (
              <span className="text-sm text-ink-2">
                {connected.length < 2 ? t('lobby.needTwo') : t('lobby.needReady')}
              </span>
            ) : null}
          </>
        )}
        <span className="ms-auto">
          <LeaveButton />
        </span>
      </Panel>
    </main>
  );
}
