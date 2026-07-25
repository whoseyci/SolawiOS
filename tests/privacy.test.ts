import { describe, it, expect, beforeEach } from 'vitest';
import { createNodePlatform } from '@solawi/platform-node';
import { Kernel, buildTranslatorForTest } from './helpers.js';
import { createRound, openRound, placeBid, barState, roundResult, histogram, MIN_BIDS_FOR_LIVE_BAR } from '@solawi/module-bidding';
import { createHousehold, neighbourCount, MIN_NEIGHBOURS_TO_SHOW } from '@solawi/module-members';
import { record } from '@solawi/module-observations';

/**
 * These tests exist because the privacy properties in ADR-0005, ADR-0007 and
 * ADR-0008 are the ones most likely to be quietly broken by a well-meaning
 * refactor. They assert behaviour a reviewer cannot eyeball.
 */

async function setup() {
  const platform = createNodePlatform({ databasePath: ':memory:' });
  const kernel = await Kernel(platform);
  const org = await kernel.createOrg({ slug: 'test-farm', name: 'Test Farm' });
  for (const m of ['bidding', 'members', 'observations', 'land']) {
    await kernel.setModuleEnabled(org.id, m, true);
  }
  return { platform, kernel, org };
}

describe('ADR-0005: bidding bar does not leak individual bids', () => {
  it('shows no position until a full batch has arrived', async () => {
    const { kernel, org } = await setup();
    const ctx = kernel.contextFor(org.id, 'bidding');

    const round = await createRound(ctx, {
      season: '2026', targetCents: 9_000_00, shareEquivalents: 75,
      displayMode: 'live_bar', batchSize: 5,
    });
    await openRound(ctx, round.id);

    // Below the live-bar floor: nothing is shown at all.
    for (let i = 0; i < 4; i++) {
      await placeBid(ctx, { roundId: round.id, householdId: `h${i}`, amountCents: 120_00 });
    }
    const early = await barState(ctx, round.id);
    expect(early.phase).toBe('collecting');
    expect(early.position).toBeNull();
  });

  it('resists the differencing attack: adding one bid does not move the bar', async () => {
    const { kernel, org } = await setup();
    const ctx = kernel.contextFor(org.id, 'bidding');
    const round = await createRound(ctx, {
      season: '2026', targetCents: 9_000_00, shareEquivalents: 75,
      displayMode: 'live_bar', batchSize: 5,
    });
    await openRound(ctx, round.id);

    // Reach a revealed batch boundary.
    for (let i = 0; i < MIN_BIDS_FOR_LIVE_BAR; i++) {
      await placeBid(ctx, { roundId: round.id, householdId: `h${i}`, amountCents: 120_00 });
    }
    const before = await barState(ctx, round.id);

    // One more bid — a wildly different amount. If the bar moved, an observer
    // with two photos could compute this bid exactly.
    await placeBid(ctx, { roundId: round.id, householdId: 'whale', amountCents: 900_00 });
    const after = await barState(ctx, round.id);

    expect(after.position).toBe(before.position);
  });

  it('never exposes an exact bid count to the room', async () => {
    const { kernel, org } = await setup();
    const ctx = kernel.contextFor(org.id, 'bidding');
    const round = await createRound(ctx, {
      season: '2026', targetCents: 100_00, shareEquivalents: 10, displayMode: 'live_bar',
    });
    await openRound(ctx, round.id);
    for (let i = 0; i < 7; i++) {
      await placeBid(ctx, { roundId: round.id, householdId: `h${i}`, amountCents: 10_00 });
    }
    const bar = await barState(ctx, round.id);
    expect(typeof bar.participationHint).toBe('string');
    expect(bar.participationHint).not.toMatch(/^\d+$/); // a bucket, not a number
  });

  it('forces final-only display for small farms', async () => {
    const { kernel, org } = await setup();
    const ctx = kernel.contextFor(org.id, 'bidding');
    const round = await createRound(ctx, {
      season: '2026', targetCents: 500_00, shareEquivalents: 8,
      displayMode: 'live_bar', batchSize: 3,
    });
    await openRound(ctx, round.id);
    for (let i = 0; i < 8; i++) {
      await placeBid(ctx, { roundId: round.id, householdId: `h${i}`, amountCents: 60_00 });
    }
    // 8 bids is below MIN_BIDS_FOR_LIVE_BAR, so no bar regardless of config.
    expect((await barState(ctx, round.id)).position).toBeNull();
  });

  it('weights bids by share size when computing the Richtwert', async () => {
    const { kernel, org } = await setup();
    const ctx = kernel.contextFor(org.id, 'bidding');
    // 60 große (1.0) + 30 kleine (0.5) = 75 share equivalents, as at crowd salat.
    const round = await createRound(ctx, {
      season: '2026', targetCents: 90_000_00, shareEquivalents: 75,
    });
    await openRound(ctx, round.id);

    await placeBid(ctx, { roundId: round.id, householdId: 'big', amountCents: 1_200_00, shareWeight: 1.0 });
    await placeBid(ctx, { roundId: round.id, householdId: 'small', amountCents: 600_00, shareWeight: 0.5 });

    const res = await roundResult(ctx, round.id);
    // Richtwert = 90 000 € / 75 = 1 200 € per full share.
    expect(res.richtwertCents).toBe(1_200_00);
    // Both households bid exactly at the guide value for their share size.
    expect(res.meanPerShareCents).toBe(1_200_00);
  });

  it('suppresses the histogram when a bucket would identify individuals', async () => {
    const { kernel, org } = await setup();
    const ctx = kernel.contextFor(org.id, 'bidding');
    const round = await createRound(ctx, {
      season: '2026', targetCents: 10_000_00, shareEquivalents: 20, histogram: true,
    });
    await openRound(ctx, round.id);

    // 19 clustered bids plus one extreme outlier: the outlier's bucket would
    // contain exactly one person.
    for (let i = 0; i < 19; i++) {
      await placeBid(ctx, { roundId: round.id, householdId: `h${i}`, amountCents: 500_00 + i * 100 });
    }
    await placeBid(ctx, { roundId: round.id, householdId: 'outlier', amountCents: 5_000_00 });

    const { closeRound } = await import('@solawi/module-bidding');
    await closeRound(ctx, round.id);
    expect(await histogram(ctx, round.id)).toBeNull();
  });

  it('appends revisions rather than overwriting, keeping the latest as current', async () => {
    const { kernel, org } = await setup();
    const ctx = kernel.contextFor(org.id, 'bidding');
    const round = await createRound(ctx, { season: '2026', targetCents: 1_000_00, shareEquivalents: 10 });
    await openRound(ctx, round.id);

    await placeBid(ctx, { roundId: round.id, householdId: 'h1', amountCents: 50_00 });
    await new Promise((r) => setTimeout(r, 5));
    await placeBid(ctx, { roundId: round.id, householdId: 'h1', amountCents: 80_00 });

    const res = await roundResult(ctx, round.id);
    expect(res.bidCount).toBe(1);       // one household
    expect(res.totalCents).toBe(80_00); // the revised amount

    const rows = await ctx.store.all<{ n: number }>(
      `SELECT COUNT(*) AS n FROM bid WHERE round_id = ?`, [round.id],
    );
    expect(rows[0]!.n).toBe(2);         // but both rows retained as history
  });
});

describe('ADR-0007: neighbour discovery reveals a count, never a location', () => {
  it('returns "fewer than 3" rather than an exact small count', async () => {
    const { kernel, org } = await setup();
    const ctx = kernel.contextFor(org.id, 'members');

    const me = await createHousehold(ctx, {
      name: 'Me', lat: 50.1109, lon: 8.6821, discoverable: true,
    });
    await createHousehold(ctx, { name: 'A', lat: 50.1120, lon: 8.6830, discoverable: true });

    const res = await neighbourCount(ctx, me.id, 5);
    expect(res.count).toBeNull();
    expect(res.display).toBe(`fewer_than_${MIN_NEIGHBOURS_TO_SHOW}`);
  });

  it('returns an exact count once the floor is cleared', async () => {
    const { kernel, org } = await setup();
    const ctx = kernel.contextFor(org.id, 'members');
    const me = await createHousehold(ctx, { name: 'Me', lat: 50.1109, lon: 8.6821, discoverable: true });
    for (let i = 0; i < 5; i++) {
      await createHousehold(ctx, {
        name: `N${i}`, lat: 50.1109 + i * 0.002, lon: 8.6821 + i * 0.002, discoverable: true,
      });
    }
    const res = await neighbourCount(ctx, me.id, 5);
    expect(res.count).toBe(5);
  });

  it('excludes households that have not opted in', async () => {
    const { kernel, org } = await setup();
    const ctx = kernel.contextFor(org.id, 'members');
    const me = await createHousehold(ctx, { name: 'Me', lat: 50.1109, lon: 8.6821, discoverable: true });
    for (let i = 0; i < 5; i++) {
      await createHousehold(ctx, {
        name: `Hidden${i}`, lat: 50.1109 + i * 0.001, lon: 8.6821, discoverable: false,
      });
    }
    const res = await neighbourCount(ctx, me.id, 5);
    expect(res.count).toBeNull(); // discoverable=0 households are invisible
  });
});

describe('ADR-0008: observations cannot be attributed to a person', () => {
  it('has no person column in the schema — structurally, not by policy', async () => {
    const { kernel, org } = await setup();
    const ctx = kernel.contextFor(org.id, 'observations');
    const cols = await ctx.store.all<{ name: string }>(`PRAGMA table_info(observation)`);
    const names = cols.map((c) => c.name);

    for (const forbidden of ['person_id', 'user_id', 'assignee', 'assigned_to', 'worker_id', 'created_by']) {
      expect(names).not.toContain(forbidden);
    }
    expect(names).toContain('bed_id');
    expect(names).toContain('activity');
  });

  it('records an observation against a bed with no way to attribute it', async () => {
    const { kernel, org } = await setup();
    const ctx = kernel.contextFor(org.id, 'observations');
    const id = await record(ctx, { bedId: 'bed-1', activity: 'weeding', minutes: 45 });
    const row = await ctx.store.first<Record<string, unknown>>(
      `SELECT * FROM observation WHERE id = ?`, [id],
    );
    expect(row).toBeTruthy();
    expect(Object.keys(row!).some((k) => /person|user|assign|worker/i.test(k))).toBe(false);
  });
});
