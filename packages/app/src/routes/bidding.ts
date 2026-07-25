import type { App } from '../app.js';
import { requireAuth, requireOrg, requireRoleIn } from '../app.js';
import {
  createRound, openRound, closeRound, placeBid, barState, roundResult,
  histogram, listBidsForFinance, addComment, getRound,
} from '@solawi/module-bidding';
import { shareEquivalents } from '@solawi/module-members';

/**
 * Bidding endpoints. The privacy boundary from ADR-0005 is enforced HERE:
 *
 *   /bar        → anyone in the farm (projector). Batched, rounded, no amounts.
 *   /result     → finance role only. Totals and the Richtwert.
 *   /bids       → finance role only. Individual amounts, audit-logged.
 *
 * Members never reach an endpoint that returns another household's amount.
 */
export function biddingRoutes(app: App): void {
  app.post('/api/bidding/rounds', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'admin');
    const body = await c.req.json<{
      season: string; targetCents: number; ordinal?: number;
      displayMode?: 'live_bar' | 'final_only'; batchSize?: number; histogram?: boolean;
      shareEquivalents?: number;
    }>();

    const kernel = c.get('kernel');
    const ctx = kernel.contextFor(orgId, 'bidding', c.get('locale'));

    // Prefer live share equivalents from `members`; fall back to an explicit value
    // so a farm can run a round before its member data is loaded.
    let equivalents = body.shareEquivalents ?? 0;
    if (!equivalents) {
      const memberCtx = kernel.contextFor(orgId, 'members', c.get('locale'));
      try { equivalents = await shareEquivalents(memberCtx, body.season); } catch { equivalents = 0; }
    }
    if (!equivalents) return c.json({ error: 'share_equivalents_required' }, 400);

    const round = await createRound(ctx, {
      season: body.season,
      targetCents: body.targetCents,
      shareEquivalents: equivalents,
      ordinal: body.ordinal,
      displayMode: body.displayMode,
      batchSize: body.batchSize,
      histogram: body.histogram,
    });
    return c.json({ round }, 201);
  });

  app.post('/api/bidding/rounds/:id/open', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'admin');
    await openRound(c.get('kernel').contextFor(orgId, 'bidding'), c.req.param('id'));
    return c.json({ ok: true });
  });

  app.post('/api/bidding/rounds/:id/close', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'admin');
    await closeRound(c.get('kernel').contextFor(orgId, 'bidding'), c.req.param('id'));
    return c.json({ ok: true });
  });

  /** Place or revise a bid. Appends — the latest row per household wins. */
  app.post('/api/bidding/rounds/:id/bids', async (c) => {
    const person = requireAuth(c);
    const { orgId, roles } = requireOrg(c);
    const body = await c.req.json<{
      householdId: string; amountCents: number; shareWeight?: number; paper?: boolean;
    }>();

    // Paper slips are entered by the team on someone's behalf; that needs admin.
    if (body.paper) requireRoleIn(roles, 'admin');

    const ctx = c.get('kernel').contextFor(orgId, 'bidding', c.get('locale'));
    await placeBid(ctx, {
      roundId: c.req.param('id'),
      householdId: body.householdId,
      amountCents: body.amountCents,
      shareWeight: body.shareWeight,
      source: body.paper ? 'paper' : 'digital',
    });
    await c.get('kernel').audit({
      orgId, personId: person.id, action: 'bidding.bid_placed',
      subject: c.req.param('id'), detail: { paper: Boolean(body.paper) },
    });
    return c.json({ ok: true }, 201);
  });

  /**
   * THE PROJECTOR. Safe for a room full of people.
   * Batched, jittered, rounded to 20 steps — no amounts, no exact counts.
   */
  app.get('/api/bidding/rounds/:id/bar', async (c) => {
    const { orgId } = requireOrg(c);
    const ctx = c.get('kernel').contextFor(orgId, 'bidding');
    return c.json(await barState(ctx, c.req.param('id')));
  });

  /** Totals and Richtwert. Finance only. */
  app.get('/api/bidding/rounds/:id/result', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'finance');
    const ctx = c.get('kernel').contextFor(orgId, 'bidding');
    return c.json(await roundResult(ctx, c.req.param('id')));
  });

  /** Individual amounts. Finance only, always audited. */
  app.get('/api/bidding/rounds/:id/bids', async (c) => {
    const person = requireAuth(c);
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'finance');

    const ctx = c.get('kernel').contextFor(orgId, 'bidding');
    const bids = await listBidsForFinance(ctx, c.req.param('id'), person.id);
    await c.get('kernel').audit({
      orgId, personId: person.id, action: 'bidding.amounts_read',
      subject: c.req.param('id'), detail: { count: bids.length },
    });
    return c.json({ bids });
  });

  /** Optional anonymised distribution; null unless safe and enabled. */
  app.get('/api/bidding/rounds/:id/histogram', async (c) => {
    const { orgId } = requireOrg(c);
    const ctx = c.get('kernel').contextFor(orgId, 'bidding');
    const buckets = await histogram(ctx, c.req.param('id'));
    return c.json({ buckets, available: buckets !== null });
  });

  app.post('/api/bidding/rounds/:id/comments', async (c) => {
    requireAuth(c);
    const { orgId } = requireOrg(c);
    const { body } = await c.req.json<{ body: string }>();
    // Stored detached from amounts: comments have no billing function.
    await addComment(c.get('kernel').contextFor(orgId, 'bidding'), c.req.param('id'), body);
    return c.json({ ok: true }, 201);
  });

  /** What a member may see about a round: status and their own guide value. */
  app.get('/api/bidding/rounds/:id', async (c) => {
    const { orgId } = requireOrg(c);
    const ctx = c.get('kernel').contextFor(orgId, 'bidding');
    const round = await getRound(ctx, c.req.param('id'));
    if (!round) return c.json({ error: 'not_found' }, 404);
    return c.json({
      id: round.id,
      season: round.season,
      ordinal: round.ordinal,
      status: round.status,
      displayMode: round.display_mode,
      richtwertCents: Math.round(round.target_cents / round.share_equivalents),
      // Deliberately absent: totals, counts, any individual amount.
    });
  });
}
