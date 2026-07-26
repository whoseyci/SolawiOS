/**
 * Offline tile pyramid.
 *
 * ── Why this replaces the single stitched image ────────────────────────────
 * A stitched snapshot has ONE resolution. Zooming past its capture level just
 * upscales the same pixels, which is why the map went soft — there was no more
 * detail to show. Worse, a 1.5 km farm as one image needs ~244 MB of decoded
 * RGBA in RAM, and iOS kills a tab long before that.
 *
 * A pyramid stores every zoom level. The cost is far lower than it sounds:
 * each level up is a quarter of the tiles, so z16+z17+z18+z19 together is only
 * 1.33x the deepest level alone. A 600 m farm is ~200 tiles, ~3.5 MB for the
 * street map and ~4.6 MB for satellite — both layers, all zooms, under 10 MB.
 *
 * Tiles are stored individually and served by a custom Leaflet layer, so
 * panning and zooming behave exactly as online, with nothing fetched.
 */

export type LayerId = 'osm' | 'satellite';

export interface TileBounds { north: number; south: number; east: number; west: number }

export interface PyramidMeta {
  org: string;
  layer: LayerId;
  bounds: TileBounds;
  minZoom: number;
  maxZoom: number;
  tileCount: number;
  bytes: number;
  capturedAt: string;
}

export interface DownloadProgress {
  layer: LayerId;
  done: number;
  total: number;
  bytes: number;
  zoom: number;
}

const DB_NAME = 'solawi-tiles';
const DB_VERSION = 1;
const TILES = 'tiles';
const META = 'meta';

export const TILE_SOURCES: Record<LayerId, { url: string; maxNative: number; label: string }> = {
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxNative: 19,
    label: 'OpenStreetMap',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxNative: 19,
    label: 'Esri World Imagery',
  },
};

// ------------------------------------------------------------- projection

export function lonToTileX(lon: number, z: number): number {
  return Math.floor(((lon + 180) / 360) * 2 ** z);
}
export function latToTileY(lat: number, z: number): number {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
}

/** Every tile covering `bounds` between the two zoom levels. */
export function tilesFor(bounds: TileBounds, minZoom: number, maxZoom: number) {
  const out: Array<{ z: number; x: number; y: number }> = [];
  for (let z = minZoom; z <= maxZoom; z++) {
    const x0 = lonToTileX(bounds.west, z), x1 = lonToTileX(bounds.east, z);
    const y0 = latToTileY(bounds.north, z), y1 = latToTileY(bounds.south, z);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push({ z, x, y });
  }
  return out;
}

export function estimate(bounds: TileBounds, minZoom: number, maxZoom: number, layer: LayerId) {
  const count = tilesFor(bounds, minZoom, maxZoom).length;
  const perTile = layer === 'satellite' ? 24_000 : 18_000;
  return { count, bytes: count * perTile };
}

// -------------------------------------------------------------- storage

let dbPromise: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(TILES)) d.createObjectStore(TILES);
      if (!d.objectStoreNames.contains(META)) d.createObjectStore(META);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

const tileKey = (org: string, layer: LayerId, z: number, x: number, y: number) =>
  `${org}/${layer}/${z}/${x}/${y}`;
const metaKey = (org: string, layer: LayerId) => `${org}/${layer}`;

export async function putTile(
  org: string, layer: LayerId, z: number, x: number, y: number, blob: Blob,
): Promise<void> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(TILES, 'readwrite');
    tx.objectStore(TILES).put(blob, tileKey(org, layer, z, x, y));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getTile(
  org: string, layer: LayerId, z: number, x: number, y: number,
): Promise<Blob | null> {
  const d = await db();
  return new Promise((resolve) => {
    const tx = d.transaction(TILES, 'readonly');
    const req = tx.objectStore(TILES).get(tileKey(org, layer, z, x, y));
    req.onsuccess = () => resolve((req.result as Blob) ?? null);
    req.onerror = () => resolve(null);
  });
}

export async function putMeta(meta: PyramidMeta): Promise<void> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(META, 'readwrite');
    tx.objectStore(META).put(meta, metaKey(meta.org, meta.layer));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getMeta(org: string, layer: LayerId): Promise<PyramidMeta | null> {
  const d = await db();
  return new Promise((resolve) => {
    const tx = d.transaction(META, 'readonly');
    const req = tx.objectStore(META).get(metaKey(org, layer));
    req.onsuccess = () => resolve((req.result as PyramidMeta) ?? null);
    req.onerror = () => resolve(null);
  });
}

export async function allMeta(org: string): Promise<PyramidMeta[]> {
  const out: PyramidMeta[] = [];
  for (const layer of Object.keys(TILE_SOURCES) as LayerId[]) {
    const m = await getMeta(org, layer);
    if (m) out.push(m);
  }
  return out;
}

export async function clearLayer(org: string, layer: LayerId): Promise<void> {
  const d = await db();
  const meta = await getMeta(org, layer);
  if (meta) {
    await new Promise<void>((resolve) => {
      const tx = d.transaction(TILES, 'readwrite');
      const store = tx.objectStore(TILES);
      for (const t of tilesFor(meta.bounds, meta.minZoom, meta.maxZoom)) {
        store.delete(tileKey(org, layer, t.z, t.x, t.y));
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }
  await new Promise<void>((resolve) => {
    const tx = d.transaction(META, 'readwrite');
    tx.objectStore(META).delete(metaKey(org, layer));
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

/** Browser storage headroom, so we can warn before filling the disk. */
export async function quota(): Promise<{ usage: number; available: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const e = await navigator.storage.estimate();
  return { usage: e.usage ?? 0, available: (e.quota ?? 0) - (e.usage ?? 0) };
}

/** Ask for persistent storage so the browser does not evict the tiles. */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted?.()) return true;
  return navigator.storage.persist();
}

// ------------------------------------------------------------- downloading

export interface DownloadOptions {
  minZoom?: number;
  maxZoom?: number;
  concurrency?: number;
  onProgress?: (p: DownloadProgress) => void;
  signal?: AbortSignal;
}

/**
 * Fetch and store every tile for one layer.
 *
 * Tiles already held are skipped, so extending coverage or resuming after a
 * dropped connection is cheap. Concurrency is deliberately low: a phone on
 * rural LTE asked for 200 tiles at once will drop most of them.
 */
export async function downloadLayer(
  org: string, layer: LayerId, bounds: TileBounds, opts: DownloadOptions = {},
): Promise<PyramidMeta> {
  const source = TILE_SOURCES[layer];
  const minZoom = opts.minZoom ?? 16;
  const maxZoom = Math.min(opts.maxZoom ?? source.maxNative, source.maxNative);
  const jobs = tilesFor(bounds, minZoom, maxZoom);

  let done = 0;
  let bytes = 0;
  const total = jobs.length;
  const queue = [...jobs];

  async function worker(): Promise<void> {
    for (;;) {
      if (opts.signal?.aborted) return;
      const job = queue.shift();
      if (!job) return;

      const existing = await getTile(org, layer, job.z, job.x, job.y);
      if (existing) {
        done++; bytes += existing.size;
        opts.onProgress?.({ layer, done, total, bytes, zoom: job.z });
        continue;
      }

      const url = source.url
        .replace('{z}', String(job.z))
        .replace('{x}', String(job.x))
        .replace('{y}', String(job.y))
        .replace('{s}', ['a', 'b', 'c'][job.x % 3]!);

      try {
        const res = await fetch(url, { signal: opts.signal, mode: 'cors' });
        if (res.ok) {
          const blob = await res.blob();
          await putTile(org, layer, job.z, job.x, job.y, blob);
          bytes += blob.size;
        }
      } catch {
        // A missing tile is not fatal; the layer simply has a gap there.
      }
      done++;
      opts.onProgress?.({ layer, done, total, bytes, zoom: job.z });
    }
  }

  await Promise.all(Array.from({ length: opts.concurrency ?? 5 }, worker));

  const meta: PyramidMeta = {
    org, layer, bounds, minZoom, maxZoom,
    tileCount: total, bytes,
    capturedAt: new Date().toISOString(),
  };
  await putMeta(meta);
  return meta;
}
