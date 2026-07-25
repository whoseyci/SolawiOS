import type { App } from '../app.js';
import { requireAuth, requireOrg } from '../app.js';

/**
 * "Who am I, here?" — one call the UI makes on boot.
 *
 * Without this the client cannot answer questions like "which household am I?"
 * and features such as neighbour discovery and bidding have nothing to act on.
 * Previously the web app expected a `solawi.household` value in localStorage
 * that nothing ever set, so those screens silently did nothing.
 */
export function meRoutes(app: App): void {
  app.get('/api/me/context', async (c) => {
    const person = requireAuth(c);
    const { orgId, roles } = requireOrg(c);
    const kernel = c.get('kernel');

    const org = await kernel.getOrg(orgId);
    const enabled = await kernel.enabledModules(orgId);

    // Household link lives in `members`; absent when that module is off.
    let household: { id: string; name: string; discoverable: boolean } | null = null;
    if (enabled.has('members')) {
      const row = await kernel.store.first<{ id: string; name: string; discoverable: number }>(
        `SELECT id, name, discoverable FROM household
          WHERE org_id = ? AND person_id = ? AND left_on IS NULL LIMIT 1`,
        [orgId, person.id],
      ).catch(() => null);
      if (row) household = { id: row.id, name: row.name, discoverable: row.discoverable === 1 };
    }

    // Surface a running Bieterrunde so the UI can show it without polling blind.
    let openRound: { id: string; season: string; richtwertCents: number } | null = null;
    if (enabled.has('bidding')) {
      const row = await kernel.store.first<{
        id: string; season: string; target_cents: number; share_equivalents: number;
      }>(
        `SELECT id, season, target_cents, share_equivalents FROM bid_round
          WHERE org_id = ? AND status = 'open' ORDER BY created_at DESC LIMIT 1`,
        [orgId],
      ).catch(() => null);
      if (row) {
        openRound = {
          id: row.id, season: row.season,
          richtwertCents: Math.round(row.target_cents / Math.max(1, row.share_equivalents)),
        };
      }
    }

    return c.json({
      person,
      org: org ? { id: org.id, slug: org.slug, name: org.name, phase: org.phase, locale: org.locale } : null,
      roles,
      modules: [...enabled].sort(),
      household,
      openRound,
    });
  });

  /**
   * Link the signed-in person to a household, or create one for them.
   *
   * A household may exist before anyone claims it (the office enters members
   * from a spreadsheet), so claiming an existing record is the common path.
   */
  app.post('/api/me/household', async (c) => {
    const person = requireAuth(c);
    const { orgId } = requireOrg(c);
    const kernel = c.get('kernel');
    const body = await c.req.json<{ householdId?: string; name?: string }>();

    if (body.householdId) {
      const target = await kernel.store.first<{ person_id: string | null }>(
        `SELECT person_id FROM household WHERE id = ? AND org_id = ?`, [body.householdId, orgId],
      );
      if (!target) return c.json({ error: 'no_such_household' }, 404);
      // Do not let one person silently take over another's household.
      if (target.person_id && target.person_id !== person.id) {
        return c.json({ error: 'household_already_claimed' }, 409);
      }
      await kernel.store.run(
        `UPDATE household SET person_id = ? WHERE id = ? AND org_id = ?`,
        [person.id, body.householdId, orgId],
      );
      await kernel.audit({
        orgId, personId: person.id, action: 'members.household_linked', subject: body.householdId,
      });
      return c.json({ ok: true, householdId: body.householdId });
    }

    const name = body.name?.trim() || person.displayName;
    const id = kernel.platform.crypto.randomUUID();
    const now = kernel.platform.clock.now().toISOString();
    await kernel.store.run(
      `INSERT INTO household (id, org_id, name, contact_email, person_id, discoverable, joined_on, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
      [id, orgId, name, person.email, person.id, now.slice(0, 10), now],
    );
    return c.json({ ok: true, householdId: id }, 201);
  });

  /** Households nobody has claimed yet — the picker after joining a farm. */
  app.get('/api/me/household/candidates', async (c) => {
    requireAuth(c);
    const { orgId } = requireOrg(c);
    const rows = await c.get('kernel').store.all<{ id: string; name: string }>(
      `SELECT id, name FROM household
        WHERE org_id = ? AND person_id IS NULL AND left_on IS NULL ORDER BY name LIMIT 200`,
      [orgId],
    ).catch(() => []);
    return c.json({ candidates: rows });
  });

  /** Opt in or out of being counted in neighbour searches (ADR-0007). */
  app.post('/api/me/discoverable', async (c) => {
    const person = requireAuth(c);
    const { orgId } = requireOrg(c);
    const { discoverable, lat, lon } = await c.req.json<{
      discoverable: boolean; lat?: number; lon?: number;
    }>();
    const kernel = c.get('kernel');

    if (typeof lat === 'number' && typeof lon === 'number') {
      await kernel.store.run(
        `UPDATE household SET discoverable = ?, lat = ?, lon = ? WHERE org_id = ? AND person_id = ?`,
        [discoverable ? 1 : 0, lat, lon, orgId, person.id],
      );
    } else {
      await kernel.store.run(
        `UPDATE household SET discoverable = ? WHERE org_id = ? AND person_id = ?`,
        [discoverable ? 1 : 0, orgId, person.id],
      );
    }
    return c.json({ ok: true });
  });
}
