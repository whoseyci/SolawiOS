import type { SolawiModule, ModuleContext, Migration } from '@solawi/kernel';

/**
 * Module 7 — distribution (Verteilung).
 *
 * The variable that differs most between farms (docs/40 §2), so the mode is
 * configuration, not code: farm pickup, depots, delivery, self-harvest, mixed.
 *
 * The part everyone underestimates is absence handling: who is away, do they
 * have a substitute, or does the share go to the Solidartafel.
 */

const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: 'distribution: depots, distribution days, pickups',
    statements: [
      `CREATE TABLE IF NOT EXISTS depot (
        id         TEXT PRIMARY KEY,
        org_id     TEXT NOT NULL,
        name       TEXT NOT NULL,
        address    TEXT,
        opening    TEXT,
        contact    TEXT,
        capacity   INTEGER,
        active     INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_depot_org ON depot (org_id, active)`,

      `CREATE TABLE IF NOT EXISTS distribution_day (
        id         TEXT PRIMARY KEY,
        org_id     TEXT NOT NULL,
        date       TEXT NOT NULL,
        note       TEXT,
        status     TEXT NOT NULL DEFAULT 'planned',
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_distday ON distribution_day (org_id, date DESC)`,

      `CREATE TABLE IF NOT EXISTS distribution_item (
        id        TEXT PRIMARY KEY,
        org_id    TEXT NOT NULL,
        day_id    TEXT NOT NULL REFERENCES distribution_day(id) ON DELETE CASCADE,
        label     TEXT NOT NULL,
        qty_full  REAL,
        qty_half  REAL,
        unit      TEXT NOT NULL DEFAULT 'kg'
      )`,
      `CREATE INDEX IF NOT EXISTS idx_distitem ON distribution_item (org_id, day_id)`,

      `CREATE TABLE IF NOT EXISTS pickup (
        id           TEXT PRIMARY KEY,
        org_id       TEXT NOT NULL,
        day_id       TEXT NOT NULL REFERENCES distribution_day(id) ON DELETE CASCADE,
        household_id TEXT NOT NULL,
        depot_id     TEXT,
        status       TEXT NOT NULL DEFAULT 'expected',
        picked_at    TEXT
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_pickup_unique ON pickup (org_id, day_id, household_id)`,
    ],
  },
];

export type PickupStatus = 'expected' | 'collected' | 'absent' | 'donated' | 'substitute';

export interface Depot {
  id: string; org_id: string; name: string; address: string | null;
  opening: string | null; contact: string | null; capacity: number | null;
  active: number; created_at: string;
}

export const distributionModule: SolawiModule = {
  manifest: {
    id: 'distribution',
    number: 7,
    maturity: 'alpha',
    phases: ['operating'],
    suggests: ['members', 'harvest'],
    provides: ['depots.list'],
    migrations: MIGRATIONS,
  },
  register(reg) {
    reg.provide('depots.list', async (ctx: ModuleContext) => listDepots(ctx));

    // An absence declared in `members` updates this week's pickup list.
    reg.on('absence.declared', async () => { /* recomputed lazily by daySheet() */ });
  },
};

export async function createDepot(
  ctx: ModuleContext,
  input: { name: string; address?: string; opening?: string; contact?: string; capacity?: number },
): Promise<Depot> {
  const id = ctx.platform.crypto.randomUUID();
  const now = ctx.platform.clock.now().toISOString();
  await ctx.store.run(
    `INSERT INTO depot (id, org_id, name, address, opening, contact, capacity, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, ctx.orgId, input.name, input.address ?? null, input.opening ?? null,
     input.contact ?? null, input.capacity ?? null, now],
  );
  return {
    id, org_id: ctx.orgId, name: input.name, address: input.address ?? null,
    opening: input.opening ?? null, contact: input.contact ?? null,
    capacity: input.capacity ?? null, active: 1, created_at: now,
  };
}

export async function listDepots(ctx: ModuleContext): Promise<Depot[]> {
  return ctx.store.all<Depot>(
    `SELECT * FROM depot WHERE org_id = ? AND active = 1 ORDER BY name`, [ctx.orgId],
  );
}

export async function createDay(
  ctx: ModuleContext, input: { date: string; note?: string },
): Promise<string> {
  const id = ctx.platform.crypto.randomUUID();
  await ctx.store.run(
    `INSERT INTO distribution_day (id, org_id, date, note, created_at) VALUES (?, ?, ?, ?, ?)`,
    [id, ctx.orgId, input.date, input.note ?? null, ctx.platform.clock.now().toISOString()],
  );
  await ctx.emit('distribution.day_created', { dayId: id, date: input.date });
  return id;
}

export async function addItem(
  ctx: ModuleContext,
  input: { dayId: string; label: string; qtyFull?: number; qtyHalf?: number; unit?: string },
): Promise<string> {
  const id = ctx.platform.crypto.randomUUID();
  await ctx.store.run(
    `INSERT INTO distribution_item (id, org_id, day_id, label, qty_full, qty_half, unit)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, ctx.orgId, input.dayId, input.label, input.qtyFull ?? null,
     input.qtyHalf ?? null, input.unit ?? 'kg'],
  );
  return id;
}

export interface DaySheet {
  day: { id: string; date: string; note: string | null; status: string };
  items: Array<{ label: string; qty_full: number | null; qty_half: number | null; unit: string }>;
  pickups: Array<{
    household_id: string; household_name: string; depot_id: string | null;
    status: PickupStatus; absent: boolean; substitute_household_id: string | null;
  }>;
  counts: { expected: number; collected: number; absent: number; donated: number };
}

/**
 * The distribution list for one day — the sheet a depot caretaker works from.
 *
 * Absences are joined in live rather than copied, so declaring an absence after
 * the day was created is reflected immediately.
 */
export async function daySheet(ctx: ModuleContext, dayId: string): Promise<DaySheet | null> {
  const day = await ctx.store.first<{ id: string; date: string; note: string | null; status: string }>(
    `SELECT id, date, note, status FROM distribution_day WHERE id = ? AND org_id = ?`,
    [dayId, ctx.orgId],
  );
  if (!day) return null;

  const items = await ctx.store.all<{ label: string; qty_full: number | null; qty_half: number | null; unit: string }>(
    `SELECT label, qty_full, qty_half, unit FROM distribution_item WHERE org_id = ? AND day_id = ?`,
    [ctx.orgId, dayId],
  );

  const pickups = await ctx.store.all<{
    household_id: string; household_name: string; depot_id: string | null;
    status: PickupStatus; absent: number; substitute_household_id: string | null;
  }>(
    `SELECT h.id AS household_id, h.name AS household_name,
            p.depot_id, COALESCE(p.status, 'expected') AS status,
            CASE WHEN a.id IS NULL THEN 0 ELSE 1 END AS absent,
            a.substitute_household_id
       FROM household h
       LEFT JOIN pickup p ON p.household_id = h.id AND p.day_id = ? AND p.org_id = h.org_id
       LEFT JOIN absence a ON a.household_id = h.id AND a.org_id = h.org_id
            AND ? BETWEEN a.from_date AND a.to_date
      WHERE h.org_id = ? AND h.left_on IS NULL
      ORDER BY h.name`,
    [dayId, day.date, ctx.orgId],
  ).catch(() => []);

  const counts = { expected: 0, collected: 0, absent: 0, donated: 0 };
  for (const p of pickups) {
    if (p.status === 'collected') counts.collected++;
    else if (p.status === 'donated') counts.donated++;
    else if (p.absent) counts.absent++;
    else counts.expected++;
  }

  return {
    day,
    items,
    pickups: pickups.map((p) => ({ ...p, absent: p.absent === 1 })),
    counts,
  };
}

export async function markPickup(
  ctx: ModuleContext,
  input: { dayId: string; householdId: string; status: PickupStatus; depotId?: string },
): Promise<void> {
  const now = ctx.platform.clock.now().toISOString();
  await ctx.store.run(
    `INSERT INTO pickup (id, org_id, day_id, household_id, depot_id, status, picked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (org_id, day_id, household_id) DO UPDATE SET
       status = excluded.status, depot_id = excluded.depot_id, picked_at = excluded.picked_at`,
    [
      ctx.platform.crypto.randomUUID(), ctx.orgId, input.dayId, input.householdId,
      input.depotId ?? null, input.status,
      input.status === 'collected' ? now : null,
    ],
  );
}

export async function listDays(ctx: ModuleContext, limit = 20) {
  return ctx.store.all<{ id: string; date: string; note: string | null; status: string }>(
    `SELECT id, date, note, status FROM distribution_day
      WHERE org_id = ? ORDER BY date DESC LIMIT ?`,
    [ctx.orgId, limit],
  );
}
