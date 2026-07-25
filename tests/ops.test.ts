import { describe, it, expect } from 'vitest';
import { createNodePlatform } from '@solawi/platform-node';
import { Kernel } from './helpers.js';
import { createDepot, createDay, addItem, daySheet, markPickup } from '@solawi/module-distribution';
import { createItem, listItems, borrow, returnItem, setCondition } from '@solawi/module-inventory';
import { addCost, addIncome, summary, checkWage } from '@solawi/module-finance';
import { createHousehold, declareAbsence } from '@solawi/module-members';

async function farm(modules: string[]) {
  const platform = createNodePlatform({ databasePath: ':memory:' });
  const kernel = await Kernel(platform);
  const org = await kernel.createOrg({ slug: `t${Math.random().toString(36).slice(2, 7)}`, name: 'T' });
  for (const m of modules) await kernel.setModuleEnabled(org.id, m, true);
  return { kernel, org };
}

describe('distribution', () => {
  it('joins absences into the day sheet live, so a late absence still counts', async () => {
    const { kernel, org } = await farm(['distribution', 'members']);
    const dist = kernel.contextFor(org.id, 'distribution');
    const mem = kernel.contextFor(org.id, 'members');

    const away = await createHousehold(mem, { name: 'Away' });
    await createHousehold(mem, { name: 'Present' });

    // Day created BEFORE the absence is declared — the sheet must still show it.
    const dayId = await createDay(dist, { date: '2026-07-28' });
    await declareAbsence(mem, { householdId: away.id, from: '2026-07-25', to: '2026-08-05', donate: true });

    const sheet = await daySheet(dist, dayId);
    expect(sheet).not.toBeNull();
    expect(sheet!.pickups.filter((p) => p.absent)).toHaveLength(1);
    expect(sheet!.counts.absent).toBe(1);
    expect(sheet!.counts.expected).toBe(1);
  });

  it('records a pickup and can undo it', async () => {
    const { kernel, org } = await farm(['distribution', 'members']);
    const dist = kernel.contextFor(org.id, 'distribution');
    const mem = kernel.contextFor(org.id, 'members');
    const h = await createHousehold(mem, { name: 'A' });
    const dayId = await createDay(dist, { date: '2026-07-28' });
    await addItem(dist, { dayId, label: 'Möhren', qtyFull: 2, qtyHalf: 1 });

    await markPickup(dist, { dayId, householdId: h.id, status: 'collected' });
    expect((await daySheet(dist, dayId))!.counts.collected).toBe(1);

    await markPickup(dist, { dayId, householdId: h.id, status: 'expected' });
    expect((await daySheet(dist, dayId))!.counts.collected).toBe(0);
  });

  it('keeps depots scoped to their farm', async () => {
    const platform = createNodePlatform({ databasePath: ':memory:' });
    const kernel = await Kernel(platform);
    const a = await kernel.createOrg({ slug: 'da', name: 'A' });
    const b = await kernel.createOrg({ slug: 'db', name: 'B' });
    for (const o of [a, b]) await kernel.setModuleEnabled(o.id, 'distribution', true);
    await createDepot(kernel.contextFor(a.id, 'distribution'), { name: 'Only A' });
    const { listDepots } = await import('@solawi/module-distribution');
    expect(await listDepots(kernel.contextFor(b.id, 'distribution'))).toHaveLength(0);
  });
});

describe('inventory', () => {
  it('tracks who has a tool and for how long', async () => {
    const { kernel, org } = await farm(['inventory']);
    const ctx = kernel.contextFor(org.id, 'inventory');
    const item = await createItem(ctx, { name: 'Grelinette', kind: 'tool' });

    await borrow(ctx, { itemId: item.id, holder: 'Anna' });
    const out = await listItems(ctx);
    expect(out[0]!.holder).toBe('Anna');
    expect(out[0]!.days_out).toBe(0);

    await returnItem(ctx, item.id);
    expect((await listItems(ctx))[0]!.holder).toBeNull();
  });

  it('flags a broken tool', async () => {
    const { kernel, org } = await farm(['inventory']);
    const ctx = kernel.contextFor(org.id, 'inventory');
    const item = await createItem(ctx, { name: 'Sense' });
    await setCondition(ctx, item.id, 'broken');
    expect((await listItems(ctx))[0]!.condition).toBe('broken');
  });
});

describe('finance', () => {
  it('computes the bidding target as costs minus non-share income', async () => {
    const { kernel, org } = await farm(['finance']);
    const ctx = kernel.contextFor(org.id, 'finance');
    await addCost(ctx, { season: '2026', category: 'wages', label: 'Löhne', cents: 7_200_000 });
    await addCost(ctx, { season: '2026', category: 'seeds', label: 'Saatgut', cents: 300_000 });
    await addIncome(ctx, { season: '2026', source: 'markets', label: 'Markt', cents: 500_000 });

    const s = await summary(ctx, '2026');
    expect(s!.totalCostCents).toBe(7_500_000);
    // Shares must cover what other income does not.
    expect(s!.targetFromSharesCents).toBe(7_000_000);
  });

  it('warns when one side business carries too much of the income', async () => {
    const { kernel, org } = await farm(['finance']);
    const ctx = kernel.contextFor(org.id, 'finance');
    await addIncome(ctx, { season: '2026', source: 'shares', label: 'Anteile', cents: 1_000_000 });
    await addIncome(ctx, { season: '2026', source: 'events', label: 'Hofcafé', cents: 600_000 });
    const s = await summary(ctx, '2026');
    expect(s!.dependencyWarnings).toContain('events');
  });

  it('converts an annual wage into a real hourly rate (SF-002)', () => {
    // 30 000 € at 48 real hours a week is below the German minimum wage —
    // the number that feels fine in a founding meeting.
    const check = checkWage({ annualCents: 3_000_000, hoursPerWeek: 48 });
    expect(check.belowMinimum).toBe(true);
    expect(check.hourlyCents).toBeLessThan(1400);
    expect(check.message).toContain('€/h');

    const ok = checkWage({ annualCents: 4_500_000, hoursPerWeek: 40 });
    expect(ok.belowMinimum).toBe(false);
  });
});
