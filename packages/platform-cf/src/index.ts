import type {
  Platform, Store, BlobStore, KeyValue, Queue, Realtime, Scheduler, Clock, Crypto,
  SqlValue, Row, BlobMeta,
} from '@solawi/platform';

// Password hashing lives in ./password.ts: the Workers free plan caps CPU at
// 10 ms per request and a single-shot PBKDF2 blows straight through it.
import { hashPassword, verifyPassword, timingSafeEqual } from './password.js';

/**
 * Cloudflare platform implementation (ADR-0004).
 *
 * Bindings are typed structurally rather than against @cloudflare/workers-types
 * so this package builds without the Workers type package installed. The shapes
 * match the real runtime API.
 */

export interface D1Like {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      all<T = unknown>(): Promise<{ results: T[] }>;
      first<T = unknown>(): Promise<T | null>;
      run(): Promise<{ meta: { changes: number } }>;
    };
  };
  batch(statements: unknown[]): Promise<unknown[]>;
}

export interface R2Like {
  put(key: string, value: ArrayBuffer | Uint8Array | string, opts?: unknown): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
  delete(key: string): Promise<void>;
  list(opts: { prefix: string }): Promise<{ objects: Array<{ key: string }> }>;
}

export interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface QueueLike {
  send(message: unknown, opts?: { delaySeconds?: number }): Promise<void>;
}

export interface DurableObjectNamespaceLike {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(request: Request): Promise<Response> };
}

export interface CfBindings {
  DB: D1Like;
  BLOBS?: R2Like;
  CACHE?: KVLike;
  JOBS?: QueueLike;
  BIDDING?: DurableObjectNamespaceLike;
}


class D1Store implements Store {
  constructor(private readonly db: D1Like) {}

  async all<T = Row>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    const res = await this.db.prepare(sql).bind(...params).all<T>();
    return res.results ?? [];
  }
  async first<T = Row>(sql: string, params: SqlValue[] = []): Promise<T | null> {
    return this.db.prepare(sql).bind(...params).first<T>();
  }
  async run(sql: string, params: SqlValue[] = []): Promise<{ changes: number }> {
    const res = await this.db.prepare(sql).bind(...params).run();
    return { changes: res.meta?.changes ?? 0 };
  }
  async batch(statements: Array<{ sql: string; params?: SqlValue[] }>): Promise<void> {
    if (statements.length === 0) return;
    // D1 batches are atomic; interactive transactions are not available, which is
    // exactly why Store.batch takes a list rather than a callback.
    const prepared = statements.map((s) => this.db.prepare(s.sql).bind(...(s.params ?? [])));
    await this.db.batch(prepared);
  }
}

class R2BlobStore implements BlobStore {
  constructor(private readonly bucket: R2Like) {}
  async put(key: string, value: ArrayBuffer | Uint8Array | string, meta?: BlobMeta): Promise<void> {
    await this.bucket.put(key, value, meta?.contentType
      ? { httpMetadata: { contentType: meta.contentType } } : undefined);
  }
  async get(key: string): Promise<ArrayBuffer | null> {
    const obj = await this.bucket.get(key);
    return obj ? obj.arrayBuffer() : null;
  }
  async delete(key: string): Promise<void> { await this.bucket.delete(key); }
  async list(prefix: string): Promise<string[]> {
    const res = await this.bucket.list({ prefix });
    return res.objects.map((o) => o.key);
  }
}

class WorkersKV implements KeyValue {
  constructor(private readonly kv: KVLike) {}
  get(key: string) { return this.kv.get(key); }
  async put(key: string, value: string, opts?: { ttlSeconds?: number }) {
    await this.kv.put(key, value, opts?.ttlSeconds ? { expirationTtl: opts.ttlSeconds } : undefined);
  }
  async delete(key: string) { await this.kv.delete(key); }
}

/** Falls back to a no-op when the queue binding is absent (e.g. local dev). */
class CfQueue implements Queue {
  constructor(private readonly q?: QueueLike) {}
  async send(name: string, payload: unknown, opts?: { delaySeconds?: number }): Promise<void> {
    if (!this.q) return;
    await this.q.send({ name, payload }, opts);
  }
}

/**
 * Realtime via Durable Objects. Each channel maps to one DO instance, which owns
 * the WebSocket fan-out and (for bidding) the batching rules in ADR-0005 §3.
 */
class DurableRealtime implements Realtime {
  constructor(private readonly ns?: DurableObjectNamespaceLike) {}
  async publish(channel: string, message: unknown): Promise<void> {
    if (!this.ns) return;
    const stub = this.ns.get(this.ns.idFromName(channel));
    await stub.fetch(new Request('https://do/publish', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(message),
    }));
  }
}

class CronScheduler implements Scheduler {
  private jobs: Array<{ name: string; cron: string }> = [];
  register(name: string, cron: string): void { this.jobs.push({ name, cron }); }
  list() { return [...this.jobs]; }
}

const webCrypto: Crypto = {
  randomUUID: () => crypto.randomUUID(),
  randomHex(bytes) {
    const arr = new Uint8Array(bytes);
    crypto.getRandomValues(arr);
    return [...arr].map((b) => b.toString(16).padStart(2, '0')).join('');
  },
  timingSafeEqual,
  hashPassword,
  verifyPassword,
};

export function createCloudflarePlatform(env: CfBindings, clock?: Clock): Platform {
  return {
    store: new D1Store(env.DB),
    blobs: new R2BlobStore(env.BLOBS ?? nullR2()),
    kv: new WorkersKV(env.CACHE ?? nullKV()),
    queue: new CfQueue(env.JOBS),
    realtime: new DurableRealtime(env.BIDDING),
    scheduler: new CronScheduler(),
    clock: clock ?? { now: () => new Date() },
    crypto: webCrypto,
    flavour: 'cloudflare',
  };
}

function nullR2(): R2Like {
  return {
    async put() {}, async get() { return null; }, async delete() {},
    async list() { return { objects: [] }; },
  };
}
function nullKV(): KVLike {
  return { async get() { return null; }, async put() {}, async delete() {} };
}
