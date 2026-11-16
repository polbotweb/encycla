import { formatSeconds } from '../../lib/format';

export interface TimerProps {
  remainingMs: number | null;
  totalMs: number;
  paused?: boolean;
  /** Horizontal bar (mobile) instead of the ring. */
  variant?: 'ring' | 'bar';
  size?: number;
}

function tone(remainingMs: number): string {
  if (remainingMs <= 3000) return 'text-danger';
  if (remainingMs <= 5000) return 'text-warning';
  return 'text-accent';
}

export function Timer({
  remainingMs,
  totalMs,
  paused = false,
  variant = 'ring',
  size = 72,
}: TimerProps) {
  if (remainingMs === null) return null;
  const fraction = totalMs > 0 ? Math.min(1, Math.max(0, remainingMs / totalMs)) : 0;
  const seconds = formatSeconds(remainingMs);
  const color = tone(remainingMs);

  if (variant === 'bar') {
    return (
      <div
        role="timer"
        aria-live="off"
        aria-label={`${seconds} seconds remaining`}
        className={color}
      >
        <progress
          className="h-2 w-full overflow-hidden rounded-pill [&::-moz-progress-bar]:bg-current [&::-webkit-progress-bar]:bg-line [&::-webkit-progress-value]:bg-current"
          max={100}
          value={Math.round(fraction * 100)}
          aria-hidden="true"
        />
        <span className="sr-only">{seconds}</span>
      </div>
    );
  }

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  return (
    <div
      role="timer"
      aria-live="off"
      aria-label={`${seconds} seconds remaining${paused ? ', paused' : ''}`}
      className={`relative inline-flex items-center justify-center ${color}`}
      data-testid="timer"
    >
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" focusable="false">
        <circle cx="50" cy="50" r={radius} fill="none" className="stroke-line" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <span className="tabular absolute font-mono text-2xl font-bold text-ink">{seconds}</span>
    </div>
  );
}
