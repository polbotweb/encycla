import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent border-transparent hover:brightness-110',
  secondary: 'bg-transparent text-ink border-line-strong hover:bg-raised',
  ghost: 'bg-transparent text-ink-2 border-transparent hover:bg-raised hover:text-ink',
  success: 'bg-success text-on-accent border-transparent hover:brightness-110',
  danger: 'bg-danger text-on-accent border-transparent hover:brightness-110',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-[44px] px-3 text-sm',
  md: 'min-h-[44px] px-4 text-base',
  lg: 'min-h-[52px] px-6 text-lg',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  block?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  block = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const inactive = disabled === true || loading;
  return (
    <button
      type={type}
      {...rest}
      disabled={inactive}
      aria-disabled={inactive || undefined}
      aria-busy={loading || undefined}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-md border font-semibold transition-colors duration-[120ms]',
        'disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTS[variant],
        SIZES[size],
        block ? 'w-full' : '',
        className,
      ].join(' ')}
    >
      {children}
    </button>
  );
}
