import type { PublicRoomState } from '../../shared/types';
import { translate } from '../i18n';
import { OPTION_LETTERS } from './format';

/** Screen-reader announcements derived from snapshots (UI-UX 21.2). Pure and testable. */
export function announcementFor(
  previous: PublicRoomState | null,
  next: PublicRoomState,
  playerId: string | null,
): string | null {
  if (previous && previous.phase === next.phase && previous.question?.id === next.question?.id) {
    return null;
  }
  switch (next.phase) {
    case 'COUNTDOWN':
      return translate('announce.matchStarting');
    case 'QUESTION':
      return next.question
        ? translate('announce.question', {
            index: next.questionIndex + 1,
            total: next.questionsPerLevel,
            text: next.question.questionText,
          })
        : null;
    case 'REVEAL': {
      const reveal = next.reveal;
      if (!reveal) return null;
      const correctText = reveal.options[reveal.correctIndex] ?? '';
      const mine = next.results?.find((result) => result.playerId === playerId);
      let outcome = '';
      if (mine) {
        if (mine.timedOut) {
          outcome = ` ${translate('announce.timeUp')}`;
        } else {
          const chosen = mine.choiceIndex === null ? '' : (reveal.options[mine.choiceIndex] ?? '');
          outcome = ` ${translate('announce.youAnswered', { text: chosen })} ${translate(
            mine.correct ? 'announce.right' : 'announce.wrong',
          )}`;
        }
      }
      const letter = OPTION_LETTERS[reveal.correctIndex] ?? '';
      return `${translate('announce.correctAnswer', { letter, text: correctText })}${outcome}`;
    }
    case 'ARTICLE':
      return next.reveal
        ? translate('announce.article', { title: next.reveal.articleTitle })
        : translate('announce.articleOnly');
    case 'LEVEL_COMPLETE':
      return translate('announce.levelComplete', { level: next.level });
    case 'MATCH_OVER': {
      const entry = next.finalRanking?.find((candidate) => candidate.playerId === playerId);
      if (!next.finalRanking || next.finalRanking.length === 0) {
        return translate('announce.matchAbandoned');
      }
      return entry
        ? translate('announce.finished', { rank: entry.rank, total: next.finalRanking.length })
        : translate('announce.matchComplete');
    }
    case 'PAUSED':
      return translate('announce.paused');
    case 'CLOSED':
      return translate('announce.closed');
    default:
      return null;
  }
}
