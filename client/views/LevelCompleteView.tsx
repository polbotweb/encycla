import { useEffect, useState } from 'react';
import { Panel, Stat, ViewTitle } from '../components/game/Shell';
import { Button } from '../components/ui/Button';
import { errorMessage, useTranslation } from '../i18n';
import { ApiClientError } from '../lib/api';
import { formatSeconds } from '../lib/format';
import { gameActions } from '../lib/realtime';
import { useMe } from '../lib/useMe';
import { useRemaining } from '../lib/useRemaining';
import { useGameStore } from '../store/gameStore';

export function LevelCompleteView() {
  const { t } = useTranslation();
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
          <ViewTitle>{t('level.complete', { level: room.level })}</ViewTitle>
        </div>
        <div className="flex justify-center gap-8">
          <Stat label={t('common.score')} value={me?.score ?? 0} />
          <Stat
            label={t('common.lives')}
            value={room.mode === 'CONTEST' ? '—' : (me?.lives ?? 0)}
          />
          <Stat label={t('common.streak')} value={me?.streak ?? 0} />
        </div>
        <p className="text-ink-2">
          {room.mode === 'CONTEST'
            ? ''
            : room.isSolo
              ? t('level.livesRestored')
              : t('level.livesCarry')}
        </p>
        {remaining !== null ? (
          <p className="text-sm text-ink-2">
            {t('level.next', { seconds: formatSeconds(remaining) })}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex justify-center gap-3">
          {!room.isTikTok ? (
            <Button size="lg" disabled={!canContinue || waiting} onClick={() => void send()}>
              {waiting ? t('common.waitingOthers') : t('common.continue')}
            </Button>
          ) : null}
          {canSkip ? (
            <Button
              variant="secondary"
              onClick={() => void gameActions.skip().catch(() => undefined)}
            >
              {t('common.skipForEveryone')}
            </Button>
          ) : null}
        </div>
      </Panel>
    </main>
  );
}
