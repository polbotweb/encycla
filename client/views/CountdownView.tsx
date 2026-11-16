import { ViewTitle } from '../components/game/Shell';
import { useGameStore } from '../store/gameStore';
import { useMe } from '../lib/useMe';
import { useRemaining } from '../lib/useRemaining';

export function CountdownView() {
  const { room } = useMe();
  const clockOffset = useGameStore((state) => state.clockOffset);
  const remaining = useRemaining(room, clockOffset, 100);
  if (!room) return null;
  const seconds = Math.max(1, Math.ceil((remaining ?? 3000) / 1000));
  return (
    <main className="mx-auto flex min-h-[70dvh] w-full max-w-shell flex-col items-center justify-center gap-4 p-4 text-center">
      <p className="label">
        Level {room.level} / {room.totalLevels}
      </p>
      <p
        aria-live="assertive"
        className="anim-fade tabular font-mono text-[10rem] font-bold leading-none text-accent"
        data-testid="countdown"
      >
        {seconds}
      </p>
      <ViewTitle>Get ready</ViewTitle>
      <p className="text-lg text-ink-2">
        {room.mode}
        {room.category ? ` · ${room.category}` : ''}
        {room.difficulty ? ` · ${room.difficulty}` : ''}
      </p>
    </main>
  );
}
