import { useEffect } from 'react';
import type { PublicRoomState } from '../../shared/types';
import { Avatar } from '../components/ui/Avatar';
import { CheckIcon } from '../components/ui/Icons';
import { ImageFrame } from '../components/ui/ImageFrame';
import { OPTION_LETTERS, formatSeconds, truncate } from '../lib/format';
import { useRemaining } from '../lib/useRemaining';
import { useRoomFeed } from '../lib/useRoomFeed';

function OverlayPanel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  // Opaque (92%) panels with a safe fallback background: never transparent text on video.
  return <section className={`rounded-lg border border-ink/10 bg-bg/90 p-6 ${className}`}>{children}</section>;
}

function Leaders({ room, limit }: { room: PublicRoomState; limit: number }) {
  const rows = [...room.players].sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt).slice(0, limit);
  return (
    <OverlayPanel>
      <h2 className="label mb-3 text-lg">Top {limit}</h2>
      {rows.length === 0 ? (
        <p className="text-xl text-ink-2">Waiting for the first answers…</p>
      ) : (
        <ol className="space-y-2 text-2xl">
          {rows.map((player, index) => (
            <li key={player.id} className="flex items-center gap-3">
              <span className="tabular w-8 text-right text-ink-2">{index + 1}.</span>
              <Avatar emoji={player.avatar} size={32} />
              <span className="min-w-0 flex-1 truncate">{truncate(player.displayName)}</span>
              <span className="tabular font-mono font-bold">{player.score}</span>
            </li>
          ))}
        </ol>
      )}
    </OverlayPanel>
  );
}

export function overlayEndTitle(room: PublicRoomState): string {
  if (!room.finalRanking || room.finalRanking.length === 0) return 'No winner';
  if (room.winnerId === null) return 'Draw';
  const winner = room.players.find((player) => player.id === room.winnerId);
  return `${winner?.displayName ?? 'Unknown'} wins`;
}

export function OverlayView({ roomCode, token }: { roomCode: string; token: string }) {
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
          <p className="text-3xl">Overlay unavailable</p>
        </OverlayPanel>
      </main>
    );
  }
  if (status === 'ended') {
    return (
      <main className="flex min-h-dvh items-center justify-center p-12">
        <OverlayPanel>
          <p className="text-3xl">Stream ended</p>
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
        <span className="font-serif text-3xl font-bold">ENCYCLA LIVE</span>
        <span className="rounded-pill border border-ink/20 bg-bg/90 px-4 py-1 font-mono text-xl tracking-[0.15em]">
          {room.roomCode}
        </span>
        {room.phase === 'PAUSED' ? (
          <span className="rounded-pill bg-warning px-3 py-1 text-sm font-bold text-on-accent">Paused</span>
        ) : null}
        {!room.tiktokConnected ? (
          <span className="rounded-pill bg-warning px-3 py-1 text-sm font-bold text-on-accent">Chat reconnecting…</span>
        ) : null}
        {full ? <span className="text-lg text-ink-2">Chat is full. New comments are ignored.</span> : null}
      </div>

      {phase === 'LOBBY' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <OverlayPanel>
            <p className="text-4xl font-bold">Comment A, B, C or D to join</p>
            <p className="mt-3 text-2xl text-ink-2">The first match starts soon.</p>
          </OverlayPanel>
          <Leaders room={room} limit={5} />
        </div>
      ) : null}

      {phase === 'COUNTDOWN' ? (
        <OverlayPanel className="text-center">
          <p className="tabular font-mono text-[12rem] leading-none text-accent">{formatSeconds(remaining ?? 3000)}</p>
          <p className="text-3xl">Get ready</p>
        </OverlayPanel>
      ) : null}

      {phase === 'QUESTION' && room.question ? (
        <div className="grid gap-6 lg:grid-cols-[55fr_45fr]">
          <ImageFrame image={room.question.image} className="h-[26rem]" />
          <div className="space-y-4">
            <OverlayPanel className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <h1 className="text-4xl">{room.question.questionText}</h1>
                <span className="tabular font-mono text-[4.5rem] font-bold leading-none text-accent" role="timer">
                  {remaining === null ? '' : formatSeconds(remaining)}
                </span>
              </div>
              <ol className="grid gap-3">
                {room.question.options.map((option, index) => (
                  <li key={index} className="flex items-center gap-4 rounded-md border border-line bg-surface px-4 py-3 text-3xl">
                    <span className="flex h-12 w-12 items-center justify-center rounded-sm bg-accent text-2xl font-bold text-on-accent">
                      {OPTION_LETTERS[index]}
                    </span>
                    {option}
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
            <h1 className="text-4xl">{room.reveal.questionText}</h1>
            <ol className="grid gap-3">
              {room.reveal.options.map((option, index) => {
                const correct = index === room.reveal?.correctIndex;
                return (
                  <li
                    key={index}
                    className={`flex items-center gap-4 rounded-md border px-4 py-3 text-3xl ${
                      correct ? 'border-success bg-success text-on-accent' : 'border-line bg-surface text-ink-2 opacity-70'
                    }`}
                  >
                    <span className="font-bold">{OPTION_LETTERS[index]}</span>
                    <span className="flex-1">{option}</span>
                    {correct ? <CheckIcon width={32} height={32} /> : null}
                  </li>
                );
              })}
            </ol>
            <p className="line-clamp-2 text-2xl text-ink-2">{room.reveal.explanation}</p>
          </OverlayPanel>
          <Leaders room={room} limit={10} />
        </div>
      ) : null}

      {phase === 'ARTICLE' && room.reveal ? (
        <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
          <ImageFrame image={room.reveal.image} className="h-[22rem]" />
          <OverlayPanel className="space-y-3">
            <h1 className="text-4xl">{room.reveal.articleTitle}</h1>
            <p className="line-clamp-3 text-2xl text-ink-2">{room.reveal.articleBody}</p>
            <p className="inline-block rounded-pill border border-ink/20 px-4 py-1 text-xl">
              Next question in {formatSeconds(remaining ?? 8000)}s
            </p>
          </OverlayPanel>
        </div>
      ) : null}

      {phase === 'LEVEL_COMPLETE' ? (
        <OverlayPanel className="text-center">
          <p className="text-5xl font-bold">Level {room.level} complete</p>
          <p className="mt-2 text-2xl text-ink-2">Next level in {formatSeconds(remaining ?? 0)}s</p>
        </OverlayPanel>
      ) : null}

      {phase === 'MATCH_OVER' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <OverlayPanel className="space-y-3">
            <p className="text-5xl font-bold">{overlayEndTitle(room)}</p>
            <p className="text-3xl text-ink-2">Thanks for playing</p>
          </OverlayPanel>
          <Leaders room={room} limit={10} />
        </div>
      ) : null}
    </main>
  );
}
