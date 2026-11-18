import type { Language } from '../../../shared/languages';
import type { LabelForm } from '../../../shared/types';
import { contentAttributes, useTranslation, type MessageKey } from '../../i18n';
import { OPTION_LETTERS } from '../../lib/format';
import { CheckIcon, CrossIcon } from './Icons';
import { Term } from './Term';

export type OptionState = 'default' | 'selected' | 'correct' | 'incorrect' | 'muted';

const STATE_CLASSES: Record<OptionState, string> = {
  default: 'bg-surface text-ink border-line hover:border-line-strong hover:bg-raised',
  selected: 'bg-accent text-on-accent border-accent',
  correct: 'bg-success text-on-accent border-success',
  incorrect: 'bg-danger text-on-accent border-danger',
  muted: 'bg-surface text-ink-2 border-line opacity-70',
};

const STATE_LABEL: Partial<Record<OptionState, MessageKey>> = {
  selected: 'option.lockedAnswer',
  correct: 'option.correct',
  incorrect: 'option.incorrect',
};

export interface OptionButtonProps {
  index: number;
  text: string;
  state?: OptionState;
  disabled?: boolean;
  onSelect?: (index: number) => void;
  /** Language of the option text (the language of the questions). */
  language?: Language;
  /** Scientific or original name, when the option is not a name in that language (D-108). */
  form?: LabelForm | null | undefined;
}

export function OptionButton({
  index,
  text,
  state = 'default',
  disabled = false,
  onSelect,
  language,
  form,
}: OptionButtonProps) {
  const { t } = useTranslation();
  const letter = OPTION_LETTERS[index] ?? String(index + 1);
  const labelKey = STATE_LABEL[state];
  const suffix = labelKey ? t(labelKey) : undefined;
  return (
    <button
      type="button"
      disabled={disabled}
      aria-disabled={disabled || undefined}
      aria-pressed={state === 'selected' || undefined}
      onClick={() => onSelect?.(index)}
      className={[
        'flex min-h-[56px] w-full items-center gap-3 rounded-md border px-3 py-2 text-start text-lg font-medium transition-colors duration-[120ms] lg:min-h-[64px]',
        'disabled:cursor-default',
        STATE_CLASSES[state],
      ].join(' ')}
    >
      <span
        dir="ltr"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-current text-sm font-bold"
      >
        {letter}
      </span>{' '}
      <span
        className="min-w-0 flex-1 break-words"
        {...(language ? contentAttributes(language) : {})}
      >
        <Term text={text} form={form} />
      </span>
      {suffix ? <span className="sr-only">{`. ${suffix}`}</span> : null}
      {state === 'correct' ? <CheckIcon className="shrink-0" /> : null}
      {state === 'incorrect' ? <CrossIcon className="shrink-0" /> : null}
    </button>
  );
}
