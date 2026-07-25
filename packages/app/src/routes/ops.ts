import type { App } from '../app.js';
import { requireAuth, requireOrg, requireRoleIn } from '../app.js';
import {
  createDepot, listDepots, createDay, addItem, daySheet, markPickup, listDays,
  type PickupStatus,
} from '@solawi/module-distribution';
import {
  createItem, listItems, borrow, returnItem, setCondition, recordService,
  type ItemKind, type Condition,
} from '@solawi/module-inventory';
import {
  addCost, addIncome, summary, checkWage, listCosts, listIncome,
  type CostCategory, type IncomeSource,
} from '@solawi/module-finance';

/** Distribution, inventory and finance endpoints. */
export function opsRoutes(app: App): void {
  // ------------------------------------------------------------ distribution
  app.get('/api/distribution/depots', async (c) => {
    const { orgId } = requireOrg(c);
    const ctx = c.get('kernel').contextFor(orgId, 'distribution', c.get('locale'));
    return c.json({ depots: await listDepots(ctx) });
  });

  app.post('/api/distribution/depots', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'admin');
    const body = await c.req.json<{
      name: string; address?: string; opening?: string; contact?: string; capacity?: number;
    }>();
    const ctx = c.get('kernel').contextFor(orgId, 'distribution', c.get('locale'));
    return c.json({ depot: await createDepot(ctx, body) }, 201);
  });

  app.get('/api/distribution/days', async (c) => {
    const { orgId } = requireOrg(c);
    const ctx = c.get('kernel').contextFor(orgId, 'distribution', c.get('locale'));
    return c.json({ days: await listDays(ctx) });
  });

  app.post('/api/distribution/days', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'grower');
    const body = await c.req.json<{ date: string; note?: string }>();
    const ctx = c.get('kernel').contextFor(orgId, 'distribution', c.get('locale'));
    return c.json({ id: await createDay(ctx, body) }, 201);
  });

  app.post('/api/distribution/days/:id/items', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'grower');
    const body = await c.req.json<{ label: string; qtyFull?: number; qtyHalf?: number; unit?: string }>();
    const ctx = c.get('kernel').contextFor(orgId, 'distribution', c.get('locale'));
    return c.json({ id: await addItem(ctx, { dayId: c.req.param('id'), ...body }) }, 201);
  });

  /** The sheet a depot caretaker works from, absences joined in live. */
  app.get('/api/distribution/days/:id', async (c) => {
    const { orgId } = requireOrg(c);
    const ctx = c.get('kernel').contextFor(orgId, 'distribution', c.get('locale'));
    const sheet = await daySheet(ctx, c.req.param('id'));
    return sheet ? c.json(sheet) : c.json({ error: 'not_found' }, 404);
  });

  app.post('/api/distribution/days/:id/pickup', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'depot');
    const body = await c.req.json<{ householdId: string; status: PickupStatus; depotId?: string }>();
    const ctx = c.get('kernel').contextFor(orgId, 'distribution', c.get('locale'));
    await markPickup(ctx, { dayId: c.req.param('id'), ...body });
    return c.json({ ok: true });
  });

  // --------------------------------------------------------------- inventory
  app.get('/api/inventory', async (c) => {
    const { orgId } = requireOrg(c);
    const ctx = c.get('kernel').contextFor(orgId, 'inventory', c.get('locale'));
    return c.json({ items: await listItems(ctx) });
  });

  app.post('/api/inventory', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'grower');
    const body = await c.req.json<{
      name: string; kind?: ItemKind; homeLocation?: string; quantity?: number;
      maintenanceDays?: number; note?: string;
    }>();
    const ctx = c.get('kernel').contextFor(orgId, 'inventory', c.get('locale'));
    return c.json({ item: await createItem(ctx, body) }, 201);
  });

  app.post('/api/inventory/:id/borrow', async (c) => {
    const person = requireAuth(c);
    const { orgId } = requireOrg(c);
    // Body is optional: "I took this" with no arguments is the common case.
    const body = await c.req.json<{ holder?: string; dueAt?: string }>()
      .catch(() => ({} as { holder?: string; dueAt?: string }));
    const ctx = c.get('kernel').contextFor(orgId, 'inventory', c.get('locale'));
    await borrow(ctx, {
      itemId: c.req.param('id'),
      holder: body.holder ?? person.displayName,
      dueAt: body.dueAt,
    });
    return c.json({ ok: true });
  });

  app.post('/api/inventory/:id/return', async (c) => {
    requireAuth(c);
    const { orgId } = requireOrg(c);
    const ctx = c.get('kernel').contextFor(orgId, 'inventory', c.get('locale'));
    await returnItem(ctx, c.req.param('id'));
    return c.json({ ok: true });
  });

  app.post('/api/inventory/:id/condition', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'member');
    const { condition } = await c.req.json<{ condition: Condition }>();
    const ctx = c.get('kernel').contextFor(orgId, 'inventory', c.get('locale'));
    await setCondition(ctx, c.req.param('id'), condition);
    return c.json({ ok: true });
  });

  app.post('/api/inventory/:id/service', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'grower');
    const ctx = c.get('kernel').contextFor(orgId, 'inventory', c.get('locale'));
    await recordService(ctx, c.req.param('id'));
    return c.json({ ok: true });
  });

  // ----------------------------------------------------------------- finance
  app.get('/api/finance/summary', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'finance');
    const season = c.req.query('season') ?? String(new Date().getFullYear());
    const ctx = c.get('kernel').contextFor(orgId, 'finance', c.get('locale'));
    return c.json({ season, summary: await summary(ctx, season) });
  });

  app.get('/api/finance/lines', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'finance');
    const season = c.req.query('season') ?? String(new Date().getFullYear());
    const ctx = c.get('kernel').contextFor(orgId, 'finance', c.get('locale'));
    return c.json({ costs: await listCosts(ctx, season), income: await listIncome(ctx, season) });
  });

  app.post('/api/finance/costs', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'finance');
    const body = await c.req.json<{
      season: string; category: CostCategory; label: string; cents: number; note?: string;
    }>();
    const ctx = c.get('kernel').contextFor(orgId, 'finance', c.get('locale'));
    return c.json({ id: await addCost(ctx, body) }, 201);
  });

  app.post('/api/finance/income', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'finance');
    const body = await c.req.json<{
      season: string; source: IncomeSource; label: string; cents: number;
    }>();
    const ctx = c.get('kernel').contextFor(orgId, 'finance', c.get('locale'));
    return c.json({ id: await addIncome(ctx, body) }, 201);
  });

  /** Wage reality check — catches SF-002 before the first Bieterrunde. */
  app.post('/api/finance/wage-check', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'finance');
    void orgId;
    const body = await c.req.json<{
      annualCents: number; hoursPerWeek: number; weeksWorked?: number;
    }>();
    return c.json(checkWage(body));
  });
}
