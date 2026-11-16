import type { PublicPlayer } from '../../../shared/types';
import { truncate } from '../../lib/format';
import { Avatar } from './Avatar';

function badge(player: PublicPlayer, you: boolean): string[] {
  const badges: string[] = [];
  if (you) badges.push('You');
  if (player.isHost) badges.push('Host');
  if (player.status === 'ELIMINATED') badges.push('Eliminated');
  if (player.status === 'FORFEITED' || player.status === 'LEFT') badges.push('Forfeited');
  if (player.status === 'DISCONNECTED') badges.push('Reconnecting…');
  return badges;
}

export function PlayerChip({
  player,
  you = false,
  showReady = false,
}: {
  player: PublicPlayer;
  you?: boolean;
  showReady?: boolean;
}) {
  const badges = badge(player, you);
  const dim =
    player.status === 'DISCONNECTED' || player.status === 'FORFEITED' || player.status === 'LEFT';
  const ready = showReady ? (player.isReady ? 'Ready' : 'Not ready') : null;
  const label = [player.displayName, ...badges, ready].filter(Boolean).join(', ');
  return (
    <li
      aria-label={label}
      className={`flex min-h-[44px] items-center gap-3 rounded-md border border-line bg-surface px-3 py-2 ${dim ? 'opacity-60' : ''}`}
    >
      <Avatar emoji={player.avatar} />
      <span className="min-w-0 flex-1 truncate font-medium">{truncate(player.displayName)}</span>
      {badges.map((text) => (
        <span
          key={text}
          className="rounded-pill border border-line-strong px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-ink-2"
        >
          {text}
        </span>
      ))}
      {ready ? (
        <span
          className={`rounded-pill px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${
            player.isReady ? 'bg-success text-on-accent' : 'border border-line-strong text-ink-2'
          }`}
        >
          {ready}
        </span>
      ) : null}
    </li>
  );
}
