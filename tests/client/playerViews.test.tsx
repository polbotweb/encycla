// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ME, jsonResponse, player, room } from './fixtures';
import { pinLanguage } from './language';

const actions = vi.hoisted(() => ({
  startSolo: vi.fn(),
  createRoom: vi.fn(),
  joinRoom: vi.fn(),
  joinQueue: vi.fn(),
  leaveQueue: vi.fn(),
  continueArticle: vi.fn(),
  skip: vi.fn(),
  vote: vi.fn(),
}));
const session = vi.hoisted(() => ({ ensureSession: vi.fn(), waitForConnected: vi.fn() }));

vi.mock('../../client/lib/realtime', () => ({ gameActions: actions, ...session }));

const { ApiClientError } = await import('../../client/lib/api');
const { errorMessage, labelFor, translate } = await import('../../client/i18n');
const { useGameStore } = await import('../../client/store/gameStore');
const { useSessionStore } = await import('../../client/store/sessionStore');
const { useUiStore } = await import('../../client/store/uiStore');
const { CountdownView } = await import('../../client/views/CountdownView');
const { LevelCompleteView } = await import('../../client/views/LevelCompleteView');
const { MatchmakingView } = await import('../../client/views/MatchmakingView');
const { LeaderboardView } = await import('../../client/views/LeaderboardView');
const { HomeView, validatePseudoInput } = await import('../../client/views/HomeView');
const { ResultsView } = await import('../../client/views/ResultsView');
const { PROTOCOL_VERSION } = await import('../../shared/protocol');

pinLanguage('en');

const CONFIG = {
  protocolVersion: PROTOCOL_VERSION,
  modes: ['CLASSIC', 'SUBJECT', 'CONTEST'],
  categories: [
    { value: 'History', questionCount: 120, subjectEnabled: true },
    { value: 'Science', questionCount: 4, subjectEnabled: false },
  ],
  constants: {},
};

let fetchMock: ReturnType<typeof vi.fn>;

function show(state: ReturnType<typeof room>): void {
  act(() => {
    useGameStore.getState().setPlayer(ME);
    useGameStore.getState().applyRoomState(state);
  });
}

beforeEach(() => {
  useGameStore.getState().reset();
  useSessionStore.getState().clear();
  useSessionStore.setState({ savedPseudo: '' });
  for (const fn of [...Object.values(actions), ...Object.values(session)]) {
    fn.mockReset();
    fn.mockResolvedValue(undefined);
  }
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('CountdownView', () => {
  it('counts down with the mode, category and difficulty', () => {
    const { container } = render(<CountdownView />);
    expect(container.innerHTML).toBe('');
    show(
      room('COUNTDOWN', {
        mode: 'SUBJECT',
        category: 'History',
        difficulty: 'Wizard',
        phaseEndsAt: Date.now() + 2500,
      }),
    );
    expect(screen.getByTestId('countdown').textContent).toBe('3');
    expect(
      screen.getByText(
        `${labelFor('mode', 'SUBJECT')} · ${labelFor('category', 'History')} · ${labelFor('difficulty', 'Wizard')}`,
      ),
    ).toBeTruthy();
  });
});

describe('LevelCompleteView', () => {
  it('continues once per phase token and recovers from an error', async () => {
    render(<LevelCompleteView />);
    show(room('LEVEL_COMPLETE', { players: [player(ME, 'Alice', { score: 420, streak: 3 })] }));
    expect(screen.getByText(translate('level.livesCarry'))).toBeTruthy();
    expect(screen.getByText('420')).toBeTruthy();
    actions.continueArticle.mockRejectedValueOnce(new ApiClientError('STALE_PHASE_TOKEN', 'x', 0));
    await act(async () => fireEvent.click(screen.getByText(translate('common.continue'))));
    expect(screen.getByRole('alert').textContent).toBe(errorMessage('STALE_PHASE_TOKEN'));
    await act(async () => fireEvent.click(screen.getByText(translate('common.continue'))));
    expect(actions.continueArticle).toHaveBeenLastCalledWith('token-1');
    expect(screen.getByText(translate('common.waitingOthers'))).toBeTruthy();
    show(room('LEVEL_COMPLETE', { stateVersion: 11, phaseToken: 'token-2' }));
    expect(screen.getByText(translate('common.continue'))).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByText(translate('common.skipForEveryone'))));
    expect(actions.skip).toHaveBeenCalled();
  });

  it('restores lives in solo and hides them in CONTEST', () => {
    render(<LevelCompleteView />);
    show(room('LEVEL_COMPLETE', { isSolo: true }));
    expect(screen.getByText(translate('level.livesRestored'))).toBeTruthy();
    show(room('LEVEL_COMPLETE', { stateVersion: 11, mode: 'CONTEST', isTikTok: true }));
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.queryByText(translate('common.continue'))).toBeNull();
  });
});

describe('MatchmakingView', () => {
  it('shows the queue, leaves it, and votes on a small room', async () => {
    const { container } = render(<MatchmakingView />);
    expect(container.innerHTML).toBe('');
    act(() =>
      useGameStore
        .getState()
        .setQueue({ position: 3, targetPlayers: 8, queuedAt: Date.now() - 65_000, proposal: null }),
    );
    expect(screen.getByText(translate('queue.searching'))).toBeTruthy();
    expect(screen.getByLabelText(/1:0[56]/)).toBeTruthy();
    fireEvent.click(screen.getByText(translate('common.cancel')));
    expect(actions.leaveQueue).toHaveBeenCalled();

    act(() =>
      useGameStore.getState().setProposal({
        proposalId: 'p1',
        playerCount: 3,
        expiresAt: Date.now() + 9000,
        voted: false,
      }),
    );
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('timer')).toBeTruthy();
    actions.vote.mockRejectedValueOnce(new ApiClientError('PROPOSAL_EXPIRED', 'x', 0));
    await act(async () => fireEvent.click(within(dialog).getByText(translate('queue.startSmall'))));
    expect(actions.vote).toHaveBeenCalledWith('p1', true);
    expect(screen.getByText(errorMessage('PROPOSAL_EXPIRED'))).toBeTruthy();
    await act(async () =>
      fireEvent.click(within(screen.getByRole('dialog')).getByText(translate('queue.keepWaiting'))),
    );
    expect(actions.vote).toHaveBeenLastCalledWith('p1', false);
    act(() => useGameStore.getState().markVoted());
    expect(within(screen.getByRole('dialog')).getByRole('status').textContent).toBe(
      translate('common.waitingOthers'),
    );
  });
});

describe('LeaderboardView', () => {
  const ENTRY = {
    rank: 1,
    playerId: ME,
    pseudo: 'Alice',
    avatar: '🦊',
    totalPoints: 900,
    matches: 2,
    bestMatchPoints: 600,
    correctCount: 9,
    firstMatchAt: 1,
  };

  it('loads, filters, pages and highlights the current player', async () => {
    useSessionStore
      .getState()
      .setSession({ playerId: ME, pseudo: 'Alice', token: 't', expiresAt: Date.now() + 1e6 });
    fetchMock.mockResolvedValueOnce(jsonResponse({ generatedAt: 1, entries: [] }));
    render(<LeaderboardView />);
    expect(screen.getByRole('status').textContent).toBe(translate('common.loading'));
    await screen.findByText(translate('leaderboard.empty'));

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        generatedAt: 1,
        entries: Array.from({ length: 50 }, (_, i) => ({
          ...ENTRY,
          rank: i + 1,
          playerId: `p${i}`,
        })),
      }),
    );
    fireEvent.change(screen.getByLabelText(translate('leaderboard.mode')), {
      target: { value: 'CONTEST' },
    });
    await screen.findByText(translate('leaderboard.loadMore'));
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/leaderboard?limit=50&mode=CONTEST');

    fetchMock.mockResolvedValueOnce(jsonResponse({ generatedAt: 1, entries: [ENTRY] }));
    fireEvent.click(screen.getByText(translate('leaderboard.loadMore')));
    await screen.findByText('900');
    expect(screen.getByText('Alice').closest('tr')?.className).toContain('font-semibold');

    fetchMock.mockResolvedValueOnce(jsonResponse({ generatedAt: 1, entries: [ENTRY] }));
    fireEvent.change(screen.getByLabelText(translate('leaderboard.source')), {
      target: { value: 'tiktok' },
    });
    await screen.findByText('900');
    expect(fetchMock.mock.calls[3]?.[0]).toBe(
      '/api/leaderboard?limit=100&mode=CONTEST&source=tiktok',
    );

    fireEvent.click(screen.getByText(translate('common.backHome')));
    expect(useUiStore.getState().screen).toBe('home');
  });

  it('explains a disabled leaderboard and retries after a failure', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { code: 'PERSISTENCE_DISABLED', message: 'off' } }, 503),
    );
    render(<LeaderboardView />);
    await screen.findByText(errorMessage('PERSISTENCE_DISABLED'));
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    fireEvent.click(screen.getByText(translate('common.retry')));
    await screen.findByText(translate('leaderboard.unavailable'));
  });
});

describe('HomeView', () => {
  function mount(config: unknown = CONFIG): void {
    fetchMock.mockResolvedValue(jsonResponse(config));
    render(<HomeView />);
  }

  it('validates nicknames', () => {
    expect(validatePseudoInput('a')).toBe(translate('pseudo.length'));
    expect(validatePseudoInput('<script>')).toBe(translate('pseudo.chars'));
    expect(validatePseudoInput('  Zoé  ')).toBeNull();
  });

  it('starts a solo SUBJECT game with the chosen category, difficulty and language', async () => {
    mount();
    await screen.findByText(/120|124/);
    fireEvent.click(screen.getByText(translate('home.soloClassic')));
    const first = screen.getByRole('dialog');
    await act(async () => fireEvent.click(within(first).getByText(translate('setup.startSolo'))));
    expect(document.getElementById('pseudo-error')?.textContent).toBe(translate('pseudo.length'));
    fireEvent.click(within(first).getByText(translate('common.cancel')));

    fireEvent.change(screen.getByLabelText(translate('home.pseudo')), {
      target: { value: '  Alice  ' },
    });
    fireEvent.click(screen.getByText(translate('home.soloSubject')));
    const dialog = screen.getByRole('dialog');
    const start = within(dialog).getByText(translate('setup.startSolo')).closest('button');
    expect(start?.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText(translate('setup.category')), {
      target: { value: 'History' },
    });
    fireEvent.click(within(dialog).getByLabelText(labelFor('difficulty', 'Wizard')));
    fireEvent.change(within(dialog).getByLabelText(translate('setup.questionLanguage')), {
      target: { value: 'ar' },
    });
    await act(async () => fireEvent.click(start as HTMLElement));
    expect(session.ensureSession).toHaveBeenCalledWith('Alice');
    expect(actions.startSolo).toHaveBeenCalledWith({
      mode: 'SUBJECT',
      category: 'History',
      difficulty: 'Wizard',
      language: 'ar',
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(useSessionStore.getState().savedPseudo).toBe('Alice');
  });

  it('creates a private room, joins the queue, and keeps errors in the dialog', async () => {
    useSessionStore.getState().setPseudo('Bob');
    mount();
    fireEvent.click(screen.getByText(translate('home.createPrivate')));
    let dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(translate('setup.maxPlayers')), {
      target: { value: '12' },
    });
    await act(async () =>
      fireEvent.click(within(dialog).getByText(translate('setup.startPrivate'))),
    );
    expect(actions.createRoom).toHaveBeenCalledWith(
      { mode: 'CLASSIC', category: null, difficulty: null, language: 'en' },
      8,
    );

    actions.joinQueue.mockRejectedValueOnce(new ApiClientError('QUEUE_ALREADY_JOINED', 'x', 409));
    fireEvent.click(screen.getByText(translate('home.playOnline')));
    dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByLabelText(translate('mode.CONTEST.desc')));
    await act(async () => fireEvent.click(within(dialog).getByText(translate('setup.startQueue'))));
    expect(actions.joinQueue).toHaveBeenCalledWith({
      mode: 'CONTEST',
      category: null,
      difficulty: null,
      language: 'en',
    });
    expect(within(screen.getByRole('dialog')).getByRole('alert').textContent).toBe(
      errorMessage('QUEUE_ALREADY_JOINED'),
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();

    session.waitForConnected.mockRejectedValueOnce(new ApiClientError('NETWORK_ERROR', 'x', 0));
    fireEvent.click(screen.getByText(translate('home.playOnline')));
    await act(async () =>
      fireEvent.click(within(screen.getByRole('dialog')).getByText(translate('setup.startQueue'))),
    );
    expect(screen.getByText(errorMessage('INTERNAL_ERROR'))).toBeTruthy();
  });

  it('joins with a prefilled invite code', async () => {
    useSessionStore.getState().setPseudo('Bob');
    useUiStore.getState().setPrefilledCode('QWERTY');
    mount();
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(translate('home.roomCode')), {
      target: { value: 'qw-er ty' },
    });
    expect(
      (within(dialog).getByLabelText(translate('home.roomCode')) as HTMLInputElement).value,
    ).toBe('QWERTY');
    await act(async () => fireEvent.click(within(dialog).getByText(translate('home.join'))));
    expect(actions.joinRoom).toHaveBeenCalledWith('QWERTY');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    fireEvent.click(screen.getByText(translate('home.leaderboard')));
    expect(useUiStore.getState().screen).toBe('leaderboard');
  });

  it('reports an unreachable server, an empty bank and a protocol mismatch', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    render(<HomeView />);
    await screen.findByText(translate('common.retry'));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ...CONFIG, protocolVersion: -1, categories: [] }),
    );
    fireEvent.click(screen.getByText(translate('common.retry')));
    await screen.findByText(translate('home.noQuestions'));
    expect(useGameStore.getState().protocolMismatch).toBe(true);
  });
});

describe('ResultsView', () => {
  it("shows each player's best streak in the final ranking", () => {
    render(<ResultsView />);
    show(
      room('MATCH_OVER', {
        players: [player(ME, 'Alice', { score: 900, bestStreak: 7 }), player('p-2', 'Bob')],
        finalRanking: [
          { playerId: ME, rank: 1, tied: false },
          { playerId: 'p-2', rank: 2, tied: false },
        ],
        winnerId: ME,
      }),
    );
    expect(
      screen.getByRole('columnheader', { name: translate('results.bestStreak') }),
    ).toBeTruthy();
    const row = screen.getAllByRole('row').find((item) => item.textContent?.includes('Alice'));
    expect(row?.textContent).toContain('7');
  });
});
