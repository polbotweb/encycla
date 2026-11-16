// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from '../../client/App';
import { useGameStore } from '../../client/store/gameStore';
import { useUiStore } from '../../client/store/uiStore';
import type { PublicPlayer, PublicRoomState, RoomPhase } from '../../shared/types';
import { pinLanguage } from './language';

pinLanguage('en');

const ME = 'p-me';

function player(id: string, name: string, overrides: Partial<PublicPlayer> = {}): PublicPlayer {
  return {
    id,
    pseudo: name,
    displayName: name,
    avatar: '🦊',
    score: 0,
    lives: 3,
    streak: 0,
    correctCount: 0,
    wrongCount: 0,
    timeoutCount: 0,
    totalResponseMs: 0,
    isReady: false,
    status: 'CONNECTED',
    isHost: id === ME,
    joinedAt: 0,
    hasAnsweredQuestionId: null,
    ...overrides,
  };
}

const OPTIONS = ['Carnac', 'Stonehenge', 'Avebury', 'Newgrange'];

function room(phase: RoomPhase, overrides: Partial<PublicRoomState> = {}): PublicRoomState {
  const now = Date.now();
  return {
    stateVersion: 10,
    serverNow: now,
    roomCode: 'ABCDEF',
    mode: 'CLASSIC',
    difficulty: null,
    category: null,
    language: 'en',
    isPublic: false,
    isTikTok: false,
    isSolo: false,
    tiktokConnected: false,
    phase,
    pausedFrom: null,
    level: 1,
    totalLevels: 10,
    questionIndex: 0,
    questionsPerLevel: 20,
    totalQuestionsAnswered: 0,
    phaseStartedAt: now,
    phaseEndsAt: now + 20_000,
    pausedAt: null,
    remainingMs: null,
    phaseToken: 'token-1',
    hostId: ME,
    matchId: null,
    settings: {
      maxPlayers: 8,
      timerMs: 20_000,
      lifePolicy: 'persist',
      articlePolicy: 'manual',
      autoAdvanceMs: null,
      isTikTok: false,
      isPublic: false,
    },
    players: [player(ME, 'Alice'), player('p-2', 'Bob', { score: 300 })],
    question: null,
    reveal: null,
    results: null,
    finalRanking: null,
    winnerId: null,
    ...overrides,
  };
}

const QUESTION = {
  id: 'q1',
  subject: 'Stonehenge',
  questionText: 'What is this prehistoric monument?',
  options: OPTIONS,
  image: { url: 'https://upload.wikimedia.org/x.jpg', alt: 'Standing stones' },
};

const REVEAL = {
  questionId: 'q1',
  subject: 'Stonehenge',
  questionText: QUESTION.questionText,
  options: OPTIONS,
  correctIndex: 1,
  explanation: 'A ring of standing stones in Wiltshire.',
  articleTitle: 'Stonehenge',
  articleBody: 'Stonehenge is a prehistoric monument.\n\nIt was built in stages.',
  textLanguage: 'en' as const,
  image: QUESTION.image,
};

function show(state: PublicRoomState): void {
  act(() => {
    useGameStore.getState().setPlayer(ME);
    useGameStore.getState().applyRoomState(state);
  });
}

async function a11yViolations(container: HTMLElement): Promise<string[]> {
  // jsdom has no layout engine: contrast is covered by the Playwright axe scans instead.
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  return results.violations.map((violation) => `${violation.id}: ${violation.help}`);
}

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  useGameStore.getState().reset();
  useUiStore.getState().setScreen('home');
});
afterEach(cleanup);

describe('player views by phase', () => {
  it('lobby: lists players and gates the start button until everyone is ready', async () => {
    const { container } = render(<App />);
    show(room('LOBBY'));
    expect(await screen.findByTestId('room-code')).toHaveProperty('textContent', 'ABCDEF');
    expect(screen.getByText('Bob')).toBeTruthy();
    const start = screen.getByRole('button', { name: /start game/i });
    expect((start as HTMLButtonElement).disabled).toBe(true);
    expect(await a11yViolations(container)).toEqual([]);
  });

  it('question: shows four named options, a timer, and never the answer', async () => {
    const { container } = render(<App />);
    show(room('QUESTION', { question: QUESTION }));
    const title = await screen.findByText(QUESTION.questionText);
    expect(title).toBeTruthy();
    for (const [index, text] of OPTIONS.entries()) {
      expect(
        screen.getByRole('button', { name: new RegExp(`^${'ABCD'[index]} ${text}`) }),
      ).toBeTruthy();
    }
    expect(container.innerHTML).not.toMatch(/correct/i);
    expect(screen.getByRole('timer')).toBeTruthy();
    expect(await a11yViolations(container)).toEqual([]);
  });

  it('reveal: marks the correct and the chosen wrong option with text, not colour alone', async () => {
    const { container } = render(<App />);
    show(
      room('REVEAL', {
        question: null,
        reveal: REVEAL,
        results: [
          {
            playerId: ME,
            choiceIndex: 0,
            correct: false,
            timedOut: false,
            responseTimeMs: 2100,
            pointsAwarded: 0,
          },
          {
            playerId: 'p-2',
            choiceIndex: 1,
            correct: true,
            timedOut: false,
            responseTimeMs: 1500,
            pointsAwarded: 300,
          },
        ],
      }),
    );
    const correct = await screen.findByRole('button', { name: /Stonehenge.*Correct/ });
    expect(correct).toBeTruthy();
    expect(screen.getByRole('button', { name: /Carnac.*Incorrect/ })).toBeTruthy();
    expect(await a11yViolations(container)).toEqual([]);
  });

  it('article: renders the body as plain paragraphs, never as HTML', async () => {
    const { container } = render(<App />);
    show(
      room('ARTICLE', {
        reveal: {
          ...REVEAL,
          articleBody: 'First paragraph <img src=x onerror=alert(1)>\n\nSecond.',
        },
      }),
    );
    expect(await screen.findByRole('heading', { name: 'Stonehenge' })).toBeTruthy();
    expect(container.querySelector('img[onerror]')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(await a11yViolations(container)).toEqual([]);
  });

  it('match over: renders the final ranking', async () => {
    const { container } = render(<App />);
    show(
      room('MATCH_OVER', {
        finalRanking: [
          { playerId: 'p-2', rank: 1, tied: false },
          { playerId: ME, rank: 2, tied: false },
        ],
        winnerId: 'p-2',
      }),
    );
    const table = await screen.findByRole('table');
    expect(within(table).getAllByRole('row').length).toBeGreaterThanOrEqual(3);
    expect(await a11yViolations(container)).toEqual([]);
  });

  it('paused: shows the paused banner', async () => {
    render(<App />);
    show(room('PAUSED', { pausedFrom: 'QUESTION', question: QUESTION }));
    expect((await screen.findAllByText(/paused/i)).length).toBeGreaterThan(0);
  });

  it('closed room: tells the player and offers a way back', async () => {
    render(<App />);
    show(room('LOBBY'));
    act(() => useGameStore.getState().setClosed('HOST_CLOSED'));
    expect(await screen.findByText(/host closed the room/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /back/i })).toBeTruthy();
  });

  it('announces phase changes through a polite live region', async () => {
    render(<App />);
    show(room('QUESTION', { question: QUESTION }));
    const live = document.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toContain('Question 1 of 20');
  });
});
