import type { Migration } from '@solawi/kernel';

/**
 * Geo additions for the map view.
 *
 * A farm needs a home position so the map opens over its own ground rather than
 * the middle of the Atlantic, and features (tool sheds, water points, compost,
 * paths) need to be drawable and typed, not just beds.
 *
 * Geometry stays GeoJSON in a text column (ADR-0004 §3): a Solawi's spatial data
 * is kilobytes, so PostGIS would buy nothing and cost us SQLite compatibility.
 */
export const GEO_MIGRATIONS: readonly Migration[] = [
  {
    version: 2,
    description: 'land: farm map centre, zoom and base layer',
    statements: [
      `ALTER TABLE land_field ADD COLUMN colour TEXT`,
      `CREATE TABLE IF NOT EXISTS land_map_settings (
        org_id     TEXT PRIMARY KEY,
        centre_lat REAL,
        centre_lon REAL,
        zoom       INTEGER NOT NULL DEFAULT 17,
        base_layer TEXT NOT NULL DEFAULT 'osm',
        updated_at TEXT NOT NULL
      )`,
    ],
  },
  {
    version: 3,
    description: 'land: richer feature types for drawn map objects',
    statements: [
      `ALTER TABLE land_feature ADD COLUMN colour TEXT`,
      `ALTER TABLE land_feature ADD COLUMN icon TEXT`,
      `CREATE INDEX IF NOT EXISTS idx_feature_org_kind ON land_feature (org_id, kind)`,
    ],
  },
];

/**
 * Feature kinds a farm can draw. Deliberately a closed list: free-text types
 * would make the legend meaningless and break cross-farm comparison later.
 */
export const FEATURE_KINDS = [
  'shed',        // Geräteschuppen
  'storage',     // Lager
  'greenhouse',  // Gewächshaus
  'water',       // Wasserstelle
  'compost',     // Kompost
  'path',        // Weg
  'hedge',       // Hecke / Agroforst
  'parking',     // Parkplatz
  'depot',       // Abholstelle
  'other',
] as const;

export type FeatureKind = (typeof FEATURE_KINDS)[number];

/** Geometry types we accept from the drawing tools. */
export type GeometryKind = 'Polygon' | 'LineString' | 'Point';

export interface MapSettings {
  centreLat: number | null;
  centreLon: number | null;
  zoom: number;
  baseLayer: 'osm' | 'satellite' | 'terrain';
}
