import { useEffect, useState } from 'react';
import { Panel, ViewTitle } from '../components/game/Shell';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { errorMessage } from '../i18n/en';
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
        <ViewTitle>Searching for players…</ViewTitle>
        <p className="text-lg text-ink-2" role="status">
          Position {queue.position} · up to {queue.targetPlayers} players
        </p>
        <p className="tabular font-mono text-5xl font-bold" aria-label={`Waiting for ${formatClock(waited)}`}>
          {formatClock(waited)}
        </p>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <Button variant="secondary" onClick={() => void gameActions.leaveQueue()}>
          Cancel
        </Button>
      </Panel>

      <Modal title="A smaller room is ready" open={Boolean(proposal)} onClose={() => void vote(false)} dismissible={!proposal?.voted}>
        {proposal ? (
          <div className="space-y-4 text-left">
            <p className="text-ink-2">
              {proposal.playerCount} players are waiting. Start now with 2-{Math.max(2, Math.min(3, proposal.playerCount))} players?
            </p>
            <p className="tabular font-mono text-3xl font-bold" role="timer" aria-live="off">
              {formatSeconds(proposalLeft)}s
            </p>
            {proposal.voted ? (
              <p role="status">Waiting for other players…</p>
            ) : (
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => void vote(false)}>
                  Keep waiting
                </Button>
                <Button onClick={() => void vote(true)}>Start with 2-3</Button>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </main>
  );
}
