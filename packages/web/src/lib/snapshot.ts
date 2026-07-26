/**
 * Offline basemap snapshots.
 *
 * Why a single raster and not SVG or cached tiles:
 *
 *   A 600 x 600 m farm at z19 is ~149 tiles (~3.2 MB) fetched as 149 requests.
 *   Stitched and re-encoded as one WebP at q80 it is 0.5–0.8 MB in ONE request.
 *   The farm's own shapes are already vector and cost ~5 KB, so they stay
 *   vector and are drawn on top — only the aerial imagery is raster, and
 *   imagery cannot be vectorised.
 *
 * The snapshot stores its exact geographic bounds alongside the pixels, so the
 * image can be re-projected onto the map at any zoom without drift. That is the
 * part that keeps shapes aligned when the team later resizes or re-centres.
 */

export interface SnapshotBounds {
  north: number; south: number; east: number; west: number;
}

export interface Snapshot {
  /** WebP (or PNG fallback) as a blob. */
  blob: Blob;
  bounds: SnapshotBounds;
  width: number;
  height: number;
  zoom: number;
  capturedAt: string;
  bytes: number;
}

const TILE = 256;

/** Slippy-map helpers, standard Web Mercator. */
function lonToX(lon: number, z: number): number { return ((lon + 180) / 360) * 2 ** z; }
function latToY(lat: number, z: number): number {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
}
function xToLon(x: number, z: number): number { return (x / 2 ** z) * 360 - 180; }
function yToLat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

/**
 * Choose the deepest zoom whose stitched image stays within a pixel budget.
 * Beyond ~4000px the file grows faster than the detail is useful on a phone.
 */
export function chooseZoom(bounds: SnapshotBounds, maxPx = 4096, maxZoom = 19): number {
  for (let z = maxZoom; z >= 12; z--) {
    const w = (lonToX(bounds.east, z) - lonToX(bounds.west, z)) * TILE;
    const h = (latToY(bounds.south, z) - latToY(bounds.north, z)) * TILE;
    if (w <= maxPx && h <= maxPx) return z;
  }
  return 12;
}

export interface CaptureProgress { done: number; total: number }

/**
 * Stitch the tiles covering `bounds` into one image.
 *
 * Tiles are fetched with a small concurrency limit: a phone on rural LTE
 * fetching 150 tiles at once will simply drop most of them.
 */
export async function captureSnapshot(
  bounds: SnapshotBounds,
  tileUrl: string,
  opts: { zoom?: number; onProgress?: (p: CaptureProgress) => void; quality?: number } = {},
): Promise<Snapshot> {
  const zoom = opts.zoom ?? chooseZoom(bounds);

  const x0 = lonToX(bounds.west, zoom);
  const x1 = lonToX(bounds.east, zoom);
  const y0 = latToY(bounds.north, zoom);
  const y1 = latToY(bounds.south, zoom);

  const tileX0 = Math.floor(x0), tileX1 = Math.ceil(x1);
  const tileY0 = Math.floor(y0), tileY1 = Math.ceil(y1);
  const cols = tileX1 - tileX0;
  const rows = tileY1 - tileY0;

  const canvas = document.createElement('canvas');
  canvas.width = cols * TILE;
  canvas.height = rows * TILE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas_unavailable');
  const draw = ctx; // narrowed for the async workers below

  const jobs: Array<{ x: number; y: number; px: number; py: number }> = [];
  for (let ty = tileY0; ty < tileY1; ty++) {
    for (let tx = tileX0; tx < tileX1; tx++) {
      jobs.push({ x: tx, y: ty, px: (tx - tileX0) * TILE, py: (ty - tileY0) * TILE });
    }
  }

  let done = 0;
  const CONCURRENCY = 6;

  async function worker(): Promise<void> {
    for (;;) {
      const job = jobs.shift();
      if (!job) return;
      const url = tileUrl
        .replace('{z}', String(zoom))
        .replace('{x}', String(job.x))
        .replace('{y}', String(job.y))
        .replace('{s}', ['a', 'b', 'c'][job.x % 3]!);
      try {
        const img = await loadImage(url);
        draw.drawImage(img, job.px, job.py, TILE, TILE);
      } catch {
        // A missing tile leaves a grey square rather than failing the capture.
        draw.fillStyle = '#dfe5e0';
        draw.fillRect(job.px, job.py, TILE, TILE);
      }
      done++;
      opts.onProgress?.({ done, total: done + jobs.length });
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // Crop to the exact requested bounds so the stored geo-reference is precise.
  const cropX = Math.round((x0 - tileX0) * TILE);
  const cropY = Math.round((y0 - tileY0) * TILE);
  const cropW = Math.max(1, Math.round((x1 - x0) * TILE));
  const cropH = Math.max(1, Math.round((y1 - y0) * TILE));

  const out = document.createElement('canvas');
  out.width = cropW; out.height = cropH;
  const octx = out.getContext('2d');
  if (!octx) throw new Error('canvas_unavailable');
  octx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

  const blob = await toBlob(out, opts.quality ?? 0.8);

  return {
    blob,
    // Recomputed from the cropped pixels, so bounds and image agree exactly.
    bounds: {
      west: xToLon(x0, zoom), east: xToLon(x1, zoom),
      north: yToLat(y0, zoom), south: yToLat(y1, zoom),
    },
    width: cropW,
    height: cropH,
    zoom,
    capturedAt: new Date().toISOString(),
    bytes: blob.size,
  };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Required or the canvas is tainted and cannot be exported.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('tile_failed'));
    img.src = url;
  });
}

async function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  // WebP is ~40% smaller than JPEG at equal quality; PNG is the safe fallback.
  for (const type of ['image/webp', 'image/jpeg', 'image/png']) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, quality));
    if (blob && blob.size > 0) return blob;
  }
  throw new Error('encode_failed');
}

// ------------------------------------------------------------- persistence

const DB_NAME = 'solawi-snapshots';

async function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('maps')) {
        req.result.createObjectStore('maps', { keyPath: 'org' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface StoredSnapshot extends Omit<Snapshot, 'blob'> { org: string; blob: Blob }

export async function saveSnapshot(org: string, snap: Snapshot): Promise<void> {
  const d = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = d.transaction('maps', 'readwrite');
    tx.objectStore('maps').put({ org, ...snap });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadSnapshot(org: string): Promise<StoredSnapshot | null> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction('maps', 'readonly');
    const req = tx.objectStore('maps').get(org);
    req.onsuccess = () => resolve((req.result as StoredSnapshot) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteSnapshot(org: string): Promise<void> {
  const d = await db();
  await new Promise<void>((resolve) => {
    const tx = d.transaction('maps', 'readwrite');
    tx.objectStore('maps').delete(org);
    tx.oncomplete = () => resolve();
  });
}

/** Download the snapshot, so a farm can keep or print it. */
export function downloadSnapshot(snap: Snapshot, name = 'hofkarte'): void {
  const ext = snap.blob.type.split('/')[1] ?? 'png';
  const url = URL.createObjectURL(snap.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}-z${snap.zoom}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}
