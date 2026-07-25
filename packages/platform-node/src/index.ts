import Database from 'better-sqlite3';
import { createHash, randomBytes, randomUUID, pbkdf2, timingSafeEqual as nodeTimingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type {
  Platform, Store, BlobStore, KeyValue, Queue, Realtime, Scheduler, Clock, Crypto,
  SqlValue, Row, BlobMeta,
} from '@solawi/platform';

const pbkdf2Async = promisify(pbkdf2);
const PBKDF2_ITERATIONS = 210_000; // OWASP guidance for PBKDF2-SHA256

class SqliteStore implements Store {
  constructor(private readonly db: Database.Database) {}

  async all<T = Row>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    return this.db.prepare(sql).all(...params) as T[];
  }
  async first<T = Row>(sql: string, params: SqlValue[] = []): Promise<T | null> {
    return (this.db.prepare(sql).get(...params) as T | undefined) ?? null;
  }
  async run(sql: string, params: SqlValue[] = []): Promise<{ changes: number }> {
    const info = this.db.prepare(sql).run(...params);
    return { changes: info.changes };
  }
  async batch(statements: Array<{ sql: string; params?: SqlValue[] }>): Promise<void> {
    const tx = this.db.transaction((items: Array<{ sql: string; params?: SqlValue[] }>) => {
      for (const s of items) this.db.prepare(s.sql).run(...(s.params ?? []));
    });
    tx(statements);
  }
}

class FsBlobStore implements BlobStore {
  constructor(private readonly root: string) { mkdirSync(root, { recursive: true }); }
  private path(key: string) { return join(this.root, key.replace(/\.\./g, '_')); }

  async put(key: string, value: ArrayBuffer | Uint8Array | string, _meta?: BlobMeta): Promise<void> {
    const p = this.path(key);
    mkdirSync(dirname(p), { recursive: true });
    const buf = typeof value === 'string' ? Buffer.from(value)
      : Buffer.from(value instanceof Uint8Array ? value : new Uint8Array(value));
    writeFileSync(p, buf);
  }
  async get(key: string): Promise<ArrayBuffer | null> {
    const p = this.path(key);
    if (!existsSync(p)) return null;
    const buf = readFileSync(p);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  }
  async delete(key: string): Promise<void> {
    const p = this.path(key);
    if (existsSync(p)) unlinkSync(p);
  }
  async list(prefix: string): Promise<string[]> {
    const dir = join(this.root, prefix);
    if (!existsSync(dir)) return [];
    return readdirSync(dir).map((f) => join(prefix, f));
  }
}

class SqliteKeyValue implements KeyValue {
  constructor(private readonly db: Database.Database) {
    db.exec(`CREATE TABLE IF NOT EXISTS _kv (k TEXT PRIMARY KEY, v TEXT NOT NULL, expires_at INTEGER)`);
  }
  async get(key: string): Promise<string | null> {
    const row = this.db.prepare(`SELECT v, expires_at FROM _kv WHERE k = ?`).get(key) as
      { v: string; expires_at: number | null } | undefined;
    if (!row) return null;
    if (row.expires_at && row.expires_at < Date.now()) {
      this.db.prepare(`DELETE FROM _kv WHERE k = ?`).run(key);
      return null;
    }
    return row.v;
  }
  async put(key: string, value: string, opts?: { ttlSeconds?: number }): Promise<void> {
    const exp = opts?.ttlSeconds ? Date.now() + opts.ttlSeconds * 1000 : null;
    this.db.prepare(
      `INSERT INTO _kv (k, v, expires_at) VALUES (?, ?, ?)
       ON CONFLICT(k) DO UPDATE SET v = excluded.v, expires_at = excluded.expires_at`,
    ).run(key, value, exp);
  }
  async delete(key: string): Promise<void> {
    this.db.prepare(`DELETE FROM _kv WHERE k = ?`).run(key);
  }
}

/** In-process queue. Adequate for a single-node self-host; not a distributed queue. */
class InProcessQueue implements Queue {
  private handlers = new Map<string, (payload: unknown) => Promise<void>>();
  on(name: string, fn: (payload: unknown) => Promise<void>) { this.handlers.set(name, fn); }
  async send(name: string, payload: unknown, opts?: { delaySeconds?: number }): Promise<void> {
    const run = async () => {
      const h = this.handlers.get(name);
      if (h) { try { await h(payload); } catch { /* logged by caller */ } }
    };
    if (opts?.delaySeconds) setTimeout(() => { void run(); }, opts.delaySeconds * 1000).unref?.();
    else queueMicrotask(() => { void run(); });
  }
}

/** In-process pub/sub. The Node server bridges this to WebSocket clients. */
export class InProcessRealtime implements Realtime {
  private subs = new Map<string, Set<(msg: unknown) => void>>();
  subscribe(channel: string, fn: (msg: unknown) => void): () => void {
    const set = this.subs.get(channel) ?? new Set();
    set.add(fn); this.subs.set(channel, set);
    return () => { set.delete(fn); };
  }
  async publish(channel: string, message: unknown): Promise<void> {
    for (const fn of this.subs.get(channel) ?? []) { try { fn(message); } catch { /* ignore */ } }
  }
}

class SimpleScheduler implements Scheduler {
  private jobs: Array<{ name: string; cron: string }> = [];
  register(name: string, cron: string): void { this.jobs.push({ name, cron }); }
  list() { return [...this.jobs]; }
}

const nodeCrypto: Crypto = {
  randomUUID: () => randomUUID(),
  randomHex: (bytes) => randomBytes(bytes).toString('hex'),
  timingSafeEqual(a, b) {
    const ab = Buffer.from(a), bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    return nodeTimingSafeEqual(ab, bb);
  },
  async hashPassword(password, salt) {
    const key = await pbkdf2Async(password, salt, PBKDF2_ITERATIONS, 32, 'sha256');
    return key.toString('hex');
  },
  async verifyPassword(password, salt, hash) {
    const computed = await this.hashPassword(password, salt);
    return this.timingSafeEqual(computed, hash);
  },
};

export interface NodePlatformOptions {
  /** SQLite file path, or ':memory:' for tests. */
  databasePath?: string;
  blobRoot?: string;
  clock?: Clock;
}

export function createNodePlatform(opts: NodePlatformOptions = {}): Platform & {
  realtime: InProcessRealtime; queue: InProcessQueue; close(): void;
} {
  const dbPath = opts.databasePath ?? ':memory:';
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const realtime = new InProcessRealtime();
  const queue = new InProcessQueue();

  return {
    store: new SqliteStore(db),
    blobs: new FsBlobStore(opts.blobRoot ?? './data/blobs'),
    kv: new SqliteKeyValue(db),
    queue,
    realtime,
    scheduler: new SimpleScheduler(),
    clock: opts.clock ?? { now: () => new Date() },
    crypto: nodeCrypto,
    flavour: 'node',
    close() { db.close(); },
  };
}

export { createHash };
