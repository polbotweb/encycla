// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeSocket, fakeIo } from './fakeSocket';
import { REVEAL, QUESTION, player, room } from './fixtures';
import { pinLanguage } from './language';

vi.mock('socket.io-client', () => ({ io: fakeIo }));

const { OverlayView, overlayEndTitle } = await import('../../client/views/OverlayView');
const { ControlView } = await import('../../client/views/ControlView');
const { errorMessage, translate } = await import('../../client/i18n');

pinLanguage('en');

function feed(): FakeSocket {
  const socket = FakeSocket.last();
  act(() => socket.serverEmit('connect'));
  return socket;
}

function push(socket: FakeSocket, state: ReturnType<typeof room>): void {
  act(() => socket.serverEmit('ROOM_STATE', state));
}

beforeEach(() => {
  FakeSocket.instances = [];
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('OverlayView', () => {
  it('is unavailable without a token, and ends when the room is gone', () => {
    const { unmount } = render(<OverlayView roomCode="ABCDEF" token="" />);
    expect(screen.getByText(translate('overlay.unavailable'))).toBeTruthy();
    expect(FakeSocket.instances).toHaveLength(0);
    unmount();

    render(<OverlayView roomCode="ABCDEF" token="ovl" />);
    const socket = FakeSocket.last();
    expect(socket.options.auth).toEqual({ role: 'overlay', roomCode: 'ABCDEF', token: 'ovl' });
    expect(document.body.classList.contains('overlay-root')).toBe(true);
    act(() =>
      socket.serverEmit(
        'connect_error',
        Object.assign(new Error('gone'), { data: { code: 'ROOM_NOT_FOUND' } }),
      ),
    );
    expect(screen.getByText(translate('overlay.ended'))).toBeTruthy();
  });

  it('renders every phase from the feed and ignores stale snapshots', () => {
    render(<OverlayView roomCode="ABCDEF" token="ovl" />);
    const socket = feed();
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy();

    push(socket, room('LOBBY', { players: [], tiktokConnected: true, isTikTok: true }));
    expect(screen.getByText(translate('overlay.join'))).toBeTruthy();
    expect(screen.getByText(translate('overlay.waitingFirst'))).toBeTruthy();
    push(socket, room('QUESTION', { stateVersion: 9, question: QUESTION }));
    expect(screen.queryByText(QUESTION.questionText)).toBeNull();

    push(socket, room('COUNTDOWN', { stateVersion: 11 }));
    expect(screen.getByText(translate('countdown.getReady'))).toBeTruthy();
    expect(screen.getByText(translate('overlay.chatReconnecting'))).toBeTruthy();

    push(socket, room('QUESTION', { stateVersion: 12, question: QUESTION }));
    expect(screen.getByRole('heading', { name: QUESTION.questionText })).toBeTruthy();
    expect(screen.getByRole('timer')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();

    push(socket, room('PAUSED', { stateVersion: 13, pausedFrom: 'REVEAL', reveal: REVEAL }));
    expect(screen.getByText(translate('overlay.paused'))).toBeTruthy();
    expect(screen.getByText(REVEAL.explanation)).toBeTruthy();

    push(socket, room('ARTICLE', { stateVersion: 14, reveal: REVEAL }));
    expect(screen.getByRole('heading', { name: REVEAL.articleTitle })).toBeTruthy();

    push(socket, room('LEVEL_COMPLETE', { stateVersion: 15 }));
    expect(screen.getByText(translate('overlay.levelComplete', { level: 1 }))).toBeTruthy();

    const ranking = room('MATCH_OVER', {
      stateVersion: 16,
      finalRanking: [{ playerId: 'p-2', rank: 1 }] as never,
      winnerId: 'p-2',
    });
    push(socket, ranking);
    expect(screen.getByText(translate('results.wins', { name: 'Bob' }))).toBeTruthy();

    act(() => socket.serverEmit('ROOM_CLOSED', { reason: 'HOST_CLOSED' }));
    expect(screen.getByText(translate('overlay.ended'))).toBeTruthy();
  });

  it('titles the end screen for draws and empty matches', () => {
    expect(overlayEndTitle(room('MATCH_OVER'))).toBe(translate('results.noWinner'));
    expect(
      overlayEndTitle(room('MATCH_OVER', { finalRanking: [{}] as never, winnerId: null })),
    ).toBe(translate('results.draw'));
    expect(
      overlayEndTitle(room('MATCH_OVER', { finalRanking: [{}] as never, winnerId: 'ghost' })),
    ).toBe(translate('results.wins', { name: translate('common.unknown') }));
  });
});

describe('ControlView', () => {
  const ALL = ['start', 'pause', 'resume', 'skip', 'close', 'manual_answer'];

  function open(overlayToken?: string): FakeSocket {
    render(
      <ControlView roomCode="ABCDEF" token="ctl" {...(overlayToken ? { overlayToken } : {})} />,
    );
    expect(screen.getByText(translate('control.connecting'))).toBeTruthy();
    const socket = feed();
    act(() => socket.serverEmit('CONTROL_READY', { capabilities: ALL }));
    return socket;
  }

  it('reports an invalid token and a closed room', () => {
    render(<ControlView roomCode="ABCDEF" token="ctl" />);
    act(() =>
      FakeSocket.last().serverEmit(
        'connect_error',
        Object.assign(new Error('no'), { data: { code: 'AUTH_INVALID' } }),
      ),
    );
    expect(screen.getByText(translate('control.unavailable'))).toBeTruthy();
    cleanup();
    render(<ControlView roomCode="ABCDEF" token="ctl" />);
    act(() => FakeSocket.last().serverEmit('ROOM_CLOSED', { reason: 'X' }));
    expect(screen.getByText(translate('control.ended'))).toBeTruthy();
  });

  it('starts, pauses, resumes and logs actions and failures', async () => {
    const socket = open();
    push(socket, room('LOBBY', { isTikTok: true, tiktokConnected: true }));
    expect(screen.getByText(translate('control.noActions'))).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByText(translate('control.start'))));
    expect(socket.emitted.at(-1)?.event).toBe('GAME_START');
    expect(screen.getByText(translate('control.logStart'))).toBeTruthy();

    push(socket, room('QUESTION', { stateVersion: 11, question: QUESTION, tiktokConnected: true }));
    socket.acks.set('HOST_PAUSE', {
      ok: false,
      error: { code: 'NOT_HOST', message: 'no', requestId: 'r0' },
    });
    await act(async () => fireEvent.click(screen.getByText(translate('common.pause'))));
    expect(screen.getByRole('alert')).toBeTruthy();

    push(
      socket,
      room('PAUSED', { stateVersion: 12, pausedFrom: 'QUESTION', tiktokConnected: true }),
    );
    await act(async () => fireEvent.click(screen.getByText(translate('common.resume'))));
    expect(socket.emitted.at(-1)?.event).toBe('HOST_RESUME');
  });

  it('confirms skip and close, and sends manual answers', async () => {
    const socket = open();
    push(socket, room('QUESTION', { question: QUESTION, tiktokConnected: true }));
    fireEvent.click(screen.getByText(translate('control.skip')));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(translate('control.skipBody'))).toBeTruthy();
    await act(async () => fireEvent.click(within(dialog).getByText(translate('common.confirm'))));
    expect(socket.emitted.at(-1)?.event).toBe('HOST_SKIP');

    fireEvent.click(screen.getByText(translate('control.close')));
    fireEvent.click(within(screen.getByRole('dialog')).getByText(translate('common.cancel')));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByText(translate('control.close')));
    await act(async () =>
      fireEvent.click(within(screen.getByRole('dialog')).getByText(translate('common.confirm'))),
    );
    expect(socket.emitted.at(-1)?.event).toBe('HOST_CLOSE');

    fireEvent.change(screen.getByLabelText(translate('control.searchPlayer')), {
      target: { value: 'bo' },
    });
    expect(
      screen.queryByRole('button', {
        name: translate('control.answerFor', { letter: 'A', name: 'Alice' }),
      }),
    ).toBeNull();
    await act(async () =>
      fireEvent.click(
        screen.getByRole('button', {
          name: translate('control.answerFor', { letter: 'C', name: 'Bob' }),
        }),
      ),
    );
    expect(socket.emitted.at(-1)).toEqual({
      event: 'HOST_MANUAL_ANSWER',
      payload: { playerId: 'p-2', choiceIndex: 2 },
    });

    push(socket, room('ARTICLE', { stateVersion: 11, reveal: REVEAL, tiktokConnected: true }));
    await act(async () => fireEvent.click(screen.getByText(translate('control.skip'))));
    expect(socket.emitted.at(-1)?.event).toBe('HOST_SKIP');
  });

  it('copies the overlay link, and reports when the clipboard fails', async () => {
    const writeText = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('x'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const socket = open('ovl-token');
    push(socket, room('LOBBY', { players: [player('p-2', 'Bob')] }));
    await act(async () => fireEvent.click(screen.getByText(translate('control.copyOverlay'))));
    expect(writeText.mock.calls[0]?.[0]).toContain(
      'mode=overlay&room=ABCDEF&voice=1#token=ovl-token',
    );
    expect(screen.getByText(translate('common.copied'))).toBeTruthy();
    cleanup();
    const second = open('ovl-token');
    push(second, room('LOBBY'));
    await act(async () => fireEvent.click(screen.getByText(translate('control.copyOverlay'))));
    expect(screen.getByText(translate('common.copyFailed'))).toBeTruthy();
  });

  it('shows reconnection and refuses to emit while disconnected', async () => {
    const socket = open();
    push(socket, room('LOBBY', { tiktokConnected: true }));
    act(() => socket.serverEmit('disconnect'));
    expect(screen.getByText(translate('connection.reconnecting'))).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByText(translate('control.close'))));
    await act(async () =>
      fireEvent.click(within(screen.getByRole('dialog')).getByText(translate('common.confirm'))),
    );
    expect(
      screen.getByText(
        translate('control.logFailed', {
          action: translate('control.logClose'),
          message: errorMessage('NOT_CONNECTED'),
        }),
      ),
    ).toBeTruthy();
  });
});
