import { monitorEventLoopDelay, type IntervalHistogram } from 'node:perf_hooks';

/**
 * Minimal Prometheus text exposition (format 0.0.4), no dependency (D-123).
 * Counters and histograms are kept in memory; gauges are read when `/metrics` is scraped.
 */
export type Labels = Record<string, string>;

const HTTP_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5];

function labelKey(labels: Labels): string {
  const entries = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return '';
  return `{${entries.map(([key, value]) => `${key}="${escapeLabel(value)}"`).join(',')}}`;
}

export function escapeLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}

function formatNumber(value: number): string {
  if (Number.isNaN(value)) return 'NaN';
  if (value === Infinity) return '+Inf';
  if (value === -Infinity) return '-Inf';
  return String(value);
}

interface Family {
  name: string;
  help: string;
  type: 'counter' | 'gauge' | 'histogram';
  render(): string[];
}

export class Counter {
  private readonly values = new Map<string, number>();
  inc(labels: Labels = {}, by = 1): void {
    const key = labelKey(labels);
    this.values.set(key, (this.values.get(key) ?? 0) + by);
  }
  get(labels: Labels = {}): number {
    return this.values.get(labelKey(labels)) ?? 0;
  }
  lines(name: string): string[] {
    return [...this.values.entries()].map(([key, value]) => `${name}${key} ${formatNumber(value)}`);
  }
}

export class Histogram {
  private readonly series = new Map<string, { counts: number[]; sum: number; count: number }>();
  constructor(private readonly buckets: readonly number[] = HTTP_BUCKETS) {}
  observe(value: number, labels: Labels = {}): void {
    const key = labelKey(labels);
    let entry = this.series.get(key);
    if (!entry) {
      entry = { counts: this.buckets.map(() => 0), sum: 0, count: 0 };
      this.series.set(key, entry);
    }
    this.buckets.forEach((bound, index) => {
      if (value <= bound) entry.counts[index] = (entry.counts[index] ?? 0) + 1;
    });
    entry.sum += value;
    entry.count += 1;
  }
  lines(name: string): string[] {
    const out: string[] = [];
    for (const [key, entry] of this.series) {
      const inner = key === '' ? '' : key.slice(1, -1);
      const withLe = (le: string) => `{${inner === '' ? '' : `${inner},`}le="${le}"}`;
      this.buckets.forEach((bound, index) => {
        out.push(`${name}_bucket${withLe(formatNumber(bound))} ${entry.counts[index] ?? 0}`);
      });
      out.push(`${name}_bucket${withLe('+Inf')} ${entry.count}`);
      out.push(`${name}_sum${key} ${formatNumber(entry.sum)}`);
      out.push(`${name}_count${key} ${entry.count}`);
    }
    return out;
  }
}

export type GaugeReader = () => number | ReadonlyArray<{ labels: Labels; value: number }>;

export class MetricsRegistry {
  private readonly families: Family[] = [];

  counter(name: string, help: string): Counter {
    const counter = new Counter();
    this.families.push({ name, help, type: 'counter', render: () => counter.lines(name) });
    return counter;
  }

  histogram(name: string, help: string, buckets?: readonly number[]): Histogram {
    const histogram = new Histogram(buckets);
    this.families.push({ name, help, type: 'histogram', render: () => histogram.lines(name) });
    return histogram;
  }

  /** A gauge read at scrape time; a failing reader is skipped rather than breaking `/metrics`. */
  gauge(name: string, help: string, read: GaugeReader): void {
    this.families.push({
      name,
      help,
      type: 'gauge',
      render: () => {
        try {
          const value = read();
          if (typeof value === 'number') return [`${name} ${formatNumber(value)}`];
          return value.map(
            (entry) => `${name}${labelKey(entry.labels)} ${formatNumber(entry.value)}`,
          );
        } catch {
          return [];
        }
      },
    });
  }

  render(): string {
    const out: string[] = [];
    for (const family of this.families) {
      out.push(`# HELP ${family.name} ${family.help}`, `# TYPE ${family.name} ${family.type}`);
      out.push(...family.render());
    }
    return `${out.join('\n')}\n`;
  }
}

export interface ServerMetrics {
  registry: MetricsRegistry;
  httpRequests: Counter;
  httpDuration: Histogram;
  socketEvents: Counter;
  rateLimited: Counter;
  stop(): void;
}

/** Process-level metrics shared by every server (memory, uptime, event-loop delay). */
export function createServerMetrics(
  options: { now?: () => number; version?: string } = {},
): ServerMetrics {
  const now = options.now ?? Date.now;
  const startedAt = now();
  const registry = new MetricsRegistry();
  let loop: IntervalHistogram | null = null;
  try {
    loop = monitorEventLoopDelay({ resolution: 20 });
    loop.enable();
  } catch {
    loop = null;
  }
  registry.gauge('encycla_build_info', 'Build information (value is always 1).', () => [
    { labels: { version: options.version ?? 'unknown', node: process.version }, value: 1 },
  ]);
  registry.gauge('encycla_uptime_seconds', 'Seconds since the server started.', () =>
    Math.round((now() - startedAt) / 1000),
  );
  registry.gauge(
    'encycla_process_resident_memory_bytes',
    'Resident memory (RSS).',
    () => process.memoryUsage().rss,
  );
  registry.gauge(
    'encycla_process_heap_used_bytes',
    'V8 heap in use.',
    () => process.memoryUsage().heapUsed,
  );
  registry.gauge(
    'encycla_event_loop_delay_p99_seconds',
    'Event-loop delay, 99th percentile since the previous scrape.',
    () => {
      if (!loop) return 0;
      const value = loop.percentile(99) / 1e9;
      loop.reset();
      return Number.isFinite(value) ? value : 0;
    },
  );
  const httpRequests = registry.counter(
    'encycla_http_requests_total',
    'HTTP requests by method, route group and status class.',
  );
  const httpDuration = registry.histogram(
    'encycla_http_request_duration_seconds',
    'HTTP request duration by route group.',
  );
  const socketEvents = registry.counter(
    'encycla_socket_events_total',
    'Socket.io events received by name and outcome.',
  );
  const rateLimited = registry.counter(
    'encycla_rate_limited_total',
    'Requests or socket events refused by a rate limit, by scope.',
  );
  return {
    registry,
    httpRequests,
    httpDuration,
    socketEvents,
    rateLimited,
    stop: () => loop?.disable(),
  };
}

/** Collapses a request path into a bounded route group (no ids, codes or tokens as labels). */
export function routeGroup(path: string): string {
  if (path === '/healthz' || path === '/readyz' || path === '/metrics') return path;
  if (path.startsWith('/img/')) return '/img';
  if (path.startsWith('/assets/')) return '/assets';
  if (!path.startsWith('/api/')) return 'static';
  const [head = '', second = ''] = path.split('/').filter(Boolean).slice(1);
  if (head === 'admin') return ADMIN_GROUPS.has(second) ? `/api/admin/${second}` : '/api/admin';
  return API_GROUPS.has(head) ? `/api/${head}` : '/api/other';
}

const API_GROUPS = new Set([
  'health',
  'sessions',
  'config',
  'me',
  'queue',
  'rooms',
  'solo',
  'leaderboard',
  'tiktok',
]);
const ADMIN_GROUPS = new Set(['questions', 'rooms', 'tiktok']);
