import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ImageStore } from '../../server/images/store';

const key = (name: string) => ImageStore.keyOf(name);

describe('ImageStore', () => {
  it('keeps images in memory only without a directory, within the memory cap', () => {
    const store = new ImageStore({ dir: null, maxMemoryBytes: 10 });
    store.set(key('a'), Buffer.alloc(6, 1));
    store.set(key('b'), Buffer.alloc(6, 2));
    expect(store.get(key('a'))).toBeNull();
    expect(store.get(key('b'))?.[0]).toBe(2);
    store.set(key('huge'), Buffer.alloc(11));
    expect(store.get(key('huge'))).toBeNull();
    expect(store.stats.diskFiles).toBe(0);
  });

  it('persists to disk under hashed names, survives a restart and evicts the oldest', () => {
    const dir = mkdtempSync(join(tmpdir(), 'encycla-img-'));
    const store = new ImageStore({ dir, maxDiskBytes: 25, maxMemoryBytes: 0 });
    store.set(key('one'), Buffer.alloc(10, 1));
    store.set(key('two'), Buffer.alloc(10, 2));
    expect(store.get(key('one'))?.[0]).toBe(1);
    const names = readdirSync(dir).flatMap((folder) => readdirSync(join(dir, folder)));
    expect(names.every((name) => /^[0-9a-f]{64}\.img$/.test(name))).toBe(true);
    store.set(key('three'), Buffer.alloc(10, 3));
    expect(store.stats.diskBytes).toBeLessThanOrEqual(25);
    expect(store.stats.diskFiles).toBe(2);

    mkdirSync(join(dir, 'zz'), { recursive: true });
    writeFileSync(join(dir, 'zz', 'ignored'), 'x');
    const leftover = join(dir, key('x').slice(0, 2), 'partial.tmp');
    mkdirSync(join(dir, key('x').slice(0, 2)), { recursive: true });
    writeFileSync(leftover, 'x');
    const reopened = new ImageStore({ dir, maxDiskBytes: 25, maxMemoryBytes: 0 });
    expect(reopened.stats.diskFiles).toBe(2);
    expect(reopened.get(key('three'))?.[0]).toBe(3);
    expect(existsSync(leftover)).toBe(false);
  });

  it('shrinks an oversized cache on start and treats unreadable files as misses', () => {
    const dir = mkdtempSync(join(tmpdir(), 'encycla-img-'));
    const big = new ImageStore({ dir, maxDiskBytes: 100 });
    for (const name of ['a', 'b', 'c', 'd']) big.set(key(name), Buffer.alloc(20));
    const small = new ImageStore({ dir, maxDiskBytes: 50, maxMemoryBytes: 0 });
    expect(small.stats.diskBytes).toBeLessThanOrEqual(50);
    const survivor = ['a', 'b', 'c', 'd'].find((name) => small.get(key(name)) !== null)!;
    const path = join(dir, key(survivor).slice(0, 2), `${key(survivor)}.img`);
    const fresh = new ImageStore({ dir, maxDiskBytes: 50, maxMemoryBytes: 0 });
    rmSync(path); // removed behind the store's back
    expect(fresh.get(key(survivor))).toBeNull();
    expect(new ImageStore({ dir: join(path, 'not-a-dir') }).stats.diskFiles).toBe(0);
  });
});
