import type { SolawiModule, ModuleContext, Migration } from '@solawi/kernel';

/**
 * Cross-cutting — observations. Implements ADR-0008.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  THE `observation` TABLE HAS NO PERSON COLUMN. THIS IS DELIBERATE.   │
 * │                                                                      │
 * │  Not nullable, not optional, not "for later" — absent. A schema      │
 * │  without the column cannot grow a report that ranks people. The      │
 * │  distance between "this bed was weeded 6 times" and "Anna weeds      │
 * │  slower than Bernd" is exactly one join, and we make that join       │
 * │  impossible rather than merely discouraged.                          │
 * │                                                                      │
 * │  Task ASSIGNMENT (forward-looking, "who will do this") lives in      │
 * │  `tasks`. The completion record that feeds analysis is here, and it  │
 * │  does not carry the assignee forward. The link is cut at the point   │
 * │  where planning becomes history.                                     │
 * └──────────────────────────────────────────────────────────────────────┘
 */

const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: 'observations: bed-scoped operational records (no person column, by design)',
    statements: [
      `CREATE TABLE IF NOT EXISTS observation (
        id          TEXT PRIMARY KEY,
        org_id      TEXT NOT NULL,
        bed_id      TEXT NOT NULL,
        activity    TEXT NOT NULL,
        observed_at TEXT NOT NULL,
        quantity    REAL,
        unit        TEXT,
        minutes     INTEGER,
        conditions  TEXT,
        note        TEXT,
        device_id   TEXT,
        created_at  TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_obs_bed_time ON observation (org_id, bed_id, observed_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_obs_activity ON observation (org_id, activity, observed_at DESC)`,
    ],
  },
];

export type Activity =
  | 'weeding' | 'watering' | 'harvest' | 'mulching' | 'sowing' | 'planting'
  | 'fertilising' | 'pest_check' | 'soil_work' | 'clearing' | 'other';

export interface Observation {
  id: string; org_id: string; bed_id: string; activity: Activity;
  observed_at: string; quantity: number | null; unit: string | null;
  minutes: number | null; conditions: string | null; note: string | null;
  device_id: string | null; created_at: string;
}

export const observationsModule: SolawiModule = {
  manifest: {
    id: 'observations',
    number: 22,
    maturity: 'alpha',
    phases: ['operating', 'developing'],
    suggests: ['land'],
    provides: ['observations.rhythm'],
    migrations: MIGRATIONS,
  },
  register(reg) {
    reg.provide('observations.rhythm', async (ctx: ModuleContext, ...args: never[]) => {
      const [bedId, activity] = args as unknown as [string, Activity];
      return rhythm(ctx, bedId, activity);
    });
  },
};

/**
 * Record an observation. One tap from the bed view.
 *
 * Everything except bed + activity is optional — a record without a quantity is
 * still useful for rhythm analysis, and a required field would convert a useful
 * dataset into a fictional one (ADR-0008 §6).
 */
export async function record(
  ctx: ModuleContext,
  input: {
    bedId: string; activity: Activity; observedAt?: string;
    quantity?: number; unit?: string; minutes?: number;
    conditions?: string; note?: string; deviceId?: string;
  },
): Promise<string> {
  const id = ctx.platform.crypto.randomUUID();
  const now = ctx.platform.clock.now();
  const observedAt = input.observedAt ?? now.toISOString();

  await ctx.store.run(
    `INSERT INTO observation
       (id, org_id, bed_id, activity, observed_at, quantity, unit, minutes, conditions, note, device_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, ctx.orgId, input.bedId, input.activity, observedAt,
      input.quantity ?? null, input.unit ?? null, input.minutes ?? null,
      input.conditions ?? null, input.note ?? null, input.deviceId ?? null,
      now.toISOString(),
    ],
  );

  if (input.activity === 'harvest' && input.quantity) {
    await ctx.emit('harvest.recorded', {
      bedId: input.bedId, quantity: input.quantity, unit: input.unit ?? 'kg', observedAt,
    });
  }
  return id;
}

/**
 * Offline sync: a batch of observations captured in the field.
 *
 * Additive merge (docs/20 §6) — quantities are summed rather than overwritten,
 * because "last write wins" is simply wrong for harvest weights. Ids are
 * client-generated so replays are idempotent.
 */
export async function syncBatch(
  ctx: ModuleContext,
  batch: Array<{
    id: string; bedId: string; activity: Activity; observedAt: string;
    quantity?: number; unit?: string; minutes?: number;
    conditions?: string; note?: string; deviceId?: string;
  }>,
): Promise<{ inserted: number; duplicates: number }> {
  if (batch.length === 0) return { inserted: 0, duplicates: 0 };
  const now = ctx.platform.clock.now().toISOString();

  const existing = new Set(
    (await ctx.store.all<{ id: string }>(
      `SELECT id FROM observation WHERE org_id = ? AND id IN (${batch.map(() => '?').join(',')})`,
      [ctx.orgId, ...batch.map((b) => b.id)],
    )).map((r) => r.id),
  );

  const fresh = batch.filter((b) => !existing.has(b.id));
  if (fresh.length > 0) {
    await ctx.store.batch(fresh.map((b) => ({
      sql: `INSERT INTO observation
              (id, org_id, bed_id, activity, observed_at, quantity, unit, minutes, conditions, note, device_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        b.id, ctx.orgId, b.bedId, b.activity, b.observedAt,
        b.quantity ?? null, b.unit ?? null, b.minutes ?? null,
        b.conditions ?? null, b.note ?? null, b.deviceId ?? null, now,
      ],
    })));
  }
  return { inserted: fresh.length, duplicates: existing.size };
}

export interface Rhythm {
  bedId: string;
  activity: Activity;
  count: number;
  /** Mean days between occurrences; null when there are fewer than two. */
  meanIntervalDays: number | null;
  /** Spread of the interval — high variance means it is happening reactively. */
  stdDevDays: number | null;
  lastAt: string | null;
  daysSinceLast: number | null;
}

/**
 * "At what rhythm is this bed actually weeded/watered/harvested?"
 * Most farms genuinely do not know, and the answer changes next year's labour budget.
 */
export async function rhythm(
  ctx: ModuleContext, bedId: string, activity: Activity, sinceIso?: string,
): Promise<Rhythm> {
  const rows = await ctx.store.all<{ observed_at: string }>(
    `SELECT observed_at FROM observation
      WHERE org_id = ? AND bed_id = ? AND activity = ?
        AND (? IS NULL OR observed_at >= ?)
      ORDER BY observed_at ASC`,
    [ctx.orgId, bedId, activity, sinceIso ?? null, sinceIso ?? null],
  );

  if (rows.length === 0) {
    return { bedId, activity, count: 0, meanIntervalDays: null, stdDevDays: null, lastAt: null, daysSinceLast: null };
  }

  const times = rows.map((r) => new Date(r.observed_at).getTime());
  const gaps: number[] = [];
  for (let i = 1; i < times.length; i++) gaps.push((times[i]! - times[i - 1]!) / 86_400_000);

  const mean = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;
  const stdDev = mean !== null && gaps.length > 1
    ? Math.sqrt(gaps.reduce((s, g) => s + (g - mean) ** 2, 0) / (gaps.length - 1))
    : null;

  const lastAt = rows[rows.length - 1]!.observed_at;
  return {
    bedId, activity, count: rows.length,
    meanIntervalDays: mean === null ? null : Math.round(mean * 10) / 10,
    stdDevDays: stdDev === null ? null : Math.round(stdDev * 10) / 10,
    lastAt,
    daysSinceLast: Math.round((ctx.platform.clock.now().getTime() - new Date(lastAt).getTime()) / 86_400_000),
  };
}

/**
 * Aggregate labour per crop — allowed and needed. The unit of analysis is the
 * CROP, never the human (ADR-0008 §3).
 */
export async function labourByActivity(
  ctx: ModuleContext, fromIso: string, toIso: string,
): Promise<Array<{ activity: string; totalMinutes: number; occurrences: number }>> {
  return ctx.store.all<{ activity: string; totalMinutes: number; occurrences: number }>(
    `SELECT activity,
            COALESCE(SUM(minutes), 0) AS totalMinutes,
            COUNT(*) AS occurrences
       FROM observation
      WHERE org_id = ? AND observed_at BETWEEN ? AND ?
      GROUP BY activity
      ORDER BY totalMinutes DESC`,
    [ctx.orgId, fromIso, toIso],
  );
}

export async function recentForBed(
  ctx: ModuleContext, bedId: string, limit = 20,
): Promise<Observation[]> {
  return ctx.store.all<Observation>(
    `SELECT * FROM observation WHERE org_id = ? AND bed_id = ?
      ORDER BY observed_at DESC LIMIT ?`,
    [ctx.orgId, bedId, limit],
  );
}
