import { randomBytes } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../server/app';
import { ImageService, type Fetcher } from '../../server/images/service';
import type { PublicRoomState } from '../../shared/types';
import { ORIGINAL_URL, THUMB_URL, jpegWithMetadata, pngWithMetadata } from './fixtures';

let server: Server | null = null;

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = null;
  }
});

interface FakeUpstream {
  fetcher: Fetcher;
  calls: { url: string; init: RequestInit }[];
}

function fakeUpstream(
  respond: (url: string) => Response | Promise<Response> = () =>
    new Response(new Uint8Array(jpegWithMetadata()), {
      headers: {
        'content-type': 'image/jpeg',
        'content-disposition': 'inline; filename="Lion_waiting_in_Namibia.jpg"',
        'last-modified': 'Tue, 01 Jan 2019 00:00:00 GMT',
        'x-object-meta-sha1base36': 'abc',
      },
    }),
): FakeUpstream {
  const calls: FakeUpstream['calls'] = [];
  return {
    calls,
    fetcher: async (url, init) => {
      calls.push({ url, init });
      return respond(url);
    },
  };
}

async function start(images: ImageService): Promise<string> {
  server = createApp({ images, rateLimit: false }).listen(0);
  await new Promise<void>((resolve) => server!.once('listening', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

function snapshot(partial: Partial<PublicRoomState>): PublicRoomState {
  return { question: null, reveal: null, ...partial } as PublicRoomState;
}

const FULL_IMAGE = {
  url: THUMB_URL,
  alt: 'Photograph of an animal to identify',
  credit: 'Kevin Pluck, CC BY 2.0',
  license: 'CC BY 2.0',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:Lion_waiting_in_Namibia.jpg',
};

describe('ImageService.publicView', () => {
  it('replaces the question picture by an opaque URL with alt text only', () => {
    const images = new ImageService({ fetcher: fakeUpstream().fetcher });
    const view = images.publicView(
      snapshot({
        question: { id: 'round-1', questionText: 'Q', options: [], image: FULL_IMAGE },
      } as unknown as Partial<PublicRoomState>),
    );
    expect(view.question?.image).toEqual({
      url: expect.stringMatching(/^\/img\/[A-Za-z0-9_-]{75}$/),
      alt: FULL_IMAGE.alt,
      widths: [330, 500, 960],
    });
    expect(JSON.stringify(view)).not.toMatch(/wikimedia|Lion|Pluck|CC BY/);
  });

  it('keeps the same URL at reveal, with the credits, and a new one next round', () => {
    const images = new ImageService({ fetcher: fakeUpstream().fetcher });
    const question = images.publicView(
      snapshot({
        question: { id: 'round-1', questionText: 'Q', options: [], image: FULL_IMAGE },
      } as unknown as Partial<PublicRoomState>),
    ).question!;
    const reveal = images.publicView(
      snapshot({
        reveal: { questionId: 'round-1', image: FULL_IMAGE },
      } as unknown as Partial<PublicRoomState>),
    ).reveal!;
    expect(reveal.image).toEqual({
      url: question.image!.url,
      alt: FULL_IMAGE.alt,
      widths: [330, 500, 960],
      credit: FULL_IMAGE.credit,
      license: FULL_IMAGE.license,
      sourceUrl: FULL_IMAGE.sourceUrl,
    });
    const next = images.publicView(
      snapshot({
        question: { id: 'round-2', questionText: 'Q', options: [], image: FULL_IMAGE },
      } as unknown as Partial<PublicRoomState>),
    ).question!;
    expect(next.image!.url).not.toBe(question.image!.url);
  });

  it('drops pictures the proxy may not fetch and leaves empty snapshots alone', () => {
    const images = new ImageService({ fetcher: fakeUpstream().fetcher });
    const view = images.publicView(
      snapshot({
        question: {
          id: 'r',
          questionText: 'Q',
          options: [],
          image: { url: 'https://evil.example/x.jpg', alt: 'x' },
        },
        reveal: { questionId: 'r', image: { url: ORIGINAL_URL, alt: 'y' } },
      } as unknown as Partial<PublicRoomState>),
    );
    expect(view.question?.image).toBeNull();
    expect(view.reveal?.image).toEqual({ url: expect.stringMatching(/^\/img\//), alt: 'y' });
    expect(images.publicView(snapshot({}))).toEqual(snapshot({}));
  });
});

describe('GET /img/:token', () => {
  function issue(images: ImageService, url = THUMB_URL, round = 'round-1'): string {
    return images.publicView(
      snapshot({
        question: { id: round, questionText: 'Q', options: [], image: { url, alt: 'a' } },
      } as unknown as Partial<PublicRoomState>),
    ).question!.image!.url;
  }

  it('serves a metadata-free image without file names, with private caching and an ETag', async () => {
    const upstream = fakeUpstream();
    const images = new ImageService({ fetcher: upstream.fetcher, rateLimitPerMinute: null });
    const base = await start(images);
    const path = issue(images);
    const response = await fetch(`${base}${path}?w=500`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(response.headers.get('content-disposition')).toBeNull();
    expect(response.headers.get('last-modified')).toBeNull();
    expect(response.headers.get('x-object-meta-sha1base36')).toBeNull();
    expect(response.headers.get('cache-control')).toMatch(/^private, max-age=\d+$/);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    const body = Buffer.from(await response.arrayBuffer());
    expect(body.toString('latin1')).not.toMatch(/Panthera|Lion|Exif/);
    expect(body.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));

    expect(upstream.calls).toHaveLength(1);
    expect(upstream.calls[0]!.url).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Lion_waiting_in_Namibia.jpg/500px-Lion_waiting_in_Namibia.jpg',
    );
    expect(upstream.calls[0]!.init.redirect).toBe('error');
    expect(new Headers(upstream.calls[0]!.init.headers).get('user-agent')).toMatch(/Encycla/);

    const etag = response.headers.get('etag')!;
    const cached = await fetch(`${base}${path}?w=500`, { headers: { 'if-none-match': etag } });
    expect(cached.status).toBe(304);
    expect(upstream.calls).toHaveLength(1);
    const head = await fetch(`${base}${path}`, { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect(upstream.calls.at(-1)!.url).toBe(THUMB_URL);
  });

  it('keeps serving the links of running rounds after a restart (same key, D-116)', async () => {
    const tokenSecret = randomBytes(32);
    const before = new ImageService({
      fetcher: fakeUpstream().fetcher,
      rateLimitPerMinute: null,
      tokenSecret,
    });
    const path = issue(before);
    const after = new ImageService({
      fetcher: fakeUpstream().fetcher,
      rateLimitPerMinute: null,
      tokenSecret,
    });
    after.registerUrls([THUMB_URL, undefined, 'https://evil.example/x.jpg']);
    const base = await start(after);
    const response = await fetch(`${base}${path}?w=500`);
    expect(response.status).toBe(200);
    const stranger = new ImageService({
      fetcher: fakeUpstream().fetcher,
      rateLimitPerMinute: null,
    });
    stranger.registerUrls([THUMB_URL]);
    expect((await fetch(`${await start(stranger)}${path}?w=500`)).status).toBe(404);
  });

  it('pads differently per round so the bytes do not match the public file', async () => {
    const images = new ImageService({ fetcher: fakeUpstream().fetcher, rateLimitPerMinute: null });
    const base = await start(images);
    const sizes = new Set<number>();
    const tags = new Set<string>();
    for (const round of ['a', 'b', 'c', 'd', 'e']) {
      const response = await fetch(`${base}${issue(images, THUMB_URL, round)}?w=960`);
      sizes.add((await response.arrayBuffer()).byteLength);
      tags.add(response.headers.get('etag')!);
    }
    expect(sizes.size).toBeGreaterThan(1);
    expect(tags.size).toBe(5);
  });

  it('strips PNG text chunks too', async () => {
    const upstream = fakeUpstream(() => new Response(new Uint8Array(pngWithMetadata())));
    const images = new ImageService({ fetcher: upstream.fetcher, rateLimitPerMinute: null });
    const base = await start(images);
    const response = await fetch(`${base}${issue(images, ORIGINAL_URL)}?w=330`);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(Buffer.from(await response.arrayBuffer()).toString('latin1')).not.toContain('Panthera');
    expect(upstream.calls[0]!.url).toBe(ORIGINAL_URL);
  });

  it('refuses unknown tokens, bad widths and non-image upstream answers', async () => {
    const upstream = fakeUpstream((url) =>
      url.includes('330px')
        ? new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } })
        : url.includes('500px')
          ? new Response('missing', { status: 404 })
          : Promise.reject(new Error('network down')),
    );
    const images = new ImageService({ fetcher: upstream.fetcher, rateLimitPerMinute: null });
    const base = await start(images);
    const path = issue(images);
    const unknown = await fetch(`${base}/img/${'A'.repeat(75)}`);
    expect(unknown.status).toBe(404);
    expect(unknown.headers.get('cache-control')).toBe('no-store');
    expect((await fetch(`${base}/img/..%2F..%2Fetc%2Fpasswd`)).status).toBe(404);
    expect((await fetch(`${base}${path}?w=1280`)).status).toBe(400);
    expect((await fetch(`${base}${path}?w=330`)).status).toBe(502);
    expect((await fetch(`${base}${path}?w=500`)).status).toBe(502);
    expect((await fetch(`${base}${path}?w=960`)).status).toBe(502);
  });

  it('rejects oversized upstream bodies and dedupes concurrent fetches', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const upstream = fakeUpstream(async (url) => {
      if (url.includes('330px')) {
        return new Response('x', { headers: { 'content-length': String(11 * 1024 * 1024) } });
      }
      if (url.includes('500px')) return new Response(new Uint8Array(11 * 1024 * 1024));
      await gate;
      return new Response(new Uint8Array(jpegWithMetadata()));
    });
    const images = new ImageService({ fetcher: upstream.fetcher, rateLimitPerMinute: null });
    const base = await start(images);
    const path = issue(images);
    expect((await fetch(`${base}${path}?w=330`)).status).toBe(502);
    expect((await fetch(`${base}${path}?w=500`)).status).toBe(502);
    const pending = [fetch(`${base}${path}`), fetch(`${base}${path}`)];
    await new Promise((resolve) => setTimeout(resolve, 50));
    release();
    const responses = await Promise.all(pending);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(upstream.calls.filter((call) => call.url === THUMB_URL)).toHaveLength(1);
  });

  it('expires tokens and rate-limits per client', async () => {
    let now = 1_000_000;
    const images = new ImageService({
      fetcher: fakeUpstream().fetcher,
      now: () => now,
      tokenTtlMs: 30_000,
      rateLimitPerMinute: 3,
    });
    const base = await start(images);
    const path = issue(images);
    const first = await fetch(`${base}${path}`);
    expect(first.headers.get('cache-control')).toBe('private, max-age=30');
    now += 30_000;
    expect((await fetch(`${base}${path}`)).status).toBe(404);
    expect((await fetch(`${base}${path}`)).status).toBe(404);
    const limited = await fetch(`${base}${path}`);
    expect(limited.status).toBe(429);
    expect(limited.headers.get('cache-control')).toBe('no-store');
  });

  it('is wired by default in createApp', async () => {
    server = createApp().listen(0);
    await new Promise<void>((resolve) => server!.once('listening', resolve));
    const port = (server.address() as AddressInfo).port;
    expect((await fetch(`http://127.0.0.1:${port}/img/${'A'.repeat(75)}`)).status).toBe(404);
  });
});
