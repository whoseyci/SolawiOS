import type { SolawiModule, ModuleContext, Migration } from '@solawi/kernel';

/**
 * Module 1 — founding (Gründungsbegleiter).
 *
 * A dependency graph of milestones, not a linear wizard, because foundings are
 * never linear. Content (milestones, pitfalls, templates) is loaded from
 * content packs per jurisdiction; this module owns only state and traversal.
 *
 * Established farms skip this entirely — see `skipFounding()`.
 */

const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: 'founding: milestone progress and pitfall acknowledgements',
    statements: [
      `CREATE TABLE IF NOT EXISTS founding_milestone (
        org_id       TEXT NOT NULL,
        milestone_id TEXT NOT NULL,
        status       TEXT NOT NULL DEFAULT 'open',
        note         TEXT,
        due_at       TEXT,
        completed_at TEXT,
        updated_at   TEXT NOT NULL,
        PRIMARY KEY (org_id, milestone_id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_founding_status ON founding_milestone (org_id, status)`,
      `CREATE TABLE IF NOT EXISTS founding_pitfall_seen (
        org_id     TEXT NOT NULL,
        pitfall_id TEXT NOT NULL,
        seen_at    TEXT NOT NULL,
        PRIMARY KEY (org_id, pitfall_id)
      )`,
    ],
  },
];

export type MilestoneStatus = 'open' | 'in_progress' | 'done' | 'skipped' | 'not_applicable';

export interface MilestoneDef {
  id: string;
  area: 'group' | 'vision' | 'land' | 'legal' | 'money' | 'people' | 'operations' | 'start';
  /** Milestones that should be done first. Soft: the UI warns, it does not block. */
  requires: string[];
  /** Typical duration in weeks, for planning. */
  typicalWeeks: number;
  /** Pitfall ids (SF-nnn) relevant here. */
  pitfalls: string[];
}

/**
 * The milestone graph. Deliberately data, not code — the German content lives in
 * content/jurisdictions/de/founding/ and is looked up by id for display.
 */
export const MILESTONES: readonly MilestoneDef[] = [
  { id: 'group.core',        area: 'group',      requires: [],                       typicalWeeks: 8,  pitfalls: [] },
  { id: 'group.roles',       area: 'group',      requires: ['group.core'],           typicalWeeks: 4,  pitfalls: [] },
  { id: 'group.decisions',   area: 'group',      requires: ['group.core'],           typicalWeeks: 4,  pitfalls: ['SF-003'] },
  { id: 'vision.model',      area: 'vision',     requires: ['group.core'],           typicalWeeks: 6,  pitfalls: [] },
  { id: 'vision.size',       area: 'vision',     requires: ['vision.model'],         typicalWeeks: 4,  pitfalls: ['SF-004'] },
  { id: 'vision.commitment', area: 'vision',     requires: ['vision.model'],         typicalWeeks: 3,  pitfalls: ['SF-003'] },
  { id: 'land.search',       area: 'land',       requires: ['vision.size'],          typicalWeeks: 26, pitfalls: [] },
  { id: 'land.soil',         area: 'land',       requires: ['land.search'],          typicalWeeks: 4,  pitfalls: ['SF-005'] },
  { id: 'land.water',        area: 'land',       requires: ['land.search'],          typicalWeeks: 4,  pitfalls: [] },
  { id: 'land.lease',        area: 'land',       requires: ['land.soil'],            typicalWeeks: 8,  pitfalls: ['SF-001'] },
  { id: 'legal.form',        area: 'legal',      requires: ['vision.model'],         typicalWeeks: 8,  pitfalls: [] },
  { id: 'legal.statutes',    area: 'legal',      requires: ['legal.form'],           typicalWeeks: 6,  pitfalls: [] },
  { id: 'legal.registration',area: 'legal',      requires: ['legal.statutes'],       typicalWeeks: 8,  pitfalls: [] },
  { id: 'money.fullcost',    area: 'money',      requires: ['vision.size'],          typicalWeeks: 6,  pitfalls: ['SF-002'] },
  { id: 'money.wages',       area: 'money',      requires: ['money.fullcost'],       typicalWeeks: 3,  pitfalls: ['SF-002'] },
  { id: 'money.investment',  area: 'money',      requires: ['money.fullcost'],       typicalWeeks: 4,  pitfalls: [] },
  { id: 'money.liquidity',   area: 'money',      requires: ['money.fullcost'],       typicalWeeks: 3,  pitfalls: [] },
  { id: 'money.funding',     area: 'money',      requires: ['legal.form'],           typicalWeeks: 12, pitfalls: [] },
  { id: 'people.outreach',   area: 'people',     requires: ['vision.model'],         typicalWeeks: 12, pitfalls: [] },
  { id: 'people.infoevent',  area: 'people',     requires: ['people.outreach'],      typicalWeeks: 4,  pitfalls: [] },
  { id: 'people.waitlist',   area: 'people',     requires: ['people.infoevent'],     typicalWeeks: 8,  pitfalls: [] },
  { id: 'ops.cropplan',      area: 'operations', requires: ['land.lease'],           typicalWeeks: 8,  pitfalls: [] },
  { id: 'ops.depots',        area: 'operations', requires: ['people.waitlist'],      typicalWeeks: 6,  pitfalls: [] },
  { id: 'ops.tools',         area: 'operations', requires: ['money.investment'],     typicalWeeks: 6,  pitfalls: [] },
  { id: 'start.bidding',     area: 'start',      requires: ['money.fullcost', 'people.waitlist'], typicalWeeks: 4, pitfalls: [] },
  { id: 'start.contracts',   area: 'start',      requires: ['start.bidding', 'legal.registration'], typicalWeeks: 4, pitfalls: [] },
  { id: 'start.sowing',      area: 'start',      requires: ['ops.cropplan', 'start.contracts'], typicalWeeks: 2, pitfalls: [] },
];

export interface MilestoneState {
  milestone_id: string;
  status: MilestoneStatus;
  note: string | null;
  due_at: string | null;
  completed_at: string | null;
}

export interface MilestoneView extends MilestoneDef {
  status: MilestoneStatus;
  note: string | null;
  dueAt: string | null;
  completedAt: string | null;
  /** Prerequisites not yet done — the reason this is not actionable yet. */
  blockedBy: string[];
  /** True when every prerequisite is satisfied and it is not finished. */
  actionable: boolean;
}

export const foundingModule: SolawiModule = {
  manifest: {
    id: 'founding',
    number: 1,
    maturity: 'alpha',
    phases: ['founding'],
    provides: ['founding.progress'],
    migrations: MIGRATIONS,
  },
  register(reg) {
    reg.provide('founding.progress', async (ctx: ModuleContext) => progress(ctx));
  },
};

async function loadStates(ctx: ModuleContext): Promise<Map<string, MilestoneState>> {
  const rows = await ctx.store.all<MilestoneState>(
    `SELECT milestone_id, status, note, due_at, completed_at
       FROM founding_milestone WHERE org_id = ?`,
    [ctx.orgId],
  );
  return new Map(rows.map((r) => [r.milestone_id, r]));
}

/** The full graph with live state, ready for the UI. */
export async function milestones(ctx: ModuleContext): Promise<MilestoneView[]> {
  const states = await loadStates(ctx);
  const statusOf = (id: string): MilestoneStatus => states.get(id)?.status ?? 'open';
  const isSettled = (s: MilestoneStatus) => s === 'done' || s === 'skipped' || s === 'not_applicable';

  return MILESTONES.map((def) => {
    const st = states.get(def.id);
    const status = st?.status ?? 'open';
    const blockedBy = def.requires.filter((r) => !isSettled(statusOf(r)));
    return {
      ...def,
      status,
      note: st?.note ?? null,
      dueAt: st?.due_at ?? null,
      completedAt: st?.completed_at ?? null,
      blockedBy,
      actionable: blockedBy.length === 0 && !isSettled(status),
    };
  });
}

export async function setMilestone(
  ctx: ModuleContext,
  milestoneId: string,
  status: MilestoneStatus,
  opts: { note?: string; dueAt?: string } = {},
): Promise<void> {
  if (!MILESTONES.some((m) => m.id === milestoneId)) {
    throw new Error(`Unknown milestone: ${milestoneId}`);
  }
  const now = ctx.platform.clock.now().toISOString();
  await ctx.store.run(
    `INSERT INTO founding_milestone (org_id, milestone_id, status, note, due_at, completed_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (org_id, milestone_id) DO UPDATE SET
       status = excluded.status,
       note = COALESCE(excluded.note, founding_milestone.note),
       due_at = COALESCE(excluded.due_at, founding_milestone.due_at),
       completed_at = excluded.completed_at,
       updated_at = excluded.updated_at`,
    [
      ctx.orgId, milestoneId, status, opts.note ?? null, opts.dueAt ?? null,
      status === 'done' ? now : null, now,
    ],
  );
  if (status === 'done') {
    await ctx.emit('milestone.completed', { milestoneId });
  }
}

export interface Progress {
  total: number;
  done: number;
  skipped: number;
  percent: number;
  actionable: string[];
  /** Areas where nothing is actionable and nothing is done — likely stuck. */
  stalledAreas: string[];
}

export async function progress(ctx: ModuleContext): Promise<Progress> {
  const list = await milestones(ctx);
  const done = list.filter((m) => m.status === 'done').length;
  const skipped = list.filter((m) => m.status === 'skipped' || m.status === 'not_applicable').length;
  const actionable = list.filter((m) => m.actionable).map((m) => m.id);

  const areas = [...new Set(list.map((m) => m.area))];
  const stalledAreas = areas.filter((area) => {
    const inArea = list.filter((m) => m.area === area);
    return !inArea.some((m) => m.actionable) && !inArea.every((m) => m.status === 'done');
  });

  return {
    total: list.length,
    done,
    skipped,
    percent: list.length === 0 ? 0 : Math.round(((done + skipped) / list.length) * 100),
    actionable,
    stalledAreas,
  };
}

/**
 * Established Solawis skip the whole founding phase.
 *
 * Marks every milestone `not_applicable` (not `done` — they were never worked
 * through here, and pretending otherwise would poison the duration statistics
 * that feed the anonymised commons), moves the org to `operating`, and disables
 * the module so it disappears from the UI. Data is retained, so a farm can
 * re-enable it to look something up.
 */
export async function skipFounding(ctx: ModuleContext, reason = 'established'): Promise<void> {
  const now = ctx.platform.clock.now().toISOString();
  await ctx.store.batch(
    MILESTONES.map((m) => ({
      sql: `INSERT INTO founding_milestone (org_id, milestone_id, status, note, updated_at)
            VALUES (?, ?, 'not_applicable', ?, ?)
            ON CONFLICT (org_id, milestone_id) DO UPDATE SET status = 'not_applicable', updated_at = excluded.updated_at`,
      params: [ctx.orgId, m.id, reason, now],
    })),
  );
  await ctx.emit('founding.skipped', { reason });
}
