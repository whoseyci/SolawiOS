/**
 * #7 — suggest field outlines from aerial imagery.
 *
 * HONEST SCOPE. This is colour-region detection, not machine learning. It finds
 * contiguous areas of similar hue in the satellite image and traces their
 * outline. On a clean rectangular field against a road or hedge it works well.
 * On a farm surrounded by other green land it will happily suggest the
 * neighbour's meadow.
 *
 * That is exactly why the interaction is one suggestion at a time with an
 * explicit tick or cross, per your request: the farmer is the classifier, and
 * the algorithm only proposes candidates worth looking at.
 */

export interface Suggestion {
  /** Outline in [lon, lat] pairs, ready to become a Polygon. */
  ring: Array<[number, number]>;
  areaSqm: number;
  /** 0–1, from region compactness and colour uniformity. Ranking only. */
  confidence: number;
}

export interface SuggestOptions {
  /** Downsample before scanning; full resolution is far too slow on a phone. */
  sampleWidth?: number;
  /** Ignore regions smaller than this share of the image. */
  minAreaFraction?: number;
  maxSuggestions?: number;
}

/**
 * Scan a rendered basemap image and propose field-sized regions.
 *
 * `bounds` maps pixels back to coordinates, so the returned rings are
 * geographic and can be saved directly.
 */
export async function suggestFields(
  image: HTMLImageElement | HTMLCanvasElement,
  bounds: { north: number; south: number; east: number; west: number },
  opts: SuggestOptions = {},
): Promise<Suggestion[]> {
  const sampleW = opts.sampleWidth ?? 320;
  const minFrac = opts.minAreaFraction ?? 0.01;
  const maxOut = opts.maxSuggestions ?? 6;

  const srcW = 'naturalWidth' in image ? image.naturalWidth : image.width;
  const srcH = 'naturalHeight' in image ? image.naturalHeight : image.height;
  if (!srcW || !srcH) return [];

  const scale = sampleW / srcW;
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(image, 0, 0, w, h);

  const { data } = ctx.getImageData(0, 0, w, h);

  // Quantise to a coarse hue/lightness key so texture does not fragment a field.
  const key = new Int16Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const light = Math.round(((max + min) / 2 / 255) * 5);       // 6 buckets
    let hue = 0;
    if (max !== min) {
      const d = max - min;
      hue = max === r ? ((g - b) / d + (g < b ? 6 : 0))
        : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      hue = Math.round((hue * 60 + 360) % 360 / 30);              // 12 buckets
    }
    key[p] = hue * 8 + light;
  }

  // Flood fill contiguous regions of the same key.
  const seen = new Uint8Array(w * h);
  const regions: Array<{ pixels: number[]; key: number }> = [];
  const minPixels = Math.max(64, Math.floor(w * h * minFrac));

  for (let start = 0; start < key.length; start++) {
    if (seen[start]) continue;
    const k = key[start]!;
    const stack = [start];
    const pixels: number[] = [];
    seen[start] = 1;

    while (stack.length) {
      const p = stack.pop()!;
      pixels.push(p);
      const x = p % w, y = (p / w) | 0;
      if (x > 0 && !seen[p - 1] && key[p - 1] === k) { seen[p - 1] = 1; stack.push(p - 1); }
      if (x < w - 1 && !seen[p + 1] && key[p + 1] === k) { seen[p + 1] = 1; stack.push(p + 1); }
      if (y > 0 && !seen[p - w] && key[p - w] === k) { seen[p - w] = 1; stack.push(p - w); }
      if (y < h - 1 && !seen[p + w] && key[p + w] === k) { seen[p + w] = 1; stack.push(p + w); }
    }
    if (pixels.length >= minPixels) regions.push({ pixels, key: k });
  }

  const latSpan = bounds.north - bounds.south;
  const lonSpan = bounds.east - bounds.west;
  // Rough metres per degree at this latitude, for the area estimate.
  const midLat = (bounds.north + bounds.south) / 2;
  const mPerLat = 111_320;
  const mPerLon = 111_320 * Math.cos((midLat * Math.PI) / 180);

  const out: Suggestion[] = regions.map((region) => {
    let minX = w, maxX = 0, minY = h, maxY = 0;
    for (const p of region.pixels) {
      const x = p % w, y = (p / w) | 0;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    const boxArea = (maxX - minX + 1) * (maxY - minY + 1);
    // Compact regions are more likely to be a managed plot than a hedge line.
    const fill = region.pixels.length / boxArea;

    const toLonLat = (x: number, y: number): [number, number] => [
      bounds.west + (x / w) * lonSpan,
      bounds.north - (y / h) * latSpan,
    ];

    const ring: Array<[number, number]> = [
      toLonLat(minX, minY), toLonLat(maxX + 1, minY),
      toLonLat(maxX + 1, maxY + 1), toLonLat(minX, maxY + 1),
    ];

    const areaSqm = ((maxX - minX + 1) / w) * lonSpan * mPerLon
      * ((maxY - minY + 1) / h) * latSpan * mPerLat;

    return { ring, areaSqm, confidence: Math.min(1, fill * 1.1) };
  });

  return out
    .filter((s) => s.confidence > 0.45 && s.areaSqm > 200)
    .sort((a, b) => b.confidence * b.areaSqm - a.confidence * a.areaSqm)
    .slice(0, maxOut);
}
