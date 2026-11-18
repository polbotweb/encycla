// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Modal } from '../../client/components/ui/Modal';
import { useUiStore } from '../../client/store/uiStore';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.resetModules();
  localStorage.clear();
});

describe('audio cues', () => {
  function fakeContext() {
    const created: string[] = [];
    const param = { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
    class FakeAudioContext {
      currentTime = 1;
      destination = {};
      resume = vi.fn().mockResolvedValue(undefined);
      createOscillator() {
        created.push('osc');
        const node = {
          type: 'sine',
          frequency: { value: 0 },
          connect: (next: unknown) => next,
          start: vi.fn(),
          stop: vi.fn(),
        };
        return node;
      }
      createGain() {
        return { gain: param, connect: (next: unknown) => next };
      }
    }
    return { created, FakeAudioContext };
  }

  it('stays silent until unlocked and while muted, unless forced', async () => {
    const { created, FakeAudioContext } = fakeContext();
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const audio = await import('../../client/lib/audio');
    const { useUiStore: store } = await import('../../client/store/uiStore');
    audio.playCue('correct');
    expect(created).toHaveLength(0);
    audio.unlockAudio();
    audio.playCue('correct');
    expect(created).toHaveLength(2);
    store.getState().toggleMuted();
    audio.playCue('wrong');
    expect(created).toHaveLength(2);
    audio.playCue('level-up', { force: true });
    expect(created).toHaveLength(5);
    expect(localStorage.getItem('encycla.audio.v1')).toBe('muted');
  });

  it('does nothing without WebAudio or when the context throws', async () => {
    vi.stubGlobal('AudioContext', undefined);
    const audio = await import('../../client/lib/audio');
    audio.unlockAudio();
    expect(() => audio.playCue('lobby-join')).not.toThrow();
    vi.resetModules();
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          throw new Error('blocked');
        }
      },
    );
    const again = await import('../../client/lib/audio');
    again.unlockAudio();
    expect(() => again.playCue('countdown-tick')).not.toThrow();
  });
});

describe('stores', () => {
  it('restores a valid stored session and drops an expired or corrupt one', async () => {
    const session = { playerId: 'p', pseudo: 'Zoé', token: 't', expiresAt: Date.now() + 1e6 };
    localStorage.setItem('encycla.session.v1', JSON.stringify(session));
    let { useSessionStore } = await import('../../client/store/sessionStore');
    expect(useSessionStore.getState()).toMatchObject({ status: 'ready', savedPseudo: 'Zoé' });
    useSessionStore.getState().setStatus('error', 'X');
    expect(useSessionStore.getState().errorCode).toBe('X');

    vi.resetModules();
    localStorage.setItem('encycla.session.v1', JSON.stringify({ ...session, expiresAt: 1 }));
    localStorage.setItem('encycla.pseudo.v1', 'Bob');
    ({ useSessionStore } = await import('../../client/store/sessionStore'));
    expect(useSessionStore.getState()).toMatchObject({ session: null, savedPseudo: 'Bob' });
    expect(localStorage.getItem('encycla.session.v1')).toBeNull();

    vi.resetModules();
    localStorage.setItem('encycla.session.v1', '{not json');
    ({ useSessionStore } = await import('../../client/store/sessionStore'));
    expect(useSessionStore.getState().session).toBeNull();
  });

  it('remembers the mute preference and toggles the leave dialog', async () => {
    localStorage.setItem('encycla.audio.v1', 'muted');
    const { useUiStore: store } = await import('../../client/store/uiStore');
    expect(store.getState().muted).toBe(true);
    store.getState().toggleMuted();
    expect(localStorage.getItem('encycla.audio.v1')).toBe('on');
    store.getState().setLeaveModal(true);
    expect(store.getState().leaveModalOpen).toBe(true);
    useUiStore.getState().setScreen('leaderboard');
  });
});

describe('Modal', () => {
  function Harness({
    dismissible = true,
    empty = false,
  }: {
    dismissible?: boolean;
    empty?: boolean;
  }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>open</button>
        <Modal title="Dialog" open={open} onClose={() => setOpen(false)} dismissible={dismissible}>
          {empty ? (
            <p>Nothing to focus</p>
          ) : (
            <>
              <button>first</button>
              <button onClick={() => setOpen(false)}>last</button>
            </>
          )}
        </Modal>
      </>
    );
  }

  it('traps focus, closes on Escape and returns focus to the opener', () => {
    render(<Harness />);
    const opener = screen.getByText('open');
    opener.focus();
    fireEvent.click(opener);
    const first = screen.getByText('first');
    const last = screen.getByText('last');
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(document, { key: 'Enter' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('keeps blocking dialogs open and focuses the dialog when it has no controls', () => {
    render(<Harness dismissible={false} empty />);
    fireEvent.click(screen.getByText('open'));
    const dialog = screen.getByRole('dialog');
    expect(document.activeElement).toBe(dialog);
    fireEvent.keyDown(document, { key: 'Tab' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
