import type { App } from '../app.js';
import { requireOrg, requireRoleIn } from '../app.js';
import { createField, listFields, createBed, listBeds, createBedGrid, addPerennial } from '@solawi/module-land';

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
}
