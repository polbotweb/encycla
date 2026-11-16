import type { PublicPlayer } from '../../../shared/types';
import { truncate } from '../../lib/format';
import { Avatar } from './Avatar';

/**
 * Live ranking by score. This is a display ordering only; the authoritative final ranking
 * always comes from the server (`finalRanking`).
 */
export function TopList({
  players,
  youId,
  limit = 5,
  title = 'Top players',
}: {
  players: PublicPlayer[];
  youId?: string | null;
  limit?: number;
  title?: string;
}) {
  const sorted = [...players].sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt);
  const shown = sorted.slice(0, limit);
  const you = youId ? sorted.findIndex((player) => player.id === youId) : -1;
  const rows = shown.map((player, index) => ({ player, rank: index + 1 }));
  if (you >= limit) {
    rows.push({ player: sorted[you] as PublicPlayer, rank: you + 1 });
  }
  return (
    <section aria-label={title}>
      <h3 className="label mb-2">{title}</h3>
      <ol className="space-y-1">
        {rows.map(({ player, rank }) => (
          <li
            key={player.id}
            className={`flex items-center gap-2 rounded-md px-2 py-1 ${player.id === youId ? 'bg-raised font-semibold' : ''}`}
          >
            <span className="tabular w-6 text-right text-ink-2">{rank}.</span>
            <Avatar emoji={player.avatar} size={24} />
            <span className="min-w-0 flex-1 truncate">{truncate(player.displayName)}</span>
            <span className="tabular font-mono">{player.score}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
