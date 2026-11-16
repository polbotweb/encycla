import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './client/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        raised: 'var(--surface-raised)',
        line: 'var(--border)',
        'line-strong': 'var(--border-strong)',
        ink: 'var(--text)',
        'ink-2': 'var(--text-secondary)',
        'ink-3': 'var(--text-muted)',
        accent: 'var(--accent)',
        success: 'var(--success)',
        danger: 'var(--danger)',
        warning: 'var(--warning)',
        'on-accent': 'var(--on-accent)',
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
