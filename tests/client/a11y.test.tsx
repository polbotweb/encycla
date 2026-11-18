// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { translate, useLanguageStore } from '../../client/i18n';
import { timerAnnouncement } from '../../client/lib/announce';
import { useGameStore } from '../../client/store/gameStore';
import { QuestionView } from '../../client/views/QuestionView';
import { ME, QUESTION, player, room } from './fixtures';
import { pinLanguage } from './language';

pinLanguage('en');

describe('timerAnnouncement', () => {
  it('speaks the 10 s, 5 s and 0 marks once, and the latest mark when several are skipped', () => {
    expect(timerAnnouncement(10_200, 9_900)).toBe('10 seconds remaining.');
    expect(timerAnnouncement(9_900, 9_700)).toBeNull();
    expect(timerAnnouncement(5_100, 4_900)).toBe('5 seconds remaining.');
    expect(timerAnnouncement(200, 0)).toBe("Time's up.");
    expect(timerAnnouncement(12_000, 4_000)).toBe('5 seconds remaining.');
    expect(timerAnnouncement(null, 9_000)).toBeNull();
    expect(timerAnnouncement(4_000, 6_000)).toBeNull();
  });

  it('is translated', () => {
    useLanguageStore.setState({ language: 'fr' });
    expect(timerAnnouncement(10_200, 9_900)).toBe(
      `${translate('timer.remaining', { count: 10 })}.`,
    );
    expect(timerAnnouncement(10, 0)).toBe('Temps écoulé.');
  });
});

describe('QuestionView timer announcements', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useGameStore.getState().reset();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  function start(overrides: Parameters<typeof room>[1] = {}): void {
    act(() => {
      useGameStore.getState().setPlayer(ME);
      useGameStore.getState().applyRoomState(
        room('QUESTION', {
          question: QUESTION,
          phaseEndsAt: Date.now() + 11_000,
          ...overrides,
        }),
      );
    });
  }

  it('announces the marks to a player who has not answered', () => {
    render(<QuestionView />);
    start();
    const questionAnnouncement = useGameStore.getState().announcement;
    expect(questionAnnouncement).toContain(QUESTION.questionText);
    act(() => vi.advanceTimersByTime(1_200));
    expect(useGameStore.getState().announcement).toBe('10 seconds remaining.');
    act(() => vi.advanceTimersByTime(5_000));
    expect(useGameStore.getState().announcement).toBe('5 seconds remaining.');
    act(() => vi.advanceTimersByTime(5_000));
    expect(useGameStore.getState().announcement).toBe("Time's up.");
  });

  it('stays quiet once the player has answered', () => {
    render(<QuestionView />);
    start({ players: [player(ME, 'Alice', { hasAnsweredQuestionId: QUESTION.id })] });
    const before = useGameStore.getState().announcement;
    act(() => vi.advanceTimersByTime(11_000));
    expect(useGameStore.getState().announcement).toBe(before);
  });
});
