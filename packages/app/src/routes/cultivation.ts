import type { App } from '../app.js';
import { requireOrg, requireRoleIn } from '../app.js';
import {
  createCrop, listCrops, createPlanting, plantingsOn, checkRotation, clearPlanting,
} from '@solawi/module-cultivation';

export function cultivationRoutes(app: App): void {
  app.get('/api/cultivation/crops', async (c) => {
    const { orgId } = requireOrg(c);
    const ctx = c.get('kernel').contextFor(orgId, 'cultivation', c.get('locale'));
    return c.json({ crops: await listCrops(ctx) });
  });

  app.post('/api/cultivation/crops', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'grower');
    const body = await c.req.json<{
      botanicalName: string; family: string; displayName: string;
      synonyms?: string[]; daysToHarvest?: number; rotationYears?: number; yieldPerSqm?: number;
    }>();
    const ctx = c.get('kernel').contextFor(orgId, 'cultivation', c.get('locale'));
    return c.json({ crop: await createCrop(ctx, body) }, 201);
  });

  /**
   * THE TIME SLIDER. `?date=YYYY-MM-DD` returns the plot on that day —
   * past, present or future. One query, so scrubbing stays responsive.
   */
  app.get('/api/cultivation/plantings', async (c) => {
    const { orgId } = requireOrg(c);
    const date = c.req.query('date') ?? new Date().toISOString().slice(0, 10);
    const ctx = c.get('kernel').contextFor(orgId, 'cultivation', c.get('locale'));
    return c.json({ date, plantings: await plantingsOn(ctx, date) });
  });

  app.post('/api/cultivation/plantings', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'grower');
    const body = await c.req.json<{
      cropId: string; bedId: string; variety?: string;
      sownOn?: string; plantedOn?: string; harvestFrom?: string; harvestTo?: string;
      expectedKg?: number; note?: string; acknowledgeRotation?: boolean;
    }>();
    const ctx = c.get('kernel').contextFor(orgId, 'cultivation', c.get('locale'));

    // The rotation guard WARNS; it never blocks. A gardener with a reason to
    // break rotation must be able to proceed by acknowledging.
    const warning = await checkRotation(ctx, {
      bedId: body.bedId, cropId: body.cropId,
      plannedDate: body.plantedOn ?? body.sownOn ?? new Date().toISOString().slice(0, 10),
    });
    if (warning && !body.acknowledgeRotation) {
      return c.json({ warning, requiresAcknowledgement: true }, 409);
    }

    const planting = await createPlanting(ctx, body);
    return c.json({ planting, warning }, 201);
  });

  /** Check rotation without committing — for the planner UI. */
  app.post('/api/cultivation/rotation-check', async (c) => {
    const { orgId } = requireOrg(c);
    const body = await c.req.json<{ bedId: string; cropId: string; plannedDate: string }>();
    const ctx = c.get('kernel').contextFor(orgId, 'cultivation', c.get('locale'));
    const warning = await checkRotation(ctx, body);
    return c.json({ ok: warning === null, warning });
  });

  app.post('/api/cultivation/plantings/:id/clear', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'grower');
    const { on } = await c.req.json<{ on?: string }>();
    const ctx = c.get('kernel').contextFor(orgId, 'cultivation', c.get('locale'));
    await clearPlanting(ctx, c.req.param('id'), on ?? new Date().toISOString().slice(0, 10));
    return c.json({ ok: true });
  });
}
