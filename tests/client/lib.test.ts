import { describe, expect, it } from 'vitest';
import { announcementFor } from '../../client/lib/announce';
import { formatClock, formatResponseTime, truncate } from '../../client/lib/format';
import { parseRoute } from '../../client/lib/route';
import { validatePseudoInput } from '../../client/views/HomeView';
import type { PublicRoomState } from '../../shared/types';
import { pinLanguage } from './language';

pinLanguage('en');

function room(overrides: Partial<PublicRoomState> = {}): PublicRoomState {
  return {
    stateVersion: 1,
    serverNow: 0,
    roomCode: 'ABCDEF',
    mode: 'CLASSIC',
    difficulty: null,
    category: null,
    language: 'en',
    isPublic: false,
    isTikTok: false,
    isSolo: true,
    tiktokConnected: false,
    phase: 'LOBBY',
    pausedFrom: null,
    level: 1,
    totalLevels: 10,
    questionIndex: 0,
    questionsPerLevel: 20,
    totalQuestionsAnswered: 0,
    phaseStartedAt: null,
    phaseEndsAt: null,
    pausedAt: null,
    remainingMs: null,
    phaseToken: null,
    hostId: null,
    matchId: null,
    settings: {} as PublicRoomState['settings'],
    players: [],
    question: null,
    reveal: null,
    results: null,
    finalRanking: null,
    winnerId: null,
    ...overrides,
  };
}

describe('parseRoute', () => {
  it('defaults to the player home screen', () => {
    expect(parseRoute('', '')).toEqual({ kind: 'player', screen: 'home', code: '' });
  });

  it('reads overlay tokens from the fragment, never the query', () => {
    expect(parseRoute('?mode=overlay&room=abcdef&token=leak', '#token=ovl_secret')).toEqual({
      kind: 'overlay',
      roomCode: 'ABCDEF',
      token: 'ovl_secret',
    });
  });

  it('reads control and overlay tokens for the control view', () => {
    expect(parseRoute('?mode=control&room=ABCDEF', '#token=ctl_a&overlay=ovl_b')).toEqual({
      kind: 'control',
      roomCode: 'ABCDEF',
      token: 'ctl_a',
      overlayToken: 'ovl_b',
    });
  });

  it('sanitizes the join code', () => {
    expect(parseRoute('?mode=join&code=ab-c%20def123', '')).toEqual({
      kind: 'player',
      screen: 'home',
      code: 'ABCDEF',
    });
  });

  it('opens the leaderboard', () => {
    expect(parseRoute('?mode=leaderboard', '')).toMatchObject({ screen: 'leaderboard' });
    expect(parseRoute('?mode=admin', '')).toEqual({ kind: 'admin' });
  });
});

describe('format helpers', () => {
  it('formats clocks and durations', () => {
    expect(formatClock(61_000)).toBe('01:01');
    expect(formatClock(-5)).toBe('00:00');
    expect(formatResponseTime(2_345)).toBe('2.3s');
  });

  it('truncates by code point', () => {
    expect(truncate('abcdef', 4)).toBe('abc…');
    expect(truncate('ok', 4)).toBe('ok');
  });
});

describe('validatePseudoInput', () => {
  it('accepts unicode letters and rejects markup or short names', () => {
    expect(validatePseudoInput('Élodie')).toBeNull();
    expect(validatePseudoInput('a')).not.toBeNull();
    expect(validatePseudoInput('<b>x</b>')).not.toBeNull();
    expect(validatePseudoInput('x'.repeat(25))).not.toBeNull();
  });
});

describe('announcementFor', () => {
  it('announces a new phase once and stays silent on same-phase updates', () => {
    const lobby = room();
    const countdown = room({ phase: 'COUNTDOWN', stateVersion: 2 });
    expect(announcementFor(lobby, countdown, null)).toBe('Match starting.');
    expect(announcementFor(countdown, { ...countdown, stateVersion: 3 }, null)).toBeNull();
  });

  it('reports the result in the reveal without relying on color', () => {
    const reveal = {
      questionId: 'q1',
      correctIndex: 1,
      options: ['Carnac', 'Stonehenge', 'Avebury', 'Newgrange'],
      articleTitle: 'Stonehenge',
    } as unknown as PublicRoomState['reveal'];
    const state = room({
      phase: 'REVEAL',
      reveal,
      results: [
        { playerId: 'p1', choiceIndex: 0, correct: false, timedOut: false },
      ] as unknown as PublicRoomState['results'],
    });
    const message = announcementFor(room({ phase: 'QUESTION' }), state, 'p1');
    expect(message).toContain('Correct answer: B, Stonehenge.');
    expect(message).toContain('Incorrect.');
  });
});
