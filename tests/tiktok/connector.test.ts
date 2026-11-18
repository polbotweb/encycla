import { describe, expect, it } from 'vitest';
import { FakeTikTokAdapter } from '../../server/tiktok/fakeAdapter';
import {
  BACKOFF_MAX_MS,
  TikTokConnector,
  backoffDelay,
  type Scheduler,
} from '../../server/tiktok/connector';
import { LiveTikTokAdapter, parseSessionCookie } from '../../server/tiktok/liveAdapter';
import { tiktokOptions, tiktokSetup } from '../../server/tiktok/setup';
import { normalizeHandle } from '../../server/tiktok/adapter';
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
      target: 'game',
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
          throw new Error('request failed: cookie: sessionid=FAKE-VALUE-FOR-TEST; path=/');
        };
        return adapter;
      },
      logger: { log: (_level, event, data) => logs.push(JSON.stringify({ event, ...data })) },
      onChat: () => {},
      onConnectionChange: () => {},
      scheduler,
      target: 'game',
    });
    connector.start();
    await flush();
    expect(logs.join('\n')).not.toContain('FAKE-VALUE-FOR-TEST');
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

describe('LiveTikTokAdapter (optional tiktok-live-connector)', () => {
  class FakeConnection {
    static last: FakeConnection | null = null;
    handlers = new Map<string, (...args: unknown[]) => void>();
    disconnected = false;
    constructor(
      public uniqueId: string,
      public options: Record<string, unknown>,
    ) {
      FakeConnection.last = this;
    }
    on(event: string, handler: (...args: unknown[]) => void) {
      this.handlers.set(event, handler);
      return this;
    }
    async connect() {
      return {};
    }
    disconnect() {
      this.disconnected = true;
    }
    emit(event: string, payload?: unknown) {
      this.handlers.get(event)?.(payload);
    }
  }
  const load = async () => ({ TikTokLiveConnection: FakeConnection });

  it('connects with the session cookie and the signing key, and maps chat messages', async () => {
    const adapter = new LiveTikTokAdapter(
      { username: 'host', sessionCookie: 'sessionid=abc; tt-target-idc=useast5', signApiKey: 'k' },
      load,
    );
    const chats: unknown[] = [];
    const drops: string[] = [];
    adapter.onChat((message) => chats.push(message));
    adapter.onDisconnect((reason) => drops.push(reason));
    await adapter.connect();

    const connection = FakeConnection.last!;
    expect(connection.uniqueId).toBe('host');
    expect(connection.options).toEqual({
      session: { cookie: { type: 'cookie', value: { sessionId: 'abc', ttTargetIdc: 'useast5' } } },
      authenticateWs: true,
      signApiKey: 'k',
    });

    connection.emit('chat', { user: { uniqueId: 'viewer1', nickname: 'Vi' }, comment: 'B' });
    connection.emit('chat', { uniqueId: 'viewer2', comment: 'c' });
    connection.emit('chat', { user: {}, comment: 'A' });
    expect(chats).toEqual([
      { uniqueId: 'viewer1', nickname: 'Vi', comment: 'B' },
      { uniqueId: 'viewer2', nickname: null, comment: 'c' },
    ]);

    connection.emit('error', new Error('secret request details'));
    connection.emit('streamEnd');
    expect(drops).toEqual(['stream ended']);
    adapter.disconnect();
    expect(connection.disconnected).toBe(true);
  });

  it('omits the signing key when none is configured', async () => {
    const adapter = new LiveTikTokAdapter(
      { username: 'host', sessionCookie: 'sessionid=abc' },
      load,
    );
    await adapter.connect();
    expect(FakeConnection.last?.options).not.toHaveProperty('signApiKey');
  });

  it('rejects without a sessionid or when the package is missing', async () => {
    await expect(
      new LiveTikTokAdapter({ username: 'host', sessionCookie: 'foo=bar' }, load).connect(),
    ).rejects.toThrow('sessionid');
    const missing = async () => {
      throw new Error('Cannot find module');
    };
    await expect(
      new LiveTikTokAdapter(
        { username: 'host', sessionCookie: 'sessionid=abc' },
        missing,
      ).connect(),
    ).rejects.toThrow('tiktok-live-connector is not installed');
    await expect(
      new LiveTikTokAdapter(
        { username: 'host', sessionCookie: 'sessionid=abc' },
        async () => ({}),
      ).connect(),
    ).rejects.toThrow('not installed or could not be loaded');
  });

  it('loads the real optional package when it is installed', async (context) => {
    let module: { TikTokLiveConnection?: unknown };
    try {
      module = (await import('tiktok-live-connector')) as typeof module;
    } catch {
      context.skip(); // installed without optional dependencies
      return;
    }
    expect(typeof module.TikTokLiveConnection).toBe('function');
  });
});

describe('isConnectorInstalled', () => {
  it('reports whether the optional package can be loaded', async () => {
    const { isConnectorInstalled } = await import('../../server/tiktok/liveAdapter');
    expect(await isConnectorInstalled(async () => ({ TikTokLiveConnection: class {} }))).toBe(true);
    expect(await isConnectorInstalled(async () => ({}))).toBe(false);
    expect(
      await isConnectorInstalled(async () => {
        throw new Error('missing');
      }),
    ).toBe(false);
  });

  it('is wired by tiktokSetup from the configuration, following the live a room names', async () => {
    class Connection {
      static last: Connection | null = null;
      handlers = new Map<string, (...args: unknown[]) => void>();
      constructor(public uniqueId: string) {
        Connection.last = this;
      }
      on(event: string, handler: (...args: unknown[]) => void) {
        this.handlers.set(event, handler);
        return this;
      }
      async connect() {
        return {};
      }
      disconnect() {}
      emit(event: string, payload?: unknown) {
        this.handlers.get(event)?.(payload);
      }
    }
    const load = async () => ({ TikTokLiveConnection: Connection });
    const config = {
      tiktokEnabled: true,
      tiktokAdapter: 'live' as const,
      tiktokUsername: '@Host.Live',
      tiktokSessionCookie: 'sessionid=abc',
      tiktokSignApiKey: null,
    };
    const setup = tiktokSetup(config, load)!;
    expect(setup.defaultTarget).toBe('host.live');
    expect(setup.simulated).toBe(false);
    const adapter = setup.factory('other_live');
    expect(adapter).toBeInstanceOf(LiveTikTokAdapter);
    const chats: unknown[] = [];
    adapter.onChat((message) => chats.push(message));
    await adapter.connect();
    expect(Connection.last!.uniqueId).toBe('other_live');
    Connection.last!.emit('chat', { user: { uniqueId: 'v' }, comment: 'D' });
    expect(chats).toEqual([{ uniqueId: 'v', nickname: null, comment: 'D' }]);

    expect(tiktokSetup({ ...config, tiktokEnabled: false })).toBeNull();
    expect(tiktokSetup({ ...config, tiktokSessionCookie: null })).toBeNull();
    const fake = tiktokSetup({ ...config, tiktokAdapter: 'fake', tiktokSessionCookie: null })!;
    expect(fake.simulated).toBe(true);
    expect(fake.factory('x')).toBeInstanceOf(FakeTikTokAdapter);
    expect(tiktokOptions(null)).toEqual({
      tiktokAdapterFactory: null,
      tiktokDefaultTarget: null,
      tiktokSimulated: false,
    });
  });
});

describe('normalizeHandle', () => {
  it('strips "@", lowercases and rejects anything but a TikTok handle', () => {
    expect(normalizeHandle(' @Some.Live_1 ')).toBe('some.live_1');
    for (const bad of ['a', 'x'.repeat(25), 'with space', 'https://x', '<b>']) {
      expect(normalizeHandle(bad), bad).toBeNull();
    }
  });
});

describe('TikTokConnector.retarget', () => {
  it('waits for a target, then follows the live it is pointed at', async () => {
    const targets: string[] = [];
    const connector = new TikTokConnector({
      factory: (target) => {
        targets.push(target);
        return new FakeTikTokAdapter();
      },
      logger: { log: () => {} },
      onChat: () => {},
      onConnectionChange: () => {},
      scheduler: new ManualScheduler(),
    });
    connector.start();
    await flush();
    expect(targets).toEqual([]);
    expect(connector.currentTarget()).toBeNull();
    connector.retarget('first');
    connector.start();
    await flush();
    expect(connector.isConnected()).toBe(true);
    connector.retarget('first');
    connector.retarget('second');
    await flush();
    expect(targets).toEqual(['first', 'second']);
    expect(connector.currentTarget()).toBe('second');
    expect(connector.isConnected()).toBe(true);
    connector.stop();
  });
});
