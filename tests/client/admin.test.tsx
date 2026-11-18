// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminView, roomLinks } from '../../client/views/AdminView';
import { pinLanguage } from './language';

pinLanguage('en');

type Call = { url: string; init: RequestInit | undefined };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('AdminView (streamer console)', () => {
  let calls: Call[];
  let status: Record<string, unknown>;
  beforeEach(() => {
    calls = [];
    status = {
      enabled: true,
      simulated: true,
      connected: true,
      liveUsername: 'demo',
      activeRoomCode: null,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        if (url === '/api/config') return json({ protocolVersion: 1, categories: [] });
        const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
        if (auth !== 'Bearer good-token') {
          return json({ error: { code: 'FORBIDDEN', message: 'no' } }, 403);
        }
        if (url === '/api/admin/tiktok') return json(status);
        if (url === '/api/tiktok/rooms') {
          status = { ...status, activeRoomCode: 'ABC234' };
          return json(
            {
              roomCode: 'ABC234',
              liveUsername: 'any.live',
              connected: true,
              overlayToken: 'ovl_x',
              controlToken: 'ctl_y',
            },
            201,
          );
        }
        if (url === '/api/admin/tiktok/chat') return new Response(null, { status: 202 });
        if (url.startsWith('/api/admin/rooms/')) {
          status = { ...status, activeRoomCode: null };
          return new Response(null, { status: 204 });
        }
        return json({ error: { code: 'INTERNAL_ERROR' } }, 500);
      }),
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('builds overlay and control links with tokens in the fragment only', () => {
    const links = roomLinks('https://encycla.example', {
      roomCode: 'ABC234',
      liveUsername: 'x',
      connected: true,
      overlayToken: 'ovl_x',
      controlToken: 'ctl_y',
    });
    expect(links.overlay).toBe('https://encycla.example/?mode=overlay&room=ABC234#token=ovl_x');
    expect(links.control).toBe(
      'https://encycla.example/?mode=control&room=ABC234#token=ctl_y&overlay=ovl_x',
    );
  });

  it('refuses a wrong token and never stores it', async () => {
    render(<AdminView />);
    fireEvent.change(screen.getByLabelText('Admin token'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    expect(await screen.findByText('Admin token refused.')).toBeTruthy();
    expect(JSON.stringify({ ...localStorage })).not.toContain('nope');
    expect(JSON.stringify({ ...sessionStorage })).not.toContain('nope');
  });

  it('creates a room for any live, shows the links, simulates chat and closes it', async () => {
    render(<AdminView />);
    fireEvent.change(screen.getByLabelText('Admin token'), { target: { value: 'good-token' } });
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    expect(await screen.findByText('Simulated chat (demo)')).toBeTruthy();
    const live = screen.getByLabelText('TikTok live to follow') as HTMLInputElement;
    await waitFor(() => expect(live.value).toBe('@demo'));
    fireEvent.change(live, { target: { value: '@Any.Live' } });
    fireEvent.change(screen.getByLabelText('Time per question'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create the room' }));
    expect(await screen.findByTestId('admin-room-code')).toHaveProperty('textContent', 'ABC234');
    const create = calls.find((call) => call.url === '/api/tiktok/rooms')!;
    expect(JSON.parse(String(create.init?.body))).toEqual({
      mode: 'CLASSIC',
      category: null,
      difficulty: null,
      language: 'en',
      timerMs: 20_000,
      liveUsername: '@Any.Live',
    });
    const overlay = screen.getByLabelText('Overlay link (OBS)') as HTMLInputElement;
    expect(overlay.value).toContain('/?mode=overlay&room=ABC234#token=ovl_x');

    fireEvent.click(screen.getByRole('button', { name: 'Comment B' }));
    expect(await screen.findByText('viewer_1 commented B.')).toBeTruthy();

    const results = await axe.run(document.body, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results.violations.map((violation) => violation.id)).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'Close the room' }));
    expect(await screen.findByRole('button', { name: 'Create the room' })).toBeTruthy();
  });

  it('explains that TikTok is off without breaking anything', async () => {
    status = { ...status, enabled: false, simulated: false, connected: false };
    render(<AdminView />);
    fireEvent.change(screen.getByLabelText('Admin token'), { target: { value: 'good-token' } });
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    expect(await screen.findByText(/TikTok mode is off on this server/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Create the room' })).toBeNull();
  });
});
