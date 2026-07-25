import type { SolawiModule, ModuleContext, Migration } from '@solawi/kernel';

/**
 * Module 2 — finance-model (Wirtschaftlichkeit).
 *
 * Full-cost accounting, because Solawis systematically underestimate it. The
 * wage sanity check exists to catch SF-002 before it happens: a wage that feels
 * fine in the founding meeting and is socially impossible to raise two years
 * later.
 *
 * Income is deliberately multi-source (from the mindmap): shares, Merch,
 * markets, donations, events, education, grants — each with a dependency share,
 * because a farm drawing 30 % from a café has a different risk profile.
 */

const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: 'finance: budget lines and income sources',
    statements: [
      `CREATE TABLE IF NOT EXISTS fin_budget (
        id         TEXT PRIMARY KEY,
        org_id     TEXT NOT NULL,
        season     TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_season ON fin_budget (org_id, season)`,

      `CREATE TABLE IF NOT EXISTS fin_cost (
        id         TEXT PRIMARY KEY,
        org_id     TEXT NOT NULL,
        budget_id  TEXT NOT NULL REFERENCES fin_budget(id) ON DELETE CASCADE,
        category   TEXT NOT NULL,
        label      TEXT NOT NULL,
        cents      INTEGER NOT NULL,
        note       TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS idx_cost_budget ON fin_cost (org_id, budget_id)`,

      `CREATE TABLE IF NOT EXISTS fin_income (
        id         TEXT PRIMARY KEY,
        org_id     TEXT NOT NULL,
        budget_id  TEXT NOT NULL REFERENCES fin_budget(id) ON DELETE CASCADE,
        source     TEXT NOT NULL,
        label      TEXT NOT NULL,
        cents      INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_income_budget ON fin_income (org_id, budget_id)`,
    ],
  },
];

/** Categories farms forget are exactly the ones listed here explicitly. */
export type CostCategory =
  | 'wages' | 'social_contributions' | 'holiday_cover' | 'seeds' | 'machinery'
  | 'fuel' | 'rent' | 'insurance' | 'admin' | 'repairs' | 'reserve' | 'other';

export type IncomeSource =
  | 'shares' | 'merch' | 'markets' | 'donations' | 'events' | 'education' | 'grants' | 'other';

export const financeModule: SolawiModule = {
  manifest: {
    id: 'finance',
    number: 2,
    maturity: 'alpha',
    phases: ['founding', 'operating', 'developing'],
    provides: ['budget.target'],
    migrations: MIGRATIONS,
  },
  register(reg) {
    // bidding asks for the target sum without importing this module.
    reg.provide('budget.target', async (ctx: ModuleContext, ...args: never[]) => {
      const [season] = args as unknown as [string];
      const s = await summary(ctx, season);
      return s?.targetFromSharesCents ?? 0;
    });
  },
};

export async function ensureBudget(ctx: ModuleContext, season: string): Promise<string> {
  const existing = await ctx.store.first<{ id: string }>(
    `SELECT id FROM fin_budget WHERE org_id = ? AND season = ?`, [ctx.orgId, season],
  );
  if (existing) return existing.id;
  const id = ctx.platform.crypto.randomUUID();
  await ctx.store.run(
    `INSERT INTO fin_budget (id, org_id, season, created_at) VALUES (?, ?, ?, ?)`,
    [id, ctx.orgId, season, ctx.platform.clock.now().toISOString()],
  );
  return id;
}

export async function addCost(
  ctx: ModuleContext,
  input: { season: string; category: CostCategory; label: string; cents: number; note?: string },
): Promise<string> {
  const budgetId = await ensureBudget(ctx, input.season);
  const id = ctx.platform.crypto.randomUUID();
  await ctx.store.run(
    `INSERT INTO fin_cost (id, org_id, budget_id, category, label, cents, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, ctx.orgId, budgetId, input.category, input.label, input.cents, input.note ?? null],
  );
  return id;
}

export async function addIncome(
  ctx: ModuleContext,
  input: { season: string; source: IncomeSource; label: string; cents: number },
): Promise<string> {
  const budgetId = await ensureBudget(ctx, input.season);
  const id = ctx.platform.crypto.randomUUID();
  await ctx.store.run(
    `INSERT INTO fin_income (id, org_id, budget_id, source, label, cents) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, ctx.orgId, budgetId, input.source, input.label, input.cents],
  );
  return id;
}

export interface Summary {
  season: string;
  totalCostCents: number;
  totalIncomeCents: number;
  /** What the Bieterrunde must raise: costs minus non-share income. */
  targetFromSharesCents: number;
  costsByCategory: Array<{ category: string; cents: number }>;
  incomeBySource: Array<{ source: string; cents: number; sharePct: number }>;
  /** Sources supplying more than a quarter of income — a concentration risk. */
  dependencyWarnings: string[];
}

export async function summary(ctx: ModuleContext, season: string): Promise<Summary | null> {
  const budget = await ctx.store.first<{ id: string }>(
    `SELECT id FROM fin_budget WHERE org_id = ? AND season = ?`, [ctx.orgId, season],
  );
  if (!budget) return null;

  const costs = await ctx.store.all<{ category: string; cents: number }>(
    `SELECT category, SUM(cents) AS cents FROM fin_cost
      WHERE org_id = ? AND budget_id = ? GROUP BY category ORDER BY cents DESC`,
    [ctx.orgId, budget.id],
  );
  const incomes = await ctx.store.all<{ source: string; cents: number }>(
    `SELECT source, SUM(cents) AS cents FROM fin_income
      WHERE org_id = ? AND budget_id = ? GROUP BY source ORDER BY cents DESC`,
    [ctx.orgId, budget.id],
  );

  const totalCostCents = costs.reduce((s, c) => s + c.cents, 0);
  const totalIncomeCents = incomes.reduce((s, i) => s + i.cents, 0);
  const nonShare = incomes.filter((i) => i.source !== 'shares').reduce((s, i) => s + i.cents, 0);

  const dependencyWarnings: string[] = [];
  for (const i of incomes) {
    if (i.source === 'shares' || totalIncomeCents === 0) continue;
    if (i.cents / totalIncomeCents > 0.25) dependencyWarnings.push(i.source);
  }

  return {
    season,
    totalCostCents,
    totalIncomeCents,
    targetFromSharesCents: Math.max(0, totalCostCents - nonShare),
    costsByCategory: costs,
    incomeBySource: incomes.map((i) => ({
      ...i, sharePct: totalIncomeCents ? Math.round((i.cents / totalIncomeCents) * 100) : 0,
    })),
    dependencyWarnings,
  };
}

export interface WageCheck {
  annualCents: number;
  hoursPerWeek: number;
  weeksWorked: number;
  hourlyCents: number;
  /** German minimum wage, 2026. Content, not law — verify per jurisdiction. */
  minimumHourlyCents: number;
  belowMinimum: boolean;
  message: string;
}

/**
 * Reality check on a wage figure (SF-002).
 *
 * Converts an annual salary into an actual hourly rate at real peak-season
 * hours, not contract hours — that gap is where the self-deception lives.
 */
export function checkWage(input: {
  annualCents: number; hoursPerWeek: number; weeksWorked?: number; minimumHourlyCents?: number;
}): WageCheck {
  const weeks = input.weeksWorked ?? 46;
  const hours = Math.max(1, input.hoursPerWeek * weeks);
  const hourlyCents = Math.round(input.annualCents / hours);
  const minimum = input.minimumHourlyCents ?? 1400;
  const below = hourlyCents < minimum;

  return {
    annualCents: input.annualCents,
    hoursPerWeek: input.hoursPerWeek,
    weeksWorked: weeks,
    hourlyCents,
    minimumHourlyCents: minimum,
    belowMinimum: below,
    message: below
      ? `Das entspricht ${(hourlyCents / 100).toFixed(2)} €/h bei ${input.hoursPerWeek} Wochenstunden — unter dem Mindestlohn. Würdet ihr diese Stelle selbst annehmen?`
      : `Das entspricht ${(hourlyCents / 100).toFixed(2)} €/h bei ${input.hoursPerWeek} Wochenstunden.`,
  };
}

export async function listCosts(ctx: ModuleContext, season: string) {
  return ctx.store.all<{ id: string; category: string; label: string; cents: number }>(
    `SELECT c.id, c.category, c.label, c.cents FROM fin_cost c
       JOIN fin_budget b ON b.id = c.budget_id
      WHERE c.org_id = ? AND b.season = ? ORDER BY c.cents DESC`,
    [ctx.orgId, season],
  );
}

export async function listIncome(ctx: ModuleContext, season: string) {
  return ctx.store.all<{ id: string; source: string; label: string; cents: number }>(
    `SELECT i.id, i.source, i.label, i.cents FROM fin_income i
       JOIN fin_budget b ON b.id = i.budget_id
      WHERE i.org_id = ? AND b.season = ? ORDER BY i.cents DESC`,
    [ctx.orgId, season],
  );
}
