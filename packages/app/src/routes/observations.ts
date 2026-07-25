import type { App } from '../app.js';
import { requireOrg, requireRoleIn } from '../app.js';
import {
  record, syncBatch, rhythm, labourByActivity, recentForBed, type Activity,
} from '@solawi/module-observations';

/**
 * Observation endpoints (ADR-0008).
 *
 * Note what is missing and will stay missing: there is no endpoint that filters
 * observations by person, because there is no person column to filter on.
 */
export function observationRoutes(app: App): void {
  /** One tap from the bed view. Everything but bed + activity is optional. */
  app.post('/api/observations', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'member');
    const body = await c.req.json<{
      bedId: string; activity: Activity; observedAt?: string;
      quantity?: number; unit?: string; minutes?: number;
      conditions?: string; note?: string; deviceId?: string;
    }>();
    const ctx = c.get('kernel').contextFor(orgId, 'observations', c.get('locale'));
    return c.json({ id: await record(ctx, body) }, 201);
  });

  /**
   * OFFLINE SYNC. A phone in a field with no signal queues observations locally
   * and posts the batch later. Ids are client-generated, so replaying a batch is
   * idempotent; quantities merge additively rather than last-write-wins, because
   * overwriting harvest weights is simply wrong (docs/20 §6).
   */
  app.post('/api/observations/sync', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'member');
    const body = await c.req.json<{
      batch: Array<{
        id: string; bedId: string; activity: Activity; observedAt: string;
        quantity?: number; unit?: string; minutes?: number;
        conditions?: string; note?: string; deviceId?: string;
      }>;
    }>();
    const ctx = c.get('kernel').contextFor(orgId, 'observations', c.get('locale'));
    return c.json(await syncBatch(ctx, body.batch ?? []));
  });

  /** "At what rhythm is this bed actually weeded?" */
  app.get('/api/observations/rhythm', async (c) => {
    const { orgId } = requireOrg(c);
    const bedId = c.req.query('bedId');
    const activity = c.req.query('activity') as Activity | undefined;
    if (!bedId || !activity) return c.json({ error: 'bedId_and_activity_required' }, 400);
    const ctx = c.get('kernel').contextFor(orgId, 'observations', c.get('locale'));
    return c.json(await rhythm(ctx, bedId, activity, c.req.query('since')));
  });

  /** Aggregate labour by activity. The unit is the activity, never the human. */
  app.get('/api/observations/labour', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'grower');
    const from = c.req.query('from') ?? `${new Date().getFullYear()}-01-01`;
    const to = c.req.query('to') ?? `${new Date().getFullYear()}-12-31`;
    const ctx = c.get('kernel').contextFor(orgId, 'observations', c.get('locale'));
    return c.json({ from, to, activities: await labourByActivity(ctx, from, to) });
  });

  app.get('/api/observations/bed/:bedId', async (c) => {
    const { orgId } = requireOrg(c);
    const ctx = c.get('kernel').contextFor(orgId, 'observations', c.get('locale'));
    return c.json({ observations: await recentForBed(ctx, c.req.param('bedId')) });
  });
}
