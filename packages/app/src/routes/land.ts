import type { App } from '../app.js';
import { requireOrg, requireRoleIn } from '../app.js';
import {
  createField, listFields, createBed, listBeds, createBedGrid, addPerennial,
  getMapSettings, setMapSettings, createFeature, listFeatures, updateGeometry,
  deleteFeature, renameBed, FEATURE_KINDS, type FeatureKind,
} from '@solawi/module-land';

export function landRoutes(app: App): void {
  app.get('/api/land/fields', async (c) => {
    const { orgId } = requireOrg(c);
    const ctx = c.get('kernel').contextFor(orgId, 'land', c.get('locale'));
    return c.json({ fields: await listFields(ctx) });
  });

  app.post('/api/land/fields', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'grower');
    const body = await c.req.json<{ name: string; geometry?: unknown; areaSqm?: number; soilNote?: string }>();
    const ctx = c.get('kernel').contextFor(orgId, 'land', c.get('locale'));
    return c.json({ field: await createField(ctx, body) }, 201);
  });

  app.get('/api/land/beds', async (c) => {
    const { orgId } = requireOrg(c);
    const ctx = c.get('kernel').contextFor(orgId, 'land', c.get('locale'));
    return c.json({ beds: await listBeds(ctx, c.req.query('fieldId')) });
  });

  app.post('/api/land/beds', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'grower');
    const body = await c.req.json<{
      fieldId: string; name: string; geometry?: unknown;
      lengthM?: number; widthM?: number; kind?: string;
    }>();
    const ctx = c.get('kernel').contextFor(orgId, 'land', c.get('locale'));
    return c.json({ bed: await createBed(ctx, body) }, 201);
  });

  /** Bulk grid — the common case when setting up a market garden. */
  app.post('/api/land/beds/grid', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'grower');
    const body = await c.req.json<{
      fieldId: string; count: number; prefix?: string; lengthM: number; widthM: number;
    }>();
    const ctx = c.get('kernel').contextFor(orgId, 'land', c.get('locale'));
    return c.json({ created: await createBedGrid(ctx, body) }, 201);
  });

  /** Perennials are first-class: Agroforst rows live for decades. */
  app.post('/api/land/perennials', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'grower');
    const body = await c.req.json<{
      species: string; plantedOn: string; fieldId?: string; bedId?: string;
      variety?: string; expectedYears?: number; geometry?: unknown; note?: string;
    }>();
    const ctx = c.get('kernel').contextFor(orgId, 'land', c.get('locale'));
    return c.json({ id: await addPerennial(ctx, body) }, 201);
  });

  // ---------------------------------------------------------------- map view

  /**
   * Everything the map needs in ONE request.
   *
   * The map is the main working view, so it must not open with a waterfall of
   * four round trips before anything appears. Crops and tasks are overlaid only
   * when those modules are enabled — the map degrades to plain geography
   * otherwise (docs/40 §3).
   */
  app.get('/api/land/map', async (c) => {
    const { orgId } = requireOrg(c);
    const kernel = c.get('kernel');
    const ctx = kernel.contextFor(orgId, 'land', c.get('locale'));
    const enabled = await kernel.enabledModules(orgId);
    const date = c.req.query('date') ?? new Date().toISOString().slice(0, 10);

    const [settings, fields, beds, features] = await Promise.all([
      getMapSettings(ctx), listFields(ctx), listBeds(ctx), listFeatures(ctx),
    ]);

    let plantings: unknown[] = [];
    let tasks: unknown[] = [];

    if (enabled.has('cultivation')) {
      const { plantingsOn } = await import('@solawi/module-cultivation');
      plantings = await plantingsOn(
        kernel.contextFor(orgId, 'cultivation', c.get('locale')), date,
      ).catch(() => []);
    }
    if (enabled.has('tasks')) {
      const { openTasks } = await import('@solawi/module-tasks');
      tasks = await openTasks(
        kernel.contextFor(orgId, 'tasks', c.get('locale')), date,
      ).catch(() => []);
    }

    return c.json({ settings, fields, beds, features, plantings, tasks, date });
  });

  app.post('/api/land/map/settings', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'grower');
    const body = await c.req.json<{
      centreLat?: number; centreLon?: number; zoom?: number; baseLayer?: string;
    }>();
    const ctx = c.get('kernel').contextFor(orgId, 'land', c.get('locale'));
    await setMapSettings(ctx, body);
    return c.json({ ok: true });
  });

  app.get('/api/land/features', async (c) => {
    const { orgId } = requireOrg(c);
    const ctx = c.get('kernel').contextFor(orgId, 'land', c.get('locale'));
    return c.json({ features: await listFeatures(ctx), kinds: FEATURE_KINDS });
  });

  app.post('/api/land/features', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'grower');
    const body = await c.req.json<{
      kind: FeatureKind; name: string; geometry?: unknown;
      fieldId?: string; note?: string; colour?: string; icon?: string;
    }>();
    const ctx = c.get('kernel').contextFor(orgId, 'land', c.get('locale'));
    return c.json({ feature: await createFeature(ctx, body) }, 201);
  });

  app.delete('/api/land/features/:id', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'grower');
    const ctx = c.get('kernel').contextFor(orgId, 'land', c.get('locale'));
    await deleteFeature(ctx, c.req.param('id'));
    return c.json({ ok: true });
  });

  /** Persist a shape after drawing or dragging it on the map. */
  app.post('/api/land/geometry', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'grower');
    const body = await c.req.json<{
      table: 'field' | 'bed' | 'feature'; id: string; geometry: unknown;
    }>();
    const ctx = c.get('kernel').contextFor(orgId, 'land', c.get('locale'));
    await updateGeometry(ctx, body);
    return c.json({ ok: true });
  });

  app.post('/api/land/beds/:id/rename', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'grower');
    const { name } = await c.req.json<{ name: string }>();
    const ctx = c.get('kernel').contextFor(orgId, 'land', c.get('locale'));
    await renameBed(ctx, c.req.param('id'), name);
    return c.json({ ok: true });
  });
}
