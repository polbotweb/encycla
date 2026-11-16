import type { ReactNode } from 'react';

export type BannerVariant = 'info' | 'success' | 'warning' | 'error';

const CLASSES: Record<BannerVariant, string> = {
  info: 'border-accent text-ink',
  success: 'border-success text-ink',
  warning: 'border-warning text-ink',
  error: 'border-danger text-ink',
};

export function Banner({
  variant = 'info',
  children,
  action,
}: {
  variant?: BannerVariant;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={`flex flex-wrap items-center justify-between gap-3 rounded-md border-s-4 bg-surface px-4 py-3 text-sm ${CLASSES[variant]}`}
    >
      <span>{children}</span>
      {action}
    </div>
  );
}
