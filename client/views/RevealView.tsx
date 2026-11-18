import { ViewTitle } from '../components/game/Shell';
import { CheckIcon, CrossIcon, FlameIcon, HeartIcon } from '../components/ui/Icons';
import { ImageFrame } from '../components/ui/ImageFrame';
import { OptionButton, type OptionState } from '../components/ui/OptionButton';
import { TextWithTerm } from '../components/ui/Term';
import { TopList } from '../components/ui/TopList';
import { contentAttributes, useTranslation } from '../i18n';
import { useMe } from '../lib/useMe';
import { useGameStore } from '../store/gameStore';

export function RevealView() {
  const { t } = useTranslation();
  const { room, me, playerId } = useMe();
  const lockedChoice = useGameStore((state) => state.lockedChoice);
  const reveal = room?.reveal ?? null;
  if (!room || !reveal) return null;

  const mine = room.results?.find((result) => result.playerId === playerId) ?? null;
  const chosenIndex =
    mine?.choiceIndex ??
    (lockedChoice?.questionId === reveal.questionId ? lockedChoice.index : null);

  let verdict: { text: string; tone: string; icon: 'check' | 'cross' } | null = null;
  if (mine) {
    verdict = mine.timedOut
      ? { text: t('verdict.timeout'), tone: 'border-danger text-danger', icon: 'cross' }
      : mine.correct
        ? { text: t('verdict.correct'), tone: 'border-success text-success', icon: 'check' }
        : { text: t('verdict.incorrect'), tone: 'border-danger text-danger', icon: 'cross' };
  }

  return (
    <main className="mx-auto w-full max-w-shell space-y-4 p-4 lg:p-8">
      <div className="grid gap-4 lg:grid-cols-[55fr_45fr]">
        <ImageFrame
          image={reveal.image}
          language={room.language}
          className="h-60 sm:h-72 lg:h-[26rem]"
        />
        <div className="space-y-4">
          {verdict ? (
            <div
              className={`flex items-center gap-2 rounded-md border-2 px-4 py-2 text-xl font-bold ${verdict.tone}`}
              role="status"
            >
              {verdict.icon === 'check' ? <CheckIcon /> : <CrossIcon />}
              <ViewTitle>{verdict.text}</ViewTitle>
              {mine && mine.pointsAwarded > 0 ? (
                <span className="tabular ms-auto font-mono">+{mine.pointsAwarded}</span>
              ) : null}
            </div>
          ) : (
            <ViewTitle>{t('reveal.title')}</ViewTitle>
          )}
          <h2 className="text-xl sm:text-2xl" {...contentAttributes(room.language)}>
            {reveal.questionText}
          </h2>
          <div role="group" aria-label={t('reveal.answers')} className="grid gap-3">
            {reveal.options.map((option, index) => {
              let state: OptionState = 'muted';
              if (index === reveal.correctIndex) state = 'correct';
              else if (chosenIndex === index) state = 'incorrect';
              return (
                <OptionButton
                  key={index}
                  index={index}
                  text={option}
                  state={state}
                  language={room.language}
                  form={reveal.optionForms?.[index]}
                  disabled
                />
              );
            })}
          </div>
          <p className="text-ink-2" {...contentAttributes(room.language)}>
            <TextWithTerm
              text={reveal.explanation}
              term={reveal.subject}
              form={reveal.subjectForm}
            />
          </p>
          {me ? (
            <div className="flex flex-wrap items-center gap-4 text-sm text-ink-2">
              {me.streak > 1 ? (
                <span className="flex items-center gap-1 text-warning">
                  <FlameIcon /> {t('reveal.streak', { count: me.streak })}
                </span>
              ) : null}
              {room.mode !== 'CONTEST' ? (
                <span className="flex items-center gap-1 text-danger">
                  <HeartIcon /> {t('reveal.lives', { count: me.lives })}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      <TopList players={room.players} youId={playerId} />
    </main>
  );
}
