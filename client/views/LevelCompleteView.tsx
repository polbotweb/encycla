import { useEffect, useState } from 'react';
import { Panel, Stat, ViewTitle } from '../components/game/Shell';
import { Button } from '../components/ui/Button';
import { errorMessage, t } from '../i18n/en';
import { ApiClientError } from '../lib/api';
import { formatSeconds } from '../lib/format';
import { gameActions } from '../lib/realtime';
import { useMe } from '../lib/useMe';
import { useRemaining } from '../lib/useRemaining';
import { useGameStore } from '../store/gameStore';

export function LevelCompleteView() {
  const { room, me, canSkip, paused } = useMe();
  const clockOffset = useGameStore((state) => state.clockOffset);
  const remaining = useRemaining(room, clockOffset);
  const [continuedToken, setContinuedToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const phaseToken = room?.phaseToken ?? null;

  useEffect(() => setContinuedToken(null), [phaseToken]);

  if (!room) return null;
  const waiting = continuedToken !== null && continuedToken === phaseToken;
  const canContinue = Boolean(
    me && me.status === 'CONNECTED' && !room.isTikTok && !paused && phaseToken,
  );

  async function send(): Promise<void> {
    if (!phaseToken) return;
    setContinuedToken(phaseToken);
    setError(null);
    try {
      await gameActions.continueArticle(phaseToken);
    } catch (caught) {
      setContinuedToken(null);
      setError(errorMessage(caught instanceof ApiClientError ? caught.code : undefined));
    }
  }

  return (
    <main className="mx-auto w-full max-w-xl p-4 lg:p-8">
      <Panel className="space-y-4 text-center">
        <div aria-live="polite">
          <ViewTitle>
            {t.levelComplete}: level {room.level}
          </ViewTitle>
        </div>
        <div className="flex justify-center gap-8">
          <Stat label="Score" value={me?.score ?? 0} />
          <Stat label="Lives" value={room.mode === 'CONTEST' ? '—' : (me?.lives ?? 0)} />
          <Stat label="Streak" value={me?.streak ?? 0} />
        </div>
        <p className="text-ink-2">
          {room.mode === 'CONTEST' ? '' : room.isSolo ? 'Lives restored.' : 'Lives carry over.'}
        </p>
        {remaining !== null ? (
          <p className="text-sm text-ink-2">Next level in {formatSeconds(remaining)}s</p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex justify-center gap-3">
          {!room.isTikTok ? (
            <Button size="lg" disabled={!canContinue || waiting} onClick={() => void send()}>
              {waiting ? 'Waiting for other players…' : t.continue}
            </Button>
          ) : null}
          {canSkip ? (
            <Button
              variant="secondary"
              onClick={() => void gameActions.skip().catch(() => undefined)}
            >
              Skip for everyone
            </Button>
          ) : null}
        </div>
      </Panel>
    </main>
  );
}
