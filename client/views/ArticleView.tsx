import { useEffect, useRef, useState } from 'react';
import { ArticleBody } from '../components/ui/ArticleBody';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { ImageCredit, ImageFrame } from '../components/ui/ImageFrame';
import { LeaveButton } from '../components/game/LeaveControls';
import { errorMessage, languageName, useTranslation } from '../i18n';
import { ApiClientError } from '../lib/api';
import { formatSeconds } from '../lib/format';
import { gameActions } from '../lib/realtime';
import { useMe } from '../lib/useMe';
import { useRemaining } from '../lib/useRemaining';
import { useGameStore } from '../store/gameStore';

export function ArticleView() {
  const { t } = useTranslation();
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
      if (
        target instanceof HTMLElement &&
        ['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      )
        return;
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
          {t('article.title')}
          {remaining === null
            ? ''
            : ` · ${t('article.remaining', { seconds: formatSeconds(remaining) })}`}
        </p>
        <LeaveButton />
      </div>
      <div className="grid gap-6 md:grid-cols-[2fr_3fr]">
        <div className="space-y-2">
          <ImageFrame image={reveal.image} language={room.language} className="h-56 md:h-80" />
          <ImageCredit image={reveal.image} language={room.language} />
        </div>
        <div className="max-h-[60dvh] overflow-y-auto pe-2">
          <ArticleBody
            ref={articleRef}
            title={reveal.articleTitle}
            body={reveal.articleBody}
            language={reveal.textLanguage}
          />
          {reveal.textLanguage !== room.language ? (
            <p className="mt-3 text-sm text-ink-2" data-testid="article-fallback-notice">
              {t('article.fallbackNotice', {
                language: languageName(reveal.textLanguage, room.language),
              })}
            </p>
          ) : null}
          {reveal.articleUrl ? (
            <p className="mt-2 text-sm">
              <a
                href={reveal.articleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
                hrefLang={reveal.textLanguage}
              >
                {t('article.readOnWikipedia', {
                  language: languageName(reveal.textLanguage, room.language),
                })}
              </a>
            </p>
          ) : null}
        </div>
      </div>
      {error ? <Banner variant="error">{error}</Banner> : null}
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        {room.isTikTok ? (
          <p className="text-ink-2" role="status">
            {t('article.autoContinue', {
              seconds: remaining === null ? 8 : formatSeconds(remaining),
            })}
          </p>
        ) : (
          <>
            <Button
              size="lg"
              disabled={!canContinue || waiting}
              onClick={() => phaseToken && void send(phaseToken)}
            >
              {waiting ? t('common.waitingOthers') : t('common.continue')}
            </Button>
            <span className="text-sm text-ink-2">
              {t('article.connected', { count: connectedPlayers })}
            </span>
          </>
        )}
        {canSkip ? (
          <Button
            variant="secondary"
            onClick={() => void gameActions.skip().catch(() => undefined)}
          >
            {t('common.skipForEveryone')}
          </Button>
        ) : null}
      </div>
    </main>
  );
}
