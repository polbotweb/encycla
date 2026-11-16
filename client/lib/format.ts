export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatSeconds(ms: number): string {
  return String(Math.max(0, Math.ceil(ms / 1000)));
}

export function formatResponseTime(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function truncate(value: string, max = 24): string {
  const chars = [...value];
  return chars.length <= max ? value : `${chars.slice(0, max - 1).join('')}…`;
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;
