import { useEffect, useState } from 'react';
import { useTranslation, type MessageKey } from '../../i18n';
import { gameActions } from '../../lib/realtime';
import { useMe } from '../../lib/useMe';
import { useGameStore } from '../../store/gameStore';
import { useSessionStore } from '../../store/sessionStore';
import { Banner } from '../ui/Banner';
import { Button } from '../ui/Button';

export function ConnectionBanner() {
  const { t } = useTranslation();
  const connection = useGameStore((state) => state.connection);
  const replaced = useGameStore((state) => state.replaced);
  const protocolMismatch = useGameStore((state) => state.protocolMismatch);
  const sessionInvalid = useGameStore((state) => state.sessionInvalid);
  const hasSession = useSessionStore((state) => state.session !== null);
  const clearSession = useSessionStore((state) => state.clear);
  const reset = useGameStore((state) => state.reset);
  const [showConnected, setShowConnected] = useState(false);
  const [lost, setLost] = useState(false);

  useEffect(() => {
    if (connection === 'reconnecting') {
      const timer = setTimeout(() => setLost(true), 5000);
      return () => clearTimeout(timer);
    }
    setLost(false);
    if (connection === 'connected') {
      setShowConnected(true);
      const timer = setTimeout(() => setShowConnected(false), 2000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [connection]);

  if (protocolMismatch) {
    return (
      <Banner
        variant="error"
        action={
          <Button size="sm" onClick={() => window.location.reload()}>
            {t('banner.reload')}
          </Button>
        }
      >
        {t('banner.outdated')}
      </Banner>
    );
  }
  if (sessionInvalid) {
    return (
      <Banner
        variant="warning"
        action={
          <Button
            size="sm"
            onClick={() => {
              clearSession();
              reset();
              window.location.reload();
            }}
          >
            {t('banner.newSession')}
          </Button>
        }
      >
        {t('banner.sessionExpired')}
      </Banner>
    );
  }
  if (replaced) {
    return (
      <Banner
        variant="warning"
        action={
          <Button size="sm" onClick={() => window.location.reload()}>
            {t('banner.useThisTab')}
          </Button>
        }
      >
        {t('banner.otherTab')}
      </Banner>
    );
  }
  if (hasSession && connection === 'reconnecting') {
    return (
      <Banner variant="warning">
        {lost ? t('connection.lost') : t('connection.reconnecting')}
      </Banner>
    );
  }
  if (showConnected) {
    return <Banner variant="success">{t('connection.connected')}</Banner>;
  }
  return null;
}

export function PausedBanner() {
  const { t } = useTranslation();
  const { room, paused, canPause } = useMe();
  if (!room || !paused) return null;
  return (
    <Banner
      variant="warning"
      action={
        canPause ? (
          <Button size="sm" onClick={() => void gameActions.resume().catch(() => undefined)}>
            {t('common.resume')}
          </Button>
        ) : undefined
      }
    >
      {t('banner.paused')}
      {canPause && !room.isTikTok ? ` · ${t('banner.autoResume', { seconds: 120 })}` : ''}
    </Banner>
  );
}

export function ClosedView() {
  const { t } = useTranslation();
  const reason = useGameStore((state) => state.closedReason);
  const leaveLocal = useGameStore((state) => state.leaveRoomLocal);
  const reasonKey = `closed.${reason ?? ''}` as MessageKey;
  const known = [
    'HOST_CLOSED',
    'ADMIN_CLOSED',
    'MATCH_CANCELLED',
    'NO_PLAYERS',
    'SERVER_RESTART',
    'MATCH_OVER_TIMEOUT',
  ];
  return (
    <main className="mx-auto flex min-h-[60dvh] w-full max-w-xl flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 tabIndex={-1} className="text-3xl outline-none">
        {t('closed.title')}
      </h1>
      <p className="text-ink-2" role="status">
        {reason && known.includes(reason) ? t(reasonKey) : t('closed.default')}
      </p>
      <Button size="lg" onClick={leaveLocal}>
        {t('common.backHome')}
      </Button>
    </main>
  );
}

export function Announcer() {
  const message = useGameStore((state) => state.announcement);
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}
