import { useEffect, useState } from 'react';
import type { GameMode } from '../../shared/types';
import { Panel, ViewTitle } from '../components/game/Shell';
import { Avatar } from '../components/ui/Avatar';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { errorMessage, t } from '../i18n/en';
import { ApiClientError, api, type LeaderboardEntryView } from '../lib/api';
import { truncate } from '../lib/format';
import { useSessionStore } from '../store/sessionStore';
import { useUiStore } from '../store/uiStore';

const MODES: (GameMode | 'ALL')[] = ['ALL', 'CLASSIC', 'SUBJECT', 'CONTEST'];
type Source = 'all' | 'web' | 'tiktok';

export function LeaderboardView() {
  const setScreen = useUiStore((state) => state.setScreen);
  const playerId = useSessionStore((state) => state.session?.playerId ?? null);
  const [mode, setMode] = useState<GameMode | 'ALL'>('ALL');
  const [source, setSource] = useState<Source>('all');
  const [limit, setLimit] = useState(50);
  const [entries, setEntries] = useState<LeaderboardEntryView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    setError(null);
    api
      .leaderboard({
        mode: mode === 'ALL' ? undefined : mode,
        source: source === 'all' ? undefined : source,
        limit,
      })
      .then((response) => {
        if (!cancelled) setEntries(response.entries);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(
            caught instanceof ApiClientError && caught.code === 'PERSISTENCE_DISABLED'
              ? errorMessage('PERSISTENCE_DISABLED')
              : 'Leaderboard unavailable.',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mode, source, limit, attempt]);

  return (
    <main className="mx-auto w-full max-w-shell space-y-4 p-4 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ViewTitle>{t.leaderboard}</ViewTitle>
        <Button variant="secondary" onClick={() => setScreen('home')}>
          {t.backHome}
        </Button>
      </div>

      <Panel className="flex flex-wrap gap-4">
        <div>
          <label htmlFor="lb-mode" className="label mb-1 block">Mode</label>
          <select
            id="lb-mode"
            value={mode}
            onChange={(event) => setMode(event.target.value as GameMode | 'ALL')}
            className="min-h-[44px] rounded-md border border-line-strong bg-bg px-3 text-ink"
          >
            {MODES.map((value) => (
              <option key={value} value={value}>
                {value === 'ALL' ? 'All' : value}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="lb-source" className="label mb-1 block">Source</label>
          <select
            id="lb-source"
            value={source}
            onChange={(event) => setSource(event.target.value as Source)}
            className="min-h-[44px] rounded-md border border-line-strong bg-bg px-3 text-ink"
          >
            <option value="all">All</option>
            <option value="web">Web</option>
            <option value="tiktok">TikTok</option>
          </select>
        </div>
      </Panel>

      {error ? (
        <Banner variant="error" action={<Button size="sm" variant="secondary" onClick={() => setAttempt((n) => n + 1)}>{t.retry}</Button>}>
          {error}
        </Banner>
      ) : null}

      <Panel className="overflow-x-auto">
        {entries === null && !error ? (
          <p className="text-ink-2" role="status">Loading…</p>
        ) : null}
        {entries !== null && entries.length === 0 ? (
          <p className="text-ink-2">No matches yet. Be the first.</p>
        ) : null}
        {entries !== null && entries.length > 0 ? (
          <table className="w-full min-w-[32rem] text-left">
            <caption className="sr-only">Leaderboard</caption>
            <thead>
              <tr className="label border-b border-line">
                <th scope="col" className="py-2 pr-2">Rank</th>
                <th scope="col" className="py-2 pr-2">Player</th>
                <th scope="col" className="py-2 pr-2 text-right">Points</th>
                <th scope="col" className="py-2 pr-2 text-right">Matches</th>
                <th scope="col" className="py-2 pr-2 text-right">Best</th>
                <th scope="col" className="py-2 text-right">Correct</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.playerId} className={`border-b border-line/60 ${entry.playerId === playerId ? 'bg-raised font-semibold' : ''}`}>
                  <td className="tabular py-2 pr-2">{entry.rank}</td>
                  <td className="py-2 pr-2">
                    <span className="flex items-center gap-2">
                      <Avatar emoji={entry.avatar} size={24} />
                      {truncate(entry.pseudo)}
                    </span>
                  </td>
                  <td className="tabular py-2 pr-2 text-right font-mono">{entry.totalPoints}</td>
                  <td className="tabular py-2 pr-2 text-right font-mono">{entry.matches}</td>
                  <td className="tabular py-2 pr-2 text-right font-mono">{entry.bestMatchPoints}</td>
                  <td className="tabular py-2 text-right font-mono">{entry.correctCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {entries !== null && entries.length >= limit && limit < 100 ? (
          <div className="mt-4">
            <Button variant="secondary" onClick={() => setLimit(100)}>
              Load more
            </Button>
          </div>
        ) : null}
      </Panel>
    </main>
  );
}
