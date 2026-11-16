import { useEffect, useRef, useState } from 'react';
import { ArticleBody } from '../components/ui/ArticleBody';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { ImageCredit, ImageFrame } from '../components/ui/ImageFrame';
import { LeaveButton } from '../components/game/LeaveControls';
import { errorMessage, t } from '../i18n/en';
import { ApiClientError } from '../lib/api';
import { formatSeconds } from '../lib/format';
import { gameActions } from '../lib/realtime';
import { useMe } from '../lib/useMe';
import { useRemaining } from '../lib/useRemaining';
import { useGameStore } from '../store/gameStore';

export function ArticleView() {
  const { room, me, canSkip, paused } = useMe();
  const clockOffset = useGameStore((state) => state.clockOffset);
  const remaining = useRemaining(room, clockOffset);
  const [continuedToken, setContinuedToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const articleRef = useRef<HTMLElement>(null);

  const phaseToken = room?.phaseToken ?? null;
  useEffect(() => {
    articleRef.current?.focus({ preventScroll: true });
  }, [phaseToken]);

  const canContinue = Boolean(
    room && me && me.status === 'CONNECTED' && !room.isTikTok && !paused && phaseToken,
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Enter' || event.repeat) return;
      const target = event.target;
      if (target instanceof HTMLElement && ['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (canContinue && phaseToken && continuedToken !== phaseToken) {
        void send(phaseToken);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canContinue, phaseToken, continuedToken]);

  async function send(token: string): Promise<void> {
    setError(null);
    setContinuedToken(token);
    try {
      await gameActions.continueArticle(token);
    } catch (caught) {
      const code = caught instanceof ApiClientError ? caught.code : undefined;
      if (code !== 'STALE_PHASE_TOKEN') {
        setContinuedToken(null);
        setError(errorMessage(code));
      }
    }
  }

  const reveal = room?.reveal ?? null;
  if (!room || !reveal) return null;
  const waiting = continuedToken !== null && continuedToken === phaseToken;
  const connectedPlayers = room.players.filter((player) => player.status === 'CONNECTED').length;

  return (
    <main className="mx-auto w-full max-w-shell space-y-4 p-4 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="label" aria-live="polite">
          {t.article} · {remaining === null ? '' : `${formatSeconds(remaining)} s remaining`}
        </p>
        <LeaveButton />
      </div>
      <div className="grid gap-6 md:grid-cols-[2fr_3fr]">
        <div className="space-y-2">
          <ImageFrame image={reveal.image} className="h-56 md:h-80" />
          <ImageCredit image={reveal.image} />
        </div>
        <div className="max-h-[60dvh] overflow-y-auto pr-2">
          <ArticleBody ref={articleRef} title={reveal.articleTitle} body={reveal.articleBody} />
        </div>
      </div>
      {error ? <Banner variant="error">{error}</Banner> : null}
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        {room.isTikTok ? (
          <p className="text-ink-2" role="status">
            Auto-continue in {remaining === null ? 8 : formatSeconds(remaining)}s
          </p>
        ) : (
          <>
            <Button size="lg" disabled={!canContinue || waiting} onClick={() => phaseToken && void send(phaseToken)}>
              {waiting ? 'Waiting for other players…' : t.continue}
            </Button>
            <span className="text-sm text-ink-2">{connectedPlayers} connected</span>
          </>
        )}
        {canSkip ? (
          <Button variant="secondary" onClick={() => void gameActions.skip().catch(() => undefined)}>
            Skip for everyone
          </Button>
        ) : null}
      </div>
    </main>
  );
}
