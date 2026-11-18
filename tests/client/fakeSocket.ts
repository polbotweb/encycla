import type { Ack } from '../../shared/protocol';

type Handler = (...args: any[]) => void;

/** In-memory stand-in for a socket.io-client socket. */
export class FakeSocket {
  static instances: FakeSocket[] = [];
  connected = false;
  handlers = new Map<string, Handler[]>();
  emitted: Array<{ event: string; payload: unknown }> = [];
  /** Ack returned for the next emits, per event; default ok with null data. */
  acks = new Map<string, Ack<unknown> | 'timeout'>();
  disconnects = 0;
  connects = 0;

  constructor(
    public url: string,
    public options: Record<string, unknown>,
  ) {
    FakeSocket.instances.push(this);
  }

  on(event: string, handler: Handler): this {
    const list = this.handlers.get(event) ?? [];
    list.push(handler);
    this.handlers.set(event, list);
    return this;
  }

  removeAllListeners(): this {
    this.handlers.clear();
    return this;
  }

  disconnect(): this {
    this.disconnects += 1;
    this.connected = false;
    return this;
  }

  connect(): this {
    this.connects += 1;
    return this;
  }

  timeout(): { emit: (event: string, payload: unknown, callback: Handler) => void } {
    return {
      emit: (event, payload, callback) => {
        this.emitted.push({ event, payload });
        const ack = this.acks.get(event) ?? { ok: true, data: null };
        queueMicrotask(() =>
          ack === 'timeout' ? callback(new Error('timeout'), undefined) : callback(null, ack),
        );
      },
    };
  }

  /** Simulates a server event. */
  serverEmit(event: string, ...args: unknown[]): void {
    if (event === 'connect') this.connected = true;
    if (event === 'disconnect') this.connected = false;
    for (const handler of this.handlers.get(event) ?? []) handler(...args);
  }

  static last(): FakeSocket {
    const socket = FakeSocket.instances.at(-1);
    if (!socket) throw new Error('no socket');
    return socket;
  }
}

export function fakeIo(url: string, options: Record<string, unknown>): FakeSocket {
  return new FakeSocket(url, options);
}
