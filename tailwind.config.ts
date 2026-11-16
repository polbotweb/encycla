import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './client/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg-rgb) / <alpha-value>)',
        surface: 'rgb(var(--surface-rgb) / <alpha-value>)',
        raised: 'rgb(var(--surface-raised-rgb) / <alpha-value>)',
        line: 'rgb(var(--border-rgb) / <alpha-value>)',
        'line-strong': 'rgb(var(--border-strong-rgb) / <alpha-value>)',
        ink: 'rgb(var(--text-rgb) / <alpha-value>)',
        'ink-2': 'rgb(var(--text-secondary-rgb) / <alpha-value>)',
        'ink-3': 'rgb(var(--text-muted-rgb) / <alpha-value>)',
        accent: 'rgb(var(--accent-rgb) / <alpha-value>)',
        success: 'rgb(var(--success-rgb) / <alpha-value>)',
        danger: 'rgb(var(--danger-rgb) / <alpha-value>)',
        warning: 'rgb(var(--warning-rgb) / <alpha-value>)',
        'on-accent': 'rgb(var(--on-accent-rgb) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'Arial', 'sans-serif'],
        serif: ['Merriweather', 'Times New Roman', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        pill: '999px',
      },
      maxWidth: {
        shell: '1152px',
      },
      minHeight: {
        tap: '44px',
      },
      boxShadow: {
        panel: '0 1px 0 rgba(248,250,252,0.04) inset, 0 16px 40px rgba(2,6,23,0.35)',
      },
    },
  },
  plugins: [],
};

export default config;
