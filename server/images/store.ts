import { createHash } from 'node:crypto';
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
  renameSync,
} from 'node:fs';
import { join } from 'node:path';

export interface ImageStoreOptions {
  /** Disk cache directory; `null` keeps images in memory only. */
  dir: string | null;
  maxDiskBytes?: number;
  maxMemoryBytes?: number;
}

interface DiskEntry {
  path: string;
  size: number;
  usedAt: number;
}

/**
 * Two-level cache of processed (metadata-free) images keyed by the hash of the upstream URL:
 * a small in-memory LRU and a size-capped directory. Least recently used files are evicted first.
 */
export class ImageStore {
  private readonly memory = new Map<string, Buffer>();
  private memoryBytes = 0;
  private readonly disk = new Map<string, DiskEntry>();
  private diskBytes = 0;
  private readonly maxDiskBytes: number;
  private readonly maxMemoryBytes: number;

  constructor(private readonly options: ImageStoreOptions) {
    this.maxDiskBytes = options.maxDiskBytes ?? 512 * 1024 * 1024;
    this.maxMemoryBytes = options.maxMemoryBytes ?? 64 * 1024 * 1024;
    if (options.dir) this.scan(options.dir);
  }

  static keyOf(url: string): string {
    return createHash('sha256').update(url).digest('hex');
  }

  get(key: string): Buffer | null {
    const hot = this.memory.get(key);
    if (hot) {
      this.memory.delete(key);
      this.memory.set(key, hot);
      return hot;
    }
    const entry = this.disk.get(key);
    if (!entry) return null;
    try {
      const bytes = readFileSync(entry.path);
      entry.usedAt = Date.now();
      this.remember(key, bytes);
      return bytes;
    } catch {
      this.forget(key);
      return null;
    }
  }

  set(key: string, bytes: Buffer): void {
    this.remember(key, bytes);
    const dir = this.options.dir;
    if (!dir || bytes.length > this.maxDiskBytes) return;
    try {
      const folder = join(dir, key.slice(0, 2));
      mkdirSync(folder, { recursive: true });
      const path = join(folder, `${key}.img`);
      const temp = `${path}.${process.pid}.tmp`;
      writeFileSync(temp, bytes);
      renameSync(temp, path);
      this.forget(key);
      this.disk.set(key, { path, size: bytes.length, usedAt: Date.now() });
      this.diskBytes += bytes.length;
      this.evictDisk();
    } catch {
      /* a read-only or full disk only costs a refetch */
    }
  }

  get stats(): { memoryBytes: number; diskBytes: number; diskFiles: number } {
    return { memoryBytes: this.memoryBytes, diskBytes: this.diskBytes, diskFiles: this.disk.size };
  }

  private remember(key: string, bytes: Buffer): void {
    if (bytes.length > this.maxMemoryBytes) return;
    const previous = this.memory.get(key);
    if (previous) {
      this.memoryBytes -= previous.length;
      this.memory.delete(key);
    }
    this.memory.set(key, bytes);
    this.memoryBytes += bytes.length;
    for (const [oldKey, oldBytes] of this.memory) {
      if (this.memoryBytes <= this.maxMemoryBytes) break;
      this.memory.delete(oldKey);
      this.memoryBytes -= oldBytes.length;
    }
  }

  private forget(key: string): void {
    const entry = this.disk.get(key);
    if (!entry) return;
    this.disk.delete(key);
    this.diskBytes -= entry.size;
  }

  private evictDisk(): void {
    if (this.diskBytes <= this.maxDiskBytes) return;
    const target = this.maxDiskBytes * 0.9;
    const oldest = [...this.disk.entries()].sort((a, b) => a[1].usedAt - b[1].usedAt);
    for (const [key, entry] of oldest) {
      if (this.diskBytes <= target) break;
      rmSync(entry.path, { force: true });
      this.forget(key);
    }
  }

  private scan(dir: string): void {
    try {
      mkdirSync(dir, { recursive: true });
      for (const folder of readdirSync(dir)) {
        const folderPath = join(dir, folder);
        if (!/^[0-9a-f]{2}$/.test(folder) || !statSync(folderPath).isDirectory()) continue;
        for (const file of readdirSync(folderPath)) {
          const path = join(folderPath, file);
          const match = /^([0-9a-f]{64})\.img$/.exec(file);
          if (!match) {
            if (file.endsWith('.tmp')) rmSync(path, { force: true });
            continue;
          }
          const stat = statSync(path);
          this.disk.set(match[1] as string, { path, size: stat.size, usedAt: stat.mtimeMs });
          this.diskBytes += stat.size;
        }
      }
      this.evictDisk();
    } catch {
      /* unreadable cache directory: start empty */
    }
  }
}
