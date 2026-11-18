import { useCallback, useEffect, useRef, useState } from 'react';
import { Stat } from '../components/game/Shell';
import { Banner } from '../components/ui/Banner';
import { FlameIcon, HeartIcon } from '../components/ui/Icons';
import { ImageFrame } from '../components/ui/ImageFrame';
import { OptionButton, type OptionState } from '../components/ui/OptionButton';
import { Timer } from '../components/ui/Timer';
import { contentAttributes, errorMessage, useTranslation } from '../i18n';
import { timerAnnouncement } from '../lib/announce';
import { ApiClientError } from '../lib/api';
import { gameActions } from '../lib/realtime';
import { useMe } from '../lib/useMe';
import { useRemaining } from '../lib/useRemaining';
import { useGameStore } from '../store/gameStore';

const KEY_TO_INDEX: Record<string, number> = {
  KeyA: 0,
  KeyB: 1,
  KeyC: 2,
  KeyD: 3,
  Digit1: 0,
  Digit2: 1,
  Digit3: 2,
  Digit4: 3,
  Numpad1: 0,
  Numpad2: 1,
  Numpad3: 2,
  Numpad4: 3,
};

export function indexForKeyCode(code: string): number | null {
  return KEY_TO_INDEX[code] ?? null;
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  );
}

export function QuestionView() {
  const { t } = useTranslation();
  const { room, me, paused } = useMe();
  const clockOffset = useGameStore((state) => state.clockOffset);
  const lockedChoice = useGameStore((state) => state.lockedChoice);
  const remaining = useRemaining(room, clockOffset);
  const [error, setError] = useState<string | null>(null);

  const question = room?.question ?? null;
  const locked = Boolean(question && me?.hasAnsweredQuestionId === question.id);
  const canAnswer = Boolean(
    question && me && me.status === 'CONNECTED' && !locked && !paused && room?.phase === 'QUESTION',
  );

  // Timer marks are spoken only to players who still have to answer (D-100).
  const lastReading = useRef<{ questionId: string | null; ms: number | null }>({
    questionId: null,
    ms: null,
  });
  const questionId = question?.id ?? null;
  const awaitingAnswer = canAnswer && !lockedChoice;
  useEffect(() => {
    const previous = lastReading.current;
    const before = previous.questionId === questionId ? previous.ms : null;
    lastReading.current = { questionId, ms: remaining };
    if (!awaitingAnswer || paused) return;
    const message = timerAnnouncement(before, remaining);
    if (message) useGameStore.getState().announce(message);
  }, [questionId, remaining, awaitingAnswer, paused]);

  const choose = useCallback(
    async (index: number) => {
      if (!question || !canAnswer) return;
      setError(null);
      try {
        await gameActions.answer(question.id, index);
      } catch (caught) {
        setError(errorMessage(caught instanceof ApiClientError ? caught.code : undefined));
      }
    },
    [question, canAnswer],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;
      if (isTypingTarget(event.target)) return;
      const index = indexForKeyCode(event.code);
      if (index === null) return;
      event.preventDefault();
      void choose(index);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [choose]);

  if (!room || !question) return null;

  const eliminated = me?.status === 'ELIMINATED';
  const forfeited = me?.status === 'FORFEITED' || me?.status === 'LEFT';
  const answered = room.players.filter(
    (player) => player.hasAnsweredQuestionId === question.id,
  ).length;
  const showLives = room.mode !== 'CONTEST';
  const total = room.settings.timerMs;
  const totalMs = room.settings.isTikTok
    ? total
    : room.phaseStartedAt && room.phaseEndsAt
      ? room.phaseEndsAt - room.phaseStartedAt
      : total;

  return (
    <main className="mx-auto w-full max-w-shell p-4 lg:p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-line bg-surface px-4 py-3">
        <div>
          <p className="label">
            {room.mode === 'CLASSIC'
              ? `${t('question.level', { level: room.level, total: room.totalLevels })} · `
              : ''}
            {t('question.counter', {
              index: room.questionIndex + 1,
              total: room.questionsPerLevel,
            })}
          </p>
          <p className="text-sm text-ink-2" aria-live="off">
            {t('question.answered', {
              answered,
              total: room.players.filter((p) => p.status === 'CONNECTED').length,
            })}
          </p>
        </div>
        <div className="flex items-center gap-5">
          {showLives && me ? (
            <div
              className="flex items-center gap-1 text-danger"
              role="img"
              aria-label={t('question.livesAria', { count: me.lives })}
            >
              {Array.from({ length: 3 }, (_, i) => (
                <HeartIcon key={i} className={i < me.lives ? '' : 'opacity-25'} />
              ))}
            </div>
          ) : null}
          <Stat label={t('common.score')} value={me?.score ?? 0} />
          {me && me.streak > 1 ? (
            <div
              className="flex items-center gap-1 text-warning"
              aria-label={t('question.streakAria', { count: me.streak })}
            >
              <FlameIcon />
              <span className="tabular font-mono font-bold">{me.streak}</span>
            </div>
          ) : null}
          <Timer remainingMs={remaining} totalMs={totalMs} paused={paused} size={72} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[55fr_45fr]">
        <ImageFrame
          image={question.image}
          language={room.language}
          className="h-60 sm:h-72 lg:h-[26rem]"
        />
        <div className="space-y-4">
          <h1
            tabIndex={-1}
            id="question-title"
            className="text-xl outline-none sm:text-2xl lg:text-3xl"
            {...contentAttributes(room.language)}
          >
            {question.questionText}
          </h1>
          <div role="group" aria-labelledby="question-title" className="grid gap-3">
            {question.options.map((option, index) => {
              let state: OptionState = 'default';
              if (lockedChoice?.questionId === question.id && lockedChoice.index === index) {
                state = 'selected';
              } else if (locked || !canAnswer) {
                state = 'muted';
              }
              return (
                <OptionButton
                  key={`${question.id}-${index}`}
                  index={index}
                  text={option}
                  state={state}
                  disabled={!canAnswer}
                  language={room.language}
                  onSelect={(chosen) => void choose(chosen)}
                />
              );
            })}
          </div>
          <p className="text-ink-2" role="status">
            {eliminated || forfeited
              ? t('question.watching')
              : locked
                ? t('question.locked')
                : paused
                  ? t('question.paused')
                  : t('question.chooseAnswer')}
          </p>
          {error ? <Banner variant="error">{error}</Banner> : null}
        </div>
      </div>
    </main>
  );
}
