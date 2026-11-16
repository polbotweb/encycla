import { useState } from 'react';
import type { ConfigResponse } from '../../../shared/protocol';
import { LANGUAGES, LANGUAGE_NAMES, isLanguage, type Language } from '../../../shared/languages';
import type { Difficulty, GameMode } from '../../../shared/types';
import { labelFor, useTranslation, type MessageKey } from '../../i18n';
import type { Selection } from '../../lib/api';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

export type PlayIntent = 'solo' | 'queue' | 'private';

const DIFFICULTIES: Difficulty[] = ['Novice', 'Adventurer', 'Wizard'];

export interface PlaySetupModalProps {
  open: boolean;
  intent: PlayIntent;
  /** Pre-select a mode (e.g. "Solo SUBJECT"). */
  initialMode?: GameMode;
  config: ConfigResponse | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (selection: Selection, maxPlayers?: number) => void;
}

const TITLES: Record<PlayIntent, MessageKey> = {
  solo: 'setup.solo',
  queue: 'setup.queue',
  private: 'setup.private',
};

const CONFIRM_LABELS: Record<PlayIntent, MessageKey> = {
  solo: 'setup.startSolo',
  queue: 'setup.startQueue',
  private: 'setup.startPrivate',
};

export function PlaySetupModal({
  open,
  intent,
  initialMode = 'CLASSIC',
  config,
  busy,
  error,
  onClose,
  onConfirm,
}: PlaySetupModalProps) {
  const { t, language: interfaceLanguage } = useTranslation();
  const modes: GameMode[] =
    intent === 'solo' ? ['CLASSIC', 'SUBJECT'] : ['CLASSIC', 'SUBJECT', 'CONTEST'];
  const [mode, setMode] = useState<GameMode>(initialMode);
  const [category, setCategory] = useState<string>('');
  const [difficulty, setDifficulty] = useState<Difficulty>('Novice');
  const [maxPlayers, setMaxPlayers] = useState(8);
  // Questions are shown in the language of the room; it starts as the interface language.
  const [questionLanguage, setQuestionLanguage] = useState<Language>(interfaceLanguage);

  const effectiveMode = modes.includes(mode) ? mode : 'CLASSIC';
  const categories = config?.categories ?? [];
  const category_ok = categories.find((entry) => entry.value === category)?.subjectEnabled === true;
  const anySubject = categories.some((entry) => entry.subjectEnabled);
  const canConfirm = effectiveMode !== 'SUBJECT' || category_ok;

  function submit(): void {
    const selection: Selection =
      effectiveMode === 'SUBJECT'
        ? { mode: 'SUBJECT', category, difficulty, language: questionLanguage }
        : { mode: effectiveMode, category: null, difficulty: null, language: questionLanguage };
    onConfirm(
      selection,
      intent === 'private' && effectiveMode !== 'CONTEST' ? maxPlayers : undefined,
    );
  }

  return (
    <Modal title={t(TITLES[intent])} open={open} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (canConfirm && !busy) submit();
        }}
      >
        <fieldset className="space-y-2">
          <legend className="label mb-1">{t('setup.mode')}</legend>
          {modes.map((value) => (
            <label
              key={value}
              className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md border border-line px-3 py-2 has-[:checked]:border-accent"
            >
              <input
                type="radio"
                name="mode"
                value={value}
                checked={effectiveMode === value}
                onChange={() => setMode(value)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              <span>{t(`mode.${value}.desc` as MessageKey)}</span>
            </label>
          ))}
        </fieldset>

        <div>
          <label htmlFor="question-language" className="label mb-1 block">
            {t('setup.questionLanguage')}
          </label>
          <select
            id="question-language"
            value={questionLanguage}
            onChange={(event) => {
              if (isLanguage(event.target.value)) setQuestionLanguage(event.target.value);
            }}
            className="min-h-[44px] w-full rounded-md border border-line-strong bg-bg px-3 text-ink"
          >
            {LANGUAGES.map((code) => (
              <option key={code} value={code} lang={code}>
                {LANGUAGE_NAMES[code]}
              </option>
            ))}
          </select>
        </div>

        {effectiveMode === 'SUBJECT' ? (
          <div className="space-y-3">
            <div>
              <label htmlFor="category" className="label mb-1 block">
                {t('setup.category')}
              </label>
              <select
                id="category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="min-h-[44px] w-full rounded-md border border-line-strong bg-bg px-3 text-ink"
              >
                <option value="">{t('setup.chooseCategory')}</option>
                {categories.map((entry) => (
                  <option key={entry.value} value={entry.value} disabled={!entry.subjectEnabled}>
                    {labelFor('category', entry.value)}
                    {entry.subjectEnabled ? '' : ` — ${t('common.comingSoon')}`}
                  </option>
                ))}
              </select>
              {!anySubject ? (
                <p className="mt-2 text-sm text-ink-2">{t('setup.noSubject')}</p>
              ) : null}
            </div>
            <fieldset>
              <legend className="label mb-1">{t('setup.difficulty')}</legend>
              <div className="flex flex-wrap gap-2">
                {DIFFICULTIES.map((value) => (
                  <label
                    key={value}
                    className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-md border border-line px-3 has-[:checked]:border-accent"
                  >
                    <input
                      type="radio"
                      name="difficulty"
                      value={value}
                      checked={difficulty === value}
                      onChange={() => setDifficulty(value)}
                      className="h-4 w-4 accent-[var(--accent)]"
                    />
                    {labelFor('difficulty', value)}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        ) : null}

        {intent === 'private' && effectiveMode !== 'CONTEST' ? (
          <div>
            <label htmlFor="maxPlayers" className="label mb-1 block">
              {t('setup.maxPlayers')}
            </label>
            <input
              id="maxPlayers"
              type="number"
              min={2}
              max={8}
              value={maxPlayers}
              onChange={(event) =>
                setMaxPlayers(Math.min(8, Math.max(2, Number(event.target.value) || 2)))
              }
              className="min-h-[44px] w-24 rounded-md border border-line-strong bg-bg px-3 text-ink"
            />
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={busy} disabled={!canConfirm}>
            {t(CONFIRM_LABELS[intent])}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
