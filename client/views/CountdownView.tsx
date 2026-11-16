import { ViewTitle } from '../components/game/Shell';
import { labelFor, useTranslation } from '../i18n';
import { useGameStore } from '../store/gameStore';
import { useMe } from '../lib/useMe';
import { useRemaining } from '../lib/useRemaining';

export function CountdownView() {
  const { t } = useTranslation();
  const { room } = useMe();
  const clockOffset = useGameStore((state) => state.clockOffset);
  const remaining = useRemaining(room, clockOffset, 100);
  if (!room) return null;
  const seconds = Math.max(1, Math.ceil((remaining ?? 3000) / 1000));
  return (
    <main className="mx-auto flex min-h-[70dvh] w-full max-w-shell flex-col items-center justify-center gap-4 p-4 text-center">
      <p className="label">
        {t('countdown.level', { level: room.level, total: room.totalLevels })}
      </p>
      <p
        aria-live="assertive"
        className="anim-fade tabular font-mono text-[10rem] font-bold leading-none text-accent"
        data-testid="countdown"
      >
        {seconds}
      </p>
      <ViewTitle>{t('countdown.getReady')}</ViewTitle>
      <p className="text-lg text-ink-2">
        {labelFor('mode', room.mode)}
        {room.category ? ` · ${labelFor('category', room.category)}` : ''}
        {room.difficulty ? ` · ${labelFor('difficulty', room.difficulty)}` : ''}
      </p>
    </main>
  );
}
