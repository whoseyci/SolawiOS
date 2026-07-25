import type { SolawiModule, ModuleContext, Migration } from '@solawi/kernel';

/**
 * Module 11 — inventory (Werkzeug & Infrastruktur).
 *
 * Underestimated, and it costs real hours every week: where is the Grelinette,
 * who has it, when was the mower last serviced.
 *
 * The loan register is deliberately gentle — a reminder that something has been
 * out for eleven days, not an accusation.
 */

const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: 'inventory: items, loans, maintenance',
    statements: [
      `CREATE TABLE IF NOT EXISTS inv_item (
        id           TEXT PRIMARY KEY,
        org_id       TEXT NOT NULL,
        name         TEXT NOT NULL,
        kind         TEXT NOT NULL DEFAULT 'tool',
        home_location TEXT,
        quantity     INTEGER NOT NULL DEFAULT 1,
        condition    TEXT NOT NULL DEFAULT 'ok',
        maintenance_days INTEGER,
        last_service TEXT,
        note         TEXT,
        created_at   TEXT NOT NULL,
        retired_at   TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS idx_inv_org ON inv_item (org_id, kind)`,

      `CREATE TABLE IF NOT EXISTS inv_loan (
        id         TEXT PRIMARY KEY,
        org_id     TEXT NOT NULL,
        item_id    TEXT NOT NULL REFERENCES inv_item(id) ON DELETE CASCADE,
        holder     TEXT NOT NULL,
        taken_at   TEXT NOT NULL,
        due_at     TEXT,
        returned_at TEXT,
        note       TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS idx_loan_open ON inv_loan (org_id, item_id, returned_at)`,
    ],
  },
];

export type ItemKind = 'tool' | 'machine' | 'consumable' | 'infrastructure' | 'seed';
export type Condition = 'ok' | 'worn' | 'broken' | 'in_repair';

export interface Item {
  id: string; org_id: string; name: string; kind: ItemKind;
  home_location: string | null; quantity: number; condition: Condition;
  maintenance_days: number | null; last_service: string | null;
  note: string | null; created_at: string; retired_at: string | null;
}

export const inventoryModule: SolawiModule = {
  manifest: {
    id: 'inventory',
    number: 11,
    maturity: 'alpha',
    phases: ['operating'],
    provides: ['tools.list'],
    migrations: MIGRATIONS,
  },
  register(reg) {
    reg.provide('tools.list', async (ctx: ModuleContext) => {
      const rows = await listItems(ctx);
      return rows.filter((i) => i.kind === 'tool' || i.kind === 'machine')
        .map((i) => ({ id: i.id, name: i.name }));
    });
  },
};

export async function createItem(
  ctx: ModuleContext,
  input: {
    name: string; kind?: ItemKind; homeLocation?: string; quantity?: number;
    maintenanceDays?: number; note?: string;
  },
): Promise<Item> {
  const id = ctx.platform.crypto.randomUUID();
  const now = ctx.platform.clock.now().toISOString();
  await ctx.store.run(
    `INSERT INTO inv_item (id, org_id, name, kind, home_location, quantity, maintenance_days, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, ctx.orgId, input.name, input.kind ?? 'tool', input.homeLocation ?? null,
     input.quantity ?? 1, input.maintenanceDays ?? null, input.note ?? null, now],
  );
  return {
    id, org_id: ctx.orgId, name: input.name, kind: input.kind ?? 'tool',
    home_location: input.homeLocation ?? null, quantity: input.quantity ?? 1,
    condition: 'ok', maintenance_days: input.maintenanceDays ?? null,
    last_service: null, note: input.note ?? null, created_at: now, retired_at: null,
  };
}

export interface ItemWithLoan extends Item {
  holder: string | null;
  taken_at: string | null;
  days_out: number | null;
  service_due: boolean;
}

export async function listItems(ctx: ModuleContext): Promise<ItemWithLoan[]> {
  const rows = await ctx.store.all<Item & { holder: string | null; taken_at: string | null }>(
    `SELECT i.*, l.holder, l.taken_at
       FROM inv_item i
       LEFT JOIN inv_loan l ON l.item_id = i.id AND l.returned_at IS NULL AND l.org_id = i.org_id
      WHERE i.org_id = ? AND i.retired_at IS NULL
      ORDER BY i.kind, i.name`,
    [ctx.orgId],
  );
  const now = ctx.platform.clock.now().getTime();
  return rows.map((r) => ({
    ...r,
    days_out: r.taken_at ? Math.floor((now - new Date(r.taken_at).getTime()) / 86_400_000) : null,
    service_due: Boolean(
      r.maintenance_days && r.last_service &&
      (now - new Date(r.last_service).getTime()) / 86_400_000 > r.maintenance_days,
    ),
  }));
}

export async function borrow(
  ctx: ModuleContext, input: { itemId: string; holder: string; dueAt?: string; note?: string },
): Promise<string> {
  const id = ctx.platform.crypto.randomUUID();
  await ctx.store.run(
    `INSERT INTO inv_loan (id, org_id, item_id, holder, taken_at, due_at, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, ctx.orgId, input.itemId, input.holder,
     ctx.platform.clock.now().toISOString(), input.dueAt ?? null, input.note ?? null],
  );
  await ctx.emit('inventory.borrowed', { itemId: input.itemId });
  return id;
}

export async function returnItem(ctx: ModuleContext, itemId: string): Promise<void> {
  await ctx.store.run(
    `UPDATE inv_loan SET returned_at = ?
      WHERE org_id = ? AND item_id = ? AND returned_at IS NULL`,
    [ctx.platform.clock.now().toISOString(), ctx.orgId, itemId],
  );
}

export async function setCondition(ctx: ModuleContext, itemId: string, condition: Condition): Promise<void> {
  await ctx.store.run(
    `UPDATE inv_item SET condition = ? WHERE id = ? AND org_id = ?`, [condition, itemId, ctx.orgId],
  );
  if (condition === 'broken') await ctx.emit('inventory.broken', { itemId });
}

export async function recordService(ctx: ModuleContext, itemId: string): Promise<void> {
  await ctx.store.run(
    `UPDATE inv_item SET last_service = ?, condition = 'ok' WHERE id = ? AND org_id = ?`,
    [ctx.platform.clock.now().toISOString().slice(0, 10), itemId, ctx.orgId],
  );
}
