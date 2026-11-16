const SIZE_CLASS = {
  24: 'h-6 w-6 text-sm',
  32: 'h-8 w-8 text-lg',
  48: 'h-12 w-12 text-2xl',
  64: 'h-16 w-16 text-4xl',
} as const;

export function Avatar({ emoji, size = 32 }: { emoji: string; size?: keyof typeof SIZE_CLASS }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-pill border border-line bg-raised ${SIZE_CLASS[size]}`}
    >
      {emoji}
    </span>
  );
}
