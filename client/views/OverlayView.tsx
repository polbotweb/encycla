import { useEffect } from 'react';
import type { PublicRoomState } from '../../shared/types';
import { Avatar } from '../components/ui/Avatar';
import { CheckIcon } from '../components/ui/Icons';
import { ImageFrame } from '../components/ui/ImageFrame';
import { Logo } from '../components/ui/Logo';
import { Term, TextWithTerm } from '../components/ui/Term';
import { contentAttributes, translate, useTranslation } from '../i18n';
import { OPTION_LETTERS, formatSeconds, truncate } from '../lib/format';
import { useRemaining } from '../lib/useRemaining';
import { useRoomFeed } from '../lib/useRoomFeed';

function OverlayPanel({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  // Opaque (92%) panels with a safe fallback background: never transparent text on video.
  return (
    <section className={`rounded-lg border border-ink/10 bg-bg/90 p-6 ${className}`}>
      {children}
    </section>
  );
}

function Leaders({ room, limit }: { room: PublicRoomState; limit: number }) {
  const { t } = useTranslation();
  const rows = [...room.players]
    .sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt)
    .slice(0, limit);
  return (
    <OverlayPanel>
      <h2 className="label mb-3 text-lg">{t('overlay.top', { count: limit })}</h2>
      {rows.length === 0 ? (
        <p className="text-xl text-ink-2">{t('overlay.waitingFirst')}</p>
      ) : (
        <ol className="space-y-2 text-2xl">
          {rows.map((player, index) => (
            <li key={player.id} className="flex items-center gap-3">
              <span className="tabular w-8 text-end text-ink-2">{index + 1}.</span>
              <Avatar emoji={player.avatar} size={32} />
              <bdi className="min-w-0 flex-1 truncate">{truncate(player.displayName)}</bdi>
              <span className="tabular font-mono font-bold">{player.score}</span>
            </li>
          ))}
        </ol>
      )}
    </OverlayPanel>
  );
}

export function overlayEndTitle(room: PublicRoomState): string {
  if (!room.finalRanking || room.finalRanking.length === 0) return translate('results.noWinner');
  if (room.winnerId === null) return translate('results.draw');
  const winner = room.players.find((player) => player.id === room.winnerId);
  return translate('results.wins', { name: winner?.displayName ?? translate('common.unknown') });
}

export function OverlayView({ roomCode, token }: { roomCode: string; token: string }) {
  const { t } = useTranslation();
  const { room, status, clockOffset } = useRoomFeed('overlay', roomCode, token);
  const remaining = useRemaining(room, clockOffset);

  useEffect(() => {
    document.body.classList.add('overlay-root');
    return () => document.body.classList.remove('overlay-root');
  }, []);

  if (status === 'unavailable') {
    return (
      <main className="flex min-h-dvh items-center justify-center p-12">
        <OverlayPanel>
          <p className="text-3xl">{t('overlay.unavailable')}</p>
        </OverlayPanel>
      </main>
    );
  }
  if (status === 'ended') {
    return (
      <main className="flex min-h-dvh items-center justify-center p-12">
        <OverlayPanel>
          <p className="text-3xl">{t('overlay.ended')}</p>
        </OverlayPanel>
      </main>
    );
  }
  if (!room) {
    return <main className="min-h-dvh p-12" aria-busy="true" />;
  }

  const phase = room.phase === 'PAUSED' ? room.pausedFrom : room.phase;
  const full = room.players.length >= room.settings.maxPlayers;

  return (
    <main className="min-h-dvh space-y-6 p-12" aria-live="off">
      <div className="flex flex-wrap items-center gap-4">
        <span className="inline-flex items-center gap-3 rounded-pill bg-bg/90 py-1 pe-4 ps-2 text-ink">
          <Logo height={44} tagline={false} />
          <span className="font-serif text-2xl font-bold">{t('overlay.live')}</span>
          <span className="sr-only">{t('overlay.title')}</span>
        </span>
        <span
          dir="ltr"
          className="rounded-pill border border-ink/20 bg-bg/90 px-4 py-1 font-mono text-xl tracking-[0.15em]"
        >
          {room.roomCode}
        </span>
        {room.phase === 'PAUSED' ? (
          <span className="rounded-pill bg-warning px-3 py-1 text-sm font-bold text-on-accent">
            {t('overlay.paused')}
          </span>
        ) : null}
        {!room.tiktokConnected ? (
          <span className="rounded-pill bg-warning px-3 py-1 text-sm font-bold text-on-accent">
            {t('overlay.chatReconnecting')}
          </span>
        ) : null}
        {full ? <span className="text-lg text-ink-2">{t('overlay.chatFull')}</span> : null}
      </div>

      {phase === 'LOBBY' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <OverlayPanel>
            <p className="text-4xl font-bold">{t('overlay.join')}</p>
            <p className="mt-3 text-2xl text-ink-2">{t('overlay.soon')}</p>
          </OverlayPanel>
          <Leaders room={room} limit={5} />
        </div>
      ) : null}

      {phase === 'COUNTDOWN' ? (
        <OverlayPanel className="text-center">
          <p className="tabular font-mono text-[12rem] leading-none text-accent">
            {formatSeconds(remaining ?? 3000)}
          </p>
          <p className="text-3xl">{t('countdown.getReady')}</p>
        </OverlayPanel>
      ) : null}

      {phase === 'QUESTION' && room.question ? (
        <div className="grid gap-6 lg:grid-cols-[55fr_45fr]">
          <ImageFrame image={room.question.image} language={room.language} className="h-[26rem]" />
          <div className="space-y-4">
            <OverlayPanel className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <h1 className="text-4xl" {...contentAttributes(room.language)}>
                  {room.question.questionText}
                </h1>
                <span
                  className="tabular font-mono text-[4.5rem] font-bold leading-none text-accent"
                  role="timer"
                >
                  {remaining === null ? '' : formatSeconds(remaining)}
                </span>
              </div>
              <ol className="grid gap-3">
                {room.question.options.map((option, index) => (
                  <li
                    key={index}
                    className="flex items-center gap-4 rounded-md border border-line bg-surface px-4 py-3 text-3xl"
                  >
                    <span
                      dir="ltr"
                      className="flex h-12 w-12 items-center justify-center rounded-sm bg-accent text-2xl font-bold text-on-accent"
                    >
                      {OPTION_LETTERS[index]}
                    </span>
                    <span {...contentAttributes(room.language)}>
                      <Term text={option} form={room.question?.optionForms?.[index]} />
                    </span>
                  </li>
                ))}
              </ol>
            </OverlayPanel>
          </div>
          <div className="lg:col-span-2">
            <Leaders room={room} limit={10} />
          </div>
        </div>
      ) : null}

      {phase === 'REVEAL' && room.reveal ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <OverlayPanel className="space-y-4">
            <h1 className="text-4xl" {...contentAttributes(room.language)}>
              {room.reveal.questionText}
            </h1>
            <ol className="grid gap-3">
              {room.reveal.options.map((option, index) => {
                const correct = index === room.reveal?.correctIndex;
                return (
                  <li
                    key={index}
                    className={`flex items-center gap-4 rounded-md border px-4 py-3 text-3xl ${
                      correct
                        ? 'border-success bg-success text-on-accent'
                        : 'border-line bg-surface text-ink-2 opacity-70'
                    }`}
                  >
                    <span dir="ltr" className="font-bold">
                      {OPTION_LETTERS[index]}
                    </span>
                    <span className="flex-1" {...contentAttributes(room.language)}>
                      <Term text={option} form={room.reveal?.optionForms?.[index]} />
                    </span>
                    {correct ? <CheckIcon width={32} height={32} /> : null}
                  </li>
                );
              })}
            </ol>
            <p className="line-clamp-2 text-2xl text-ink-2" {...contentAttributes(room.language)}>
              <TextWithTerm
                text={room.reveal.explanation}
                term={room.reveal.subject}
                form={room.reveal.subjectForm}
              />
            </p>
          </OverlayPanel>
          <Leaders room={room} limit={10} />
        </div>
      ) : null}

      {phase === 'ARTICLE' && room.reveal ? (
        <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
          <ImageFrame image={room.reveal.image} language={room.language} className="h-[22rem]" />
          <OverlayPanel className="space-y-3">
            <h1 className="text-4xl" {...contentAttributes(room.reveal.textLanguage)}>
              {room.reveal.articleTitle}
            </h1>
            <p
              className="line-clamp-3 text-2xl text-ink-2"
              {...contentAttributes(room.reveal.textLanguage)}
            >
              {room.reveal.articleBody}
            </p>
            <p className="inline-block rounded-pill border border-ink/20 px-4 py-1 text-xl">
              {t('overlay.nextQuestion', { seconds: formatSeconds(remaining ?? 8000) })}
            </p>
          </OverlayPanel>
        </div>
      ) : null}

      {phase === 'LEVEL_COMPLETE' ? (
        <OverlayPanel className="text-center">
          <p className="text-5xl font-bold">{t('overlay.levelComplete', { level: room.level })}</p>
          <p className="mt-2 text-2xl text-ink-2">
            {t('level.next', { seconds: formatSeconds(remaining ?? 0) })}
          </p>
        </OverlayPanel>
      ) : null}

      {phase === 'MATCH_OVER' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <OverlayPanel className="space-y-3">
            <p className="text-5xl font-bold">{overlayEndTitle(room)}</p>
            <p className="text-3xl text-ink-2">{t('overlay.thanks')}</p>
          </OverlayPanel>
          <Leaders room={room} limit={10} />
        </div>
      ) : null}
    </main>
  );
}
