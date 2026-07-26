/**
 * Place search, so a farm can find its own ground instead of panning from a
 * world view.
 *
 * Nominatim is OpenStreetMap's own geocoder: no API key, no account. Its usage
 * policy requires an identifying User-Agent or Referer and at most one request
 * per second, so we debounce hard and never search on every keystroke.
 */

export interface Place {
  label: string;
  lat: number;
  lon: number;
  /** Suggested viewport, when the geocoder returns one. */
  bounds?: { north: number; south: number; east: number; west: number };
  kind: string;
}

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const url = new URL(ENDPOINT);
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '6');
  url.searchParams.set('addressdetails', '1');
  // Bias towards German-speaking Europe without excluding anywhere else.
  url.searchParams.set('accept-language', 'de,en');

  const res = await fetch(url, { signal, headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`geocode_${res.status}`);

  const rows = (await res.json()) as Array<{
    display_name: string; lat: string; lon: string;
    boundingbox?: [string, string, string, string]; type?: string; category?: string;
  }>;

  return rows.map((r) => ({
    label: r.display_name,
    lat: Number(r.lat),
    lon: Number(r.lon),
    kind: r.type ?? r.category ?? 'place',
    bounds: r.boundingbox ? {
      south: Number(r.boundingbox[0]), north: Number(r.boundingbox[1]),
      west: Number(r.boundingbox[2]), east: Number(r.boundingbox[3]),
    } : undefined,
  }));
}

/** Debounced searcher that cancels the in-flight request. */
export function createSearcher(onResults: (places: Place[], error?: string) => void, delay = 600) {
  let timer: number | undefined;
  let controller: AbortController | null = null;

  return (query: string): void => {
    window.clearTimeout(timer);
    controller?.abort();

    if (query.trim().length < 3) { onResults([]); return; }

    timer = window.setTimeout(async () => {
      controller = new AbortController();
      try {
        onResults(await searchPlaces(query, controller.signal));
      } catch (err) {
        if ((err as Error).name !== 'AbortError') onResults([], 'search_failed');
      }
    }, delay);
  };
}
