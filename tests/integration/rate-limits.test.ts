import { io as connect } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import { RATE_LIMITS } from '../../server/security/limits';
import { forwardedIp } from '../../server/security/rateLimit';
import { startHarness, type Harness } from '../fixtures/harness';

let harness: Harness | null = null;

afterEach(async () => {
  await harness?.close();
  harness = null;
});

describe('client address behind proxies (D-118)', () => {
  it('follows Express trust-proxy hop semantics', () => {
    expect(forwardedIp('10.0.0.1', undefined, 1)).toBe('10.0.0.1');
    expect(forwardedIp('10.0.0.1', '203.0.113.7', false)).toBe('10.0.0.1');
    expect(forwardedIp('10.0.0.1', '203.0.113.7', 1)).toBe('203.0.113.7');
    expect(forwardedIp('10.0.0.1', 'spoofed, 203.0.113.7', 1)).toBe('203.0.113.7');
    expect(forwardedIp('10.0.0.1', ['spoofed', '203.0.113.7, 10.0.0.2'], 2)).toBe('203.0.113.7');
    expect(forwardedIp('10.0.0.1', '203.0.113.7', 5)).toBe('203.0.113.7');
    expect(forwardedIp(undefined, undefined, false)).toBe('unknown');
  });
});

describe('socket limits behind one address (D-118)', () => {
  it('limits ROOM_JOIN per player, so a neighbour on the same IP can still join', async () => {
    harness = await startHarness({ rateLimit: true });
    const host = await harness.newPlayer('Hote');
    const created = await harness.api('/api/rooms', {
      token: host.token,
      body: { mode: 'CONTEST' },
    });
    const guesser = await harness.newPlayer('Devine');
    const codes: string[] = [];
    for (let index = 0; index <= RATE_LIMITS.roomJoinPerPlayer; index += 1) {
      const ack = await guesser.emit('ROOM_JOIN', { code: 'ZZZZZZ' });
      codes.push(ack.ok ? 'OK' : ack.error.code);
    }
    expect(codes.slice(0, RATE_LIMITS.roomJoinPerPlayer).every((c) => c === 'ROOM_NOT_FOUND')).toBe(
      true,
    );
    expect(codes.at(-1)).toBe('RATE_LIMITED');

    const neighbour = await harness.newPlayer('Voisin');
    const code = created.body.roomCode as string;
    const joined = await neighbour.emit('ROOM_JOIN', { code });
    expect(joined).toMatchObject({ ok: true });
  });

  it('refuses handshakes over the per-IP connection budget with RATE_LIMITED', async () => {
    harness = await startHarness({ rateLimit: true });
    const attempt = (): Promise<string> =>
      new Promise((resolve) => {
        const socket = connect(`${harness!.baseUrl}/game`, {
          auth: { role: 'player', token: 'sess_invalid' },
          transports: ['websocket'],
          reconnection: false,
          forceNew: true,
        });
        socket.once('connect_error', (error: Error & { data?: { code?: string } }) => {
          socket.close();
          resolve(error.data?.code ?? 'UNKNOWN');
        });
        socket.once('connect', () => {
          socket.close();
          resolve('CONNECTED');
        });
      });
    const codes: string[] = [];
    for (let index = 0; index <= RATE_LIMITS.socketConnectsPerIp; index += 1) {
      codes.push(await attempt());
    }
    expect(codes.slice(0, -1).every((code) => code === 'AUTH_INVALID')).toBe(true);
    expect(codes.at(-1)).toBe('RATE_LIMITED');
  });
});
