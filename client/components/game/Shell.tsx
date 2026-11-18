import { useEffect, useRef, type ReactNode } from 'react';
import { LanguageSwitcher } from '../../i18n/LanguageSwitcher';
import { useTranslation } from '../../i18n';
import { useGameStore } from '../../store/gameStore';
import { useUiStore } from '../../store/uiStore';
import { unlockAudio } from '../../lib/audio';
import { SoundOffIcon, SoundOnIcon } from '../ui/Icons';
import { Logo } from '../ui/Logo';
import { VoiceToggleButton } from './Voice';

export function AppHeader() {
  const { t } = useTranslation();
  const muted = useUiStore((state) => state.muted);
  const toggleMuted = useUiStore((state) => state.toggleMuted);
  const connection = useGameStore((state) => state.connection);
  const setScreen = useUiStore((state) => state.setScreen);
  const dot =
    connection === 'connected'
      ? 'bg-success'
      : connection === 'offline'
        ? 'bg-line-strong'
        : 'bg-warning anim-pulse';
  const label =
    connection === 'connected'
      ? t('connection.connected')
      : connection === 'offline'
        ? t('connection.offline')
        : t('connection.reconnecting');
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-3">
      <button
        type="button"
        onClick={() => setScreen('home')}
        className="inline-flex min-h-[44px] items-center rounded-md text-ink"
        aria-label={t('app.homeAria')}
        lang="en"
        dir="ltr"
      >
        <Logo height={36} tagline={false} />
      </button>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <LanguageSwitcher />
        <button
          type="button"
          onClick={() => {
            unlockAudio();
            toggleMuted();
          }}
          aria-pressed={muted}
          aria-label={muted ? t('audio.off') : t('audio.on')}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-ink-2 hover:bg-raised hover:text-ink"
        >
          {muted ? <SoundOffIcon /> : <SoundOnIcon />}
        </button>
        <VoiceToggleButton />
        <span className="flex items-center gap-2 text-sm text-ink-2" role="status">
          <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-pill ${dot}`} />
          {label}
        </span>
      </div>
    </header>
  );
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-lg border border-line bg-surface p-4 shadow-panel sm:p-6 ${className}`}
    >
      {children}
    </section>
  );
}

/** Heading that receives focus when a view mounts (UI-UX 3.6). */
export function ViewTitle({ children, id }: { children: ReactNode; id?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <h1 id={id} tabIndex={-1} ref={ref} className="text-3xl outline-none sm:text-4xl">
      {children}
    </h1>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="text-center">
      <div className="label">{label}</div>
      <div className="tabular font-mono text-xl font-bold">{value}</div>
    </div>
  );
}
