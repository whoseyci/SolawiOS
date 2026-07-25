import type { App } from '../app.js';
import { requireOrg, requireRoleIn } from '../app.js';
import { milestones, setMilestone, progress, skipFounding, type MilestoneStatus } from '@solawi/module-founding';

export function foundingRoutes(app: App): void {
  /** The milestone graph with live state: what is actionable, what is blocked, why. */
  app.get('/api/founding/milestones', async (c) => {
    const { orgId } = requireOrg(c);
    const ctx = c.get('kernel').contextFor(orgId, 'founding', c.get('locale'));
    return c.json({
      milestones: await milestones(ctx),
      progress: await progress(ctx),
    });
  });

  app.post('/api/founding/milestones/:id', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'admin');
    const body = await c.req.json<{ status: MilestoneStatus; note?: string; dueAt?: string }>();
    const ctx = c.get('kernel').contextFor(orgId, 'founding', c.get('locale'));
    await setMilestone(ctx, c.req.param('id'), body.status, body);
    return c.json({ ok: true, progress: await progress(ctx) });
  });

  /**
   * THE SKIP PATH for established Solawis.
   *
   * Marks every milestone `not_applicable` rather than `done`: they were never
   * worked through here, and recording them as done would poison the duration
   * statistics that feed the anonymised commons. Moves the farm to `operating`
   * and switches the module off — data is retained, so it can be re-enabled to
   * look something up.
   */
  app.post('/api/founding/skip', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'admin');
    const { reason } = await c.req.json<{ reason?: string }>().catch(() => ({ reason: undefined }));

    const kernel = c.get('kernel');
    const ctx = kernel.contextFor(orgId, 'founding', c.get('locale'));
    await skipFounding(ctx, reason ?? 'established');
    await kernel.setPhase(orgId, 'operating');
    await kernel.setModuleEnabled(orgId, 'founding', false);
    return c.json({ ok: true, phase: 'operating' });
  });
}
