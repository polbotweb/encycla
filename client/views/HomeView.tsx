import { useEffect, useRef, useState } from 'react';
import { Panel, ViewTitle } from '../components/game/Shell';
import { PlaySetupModal, type PlayIntent } from '../components/game/PlaySetupModal';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { ERROR_MESSAGES, errorMessage, t } from '../i18n/en';
import { unlockAudio } from '../lib/audio';
import { ApiClientError, type Selection } from '../lib/api';
import { ensureSession, gameActions, waitForConnected } from '../lib/realtime';
import { useConfig } from '../lib/useConfig';
import { useGameStore } from '../store/gameStore';
import { useSessionStore } from '../store/sessionStore';
import { useUiStore } from '../store/uiStore';
import type { GameMode } from '../../shared/types';

const PSEUDO_PATTERN = /^[\p{L}\p{M}\p{N} _-]+$/u;

export function validatePseudoInput(value: string): string | null {
  const trimmed = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  const length = [...trimmed].length;
  if (length < 2 || length > 24) return 'Pseudo must contain between 2 and 24 characters.';
  if (!PSEUDO_PATTERN.test(trimmed)) return 'Pseudo contains unsupported characters.';
  return null;
}

interface PendingAction {
  intent: PlayIntent;
  mode: GameMode;
}

export function HomeView() {
  const savedPseudo = useSessionStore((state) => state.savedPseudo);
  const setPseudoStored = useSessionStore((state) => state.setPseudo);
  const connection = useGameStore((state) => state.connection);
  const setScreen = useUiStore((state) => state.setScreen);
  const prefilledCode = useUiStore((state) => state.prefilledCode);
  const setPrefilledCode = useUiStore((state) => state.setPrefilledCode);
  const { config, failed, loading, reload } = useConfig();

  const [pseudo, setPseudo] = useState(savedPseudo);
  const [pseudoError, setPseudoError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [joinOpen, setJoinOpen] = useState(prefilledCode !== '');
  const [code, setCode] = useState(prefilledCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pseudoRef = useRef<HTMLInputElement>(null);

  // An invite link (?mode=join&code=XXXXXX) opens the join dialog with the code filled in.
  useEffect(() => {
    if (prefilledCode) {
      setCode(prefilledCode);
      setJoinOpen(true);
      setPrefilledCode('');
    }
  }, [prefilledCode, setPrefilledCode]);

  const classicAvailable = config
    ? config.categories.some((entry) => entry.questionCount > 0)
    : true;

  /** Validates the pseudo, creates the session, waits for the socket, then runs the action. */
  async function withSession(action: () => Promise<void>): Promise<boolean> {
    const problem = validatePseudoInput(pseudo);
    if (problem) {
      setPseudoError(problem);
      pseudoRef.current?.focus();
      return false;
    }
    setPseudoError(null);
    setBusy(true);
    setError(null);
    unlockAudio();
    try {
      const normalized = pseudo.normalize('NFKC').trim().replace(/\s+/g, ' ');
      await ensureSession(normalized);
      setPseudoStored(normalized);
      await waitForConnected();
      await action();
      return true;
    } catch (caught) {
      const codeValue = caught instanceof ApiClientError ? caught.code : 'INTERNAL_ERROR';
      setError(
        codeValue === 'NETWORK_ERROR' ? ERROR_MESSAGES.INTERNAL_ERROR : errorMessage(codeValue),
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function confirmSetup(selection: Selection, maxPlayers?: number): Promise<void> {
    if (!pending) return;
    const intent = pending.intent;
    const ok = await withSession(async () => {
      if (intent === 'solo') await gameActions.startSolo(selection);
      else if (intent === 'queue') await gameActions.joinQueue(selection);
      else await gameActions.createRoom(selection, maxPlayers);
    });
    if (ok) setPending(null);
  }

  async function confirmJoin(): Promise<void> {
    const ok = await withSession(() => gameActions.joinRoom(code));
    if (ok) setJoinOpen(false);
  }

  const sessionPreparing = busy || connection === 'connecting';

  return (
    <main className="mx-auto grid w-full max-w-shell gap-6 p-4 lg:grid-cols-[55fr_45fr] lg:p-8">
      <div className="space-y-4">
        <p className="label">{t.tagline}</p>
        <ViewTitle>Encycla MindMaze</ViewTitle>
        <p className="max-w-prose text-lg text-ink-2">
          Identify the subject, answer before the timer runs out, then read the story behind the
          image. Play solo, challenge friends in a private room, or find a match online.
        </p>
        <Panel className="hidden lg:block">
          <h2 className="mb-2 text-xl">How to play</h2>
          <ul className="list-disc space-y-1 pl-5 text-ink-2">
            <li>Pick the right option before the clock hits zero.</li>
            <li>Faster answers and streaks earn bonus points.</li>
            <li>Wrong answers cost a life; lose all three and you are out.</li>
            <li>After every question, read the article behind the picture.</li>
          </ul>
        </Panel>
        {config ? (
          <p className="text-sm text-ink-2">
            {config.categories.reduce((sum, entry) => sum + entry.questionCount, 0)} questions ·{' '}
            {config.categories.length} categories
          </p>
        ) : null}
      </div>

      <Panel className="space-y-4 self-start">
        {failed ? (
          <Banner
            variant="error"
            action={
              <Button size="sm" variant="secondary" onClick={reload}>
                {t.retry}
              </Button>
            }
          >
            The server is not reachable. {ERROR_MESSAGES.INTERNAL_ERROR}
          </Banner>
        ) : null}
        {!loading && !failed && !classicAvailable ? (
          <Banner variant="warning">
            No questions are available right now. Please contact the operator.
          </Banner>
        ) : null}

        <div>
          <label htmlFor="pseudo" className="label mb-1 block">
            Pseudo
          </label>
          <input
            id="pseudo"
            ref={pseudoRef}
            value={pseudo}
            maxLength={40}
            autoComplete="nickname"
            onChange={(event) => {
              setPseudo(event.target.value);
              if (pseudoError) setPseudoError(null);
            }}
            aria-invalid={pseudoError ? true : undefined}
            aria-describedby={pseudoError ? 'pseudo-error' : undefined}
            className="min-h-[48px] w-full rounded-md border border-line-strong bg-bg px-3 text-lg text-ink"
          />
          {pseudoError ? (
            <p id="pseudo-error" role="alert" className="mt-1 text-sm text-danger">
              {pseudoError}
            </p>
          ) : null}
        </div>

        {error && !pending && !joinOpen ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="grid gap-3">
          <Button
            size="lg"
            block
            disabled={sessionPreparing || failed || !classicAvailable}
            onClick={() => {
              setError(null);
              setPending({ intent: 'solo', mode: 'CLASSIC' });
            }}
          >
            {sessionPreparing ? t.preparing : t.soloClassic}
          </Button>
          <Button
            size="lg"
            variant="secondary"
            block
            disabled={sessionPreparing || failed}
            onClick={() => {
              setError(null);
              setPending({ intent: 'solo', mode: 'SUBJECT' });
            }}
          >
            {t.soloSubject}
          </Button>
          <Button
            size="lg"
            variant="secondary"
            block
            disabled={sessionPreparing || failed}
            onClick={() => {
              setError(null);
              setPending({ intent: 'queue', mode: 'CLASSIC' });
            }}
          >
            {t.playOnline}
          </Button>
          <Button
            size="lg"
            variant="secondary"
            block
            disabled={sessionPreparing || failed}
            onClick={() => {
              setError(null);
              setPending({ intent: 'private', mode: 'CLASSIC' });
            }}
          >
            {t.createPrivate}
          </Button>
          <Button
            size="lg"
            variant="secondary"
            block
            disabled={sessionPreparing || failed}
            onClick={() => {
              setError(null);
              setJoinOpen(true);
            }}
          >
            {t.joinWithCode}
          </Button>
          <Button size="lg" variant="ghost" block onClick={() => setScreen('leaderboard')}>
            {t.leaderboard}
          </Button>
        </div>
      </Panel>

      {pending ? (
        <PlaySetupModal
          key={`${pending.intent}-${pending.mode}`}
          open
          intent={pending.intent}
          initialMode={pending.mode}
          config={config}
          busy={busy}
          error={error}
          onClose={() => {
            setPending(null);
            setError(null);
          }}
          onConfirm={(selection, maxPlayers) => void confirmSetup(selection, maxPlayers)}
        />
      ) : null}

      <Modal title={t.joinWithCode} open={joinOpen} onClose={() => setJoinOpen(false)}>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (code.length === 6 && !busy) void confirmJoin();
          }}
        >
          <label htmlFor="join-pseudo" className="label block">
            Pseudo
          </label>
          <input
            id="join-pseudo"
            value={pseudo}
            maxLength={24}
            autoComplete="nickname"
            onChange={(event) => {
              setPseudo(event.target.value);
              if (pseudoError) setPseudoError(null);
            }}
            aria-invalid={pseudoError ? true : undefined}
            className="min-h-[48px] w-full rounded-md border border-line-strong bg-bg px-3 text-lg text-ink"
          />
          {pseudoError ? (
            <p role="alert" className="text-sm text-danger">
              {pseudoError}
            </p>
          ) : null}
          <label htmlFor="room-code" className="label block">
            Room code
          </label>
          <input
            id="room-code"
            value={code}
            maxLength={6}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            onChange={(event) =>
              setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
            }
            className="min-h-[48px] w-full rounded-md border border-line-strong bg-bg px-3 text-center font-mono text-2xl tracking-[0.15em] text-ink"
          />
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setJoinOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={code.length !== 6}>
              Join
            </Button>
          </div>
        </form>
      </Modal>
    </main>
  );
}
