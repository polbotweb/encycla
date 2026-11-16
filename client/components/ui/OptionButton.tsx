import { OPTION_LETTERS } from '../../lib/format';
import { CheckIcon, CrossIcon } from './Icons';

export type OptionState = 'default' | 'selected' | 'correct' | 'incorrect' | 'muted';

const STATE_CLASSES: Record<OptionState, string> = {
  default: 'bg-surface text-ink border-line hover:border-line-strong hover:bg-raised',
  selected: 'bg-accent text-on-accent border-accent',
  correct: 'bg-success text-on-accent border-success',
  incorrect: 'bg-danger text-on-accent border-danger',
  muted: 'bg-surface text-ink-2 border-line opacity-70',
};

const STATE_LABEL: Partial<Record<OptionState, string>> = {
  selected: 'Your answer, locked',
  correct: 'Correct',
  incorrect: 'Incorrect',
};

export interface OptionButtonProps {
  index: number;
  text: string;
  state?: OptionState;
  disabled?: boolean;
  onSelect?: (index: number) => void;
}

export function OptionButton({
  index,
  text,
  state = 'default',
  disabled = false,
  onSelect,
}: OptionButtonProps) {
  const letter = OPTION_LETTERS[index] ?? String(index + 1);
  const suffix = STATE_LABEL[state];
  return (
    <button
      type="button"
      disabled={disabled}
      aria-disabled={disabled || undefined}
      aria-pressed={state === 'selected' || undefined}
      onClick={() => onSelect?.(index)}
      className={[
        'flex min-h-[56px] w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-lg font-medium transition-colors duration-[120ms] lg:min-h-[64px]',
        'disabled:cursor-default',
        STATE_CLASSES[state],
      ].join(' ')}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-current text-sm font-bold">
        {letter}
      </span>{' '}
      <span className="min-w-0 flex-1 break-words">{text}</span>
      {suffix ? <span className="sr-only">{`. ${suffix}`}</span> : null}
      {state === 'correct' ? <CheckIcon className="shrink-0" /> : null}
      {state === 'incorrect' ? <CrossIcon className="shrink-0" /> : null}
    </button>
  );
}
