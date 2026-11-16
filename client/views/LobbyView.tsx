import { useState } from 'react';
import { LeaveButton } from '../components/game/LeaveControls';
import { Panel, ViewTitle } from '../components/game/Shell';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { PlayerChip } from '../components/ui/PlayerChip';
import { errorMessage, t } from '../i18n/en';
import { ApiClientError } from '../lib/api';
import { gameActions } from '../lib/realtime';
import { useMe } from '../lib/useMe';

export function LobbyView() {
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
      setError('Copy failed. Select the code and copy it manually.');
    }
  }

  const modeLine = [
    room.mode,
    room.category,
    room.difficulty,
    `${room.totalLevels} ${room.totalLevels === 1 ? 'level' : 'levels'}`,
    `${room.questionsPerLevel} questions per level`,
    `${total} total`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <main className="mx-auto w-full max-w-shell space-y-4 p-4 lg:p-8">
      <Panel className="space-y-2">
        <p className="label">{room.isPublic ? 'Public match' : 'Private room'}</p>
        <ViewTitle>
          Room{' '}
          <span className="select-all font-mono tracking-[0.15em]" data-testid="room-code">
            {room.roomCode}
          </span>
        </ViewTitle>
        <p className="text-ink-2">{modeLine}</p>
        {!room.isPublic ? (
          <Button variant="secondary" size="sm" onClick={() => void copy()}>
            {copied ? t.copied : t.copyCode}
          </Button>
        ) : null}
      </Panel>

      <Panel>
        <h2 className="mb-3 text-xl">
          Players ({room.players.length}/{room.settings.maxPlayers})
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
            {room.players.length < 2 ? t.waiting : t.startingAuto}
          </p>
        ) : (
          <>
            <Button
              variant={me?.isReady ? 'secondary' : 'primary'}
              loading={busy}
              onClick={() => void run(() => gameActions.setReady(!me?.isReady))}
              aria-pressed={me?.isReady ?? false}
            >
              {me?.isReady ? t.notReady : t.ready}
            </Button>
            {isHost ? (
              <Button
                variant="success"
                disabled={!allReady}
                loading={busy}
                onClick={() => void run(() => gameActions.start())}
              >
                {t.start}
              </Button>
            ) : (
              <span className="text-ink-2" role="status">
                {t.waitingForHost}
              </span>
            )}
            {isHost && !allReady ? (
              <span className="text-sm text-ink-2">
                {connected.length < 2
                  ? 'At least 2 players are required.'
                  : 'Every player must be ready.'}
              </span>
            ) : null}
          </>
        )}
        <span className="ml-auto">
          <LeaveButton />
        </span>
      </Panel>
    </main>
  );
}
