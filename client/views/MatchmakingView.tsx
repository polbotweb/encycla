import { useEffect, useState } from 'react';
import { Panel, ViewTitle } from '../components/game/Shell';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { errorMessage, useTranslation } from '../i18n';
import { formatClock, formatSeconds } from '../lib/format';
import { ApiClientError } from '../lib/api';
import { gameActions } from '../lib/realtime';
import { useGameStore } from '../store/gameStore';

function useNow(intervalMs = 500): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function MatchmakingView() {
  const { t } = useTranslation();
  const queue = useGameStore((state) => state.queue);
  const proposal = useGameStore((state) => state.proposal);
  const clockOffset = useGameStore((state) => state.clockOffset);
  const now = useNow();
  const [error, setError] = useState<string | null>(null);
  if (!queue) return null;

  const waited = Math.max(0, now - queue.queuedAt);
  const proposalLeft = proposal ? Math.max(0, proposal.expiresAt - (now + clockOffset)) : 0;

  async function vote(accept: boolean): Promise<void> {
    if (!proposal) return;
    try {
      await gameActions.vote(proposal.proposalId, accept);
    } catch (caught) {
      setError(errorMessage(caught instanceof ApiClientError ? caught.code : undefined));
    }
  }

  return (
    <main className="mx-auto w-full max-w-xl space-y-4 p-4 text-center lg:p-8">
      <Panel className="space-y-3">
        <ViewTitle>{t('queue.searching')}</ViewTitle>
        <p className="text-lg text-ink-2" role="status">
          {t('queue.position', { position: queue.position })} ·{' '}
          {t('queue.upTo', { count: queue.targetPlayers })}
        </p>
        <p
          className="tabular font-mono text-5xl font-bold"
          aria-label={t('queue.waitedAria', { time: formatClock(waited) })}
        >
          {formatClock(waited)}
        </p>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <Button variant="secondary" onClick={() => void gameActions.leaveQueue()}>
          {t('common.cancel')}
        </Button>
      </Panel>

      <Modal
        title={t('queue.smallRoomTitle')}
        open={Boolean(proposal)}
        onClose={() => void vote(false)}
        dismissible={!proposal?.voted}
      >
        {proposal ? (
          <div className="space-y-4 text-start">
            <p className="text-ink-2">
              {t('queue.smallRoomBody', {
                count: proposal.playerCount,
                max: Math.max(2, Math.min(3, proposal.playerCount)),
              })}
            </p>
            <p className="tabular font-mono text-3xl font-bold" role="timer" aria-live="off">
              {t('common.seconds', { seconds: formatSeconds(proposalLeft) })}
            </p>
            {proposal.voted ? (
              <p role="status">{t('common.waitingOthers')}</p>
            ) : (
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => void vote(false)}>
                  {t('queue.keepWaiting')}
                </Button>
                <Button onClick={() => void vote(true)}>{t('queue.startSmall')}</Button>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </main>
  );
}
