import { describe, it, expect } from 'vitest';
import { createNodePlatform } from '@solawi/platform-node';
import { Kernel } from './helpers.js';
import {
  createField, createBed, createFeature, listFeatures,
  getMapSettings, setMapSettings, updateGeometry, deleteFeature,
  polygonAreaSqm, FEATURE_KINDS,
} from '@solawi/module-land';
import { createTask, board, moveTask, tasksForBed } from '@solawi/module-tasks';

async function farm(modules: string[]) {
  const platform = createNodePlatform({ databasePath: ':memory:' });
  const kernel = await Kernel(platform);
  const org = await kernel.createOrg({ slug: `m${Math.random().toString(36).slice(2, 7)}`, name: 'M' });
  for (const m of modules) await kernel.setModuleEnabled(org.id, m, true);
  return { kernel, org };
}

const SQUARE = {
  type: 'Polygon',
  coordinates: [[[8.6800, 50.1100], [8.6814, 50.1100], [8.6814, 50.1109], [8.6800, 50.1109], [8.6800, 50.1100]]],
};

describe('map: farm geography', () => {
  it('stores a farm centre and base layer so the map opens over the right ground', async () => {
    const { kernel, org } = await farm(['land']);
    const ctx = kernel.contextFor(org.id, 'land');

    // Unset: the client falls back to geolocation rather than the Atlantic.
    expect((await getMapSettings(ctx)).centreLat).toBeNull();

    await setMapSettings(ctx, { centreLat: 50.1109, centreLon: 8.6821, zoom: 18, baseLayer: 'satellite' });
    const s = await getMapSettings(ctx);
    expect(s.centreLat).toBeCloseTo(50.1109, 4);
    expect(s.baseLayer).toBe('satellite');
    expect(s.zoom).toBe(18);
  });

  it('computes area when a shape is drawn', async () => {
    const { kernel, org } = await farm(['land']);
    const ctx = kernel.contextFor(org.id, 'land');
    const field = await createField(ctx, { name: 'Hauptacker', geometry: SQUARE });
    // ~100m x ~100m near Frankfurt.
    expect(field.area_sqm).toBeGreaterThan(8_000);
    expect(field.area_sqm).toBeLessThan(14_000);
  });

  it('recomputes area when a shape is redrawn', async () => {
    const { kernel, org } = await farm(['land']);
    const ctx = kernel.contextFor(org.id, 'land');
    const field = await createField(ctx, { name: 'F' });
    const bed = await createBed(ctx, { fieldId: field.id, name: 'Beet 1' });
    expect(bed.area_sqm).toBeNull();

    await updateGeometry(ctx, { table: 'bed', id: bed.id, geometry: SQUARE });
    const row = await ctx.store.first<{ area_sqm: number | null }>(
      `SELECT area_sqm FROM land_bed WHERE id = ?`, [bed.id]);
    expect(row!.area_sqm).toBeGreaterThan(8_000);
  });

  it('stores typed map features and removes them again', async () => {
    const { kernel, org } = await farm(['land']);
    const ctx = kernel.contextFor(org.id, 'land');

    const shed = await createFeature(ctx, {
      kind: 'shed', name: 'Geräteschuppen',
      geometry: { type: 'Point', coordinates: [8.6809, 50.1104] },
    });
    await createFeature(ctx, {
      kind: 'water', name: 'Brunnen',
      geometry: { type: 'Point', coordinates: [8.6811, 50.1107] },
    });
    expect(await listFeatures(ctx)).toHaveLength(2);

    await deleteFeature(ctx, shed.id);
    expect(await listFeatures(ctx)).toHaveLength(1);
  });

  it('keeps the feature vocabulary closed so the legend stays meaningful', () => {
    expect(FEATURE_KINDS).toContain('shed');
    expect(FEATURE_KINDS).toContain('water');
    expect(FEATURE_KINDS).toContain('hedge');
    expect(FEATURE_KINDS.length).toBeLessThan(15);
  });

  it('returns null area for a degenerate shape rather than throwing', () => {
    expect(polygonAreaSqm(null)).toBeNull();
    expect(polygonAreaSqm({ type: 'Polygon', coordinates: [[[1, 1]]] })).toBeNull();
  });
});

describe('kanban board', () => {
  it('starts new tasks in the backlog', async () => {
    const { kernel, org } = await farm(['tasks']);
    const ctx = kernel.contextFor(org.id, 'tasks');
    await createTask(ctx, { title: 'Jäten' });
    const b = await board(ctx);
    expect(b.backlog).toHaveLength(1);
    expect(b.doing).toHaveLength(0);
  });

  it('moves a card between lanes', async () => {
    const { kernel, org } = await farm(['tasks']);
    const ctx = kernel.contextFor(org.id, 'tasks');
    const task = await createTask(ctx, { title: 'Wässern' });

    await moveTask(ctx, { taskId: task.id, column: 'doing' });
    expect((await board(ctx)).doing).toHaveLength(1);

    await moveTask(ctx, { taskId: task.id, column: 'done' });
    const b = await board(ctx);
    expect(b.doing).toHaveLength(0);
    expect(b.done).toHaveLength(1);
  });

  it('completing by drag sets the task done, and dragging back reopens it', async () => {
    const { kernel, org } = await farm(['tasks']);
    const ctx = kernel.contextFor(org.id, 'tasks');
    const task = await createTask(ctx, { title: 'Mulchen' });

    await moveTask(ctx, { taskId: task.id, column: 'done' });
    let row = await ctx.store.first<{ status: string; completed_at: string | null }>(
      `SELECT status, completed_at FROM task WHERE id = ?`, [task.id]);
    expect(row!.status).toBe('done');
    expect(row!.completed_at).not.toBeNull();

    await moveTask(ctx, { taskId: task.id, column: 'ready' });
    row = await ctx.store.first(`SELECT status, completed_at FROM task WHERE id = ?`, [task.id]);
    expect(row!.status).toBe('open');
    expect(row!.completed_at).toBeNull();
  });

  it('orders by midpoint so a drop does not renumber the lane', async () => {
    const { kernel, org } = await farm(['tasks']);
    const ctx = kernel.contextFor(org.id, 'tasks');
    const a = await createTask(ctx, { title: 'A' });
    const b = await createTask(ctx, { title: 'B' });

    await moveTask(ctx, { taskId: a.id, column: 'ready', afterOrder: 100 });
    await moveTask(ctx, { taskId: b.id, column: 'ready', beforeOrder: 100, afterOrder: 200 });

    const rows = await ctx.store.all<{ id: string; board_order: number }>(
      `SELECT id, board_order FROM task WHERE org_id = ? ORDER BY board_order`, [org.id]);
    expect(rows[0]!.id).toBe(a.id);
    expect(rows[1]!.board_order).toBe(150);
  });

  it('lists the tasks attached to one bed for the map detail panel', async () => {
    const { kernel, org } = await farm(['tasks']);
    const ctx = kernel.contextFor(org.id, 'tasks');
    await createTask(ctx, { title: 'Beet 1 jäten', bedId: 'bed-1' });
    await createTask(ctx, { title: 'Woanders', bedId: 'bed-2' });
    expect(await tasksForBed(ctx, 'bed-1')).toHaveLength(1);
  });
});
