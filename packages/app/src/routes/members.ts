import type { App } from '../app.js';
import { requireAuth, requireOrg, requireRoleIn } from '../app.js';
import {
  createHousehold, listHouseholds, createShareType, addShare, shareEquivalents,
  declareAbsence, neighbourCount, sendConnectRequest, respondToConnect,
} from '@solawi/module-members';

export function memberRoutes(app: App): void {
  app.get('/api/members/households', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'admin');
    const ctx = c.get('kernel').contextFor(orgId, 'members', c.get('locale'));
    return c.json({ households: await listHouseholds(ctx) });
  });

  app.post('/api/members/households', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'admin');
    const body = await c.req.json<{
      name: string; contactEmail?: string; contactPhone?: string; personId?: string;
      lat?: number; lon?: number; discoverable?: boolean; joinedOn?: string;
    }>();
    const ctx = c.get('kernel').contextFor(orgId, 'members', c.get('locale'));
    return c.json({ household: await createHousehold(ctx, body) }, 201);
  });

  /** Share types carry the weight that makes the Richtwert meaningful. */
  app.post('/api/members/share-types', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'admin');
    const body = await c.req.json<{ name: string; weight: number; sortOrder?: number }>();
    const ctx = c.get('kernel').contextFor(orgId, 'members', c.get('locale'));
    return c.json({ id: await createShareType(ctx, body) }, 201);
  });

  app.post('/api/members/shares', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'admin');
    const body = await c.req.json<{
      householdId: string; shareTypeId: string; season: string; startedOn?: string;
    }>();
    const ctx = c.get('kernel').contextFor(orgId, 'members', c.get('locale'));
    return c.json({ id: await addShare(ctx, body) }, 201);
  });

  app.get('/api/members/share-equivalents', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'admin');
    const season = c.req.query('season') ?? String(new Date().getFullYear());
    const ctx = c.get('kernel').contextFor(orgId, 'members', c.get('locale'));
    return c.json({ season, shareEquivalents: await shareEquivalents(ctx, season) });
  });

  app.post('/api/members/absences', async (c) => {
    requireAuth(c);
    const { orgId } = requireOrg(c);
    const body = await c.req.json<{
      householdId: string; from: string; to: string;
      substituteHouseholdId?: string; donate?: boolean;
    }>();
    const ctx = c.get('kernel').contextFor(orgId, 'members', c.get('locale'));
    return c.json({ id: await declareAbsence(ctx, body) }, 201);
  });

  /**
   * NEIGHBOUR DISCOVERY (ADR-0007 rev 2).
   *
   * Returns a COUNT within a radius. No map, no names, no coordinates, no
   * directions. Below 3 households it returns "fewer than 3" rather than a
   * number, because "1 household within 1 km" plus local knowledge is an address.
   */
  app.get('/api/members/neighbours', async (c) => {
    requireAuth(c);
    const { orgId } = requireOrg(c);
    const householdId = c.req.query('householdId');
    const radiusKm = Number(c.req.query('radiusKm') ?? '5');
    if (!householdId) return c.json({ error: 'householdId_required' }, 400);
    if (![1, 2, 5, 10].includes(radiusKm)) return c.json({ error: 'invalid_radius' }, 400);

    const ctx = c.get('kernel').contextFor(orgId, 'members', c.get('locale'));
    return c.json(await neighbourCount(ctx, householdId, radiusKm));
  });

  /** Send a connect request. The sender does not learn who receives it. */
  app.post('/api/members/connect', async (c) => {
    const person = requireAuth(c);
    const { orgId } = requireOrg(c);
    const body = await c.req.json<{
      fromHouseholdId: string; radiusKm: number; purpose: string; message?: string;
    }>();
    const ctx = c.get('kernel').contextFor(orgId, 'members', c.get('locale'));
    try {
      const res = await sendConnectRequest(ctx, body);
      await c.get('kernel').audit({
        orgId, personId: person.id, action: 'members.connect_requested',
        detail: { radiusKm: body.radiusKm, purpose: body.purpose, sent: res.sent },
      });
      return c.json(res, 201);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'error' }, 429);
    }
  });

  /**
   * Respond. Accepting exchanges contact details in BOTH directions at once.
   * Ignoring is a first-class outcome — there is deliberately no "seen" state.
   */
  app.post('/api/members/connect/:id/respond', async (c) => {
    requireAuth(c);
    const { orgId } = requireOrg(c);
    const { accept } = await c.req.json<{ accept: boolean }>();
    const ctx = c.get('kernel').contextFor(orgId, 'members', c.get('locale'));
    return c.json(await respondToConnect(ctx, c.req.param('id'), Boolean(accept)));
  });
}
