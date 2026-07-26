import L from 'leaflet';
import { getTile, TILE_SOURCES, type LayerId } from './tilestore.js';

/**
 * A Leaflet tile layer backed by IndexedDB.
 *
 * Behaves exactly like a normal tile layer — pan, zoom, retina, the lot — but
 * every tile comes from local storage. Panning and zooming therefore stay
 * crisp at every level, which a single stitched image could never do.
 *
 * `allowNetwork` is off by default. When a farm has downloaded its area, the
 * app must not quietly reach for the network again; missing tiles show as an
 * empty square, which is honest, rather than a surprise data charge.
 */
export interface OfflineLayerOptions extends L.TileLayerOptions {
  org: string;
  layer: LayerId;
  /** Fetch (and cache) tiles the store does not have. Default false. */
  allowNetwork?: boolean;
  /** Called when a tile is missing, so the UI can offer to extend coverage. */
  onMissing?: (z: number, x: number, y: number) => void;
}

const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export const OfflineTileLayer = L.TileLayer.extend({
  initialize(options: OfflineLayerOptions) {
    this._org = options.org;
    this._layerId = options.layer;
    this._allowNetwork = options.allowNetwork ?? false;
    this._onMissing = options.onMissing;
    this._objectUrls = new Set<string>();
    // Leaflet's TypeScript types omit the prototype methods used by extend().
    (L.TileLayer.prototype as unknown as {
      initialize(url: string, opts: L.TileLayerOptions): void;
    }).initialize.call(this, '', {
      ...options,
      // Upscale beyond the deepest stored level rather than showing nothing.
      maxNativeZoom: TILE_SOURCES[options.layer].maxNative,
    });
  },

  createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const img = document.createElement('img');
    img.alt = '';
    img.setAttribute('role', 'presentation');

    void (async () => {
      const blob = await getTile(this._org, this._layerId, coords.z, coords.x, coords.y);

      if (blob) {
        const url = URL.createObjectURL(blob);
        this._objectUrls.add(url);
        img.onload = () => done(undefined, img);
        img.onerror = () => done(undefined, img);
        img.src = url;
        return;
      }

      if (this._allowNetwork) {
        const src = TILE_SOURCES[this._layerId as LayerId].url
          .replace('{z}', String(coords.z))
          .replace('{x}', String(coords.x))
          .replace('{y}', String(coords.y))
          .replace('{s}', ['a', 'b', 'c'][coords.x % 3]!);
        img.crossOrigin = 'anonymous';
        img.onload = () => done(undefined, img);
        img.onerror = () => { img.src = BLANK; done(undefined, img); };
        img.src = src;
        return;
      }

      this._onMissing?.(coords.z, coords.x, coords.y);
      img.src = BLANK;
      done(undefined, img);
    })();

    return img;
  },

  onRemove(map: L.Map) {
    // Object URLs leak until revoked, and a session can create thousands.
    for (const url of this._objectUrls as Set<string>) URL.revokeObjectURL(url);
    this._objectUrls.clear();
    (L.TileLayer.prototype as unknown as {
      onRemove(m: L.Map): void;
    }).onRemove.call(this, map);
  },
}) as unknown as {
  new (options: OfflineLayerOptions): L.TileLayer;
};

export function createOfflineLayer(options: OfflineLayerOptions): L.TileLayer {
  return new OfflineTileLayer(options);
}
