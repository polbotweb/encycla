import { describe, expect, it } from 'vitest';
import { FakeTikTokAdapter } from '../../server/tiktok/fakeAdapter';
import {
  BACKOFF_MAX_MS,
  TikTokConnector,
  backoffDelay,
  type Scheduler,
} from '../../server/tiktok/connector';
import { parseSessionCookie } from '../../server/tiktok/liveAdapter';
import { type LogLevel } from '../../server/util/logger';

class ManualScheduler implements Scheduler {
  pending: { id: number; at: number; callback: () => void }[] = [];
  delays: number[] = [];
  private nextId = 1;
  private clock = 0;
  setTimeout(callback: () => void, ms: number): unknown {
    const id = this.nextId++;
    this.delays.push(ms);
    this.pending.push({ id, at: this.clock + ms, callback });
    return id;
  }
  clearTimeout(handle: unknown): void {
    this.pending = this.pending.filter((entry) => entry.id !== handle);
  }
  async advance(ms: number): Promise<void> {
    this.clock += ms;
    const due = this.pending.filter((entry) => entry.at <= this.clock);
    this.pending = this.pending.filter((entry) => entry.at > this.clock);
    for (const entry of due) entry.callback();
    await flush();
  }
}

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('backoffDelay', () => {
  it('doubles from 1 s and caps at 30 s', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 20].map(backoffDelay)).toEqual([
      1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000,
    ]);
    expect(backoffDelay(50)).toBe(BACKOFF_MAX_MS);
  });
});

describe('TikTokConnector', () => {
  function setup(failures = 0) {
    const scheduler = new ManualScheduler();
    const adapters: FakeTikTokAdapter[] = [];
    const changes: boolean[] = [];
    const chats: string[] = [];
    const logs: { level: LogLevel; event: string; data?: Record<string, unknown> | undefined }[] =
      [];
    let remaining = failures;
    const connector = new TikTokConnector({
      factory: () => {
        const adapter = new FakeTikTokAdapter();
        if (remaining > 0) {
          adapter.failNextConnects = 1;
          remaining -= 1;
        }
        adapters.push(adapter);
        return adapter;
      },
      logger: { log: (level, event, data) => logs.push({ level, event, data }) },
      onChat: (message) => chats.push(message.comment),
      onConnectionChange: (connected) => changes.push(connected),
      scheduler,
    });
    return { scheduler, adapters, changes, chats, logs, connector };
  }

  it('connects and forwards chat', async () => {
    const { connector, adapters, changes, chats } = setup();
    connector.start();
    await flush();
    expect(connector.isConnected()).toBe(true);
    expect(changes).toEqual([true]);
    adapters[0]!.say('viewer', 'A');
    expect(chats).toEqual(['A']);
  });

  it('retries with exponential backoff until connected', async () => {
    const { connector, scheduler, adapters } = setup(3);
    connector.start();
    await flush();
    expect(connector.isConnected()).toBe(false);
    await scheduler.advance(1000);
    await scheduler.advance(2000);
    expect(connector.isConnected()).toBe(false);
    await scheduler.advance(4000);
    expect(connector.isConnected()).toBe(true);
    expect(scheduler.delays).toEqual([1000, 2000, 4000]);
    expect(adapters).toHaveLength(4);
  });

  it('reconnects after a drop and resets the backoff', async () => {
    const { connector, scheduler, adapters, changes } = setup();
    connector.start();
    await flush();
    adapters[0]!.drop();
    expect(connector.isConnected()).toBe(false);
    await scheduler.advance(1000);
    expect(connector.isConnected()).toBe(true);
    expect(changes).toEqual([true, false, true]);
    adapters[1]!.drop();
    await scheduler.advance(1000);
    expect(scheduler.delays).toEqual([1000, 1000]);
  });

  it('ignores chat from a replaced adapter and stops cleanly', async () => {
    const { connector, scheduler, adapters, chats } = setup();
    connector.start();
    await flush();
    adapters[0]!.drop();
    adapters[0]!.say('late', 'B');
    expect(chats).toEqual([]);
    connector.stop();
    await scheduler.advance(60_000);
    expect(adapters).toHaveLength(1);
    expect(connector.isConnected()).toBe(false);
  });

  it('never writes credentials to the logs', async () => {
    const scheduler = new ManualScheduler();
    const logs: string[] = [];
    const connector = new TikTokConnector({
      factory: () => {
        const adapter = new FakeTikTokAdapter();
        adapter.connect = async () => {
          throw new Error('request failed: cookie: sessionid=SUPERSECRET123; path=/');
        };
        return adapter;
      },
      logger: { log: (_level, event, data) => logs.push(JSON.stringify({ event, ...data })) },
      onChat: () => {},
      onConnectionChange: () => {},
      scheduler,
    });
    connector.start();
    await flush();
    expect(logs.join('\n')).not.toContain('SUPERSECRET123');
    connector.stop();
  });
});

describe('parseSessionCookie', () => {
  it('extracts sessionid and tt-target-idc', () => {
    expect(parseSessionCookie('sessionid=abc; tt-target-idc=useast5; other=1')).toEqual({
      sessionId: 'abc',
      ttTargetIdc: 'useast5',
    });
    expect(parseSessionCookie('SessionId=abc')).toEqual({ sessionId: 'abc', ttTargetIdc: '' });
    expect(parseSessionCookie('foo=bar')).toBeNull();
    expect(parseSessionCookie('')).toBeNull();
  });
});
