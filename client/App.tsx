import { Suspense, lazy, useEffect, useState } from 'react';
import { Announcer, ClosedView, ConnectionBanner, PausedBanner } from './components/game/Banners';
import { LeaveModal } from './components/game/LeaveControls';
import { AppHeader } from './components/game/Shell';
import { connectPlayerSocket, disconnectPlayerSocket } from './lib/realtime';
import { parseRoute } from './lib/route';
import { unlockAudio } from './lib/audio';
import { useVoiceStore, watchVoices, type VoiceScope } from './lib/speech';
import { Narrator, VoiceNotice } from './components/game/Voice';
import { isTypingTarget } from './views/QuestionView';
import { useGameStore } from './store/gameStore';
import { useSessionStore } from './store/sessionStore';
import { useUiStore } from './store/uiStore';
import { ArticleView } from './views/ArticleView';
import { CountdownView } from './views/CountdownView';
import { HomeView } from './views/HomeView';
import { LeaderboardView } from './views/LeaderboardView';
import { LevelCompleteView } from './views/LevelCompleteView';
import { LobbyView } from './views/LobbyView';
import { MatchmakingView } from './views/MatchmakingView';
import { QuestionView } from './views/QuestionView';
import { ResultsView } from './views/ResultsView';
import { RevealView } from './views/RevealView';
import { useMe } from './lib/useMe';
import type { RoomPhase } from '../shared/types';

// Streamer-only screens are split out of the player bundle.
const OverlayView = lazy(() =>
  import('./views/OverlayView').then((module) => ({ default: module.OverlayView })),
);
const AdminView = lazy(() =>
  import('./views/AdminView').then((module) => ({ default: module.AdminView })),
);
const ControlView = lazy(() =>
  import('./views/ControlView').then((module) => ({ default: module.ControlView })),
);

function RoomView({ phase }: { phase: RoomPhase | null }) {
  switch (phase) {
    case 'LOBBY':
      return <LobbyView />;
    case 'COUNTDOWN':
      return <CountdownView />;
    case 'QUESTION':
      return <QuestionView />;
    case 'REVEAL':
      return <RevealView />;
    case 'ARTICLE':
      return <ArticleView />;
    case 'LEVEL_COMPLETE':
      return <LevelCompleteView />;
    case 'MATCH_OVER':
      return <ResultsView />;
    default:
      return <ClosedView />;
  }
}

function PlayerApp({
  initialScreen,
  initialCode,
}: {
  initialScreen: 'home' | 'leaderboard';
  initialCode: string;
}) {
  const session = useSessionStore((state) => state.session);
  const screen = useUiStore((state) => state.screen);
  const setScreen = useUiStore((state) => state.setScreen);
  const setPrefilledCode = useUiStore((state) => state.setPrefilledCode);
  const toggleMuted = useUiStore((state) => state.toggleMuted);
  const setLeaveModal = useUiStore((state) => state.setLeaveModal);
  const queue = useGameStore((state) => state.queue);
  const closedReason = useGameStore((state) => state.closedReason);
  const { room, phase, me } = useMe();
  const clockOffset = useGameStore((state) => state.clockOffset);
  const lockedChoice = useGameStore((state) => state.lockedChoice);
  const muted = useUiStore((state) => state.muted);
  const questionId = room?.question?.id ?? null;
  // Time marks only while this player still has to answer (D-100).
  const awaiting =
    questionId !== null &&
    me?.status === 'CONNECTED' &&
    me.hasAnsweredQuestionId !== questionId &&
    lockedChoice?.questionId !== questionId;

  useEffect(() => {
    setScreen(initialScreen);
    if (initialCode) setPrefilledCode(initialCode);
  }, [initialScreen, initialCode, setScreen, setPrefilledCode]);

  const token = session?.token ?? null;
  useEffect(() => {
    if (token) connectPlayerSocket(token);
    return () => {
      if (token) disconnectPlayerSocket();
    };
  }, [token]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      unlockAudio();
      if (event.ctrlKey || event.altKey || event.metaKey || isTypingTarget(event.target)) return;
      if (event.code === 'KeyM') {
        toggleMuted();
      } else if (event.code === 'Escape' && useGameStore.getState().room) {
        setLeaveModal(true);
      }
    }
    const unlock = (): void => unlockAudio();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', unlock);
    };
  }, [toggleMuted, setLeaveModal]);

  let content;
  if (room) {
    const closed = closedReason !== null && room.phase !== 'MATCH_OVER';
    content = closed ? <ClosedView /> : <RoomView phase={phase} />;
  } else if (queue) {
    content = <MatchmakingView />;
  } else if (screen === 'leaderboard') {
    content = <LeaderboardView />;
  } else {
    content = <HomeView />;
  }

  return (
    <div className="mx-auto min-h-dvh max-w-shell">
      <AppHeader />
      <div className="space-y-2 px-4 pt-3 empty:hidden">
        <ConnectionBanner />
        <PausedBanner />
        {room ? <VoiceNotice language={room.language} /> : null}
      </div>
      {content}
      <LeaveModal started={room !== null && room.phase !== 'LOBBY'} />
      <Announcer />
      <Narrator room={room} clockOffset={clockOffset} timeCues={awaiting} silenced={muted} />
    </div>
  );
}

export default function App() {
  const [route] = useState(() => {
    const parsed = parseRoute(window.location.search, window.location.hash);
    const scope: VoiceScope =
      parsed.kind === 'overlay' ? 'overlay' : parsed.kind === 'player' ? 'player' : 'console';
    useVoiceStore.getState().init(scope);
    return parsed;
  });
  useEffect(() => watchVoices(), []);
  if (route.kind === 'overlay') {
    return (
      <Suspense fallback={<main className="min-h-dvh" aria-busy="true" />}>
        <OverlayView roomCode={route.roomCode} token={route.token} />
      </Suspense>
    );
  }
  if (route.kind === 'admin') {
    return (
      <Suspense fallback={<main className="min-h-dvh" aria-busy="true" />}>
        <AdminView />
      </Suspense>
    );
  }
  if (route.kind === 'control') {
    return (
      <Suspense fallback={<main className="min-h-dvh" aria-busy="true" />}>
        <ControlView
          roomCode={route.roomCode}
          token={route.token}
          {...(route.overlayToken ? { overlayToken: route.overlayToken } : {})}
        />
      </Suspense>
    );
  }
  return <PlayerApp initialScreen={route.screen} initialCode={route.code} />;
}
