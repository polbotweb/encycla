import { afterEach, describe, expect, it } from 'vitest';
import { startHarness, type Harness } from '../fixtures/harness';

let harness: Harness | null = null;
afterEach(async () => {
  await harness?.close();
  harness = null;
});

async function metrics(base: string): Promise<string> {
  const response = await fetch(`${base}/metrics`, {
    headers: { authorization: 'Bearer admin-secret-for-tests' },
  });
  expect(response.status).toBe(200);
  return response.text();
}

describe('game server observability (D-123)', () => {
  it('exposes sockets, rooms, queue and socket event outcomes; TikTok gauge absent when off', async () => {
    harness = await startHarness();
    const alice = await harness.newPlayer('Alice');
    expect(await alice.emit('ROOM_JOIN', { code: 42 })).toMatchObject({ ok: false });
    expect(await alice.emit('GAME_START')).toMatchObject({ ok: false });
    const text = await metrics(harness.baseUrl);
    expect(text).toContain('encycla_sockets_connected 1');
    expect(text).toContain('encycla_queue_players 0');
    expect(text).toMatch(/encycla_rooms \d+/);
    expect(text).toContain('encycla_socket_events_total{event="ROOM_JOIN",outcome="rejected"} 1');
    expect(text).toContain('encycla_socket_events_total{event="GAME_START",outcome="rejected"} 1');
    expect(text).not.toMatch(/^encycla_tiktok_connected /m);
  });

  it('turns /readyz to 503 as soon as shutdown starts', async () => {
    harness = await startHarness();
    expect((await fetch(`${harness.baseUrl}/readyz`)).status).toBe(200);
    harness.server.readiness.shuttingDown = true;
    const response = await fetch(`${harness.baseUrl}/readyz`);
    expect(response.status).toBe(503);
    harness.server.readiness.shuttingDown = false;
  });

  it('reports the simulated TikTok connector state', async () => {
    const { FakeTikTokAdapter } = await import('../../server/tiktok/fakeAdapter');
    harness = await startHarness({
      tiktokAdapterFactory: () => new FakeTikTokAdapter(),
      tiktokSimulated: true,
    });
    expect(await metrics(harness.baseUrl)).toMatch(/^encycla_tiktok_connected [01]$/m);
  });
});
