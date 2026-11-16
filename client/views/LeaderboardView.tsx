import { useEffect, useState } from 'react';
import type { GameMode } from '../../shared/types';
import { Panel, ViewTitle } from '../components/game/Shell';
import { Avatar } from '../components/ui/Avatar';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { errorMessage, labelFor, translate, useTranslation } from '../i18n';
import { ApiClientError, api, type LeaderboardEntryView } from '../lib/api';
import { truncate } from '../lib/format';
import { useSessionStore } from '../store/sessionStore';
import { useUiStore } from '../store/uiStore';

const MODES: (GameMode | 'ALL')[] = ['ALL', 'CLASSIC', 'SUBJECT', 'CONTEST'];
type Source = 'all' | 'web' | 'tiktok';

export function LeaderboardView() {
  const { t, language } = useTranslation();
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
              ? errorMessage('PERSISTENCE_DISABLED', language)
              : translate('leaderboard.unavailable', undefined, language),
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mode, source, limit, attempt, language]);

  return (
    <main className="mx-auto w-full max-w-shell space-y-4 p-4 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ViewTitle>{t('leaderboard.title')}</ViewTitle>
        <Button variant="secondary" onClick={() => setScreen('home')}>
          {t('common.backHome')}
        </Button>
      </div>

      <Panel className="flex flex-wrap gap-4">
        <div>
          <label htmlFor="lb-mode" className="label mb-1 block">
            {t('leaderboard.mode')}
          </label>
          <select
            id="lb-mode"
            value={mode}
            onChange={(event) => setMode(event.target.value as GameMode | 'ALL')}
            className="min-h-[44px] rounded-md border border-line-strong bg-bg px-3 text-ink"
          >
            {MODES.map((value) => (
              <option key={value} value={value}>
                {value === 'ALL' ? t('leaderboard.all') : labelFor('mode', value)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="lb-source" className="label mb-1 block">
            {t('leaderboard.source')}
          </label>
          <select
            id="lb-source"
            value={source}
            onChange={(event) => setSource(event.target.value as Source)}
            className="min-h-[44px] rounded-md border border-line-strong bg-bg px-3 text-ink"
          >
            <option value="all">{t('leaderboard.all')}</option>
            <option value="web">{t('leaderboard.web')}</option>
            <option value="tiktok">{t('leaderboard.tiktok')}</option>
          </select>
        </div>
      </Panel>

      {error ? (
        <Banner
          variant="error"
          action={
            <Button size="sm" variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
              {t('common.retry')}
            </Button>
          }
        >
          {error}
        </Banner>
      ) : null}

      <Panel className="overflow-x-auto">
        {entries === null && !error ? (
          <p className="text-ink-2" role="status">
            {t('common.loading')}
          </p>
        ) : null}
        {entries !== null && entries.length === 0 ? (
          <p className="text-ink-2">{t('leaderboard.empty')}</p>
        ) : null}
        {entries !== null && entries.length > 0 ? (
          <table className="w-full min-w-[32rem] text-start">
            <caption className="sr-only">{t('leaderboard.title')}</caption>
            <thead>
              <tr className="label border-b border-line">
                <th scope="col" className="py-2 pe-2">
                  {t('results.rank')}
                </th>
                <th scope="col" className="py-2 pe-2">
                  {t('results.player')}
                </th>
                <th scope="col" className="py-2 pe-2 text-end">
                  {t('leaderboard.points')}
                </th>
                <th scope="col" className="py-2 pe-2 text-end">
                  {t('leaderboard.matches')}
                </th>
                <th scope="col" className="py-2 pe-2 text-end">
                  {t('leaderboard.best')}
                </th>
                <th scope="col" className="py-2 text-end">
                  {t('leaderboard.correct')}
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.playerId}
                  className={`border-b border-line/60 ${entry.playerId === playerId ? 'bg-raised font-semibold' : ''}`}
                >
                  <td className="tabular py-2 pe-2">{entry.rank}</td>
                  <td className="py-2 pe-2">
                    <span className="flex items-center gap-2">
                      <Avatar emoji={entry.avatar} size={24} />
                      <bdi>{truncate(entry.pseudo)}</bdi>
                    </span>
                  </td>
                  <td className="tabular py-2 pe-2 text-end font-mono">{entry.totalPoints}</td>
                  <td className="tabular py-2 pe-2 text-end font-mono">{entry.matches}</td>
                  <td className="tabular py-2 pe-2 text-end font-mono">{entry.bestMatchPoints}</td>
                  <td className="tabular py-2 text-end font-mono">{entry.correctCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {entries !== null && entries.length >= limit && limit < 100 ? (
          <div className="mt-4">
            <Button variant="secondary" onClick={() => setLimit(100)}>
              {t('leaderboard.loadMore')}
            </Button>
          </div>
        ) : null}
      </Panel>
    </main>
  );
}
