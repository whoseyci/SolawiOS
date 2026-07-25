import type { SolawiModule, ModuleContext, Migration } from '@solawi/kernel';

/**
 * Module 4 — cultivation (Anbauplanung).
 *
 * The heart of the field side. Two things make it more than a calendar:
 *  - the time slider: the plot on any given day, backwards and forwards
 *  - the rotation guard: warns when a plant family returns to a bed too soon,
 *    with a reason and an alternative, never a hard block (AGENTS.md §3.7)
 */

const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: 'cultivation: crops, varieties, plantings',
    statements: [
      `CREATE TABLE IF NOT EXISTS cult_crop (
        id             TEXT PRIMARY KEY,
        org_id         TEXT NOT NULL,
        botanical_name TEXT NOT NULL,
        family         TEXT NOT NULL,
        display_name   TEXT NOT NULL,
        synonyms       TEXT,
        days_to_harvest INTEGER,
        rotation_years  INTEGER NOT NULL DEFAULT 3,
        yield_per_sqm   REAL,
        created_at     TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_crop_org ON cult_crop (org_id)`,
      `CREATE INDEX IF NOT EXISTS idx_crop_family ON cult_crop (org_id, family)`,

      `CREATE TABLE IF NOT EXISTS cult_planting (
        id            TEXT PRIMARY KEY,
        org_id        TEXT NOT NULL,
        crop_id       TEXT NOT NULL REFERENCES cult_crop(id) ON DELETE CASCADE,
        bed_id        TEXT NOT NULL,
        variety       TEXT,
        stage         TEXT NOT NULL DEFAULT 'planned',
        sown_on       TEXT,
        planted_on    TEXT,
        harvest_from  TEXT,
        harvest_to    TEXT,
        cleared_on    TEXT,
        expected_kg   REAL,
        actual_kg     REAL,
        note          TEXT,
        created_at    TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_planting_org_bed ON cult_planting (org_id, bed_id)`,
      `CREATE INDEX IF NOT EXISTS idx_planting_dates ON cult_planting (org_id, harvest_from, harvest_to)`,
    ],
  },
];

export type Stage = 'planned' | 'sown' | 'planted' | 'growing' | 'harvesting' | 'cleared';

export interface Crop {
  id: string; org_id: string; botanical_name: string; family: string;
  display_name: string; synonyms: string | null;
  days_to_harvest: number | null; rotation_years: number;
  yield_per_sqm: number | null; created_at: string;
}

export interface Planting {
  id: string; org_id: string; crop_id: string; bed_id: string;
  variety: string | null; stage: Stage;
  sown_on: string | null; planted_on: string | null;
  harvest_from: string | null; harvest_to: string | null; cleared_on: string | null;
  expected_kg: number | null; actual_kg: number | null;
  note: string | null; created_at: string;
}

export const cultivationModule: SolawiModule = {
  manifest: {
    id: 'cultivation',
    number: 4,
    maturity: 'alpha',
    phases: ['operating', 'developing'],
    suggests: ['land'],
    provides: ['plantings.active'],
    migrations: MIGRATIONS,
  },
  register(reg) {
    reg.provide('plantings.active', async (ctx: ModuleContext) => {
      const today = ctx.platform.clock.now().toISOString().slice(0, 10);
      return plantingsOn(ctx, today);
    });
  },
};

export async function createCrop(
  ctx: ModuleContext,
  input: {
    botanicalName: string; family: string; displayName: string;
    synonyms?: string[]; daysToHarvest?: number; rotationYears?: number; yieldPerSqm?: number;
  },
): Promise<Crop> {
  const id = ctx.platform.crypto.randomUUID();
  const now = ctx.platform.clock.now().toISOString();
  await ctx.store.run(
    `INSERT INTO cult_crop
       (id, org_id, botanical_name, family, display_name, synonyms, days_to_harvest, rotation_years, yield_per_sqm, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, ctx.orgId, input.botanicalName, input.family, input.displayName,
      input.synonyms ? JSON.stringify(input.synonyms) : null,
      input.daysToHarvest ?? null, input.rotationYears ?? 3, input.yieldPerSqm ?? null, now,
    ],
  );
  return {
    id, org_id: ctx.orgId, botanical_name: input.botanicalName, family: input.family,
    display_name: input.displayName, synonyms: input.synonyms ? JSON.stringify(input.synonyms) : null,
    days_to_harvest: input.daysToHarvest ?? null, rotation_years: input.rotationYears ?? 3,
    yield_per_sqm: input.yieldPerSqm ?? null, created_at: now,
  };
}

export async function listCrops(ctx: ModuleContext): Promise<Crop[]> {
  return ctx.store.all<Crop>(
    `SELECT * FROM cult_crop WHERE org_id = ? ORDER BY display_name`, [ctx.orgId],
  );
}

export async function createPlanting(
  ctx: ModuleContext,
  input: {
    cropId: string; bedId: string; variety?: string;
    sownOn?: string; plantedOn?: string; harvestFrom?: string; harvestTo?: string;
    expectedKg?: number; note?: string;
  },
): Promise<Planting> {
  const id = ctx.platform.crypto.randomUUID();
  const now = ctx.platform.clock.now().toISOString();

  // Derive a harvest window from days_to_harvest when not given explicitly.
  let harvestFrom = input.harvestFrom ?? null;
  let harvestTo = input.harvestTo ?? null;
  if (!harvestFrom && (input.sownOn || input.plantedOn)) {
    const crop = await ctx.store.first<Crop>(
      `SELECT * FROM cult_crop WHERE id = ? AND org_id = ?`, [input.cropId, ctx.orgId],
    );
    if (crop?.days_to_harvest) {
      const base = new Date(input.plantedOn ?? input.sownOn!);
      harvestFrom = addDays(base, crop.days_to_harvest).toISOString().slice(0, 10);
      harvestTo = addDays(base, crop.days_to_harvest + 21).toISOString().slice(0, 10);
    }
  }

  await ctx.store.run(
    `INSERT INTO cult_planting
       (id, org_id, crop_id, bed_id, variety, stage, sown_on, planted_on, harvest_from, harvest_to, expected_kg, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, ctx.orgId, input.cropId, input.bedId, input.variety ?? null,
      input.plantedOn ? 'planted' : input.sownOn ? 'sown' : 'planned',
      input.sownOn ?? null, input.plantedOn ?? null, harvestFrom, harvestTo,
      input.expectedKg ?? null, input.note ?? null, now,
    ],
  );

  if (input.sownOn) await ctx.emit('planting.sown', { plantingId: id, bedId: input.bedId, cropId: input.cropId });

  return {
    id, org_id: ctx.orgId, crop_id: input.cropId, bed_id: input.bedId,
    variety: input.variety ?? null,
    stage: input.plantedOn ? 'planted' : input.sownOn ? 'sown' : 'planned',
    sown_on: input.sownOn ?? null, planted_on: input.plantedOn ?? null,
    harvest_from: harvestFrom, harvest_to: harvestTo, cleared_on: null,
    expected_kg: input.expectedKg ?? null, actual_kg: null,
    note: input.note ?? null, created_at: now,
  };
}

export interface PlantingOnDay extends Planting {
  crop_name: string;
  family: string;
  /** What the bed is doing on the queried day. */
  phase: 'growing' | 'harvestable' | 'finished' | 'future';
}

/**
 * THE TIME SLIDER.
 *
 * Everything standing on a given date — the plot as it was, is, or will be.
 * One query, so the UI can scrub a slider without hammering the database.
 */
export async function plantingsOn(ctx: ModuleContext, isoDate: string): Promise<PlantingOnDay[]> {
  const rows = await ctx.store.all<Planting & { crop_name: string; family: string }>(
    `SELECT p.*, c.display_name AS crop_name, c.family AS family
       FROM cult_planting p
       JOIN cult_crop c ON c.id = p.crop_id
      WHERE p.org_id = ?
        AND COALESCE(p.sown_on, p.planted_on, p.harvest_from, p.created_at) <= ?
        AND (p.cleared_on IS NULL OR p.cleared_on >= ?)
      ORDER BY p.bed_id`,
    [ctx.orgId, isoDate, isoDate],
  );

  return rows.map((r) => {
    let phase: PlantingOnDay['phase'] = 'growing';
    if (r.cleared_on && r.cleared_on < isoDate) phase = 'finished';
    else if (r.harvest_from && r.harvest_to && isoDate >= r.harvest_from && isoDate <= r.harvest_to) phase = 'harvestable';
    else if (r.harvest_from && isoDate > r.harvest_from && !r.cleared_on) phase = 'harvestable';
    else if (r.harvest_from && isoDate < r.harvest_from) phase = 'growing';
    return { ...r, phase };
  });
}

export interface RotationWarning {
  bedId: string;
  family: string;
  /** The previous planting of the same family that triggers the warning. */
  previousCrop: string;
  previousClearedOn: string | null;
  requiredYears: number;
  actualYears: number;
  /** Human-readable reason; the UI shows this verbatim. */
  reason: string;
}

/**
 * THE ROTATION GUARD.
 *
 * Warns — never blocks. Returns null when the rotation is fine.
 * A gardener who knows why they are breaking rotation must be able to proceed.
 */
export async function checkRotation(
  ctx: ModuleContext,
  input: { bedId: string; cropId: string; plannedDate: string },
): Promise<RotationWarning | null> {
  const crop = await ctx.store.first<Crop>(
    `SELECT * FROM cult_crop WHERE id = ? AND org_id = ?`, [input.cropId, ctx.orgId],
  );
  if (!crop) return null;

  const previous = await ctx.store.first<{
    display_name: string; cleared_on: string | null; sown_on: string | null; planted_on: string | null;
  }>(
    `SELECT c.display_name, p.cleared_on, p.sown_on, p.planted_on
       FROM cult_planting p
       JOIN cult_crop c ON c.id = p.crop_id
      WHERE p.org_id = ? AND p.bed_id = ? AND c.family = ?
      ORDER BY COALESCE(p.cleared_on, p.harvest_to, p.planted_on, p.sown_on) DESC
      LIMIT 1`,
    [ctx.orgId, input.bedId, crop.family],
  );
  if (!previous) return null;

  const lastDate = previous.cleared_on ?? previous.planted_on ?? previous.sown_on;
  if (!lastDate) return null;

  const years = yearsBetween(lastDate, input.plannedDate);
  if (years >= crop.rotation_years) return null;

  return {
    bedId: input.bedId,
    family: crop.family,
    previousCrop: previous.display_name,
    previousClearedOn: previous.cleared_on,
    requiredYears: crop.rotation_years,
    actualYears: Math.round(years * 10) / 10,
    reason:
      `${crop.display_name} gehört zur Familie ${crop.family}. ` +
      `Auf diesem Beet stand zuletzt ${previous.display_name} (dieselbe Familie) vor ` +
      `${years.toFixed(1)} Jahren. Empfohlen sind ${crop.rotation_years} Jahre Anbaupause, ` +
      `um Krankheitsdruck und einseitige Nährstoffzehrung zu vermeiden.`,
  };
}

/** Beds with no planting on the given date — the planner's free space. */
export async function freeBedsOn(
  ctx: ModuleContext, isoDate: string, allBedIds: string[],
): Promise<string[]> {
  const busy = new Set((await plantingsOn(ctx, isoDate)).map((p) => p.bed_id));
  return allBedIds.filter((id) => !busy.has(id));
}

export async function recordHarvestWindow(
  ctx: ModuleContext, plantingId: string, actualKg: number,
): Promise<void> {
  await ctx.store.run(
    `UPDATE cult_planting SET actual_kg = COALESCE(actual_kg, 0) + ?, stage = 'harvesting'
      WHERE id = ? AND org_id = ?`,
    [actualKg, plantingId, ctx.orgId],
  );
}

export async function clearPlanting(ctx: ModuleContext, plantingId: string, on: string): Promise<void> {
  await ctx.store.run(
    `UPDATE cult_planting SET cleared_on = ?, stage = 'cleared' WHERE id = ? AND org_id = ?`,
    [on, plantingId, ctx.orgId],
  );
  await ctx.emit('planting.cleared', { plantingId, on });
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function yearsBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / (365.25 * 86_400_000);
}
