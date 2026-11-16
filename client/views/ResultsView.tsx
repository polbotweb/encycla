import { useState } from 'react';
import type { PublicPlayer, PublicRoomState } from '../../shared/types';
import { Panel, ViewTitle } from '../components/game/Shell';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { translate, useTranslation } from '../i18n';
import { formatResponseTime, truncate } from '../lib/format';
import { gameActions } from '../lib/realtime';
import { useMe } from '../lib/useMe';
import { useUiStore } from '../store/uiStore';

export interface ResultRow {
  rank: number;
  tied: boolean;
  player: PublicPlayer;
}

/** Rows come from the server `finalRanking`; the client never re-ranks (ADR-005). */
export function buildResultRows(room: PublicRoomState): ResultRow[] {
  const byId = new Map(room.players.map((player) => [player.id, player]));
  return (room.finalRanking ?? []).flatMap((entry) => {
    const player = byId.get(entry.playerId);
    return player ? [{ rank: entry.rank, tied: entry.tied, player }] : [];
  });
}

export function resultTitle(room: PublicRoomState): { title: string; subtitle: string } {
  const ranking = room.finalRanking ?? [];
  if (ranking.length === 0) {
    return { title: translate('results.matchAbandoned'), subtitle: translate('results.noWinner') };
  }
  if (room.winnerId === null) {
    return { title: translate('results.matchComplete'), subtitle: translate('results.draw') };
  }
  const winner = room.players.find((player) => player.id === room.winnerId);
  return {
    title: translate('results.matchComplete'),
    subtitle: translate('results.wins', {
      name: winner?.displayName ?? translate('common.unknown'),
    }),
  };
}

function statusLabel(player: PublicPlayer): string | null {
  if (player.status === 'ELIMINATED') return translate('player.eliminated');
  if (player.status === 'FORFEITED' || player.status === 'LEFT')
    return translate('player.forfeited');
  return null;
}

export function ResultsView() {
  const { t } = useTranslation();
  const { room, playerId } = useMe();
  const setScreen = useUiStore((state) => state.setScreen);
  const [busy, setBusy] = useState(false);
  if (!room) return null;

  const rows = buildResultRows(room);
  const { title, subtitle } = resultTitle(room);
  const podium = rows.filter((row) => row.rank <= 3).slice(0, 3);

  async function leave(toLeaderboard: boolean): Promise<void> {
    setBusy(true);
    try {
      await gameActions.leaveRoom();
    } catch {
      /* local state is cleared regardless */
    } finally {
      setBusy(false);
      setScreen(toLeaderboard ? 'leaderboard' : 'home');
    }
  }

  return (
    <main className="anim-fade mx-auto w-full max-w-shell space-y-6 p-4 lg:p-8">
      <Panel className="space-y-2 text-center">
        <div aria-live="polite">
          <ViewTitle>{title}</ViewTitle>
        </div>
        <p className="text-xl text-ink-2">{subtitle}</p>
        {podium.length > 0 ? (
          <ol className="mt-4 flex items-end justify-center gap-4" aria-label={t('results.podium')}>
            {podium.map((row) => (
              <li key={row.player.id} className="flex w-28 flex-col items-center gap-1">
                <Avatar emoji={row.player.avatar} size={64} />
                <bdi className="max-w-full truncate font-semibold">
                  {truncate(row.player.displayName, 14)}
                </bdi>
                <span className="tabular font-mono text-ink-2">{row.player.score}</span>
                <span className="rounded-md border border-line-strong px-3 py-1 text-lg font-bold">
                  #{row.rank}
                </span>
              </li>
            ))}
          </ol>
        ) : null}
      </Panel>

      {rows.length > 0 ? (
        <Panel className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-start">
            <caption className="sr-only">{t('results.finalRanking')}</caption>
            <thead>
              <tr className="label border-b border-line">
                <th scope="col" className="py-2 pe-2">
                  {t('results.rank')}
                </th>
                <th scope="col" className="py-2 pe-2">
                  {t('results.player')}
                </th>
                <th scope="col" className="py-2 pe-2 text-end">
                  {t('results.score')}
                </th>
                <th scope="col" className="py-2 pe-2 text-end">
                  {t('results.correct')}
                </th>
                <th scope="col" className="py-2 pe-2 text-end">
                  {t('results.errors')}
                </th>
                <th scope="col" className="py-2 text-end">
                  {t('results.time')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const status = statusLabel(row.player);
                return (
                  <tr
                    key={row.player.id}
                    className={`border-b border-line/60 ${row.player.id === playerId ? 'bg-raised font-semibold' : ''}`}
                  >
                    <td className="tabular py-2 pe-2">
                      {row.rank}
                      {row.tied ? <span className="sr-only"> {t('results.tied')}</span> : null}
                      {row.tied ? <span aria-hidden="true">=</span> : null}
                    </td>
                    <td className="py-2 pe-2">
                      <span className="flex items-center gap-2">
                        <Avatar emoji={row.player.avatar} size={24} />
                        <bdi>{truncate(row.player.displayName)}</bdi>
                        {status ? <span className="text-sm text-ink-2">{status}</span> : null}
                      </span>
                    </td>
                    <td className="tabular py-2 pe-2 text-end font-mono">{row.player.score}</td>
                    <td className="tabular py-2 pe-2 text-end font-mono">
                      {row.player.correctCount}
                    </td>
                    <td className="tabular py-2 pe-2 text-end font-mono">
                      {row.player.wrongCount + row.player.timeoutCount}
                    </td>
                    <td className="tabular py-2 text-end font-mono">
                      {formatResponseTime(row.player.totalResponseMs)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      ) : null}

      <div className="flex flex-wrap justify-center gap-3">
        <Button size="lg" loading={busy} onClick={() => void leave(false)}>
          {t('common.backHome')}
        </Button>
        <Button size="lg" variant="secondary" disabled={busy} onClick={() => void leave(true)}>
          {t('home.leaderboard')}
        </Button>
      </div>
    </main>
  );
}
