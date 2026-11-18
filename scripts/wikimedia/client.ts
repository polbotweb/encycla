import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Minimal, polite client for the MediaWiki / Wikidata APIs.
 *
 * Etiquette (https://www.mediawiki.org/wiki/API:Etiquette, https://meta.wikimedia.org/wiki/User-Agent_policy):
 *  - descriptive User-Agent with a contact URL;
 *  - strictly serial requests with a minimum delay between two calls;
 *  - `maxlag` on every request, and a retry honouring `Retry-After` on 429/502/503/504/maxlag;
 *  - batched queries (up to 20/50 titles) instead of one call per title;
 *  - every response cached on disk, so re-running the generator does not hit the API again.
 */

export const USER_AGENT =
  'EncyclaQuestionBot/1.0 (https://github.com/polbotweb/encycla; educational quiz data generator) node-fetch';

const MIN_DELAY_MS = 250;
const MAX_RETRIES = 6;
const MAXLAG_SECONDS = 5;

export interface CachedResponse<T> {
  fetchedAt: string;
  body: T;
}

export interface ClientOptions {
  cacheDir: string;
  /** Do not use the network: fail when a response is not already cached. */
  offline?: boolean;
  /** Ignore cached responses and refetch. */
  refresh?: boolean;
  minDelayMs?: number;
}

export class WikiClient {
  private lastRequestAt = 0;
  requests = 0;
  cacheHits = 0;

  constructor(private readonly options: ClientOptions) {}

  private cachePath(url: string): string {
    const digest = createHash('sha256').update(url).digest('hex');
    return join(this.options.cacheDir, digest.slice(0, 2), `${digest}.json`);
  }

  /** GET a MediaWiki API URL with the given query parameters, returning the parsed JSON body. */
  async get<T>(endpoint: string, params: Record<string, string>): Promise<CachedResponse<T>> {
    const query = new URLSearchParams({
      format: 'json',
      formatversion: '2',
      maxlag: String(MAXLAG_SECONDS),
      ...params,
    });
    // Sort for a stable cache key.
    query.sort();
    const url = `${endpoint}?${query.toString()}`;
    const path = this.cachePath(url);

    if (!this.options.refresh) {
      try {
        const cached = JSON.parse(await readFile(path, 'utf8')) as CachedResponse<T>;
        this.cacheHits += 1;
        return cached;
      } catch {
        // cache miss
      }
    }

    if (this.options.offline) {
      throw new Error(`offline mode: response not cached for ${url}`);
    }

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      const wait = this.lastRequestAt + (this.options.minDelayMs ?? MIN_DELAY_MS) - Date.now();
      if (wait > 0) {
        await sleep(wait);
      }
      this.lastRequestAt = Date.now();
      this.requests += 1;

      let response: Response;
      try {
        response = await fetch(url, {
          headers: { 'User-Agent': USER_AGENT, 'Accept-Encoding': 'gzip' },
        });
      } catch (error) {
        if (attempt === MAX_RETRIES) {
          throw error;
        }
        await sleep(2000 * (attempt + 1));
        continue;
      }

      if ([429, 502, 503, 504].includes(response.status)) {
        const retryAfter = Number(response.headers.get('retry-after') ?? '5');
        await sleep((Number.isFinite(retryAfter) ? retryAfter : 5) * 1000 + 500);
        continue;
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }

      const body = (await response.json()) as T & { error?: { code?: string; info?: string } };
      if (body.error) {
        if (body.error.code === 'maxlag') {
          const retryAfter = Number(response.headers.get('retry-after') ?? '5');
          await sleep((Number.isFinite(retryAfter) ? retryAfter : 5) * 1000 + 500);
          continue;
        }
        throw new Error(`API error ${body.error.code ?? '?'}: ${body.error.info ?? ''} (${url})`);
      }

      const cached: CachedResponse<T> = { fetchedAt: new Date().toISOString(), body };
      await mkdir(join(path, '..'), { recursive: true });
      await writeFile(path, JSON.stringify(cached), 'utf8');
      return cached;
    }

    throw new Error(`Giving up after ${MAX_RETRIES} retries: ${url}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}
