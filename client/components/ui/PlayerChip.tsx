import type { PublicPlayer } from '../../../shared/types';
import { useTranslation, type TranslateFn } from '../../i18n';
import { truncate } from '../../lib/format';
import { Avatar } from './Avatar';

function badge(t: TranslateFn, player: PublicPlayer, you: boolean): string[] {
  const badges: string[] = [];
  if (you) badges.push(t('player.you'));
  if (player.isHost) badges.push(t('player.host'));
  if (player.status === 'ELIMINATED') badges.push(t('player.eliminated'));
  if (player.status === 'FORFEITED' || player.status === 'LEFT') badges.push(t('player.forfeited'));
  if (player.status === 'DISCONNECTED') badges.push(t('player.reconnecting'));
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
  const { t } = useTranslation();
  const badges = badge(t, player, you);
  const dim =
    player.status === 'DISCONNECTED' || player.status === 'FORFEITED' || player.status === 'LEFT';
  const ready = showReady ? t(player.isReady ? 'player.ready' : 'player.notReady') : null;
  const label = [player.displayName, ...badges, ready].filter(Boolean).join(', ');
  return (
    <li
      aria-label={label}
      className={`flex min-h-[44px] items-center gap-3 rounded-md border border-line bg-surface px-3 py-2 ${dim ? 'opacity-60' : ''}`}
    >
      <Avatar emoji={player.avatar} />
      <bdi className="min-w-0 flex-1 truncate font-medium">{truncate(player.displayName)}</bdi>
      {badges.map((text) => (
        <span
          key={text}
          className="rounded-pill border border-line-strong px-2 py-0.5 text-xs font-semibold uppercase tracking-wider rtl:normal-case rtl:tracking-normal text-ink-2"
        >
          {text}
        </span>
      ))}
      {ready ? (
        <span
          className={`rounded-pill px-2 py-0.5 text-xs font-semibold uppercase tracking-wider rtl:normal-case rtl:tracking-normal ${
            player.isReady ? 'bg-success text-on-accent' : 'border border-line-strong text-ink-2'
          }`}
        >
          {ready}
        </span>
      ) : null}
    </li>
  );
}
