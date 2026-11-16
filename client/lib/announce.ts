import type { PublicRoomState } from '../../shared/types';
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
      return 'Match starting.';
    case 'QUESTION':
      return next.question
        ? `Question ${next.questionIndex + 1} of ${next.questionsPerLevel}. ${next.question.questionText}`
        : null;
    case 'REVEAL': {
      const reveal = next.reveal;
      if (!reveal) return null;
      const correctText = reveal.options[reveal.correctIndex] ?? '';
      const mine = next.results?.find((result) => result.playerId === playerId);
      let outcome = '';
      if (mine) {
        if (mine.timedOut) {
          outcome = " Time's up.";
        } else {
          const chosen = mine.choiceIndex === null ? '' : (reveal.options[mine.choiceIndex] ?? '');
          outcome = ` You answered ${chosen}. ${mine.correct ? 'Correct.' : 'Incorrect.'}`;
        }
      }
      const letter = OPTION_LETTERS[reveal.correctIndex] ?? '';
      return `Correct answer: ${letter}, ${correctText}.${outcome}`;
    }
    case 'ARTICLE':
      return next.reveal ? `Article: ${next.reveal.articleTitle}.` : 'Article.';
    case 'LEVEL_COMPLETE':
      return `Level ${next.level} complete.`;
    case 'MATCH_OVER': {
      const entry = next.finalRanking?.find((candidate) => candidate.playerId === playerId);
      if (!next.finalRanking || next.finalRanking.length === 0) {
        return 'Match abandoned.';
      }
      return entry
        ? `Match complete. You finished ${entry.rank} of ${next.finalRanking.length}.`
        : 'Match complete.';
    }
    case 'PAUSED':
      return 'Paused.';
    case 'CLOSED':
      return 'Room closed.';
    default:
      return null;
  }
}
