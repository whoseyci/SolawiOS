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


/**
 * What a farm calls its two levels of land.
 *
 * "Field" and "bed" are market-garden words. A field-vegetable farm calls the
 * outer thing a Schlag and the inner one a Reihe or Satzfläche; a small CSA may
 * use one word for both. Forcing our vocabulary on them makes the app feel
 * wrong in a way that is hard to articulate but easy to feel.
 *
 * The DATA MODEL keeps two levels — an area and subdivisions of it — because
 * that hierarchy is real. Only the LABELS are configurable.
 */
export const LAND_VOCABULARIES = {
  market_garden: { outer: 'Schlag', inner: 'Beet', outerPl: 'Schläge', innerPl: 'Beete' },
  field_crops:   { outer: 'Schlag', inner: 'Satzfläche', outerPl: 'Schläge', innerPl: 'Satzflächen' },
  simple:        { outer: 'Fläche', inner: 'Abschnitt', outerPl: 'Flächen', innerPl: 'Abschnitte' },
  orchard:       { outer: 'Anlage', inner: 'Reihe', outerPl: 'Anlagen', innerPl: 'Reihen' },
} as const;

export type VocabularyKey = keyof typeof LAND_VOCABULARIES;

export interface LandVocabulary {
  outer: string; inner: string; outerPl: string; innerPl: string;
  /** True when the farm does not subdivide, so the inner level is hidden. */
  singleLevel: boolean;
}

export const VOCAB_MIGRATION: Migration = {
  version: 4,
  description: 'land: per-farm vocabulary for the two land levels',
  statements: [
    `ALTER TABLE land_map_settings ADD COLUMN vocabulary TEXT NOT NULL DEFAULT 'market_garden'`,
    `ALTER TABLE land_map_settings ADD COLUMN single_level INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE land_map_settings ADD COLUMN custom_outer TEXT`,
    `ALTER TABLE land_map_settings ADD COLUMN custom_inner TEXT`,
    `ALTER TABLE land_map_settings ADD COLUMN snapshot_key TEXT`,
    `ALTER TABLE land_map_settings ADD COLUMN snapshot_bounds TEXT`,
  ],
};
