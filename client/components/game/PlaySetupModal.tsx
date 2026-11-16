import { useState } from 'react';
import type { ConfigResponse } from '../../../shared/protocol';
import type { Difficulty, GameMode } from '../../../shared/types';
import type { Selection } from '../../lib/api';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

export type PlayIntent = 'solo' | 'queue' | 'private';

const MODE_LABEL: Record<GameMode, string> = {
  CLASSIC: 'CLASSIC — 10 levels, all categories',
  SUBJECT: 'SUBJECT — one category, one level',
  CONTEST: 'CONTEST — head-to-head duel',
};

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

const TITLES: Record<PlayIntent, string> = {
  solo: 'Play solo',
  queue: 'Play online',
  private: 'Create a private room',
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
  const modes: GameMode[] =
    intent === 'solo' ? ['CLASSIC', 'SUBJECT'] : ['CLASSIC', 'SUBJECT', 'CONTEST'];
  const [mode, setMode] = useState<GameMode>(initialMode);
  const [category, setCategory] = useState<string>('');
  const [difficulty, setDifficulty] = useState<Difficulty>('Novice');
  const [maxPlayers, setMaxPlayers] = useState(8);

  const effectiveMode = modes.includes(mode) ? mode : 'CLASSIC';
  const categories = config?.categories ?? [];
  const category_ok = categories.find((entry) => entry.value === category)?.subjectEnabled === true;
  const anySubject = categories.some((entry) => entry.subjectEnabled);
  const canConfirm = effectiveMode !== 'SUBJECT' || category_ok;

  function submit(): void {
    const selection: Selection =
      effectiveMode === 'SUBJECT'
        ? { mode: 'SUBJECT', category, difficulty }
        : { mode: effectiveMode, category: null, difficulty: null };
    onConfirm(
      selection,
      intent === 'private' && effectiveMode !== 'CONTEST' ? maxPlayers : undefined,
    );
  }

  return (
    <Modal title={TITLES[intent]} open={open} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (canConfirm && !busy) submit();
        }}
      >
        <fieldset className="space-y-2">
          <legend className="label mb-1">Mode</legend>
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
              <span>{MODE_LABEL[value]}</span>
            </label>
          ))}
        </fieldset>

        {effectiveMode === 'SUBJECT' ? (
          <div className="space-y-3">
            <div>
              <label htmlFor="category" className="label mb-1 block">
                Category
              </label>
              <select
                id="category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="min-h-[44px] w-full rounded-md border border-line-strong bg-bg px-3 text-ink"
              >
                <option value="">Choose a category</option>
                {categories.map((entry) => (
                  <option key={entry.value} value={entry.value} disabled={!entry.subjectEnabled}>
                    {entry.value}
                    {entry.subjectEnabled ? '' : ' — Coming soon'}
                  </option>
                ))}
              </select>
              {!anySubject ? (
                <p className="mt-2 text-sm text-ink-2">
                  SUBJECT is not available yet: no category has the 20 questions it needs.
                </p>
              ) : null}
            </div>
            <fieldset>
              <legend className="label mb-1">Difficulty</legend>
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
                    {value}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        ) : null}

        {intent === 'private' && effectiveMode !== 'CONTEST' ? (
          <div>
            <label htmlFor="maxPlayers" className="label mb-1 block">
              Maximum players
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
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={!canConfirm}>
            {intent === 'solo' ? 'Start' : intent === 'queue' ? 'Find a match' : 'Create room'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
