import type { SolawiModule, ModuleContext, Migration } from '@solawi/kernel';

/**
 * Module 3 — land (Flächen & Karte).
 *
 * Geometry is GeoJSON in a text column, computed in application code (ADR-0004 §3).
 * A Solawi's spatial data is kilobytes; PostGIS would buy nothing and would cost
 * us SQLite compatibility, which is what lets the same schema run on D1 and on a
 * Raspberry Pi.
 *
 * Perennials are first-class (Agroforst), not a special case of vegetable beds.
 */

const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: 'land: fields, beds, features, perennials, soil samples',
    statements: [
      `CREATE TABLE IF NOT EXISTS land_field (
        id         TEXT PRIMARY KEY,
        org_id     TEXT NOT NULL,
        name       TEXT NOT NULL,
        geometry   TEXT,
        area_sqm   REAL,
        soil_note  TEXT,
        created_at TEXT NOT NULL,
        retired_at TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS idx_field_org ON land_field (org_id)`,

      `CREATE TABLE IF NOT EXISTS land_bed (
        id          TEXT PRIMARY KEY,
        org_id      TEXT NOT NULL,
        field_id    TEXT NOT NULL REFERENCES land_field(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        geometry    TEXT,
        length_m    REAL,
        width_m     REAL,
        area_sqm    REAL,
        kind        TEXT NOT NULL DEFAULT 'bed',
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL,
        retired_at  TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS idx_bed_org_field ON land_bed (org_id, field_id)`,

      `CREATE TABLE IF NOT EXISTS land_feature (
        id         TEXT PRIMARY KEY,
        org_id     TEXT NOT NULL,
        field_id   TEXT REFERENCES land_field(id) ON DELETE SET NULL,
        kind       TEXT NOT NULL,
        name       TEXT NOT NULL,
        geometry   TEXT,
        note       TEXT,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_feature_org ON land_feature (org_id, kind)`,

      `CREATE TABLE IF NOT EXISTS land_perennial (
        id           TEXT PRIMARY KEY,
        org_id       TEXT NOT NULL,
        field_id     TEXT REFERENCES land_field(id) ON DELETE SET NULL,
        bed_id       TEXT REFERENCES land_bed(id) ON DELETE SET NULL,
        species      TEXT NOT NULL,
        variety      TEXT,
        planted_on   TEXT NOT NULL,
        expected_years INTEGER,
        removed_on   TEXT,
        geometry     TEXT,
        note         TEXT,
        created_at   TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_perennial_org ON land_perennial (org_id)`,

      `CREATE TABLE IF NOT EXISTS land_soil_sample (
        id         TEXT PRIMARY KEY,
        org_id     TEXT NOT NULL,
        field_id   TEXT NOT NULL REFERENCES land_field(id) ON DELETE CASCADE,
        taken_on   TEXT NOT NULL,
        ph         REAL,
        humus_pct  REAL,
        nutrients  TEXT,
        note       TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS idx_soil_field ON land_soil_sample (org_id, field_id, taken_on DESC)`,
    ],
  },
];

export interface Field {
  id: string; org_id: string; name: string;
  geometry: string | null; area_sqm: number | null;
  soil_note: string | null; created_at: string; retired_at: string | null;
}

export interface Bed {
  id: string; org_id: string; field_id: string; name: string;
  geometry: string | null; length_m: number | null; width_m: number | null;
  area_sqm: number | null; kind: string; sort_order: number;
  created_at: string; retired_at: string | null;
}

export const landModule: SolawiModule = {
  manifest: {
    id: 'land',
    number: 3,
    maturity: 'alpha',
    phases: ['operating', 'developing'],
    provides: ['locations.list'],
    migrations: MIGRATIONS,
  },
  register(reg) {
    // tasks/inventory/markets ask for places without importing this module.
    reg.provide('locations.list', async (ctx: ModuleContext) => {
      const beds = await listBeds(ctx);
      return beds.map((b) => ({ id: b.id, name: b.name, kind: 'bed' as const }));
    });
  },
};

export async function createField(
  ctx: ModuleContext,
  input: { name: string; geometry?: unknown; areaSqm?: number; soilNote?: string },
): Promise<Field> {
  const id = ctx.platform.crypto.randomUUID();
  const now = ctx.platform.clock.now().toISOString();
  const geometry = input.geometry ? JSON.stringify(input.geometry) : null;
  const area = input.areaSqm ?? (input.geometry ? polygonAreaSqm(input.geometry) : null);
  await ctx.store.run(
    `INSERT INTO land_field (id, org_id, name, geometry, area_sqm, soil_note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, ctx.orgId, input.name, geometry, area, input.soilNote ?? null, now],
  );
  return {
    id, org_id: ctx.orgId, name: input.name, geometry, area_sqm: area,
    soil_note: input.soilNote ?? null, created_at: now, retired_at: null,
  };
}

export async function listFields(ctx: ModuleContext): Promise<Field[]> {
  return ctx.store.all<Field>(
    `SELECT * FROM land_field WHERE org_id = ? AND retired_at IS NULL ORDER BY name`,
    [ctx.orgId],
  );
}

export async function createBed(
  ctx: ModuleContext,
  input: {
    fieldId: string; name: string; geometry?: unknown;
    lengthM?: number; widthM?: number; kind?: string; sortOrder?: number;
  },
): Promise<Bed> {
  const id = ctx.platform.crypto.randomUUID();
  const now = ctx.platform.clock.now().toISOString();
  const geometry = input.geometry ? JSON.stringify(input.geometry) : null;
  const area = input.lengthM && input.widthM
    ? input.lengthM * input.widthM
    : input.geometry ? polygonAreaSqm(input.geometry) : null;

  await ctx.store.run(
    `INSERT INTO land_bed (id, org_id, field_id, name, geometry, length_m, width_m, area_sqm, kind, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, ctx.orgId, input.fieldId, input.name, geometry,
      input.lengthM ?? null, input.widthM ?? null, area,
      input.kind ?? 'bed', input.sortOrder ?? 0, now,
    ],
  );
  return {
    id, org_id: ctx.orgId, field_id: input.fieldId, name: input.name, geometry,
    length_m: input.lengthM ?? null, width_m: input.widthM ?? null, area_sqm: area,
    kind: input.kind ?? 'bed', sort_order: input.sortOrder ?? 0, created_at: now, retired_at: null,
  };
}

export async function listBeds(ctx: ModuleContext, fieldId?: string): Promise<Bed[]> {
  return fieldId
    ? ctx.store.all<Bed>(
        `SELECT * FROM land_bed WHERE org_id = ? AND field_id = ? AND retired_at IS NULL
         ORDER BY sort_order, name`, [ctx.orgId, fieldId])
    : ctx.store.all<Bed>(
        `SELECT * FROM land_bed WHERE org_id = ? AND retired_at IS NULL
         ORDER BY sort_order, name`, [ctx.orgId]);
}

/** Bulk-create a grid of beds — the common case for a market garden. */
export async function createBedGrid(
  ctx: ModuleContext,
  input: { fieldId: string; count: number; prefix?: string; lengthM: number; widthM: number },
): Promise<number> {
  const now = ctx.platform.clock.now().toISOString();
  const prefix = input.prefix ?? 'Beet';
  const rows = Array.from({ length: input.count }, (_, i) => ({
    sql: `INSERT INTO land_bed (id, org_id, field_id, name, length_m, width_m, area_sqm, kind, sort_order, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'bed', ?, ?)`,
    params: [
      ctx.platform.crypto.randomUUID(), ctx.orgId, input.fieldId,
      `${prefix} ${i + 1}`, input.lengthM, input.widthM,
      input.lengthM * input.widthM, i, now,
    ] as (string | number | null)[],
  }));
  await ctx.store.batch(rows);
  return input.count;
}

export async function addPerennial(
  ctx: ModuleContext,
  input: {
    species: string; plantedOn: string; fieldId?: string; bedId?: string;
    variety?: string; expectedYears?: number; geometry?: unknown; note?: string;
  },
): Promise<string> {
  const id = ctx.platform.crypto.randomUUID();
  await ctx.store.run(
    `INSERT INTO land_perennial
       (id, org_id, field_id, bed_id, species, variety, planted_on, expected_years, geometry, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, ctx.orgId, input.fieldId ?? null, input.bedId ?? null, input.species,
      input.variety ?? null, input.plantedOn, input.expectedYears ?? null,
      input.geometry ? JSON.stringify(input.geometry) : null, input.note ?? null,
      ctx.platform.clock.now().toISOString(),
    ],
  );
  return id;
}

/**
 * Spherical polygon area in m², good enough at field scale (sub-metre error).
 * Accepts a GeoJSON Polygon or a bare ring of [lon, lat] pairs.
 */
export function polygonAreaSqm(geometry: unknown): number | null {
  const ring = extractRing(geometry);
  if (!ring || ring.length < 3) return null;
  const R = 6_378_137;
  let total = 0;
  for (let i = 0; i < ring.length; i++) {
    const p1 = ring[i]!;
    const p2 = ring[(i + 1) % ring.length]!;
    total += toRad(p2[0] - p1[0]) * (2 + Math.sin(toRad(p1[1])) + Math.sin(toRad(p2[1])));
  }
  return Math.abs((total * R * R) / 2);
}

function extractRing(geometry: unknown): Array<[number, number]> | null {
  if (!geometry) return null;
  if (Array.isArray(geometry)) return geometry as Array<[number, number]>;
  const g = geometry as { type?: string; coordinates?: unknown; geometry?: unknown };
  if (g.type === 'Feature') return extractRing(g.geometry);
  if (g.type === 'Polygon' && Array.isArray(g.coordinates)) {
    return (g.coordinates as Array<Array<[number, number]>>)[0] ?? null;
  }
  return null;
}

const toRad = (deg: number) => (deg * Math.PI) / 180;
