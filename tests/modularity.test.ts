import { describe, it, expect } from 'vitest';
import { createNodePlatform } from '@solawi/platform-node';
import { Kernel } from './helpers.js';
import { plantingsOn, createCrop, createPlanting, checkRotation } from '@solawi/module-cultivation';
import { createField, createBed, createBedGrid, polygonAreaSqm } from '@solawi/module-land';
import { createTask, suggestSequence } from '@solawi/module-tasks';
import { milestones, progress, skipFounding, setMilestone } from '@solawi/module-founding';

async function farm(modules: string[]) {
  const platform = createNodePlatform({ databasePath: ':memory:' });
  const kernel = await Kernel(platform);
  const org = await kernel.createOrg({ slug: `f-${Math.random().toString(36).slice(2, 8)}`, name: 'Farm' });
  for (const m of modules) await kernel.setModuleEnabled(org.id, m, true);
  return { kernel, org };
}

describe('modularity: a farm can switch modules off without breaking', () => {
  it('answers capabilities with declared empty values when the provider is disabled', async () => {
    const { kernel, org } = await farm(['tasks']); // land deliberately OFF
    const ctx = kernel.contextFor(org.id, 'tasks');
    // tasks asks land for locations; land is off, so it must get [] not an error.
    expect(await ctx.ask('locations.list')).toEqual([]);
    expect(await ctx.ask('shares.equivalents', '2026')).toBe(0);
  });

  it('runs the sequencing assistant with no land module present', async () => {
    const { kernel, org } = await farm(['tasks']);
    const ctx = kernel.contextFor(org.id, 'tasks');
    await createTask(ctx, { title: 'Jäten Beet 1', activity: 'weeding', bedId: 'b1' });
    await createTask(ctx, { title: 'Pflanzen Beet 2', activity: 'planting', bedId: 'b2' });
    const seq = await suggestSequence(ctx);
    expect(seq).toHaveLength(2);
    expect(seq[0]!.task.activity).toBe('weeding'); // disturbing work first
  });

  it('keeps data when a module is disabled and restores it when re-enabled', async () => {
    const { kernel, org } = await farm(['land']);
    const ctx = kernel.contextFor(org.id, 'land');
    const field = await createField(ctx, { name: 'Schlag A' });
    await createBed(ctx, { fieldId: field.id, name: 'Beet 1', lengthM: 30, widthM: 0.75 });

    await kernel.setModuleEnabled(org.id, 'land', false);
    await kernel.setModuleEnabled(org.id, 'land', true);

    const beds = await ctx.store.all(`SELECT * FROM land_bed WHERE org_id = ?`, [org.id]);
    expect(beds).toHaveLength(1);
  });
});

describe('multi-tenancy: farms cannot see each other', () => {
  it('scopes every query by org', async () => {
    const platform = createNodePlatform({ databasePath: ':memory:' });
    const kernel = await Kernel(platform);
    const a = await kernel.createOrg({ slug: 'farm-a', name: 'A' });
    const b = await kernel.createOrg({ slug: 'farm-b', name: 'B' });
    for (const o of [a, b]) await kernel.setModuleEnabled(o.id, 'land', true);

    const ctxA = kernel.contextFor(a.id, 'land');
    const ctxB = kernel.contextFor(b.id, 'land');

    const fieldA = await createField(ctxA, { name: 'Only A' });
    await createBedGrid(ctxA, { fieldId: fieldA.id, count: 10, lengthM: 30, widthM: 0.75 });

    const { listBeds } = await import('@solawi/module-land');
    expect(await listBeds(ctxA)).toHaveLength(10);
    expect(await listBeds(ctxB)).toHaveLength(0);
  });

  it('isolates module enablement per farm', async () => {
    const platform = createNodePlatform({ databasePath: ':memory:' });
    const kernel = await Kernel(platform);
    const a = await kernel.createOrg({ slug: 'a2', name: 'A' });
    const b = await kernel.createOrg({ slug: 'b2', name: 'B' });
    await kernel.setModuleEnabled(a.id, 'bidding', true);

    expect([...(await kernel.enabledModules(a.id))]).toContain('bidding');
    expect([...(await kernel.enabledModules(b.id))]).not.toContain('bidding');
  });
});

describe('cultivation: time slider and rotation guard', () => {
  it('shows the plot as it was, is and will be', async () => {
    const { kernel, org } = await farm(['land', 'cultivation']);
    const landCtx = kernel.contextFor(org.id, 'land');
    const ctx = kernel.contextFor(org.id, 'cultivation');

    const field = await createField(landCtx, { name: 'A' });
    const bed = await createBed(landCtx, { fieldId: field.id, name: 'Beet 1' });
    const crop = await createCrop(ctx, {
      botanicalName: 'Daucus carota', family: 'Apiaceae', displayName: 'Möhre', daysToHarvest: 90,
    });
    await createPlanting(ctx, { cropId: crop.id, bedId: bed.id, sownOn: '2026-04-01' });

    expect(await plantingsOn(ctx, '2026-03-01')).toHaveLength(0); // before sowing
    expect(await plantingsOn(ctx, '2026-05-01')).toHaveLength(1); // growing
    const atHarvest = await plantingsOn(ctx, '2026-07-15');
    expect(atHarvest[0]!.phase).toBe('harvestable');
  });

  it('warns but does not block when rotation is too tight', async () => {
    const { kernel, org } = await farm(['land', 'cultivation']);
    const landCtx = kernel.contextFor(org.id, 'land');
    const ctx = kernel.contextFor(org.id, 'cultivation');
    const field = await createField(landCtx, { name: 'A' });
    const bed = await createBed(landCtx, { fieldId: field.id, name: 'Beet 1' });

    const cabbage = await createCrop(ctx, {
      botanicalName: 'Brassica oleracea', family: 'Brassicaceae', displayName: 'Kohl', rotationYears: 4,
    });
    await createPlanting(ctx, { cropId: cabbage.id, bedId: bed.id, plantedOn: '2025-05-01' });

    const warning = await checkRotation(ctx, {
      bedId: bed.id, cropId: cabbage.id, plannedDate: '2026-05-01',
    });
    expect(warning).not.toBeNull();
    expect(warning!.requiredYears).toBe(4);
    expect(warning!.actualYears).toBeLessThan(4);
    expect(warning!.reason).toContain('Brassicaceae');

    // Crucially: it is still possible to create the planting anyway.
    const planting = await createPlanting(ctx, { cropId: cabbage.id, bedId: bed.id, plantedOn: '2026-05-01' });
    expect(planting.id).toBeTruthy();
  });

  it('computes polygon area at field scale', () => {
    // ~100 m × ~100 m near Frankfurt.
    const area = polygonAreaSqm({
      type: 'Polygon',
      coordinates: [[[8.6800, 50.1100], [8.6814, 50.1100], [8.6814, 50.1109], [8.6800, 50.1109], [8.6800, 50.1100]]],
    });
    expect(area).toBeGreaterThan(8_000);
    expect(area).toBeLessThan(12_000);
  });
});

describe('founding: established farms can skip the whole phase', () => {
  it('marks milestones not_applicable rather than done', async () => {
    const { kernel, org } = await farm(['founding']);
    const ctx = kernel.contextFor(org.id, 'founding');

    await skipFounding(ctx, 'established_farm');
    const list = await milestones(ctx);

    expect(list.every((m) => m.status === 'not_applicable')).toBe(true);
    // Not "done": recording them as done would poison duration statistics.
    expect(list.some((m) => m.status === 'done')).toBe(false);
  });

  it('computes blockers from the dependency graph', async () => {
    const { kernel, org } = await farm(['founding']);
    const ctx = kernel.contextFor(org.id, 'founding');

    const before = await milestones(ctx);
    const lease = before.find((m) => m.id === 'land.lease')!;
    expect(lease.actionable).toBe(false);
    expect(lease.blockedBy).toContain('land.soil');

    await setMilestone(ctx, 'group.core', 'done');
    await setMilestone(ctx, 'vision.model', 'done');
    await setMilestone(ctx, 'vision.size', 'done');
    await setMilestone(ctx, 'land.search', 'done');
    await setMilestone(ctx, 'land.soil', 'done');

    const after = await milestones(ctx);
    expect(after.find((m) => m.id === 'land.lease')!.actionable).toBe(true);
    expect((await progress(ctx)).done).toBe(5);
  });
});

describe('org slugs', () => {
  it('accepts two-character slugs', () => {
    // Regression: the original pattern required 3+ chars, so a farm called
    // "Ce" or "CS" could not sign up and the UI showed a generic error.
    const re = /^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$/;
    expect(re.test('cs')).toBe(true);
    expect(re.test('ab')).toBe(true);
    expect(re.test('crowdsalat')).toBe(true);
    expect(re.test('my-farm')).toBe(true);
    expect(re.test('a')).toBe(false);        // single char is too short
    expect(re.test('-bad')).toBe(false);     // may not start with a hyphen
    expect(re.test('bad-')).toBe(false);     // nor end with one
    expect(re.test('Bad')).toBe(false);      // lowercase only
  });
});
