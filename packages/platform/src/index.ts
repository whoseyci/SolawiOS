/**
 * Platform capability interfaces (ADR-0004).
 *
 * These are the ONLY way modules touch infrastructure. No module may import a
 * Cloudflare type, a Node type, or a driver. Two implementations exist and both
 * are exercised in CI: `@solawi/platform-cf` and `@solawi/platform-node`.
 *
 * Baseline SQL dialect is SQLite (D1 on Cloudflare, better-sqlite3 locally), so
 * queries written against `Store` must stay within SQLite's dialect.
 */

/** A value that can cross the SQL boundary. */
export type SqlValue = string | number | null | Uint8Array;

/** A row returned from the store. */
export type Row = Record<string, SqlValue>;

/**
 * Relational persistence. Deliberately tiny: it is a query interface, not an ORM.
 * Parameters are always bound, never interpolated.
 */
export interface Store {
  /** Return all matching rows. */
  all<T = Row>(sql: string, params?: SqlValue[]): Promise<T[]>;
  /** Return the first row, or null. */
  first<T = Row>(sql: string, params?: SqlValue[]): Promise<T | null>;
  /** Execute a statement; returns number of affected rows where known. */
  run(sql: string, params?: SqlValue[]): Promise<{ changes: number }>;
  /**
   * Execute a set of statements atomically.
   *
   * Note: D1 batches are atomic but do not support interactive transactions,
   * so the callback receives a queue rather than a live connection. This is the
   * intersection of both platforms and must not be widened.
   */
  batch(statements: Array<{ sql: string; params?: SqlValue[] }>): Promise<void>;
}

/** Binary object storage: photos, exports, documents. */
export interface BlobStore {
  put(key: string, value: ArrayBuffer | Uint8Array | string, meta?: BlobMeta): Promise<void>;
  get(key: string): Promise<ArrayBuffer | null>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

export interface BlobMeta {
  contentType?: string;
  /** Cache lifetime in seconds. */
  ttl?: number;
}

/** Small mutable values: config, feature flags, counters. */
export interface KeyValue {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { ttlSeconds?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

/** Deferred work. Handlers are registered by the server, not by modules. */
export interface Queue {
  send(name: string, payload: unknown, opts?: { delaySeconds?: number }): Promise<void>;
}

/** Live sessions (the Bieterrunde projector, presence). */
export interface Realtime {
  /** Broadcast to every subscriber of a channel. */
  publish(channel: string, message: unknown): Promise<void>;
}

/** Recurring work. Schedules are declared statically; this reads them back. */
export interface Scheduler {
  /** Register a recurring job. Called at boot by the server. */
  register(name: string, cron: string): void;
  list(): Array<{ name: string; cron: string }>;
}

/** Clock, injected so tests are deterministic and time is never read ad hoc. */
export interface Clock {
  now(): Date;
}

/** Cryptographic helpers. Wrapped so modules never reach for a runtime global. */
export interface Crypto {
  randomUUID(): string;
  /** Random bytes, hex-encoded. */
  randomHex(bytes: number): string;
  /** Constant-time comparison for tokens and hashes. */
  timingSafeEqual(a: string, b: string): boolean;
  hashPassword(password: string, salt: string): Promise<string>;
  /** Argon2id-style parameters are not available on Workers; we use PBKDF2-SHA256. */
  verifyPassword(password: string, salt: string, hash: string): Promise<boolean>;
}

/**
 * The full platform surface handed to the kernel at boot.
 * Modules receive a narrowed view via their context (see @solawi/kernel).
 */
export interface Platform {
  store: Store;
  blobs: BlobStore;
  kv: KeyValue;
  queue: Queue;
  realtime: Realtime;
  scheduler: Scheduler;
  clock: Clock;
  crypto: Crypto;
  /** Which implementation is running; for diagnostics only, never for branching logic. */
  readonly flavour: 'cloudflare' | 'node';
}

/** Thrown when a capability is used that the current platform cannot provide. */
export class CapabilityUnavailable extends Error {
  constructor(capability: string) {
    super(`Platform capability unavailable: ${capability}`);
    this.name = 'CapabilityUnavailable';
  }
}
