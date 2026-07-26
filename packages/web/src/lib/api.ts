/**
 * API client with an offline outbox.
 *
 * The binding constraint (ADR-0004 §6): a gardener records a harvest in a field
 * with no signal. The write must succeed locally and sync later, or the data is
 * simply never captured.
 *
 * Strategy:
 *  - GET  → network first, fall back to a cached copy, mark the UI as stale
 *  - POST → if offline, queue in IndexedDB and return optimistically
 *  - observations carry client-generated ids, so replaying a batch is idempotent
 */

const TOKEN_KEY = 'solawi.token';
const ORG_KEY = 'solawi.org';

export interface QueuedWrite {
  id: string;
  path: string;
  body: unknown;
  queuedAt: string;
}

let db: IDBDatabase | null = null;

async function idb(): Promise<IDBDatabase> {
  if (db) return db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('solawi-os', 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('outbox')) d.createObjectStore('outbox', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('cache')) d.createObjectStore('cache', { keyPath: 'key' });
    };
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(store: string, value: unknown): Promise<void> {
  const d = await idb();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbAll<T>(store: string): Promise<T[]> {
  const d = await idb();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(store: string, key: string): Promise<T | null> {
  const d = await idb();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(store: string, key: string): Promise<void> {
  const d = await idb();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export const auth = {
  get token(): string | null { return localStorage.getItem(TOKEN_KEY); },
  set token(v: string | null) {
    if (v) localStorage.setItem(TOKEN_KEY, v); else localStorage.removeItem(TOKEN_KEY);
  },
  get org(): string | null { return localStorage.getItem(ORG_KEY); },
  set org(v: string | null) {
    if (v) localStorage.setItem(ORG_KEY, v); else localStorage.removeItem(ORG_KEY);
  },
  get signedIn(): boolean { return Boolean(this.token); },
};

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'content-type': 'application/json' };
  if (auth.token) h.authorization = `Bearer ${auth.token}`;
  if (auth.org) h['x-solawi-org'] = auth.org;
  return h;
}

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, readonly payload?: unknown) {
    super(code);
  }
}

export interface GetResult<T> {
  data: T;
  /** True when served from cache because the network was unavailable. */
  stale: boolean;
}

export async function get<T>(path: string): Promise<GetResult<T>> {
  try {
    const res = await fetch(path, { headers: headers() });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(res.status, (body as { error?: string }).error ?? `http_${res.status}`, body);
    }
    const data = (await res.json()) as T;
    await idbPut('cache', { key: cacheKey(path), data, at: Date.now() }).catch(() => {});
    return { data, stale: false };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    const cached = await idbGet<{ data: T }>('cache', cacheKey(path)).catch(() => null);
    if (cached) return { data: cached.data, stale: true };
    throw err;
  }
}

export async function post<T>(path: string, body: unknown, opts: { queue?: boolean } = {}): Promise<T> {
  try {
    const res = await fetch(path, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiError(res.status, (payload as { error?: string }).error ?? `http_${res.status}`, payload);
    }
    return payload as T;
  } catch (err) {
    // Genuine server rejections must surface; only network failures are queued.
    if (err instanceof ApiError) throw err;
    if (opts.queue) {
      const item: QueuedWrite = {
        id: crypto.randomUUID(), path, body, queuedAt: new Date().toISOString(),
      };
      await idbPut('outbox', item);
      window.dispatchEvent(new CustomEvent('solawi:outbox'));
      return { queued: true } as T;
    }
    throw err;
  }
}

export async function del<T>(path: string): Promise<T> {
  const res = await fetch(path, { method: 'DELETE', headers: headers() });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, (payload as { error?: string }).error ?? `http_${res.status}`, payload);
  }
  return payload as T;
}

export async function outboxCount(): Promise<number> {
  return (await idbAll<QueuedWrite>('outbox').catch(() => [])).length;
}

/** Flush queued writes. Called on reconnect and after every successful request. */
export async function flushOutbox(): Promise<{ sent: number; failed: number }> {
  const items = await idbAll<QueuedWrite>('outbox').catch(() => []);
  let sent = 0, failed = 0;
  for (const item of items) {
    try {
      const res = await fetch(item.path, {
        method: 'POST', headers: headers(), body: JSON.stringify(item.body),
      });
      // 4xx means the server rejected it — retrying forever would never help.
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        await idbDelete('outbox', item.id);
        sent++;
      } else failed++;
    } catch { failed++; }
  }
  if (sent > 0) window.dispatchEvent(new CustomEvent('solawi:outbox'));
  return { sent, failed };
}

function cacheKey(path: string): string {
  return `${auth.org ?? 'none'}:${path}`;
}

export const online = {
  get is(): boolean { return navigator.onLine; },
  listen(fn: (online: boolean) => void): void {
    window.addEventListener('online', () => { void flushOutbox(); fn(true); });
    window.addEventListener('offline', () => fn(false));
  },
};
