import { useEffect, useState } from 'react';
import { t } from '../../i18n/en';
import { gameActions } from '../../lib/realtime';
import { useMe } from '../../lib/useMe';
import { useGameStore } from '../../store/gameStore';
import { useSessionStore } from '../../store/sessionStore';
import { Banner } from '../ui/Banner';
import { Button } from '../ui/Button';

export function ConnectionBanner() {
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
      <Banner variant="error" action={<Button size="sm" onClick={() => window.location.reload()}>Reload</Button>}>
        This page is out of date. Reload.
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
            New session
          </Button>
        }
      >
        Your session expired. Start a new one.
      </Banner>
    );
  }
  if (replaced) {
    return (
      <Banner variant="warning" action={<Button size="sm" onClick={() => window.location.reload()}>Use this tab</Button>}>
        This session is open in another tab or window.
      </Banner>
    );
  }
  if (hasSession && connection === 'reconnecting') {
    return (
      <Banner variant="warning">
        {lost ? 'Connection lost. Reconnecting…' : t.reconnecting}
      </Banner>
    );
  }
  if (showConnected) {
    return <Banner variant="success">Connected</Banner>;
  }
  return null;
}

export function PausedBanner() {
  const { room, paused, canPause } = useMe();
  if (!room || !paused) return null;
  return (
    <Banner
      variant="warning"
      action={
        canPause ? (
          <Button size="sm" onClick={() => void gameActions.resume().catch(() => undefined)}>
            {t.resume}
          </Button>
        ) : undefined
      }
    >
      {t.paused}
      {canPause && !room.isTikTok ? ' · Auto-resume in 120 s' : ''}
    </Banner>
  );
}

export function ClosedView() {
  const reason = useGameStore((state) => state.closedReason);
  const leaveLocal = useGameStore((state) => state.leaveRoomLocal);
  const messages: Record<string, string> = {
    HOST_CLOSED: 'The host closed the room.',
    ADMIN_CLOSED: 'An administrator closed the room.',
    MATCH_CANCELLED: 'The match was cancelled.',
    NO_PLAYERS: 'The room closed because nobody is left.',
    SERVER_RESTART: 'The server restarted. Your match was ended.',
    MATCH_OVER_TIMEOUT: 'The room has closed.',
  };
  return (
    <main className="mx-auto flex min-h-[60dvh] w-full max-w-xl flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 tabIndex={-1} className="text-3xl outline-none">
        {t.roomClosed}
      </h1>
      <p className="text-ink-2" role="status">
        {messages[reason ?? ''] ?? 'This room is closed.'}
      </p>
      <Button size="lg" onClick={leaveLocal}>
        {t.backHome}
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
