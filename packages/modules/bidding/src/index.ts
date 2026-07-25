import type { SolawiModule, ModuleContext, Migration } from '@solawi/kernel';

/**
 * Module 9 — bidding (Bieterrunde). Implements ADR-0005 rev 3.
 *
 * Design decisions that are load-bearing and must not be "simplified":
 *
 *  1. Bids are ORDINARY records linked to a household. The team can read them;
 *     billing depends on it. No sealing, no key escrow (rev 2 removed).
 *  2. The protected boundary is PEER visibility: members never see each other's
 *     amounts. Enforced at the API layer plus audit logging here.
 *  3. Richtwert = budget / share-equivalents, and every bid is normalised by its
 *     share weight before averaging. Without this a farm with 60 große + 30
 *     kleine Anteile gets a meaningless guide value.
 *  4. The live bar batches, jitters and rounds, because a naive running average
 *     leaks individual bids by differencing:
 *         bid = avg(n+1)*(n+1) - avg(n)*n
 *     Two photos of the projector would otherwise recover an exact bid.
 *  5. Revisions APPEND. The current bid is the latest row per household.
 */

const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: 'bidding: rounds, bids (append-only), anonymous comments',
    statements: [
      `CREATE TABLE IF NOT EXISTS bid_round (
        id             TEXT PRIMARY KEY,
        org_id         TEXT NOT NULL,
        season         TEXT NOT NULL,
        ordinal        INTEGER NOT NULL DEFAULT 1,
        target_cents   INTEGER NOT NULL,
        share_equivalents REAL NOT NULL,
        display_mode   TEXT NOT NULL DEFAULT 'final_only',
        batch_size     INTEGER NOT NULL DEFAULT 5,
        status         TEXT NOT NULL DEFAULT 'draft',
        opened_at      TEXT,
        closed_at      TEXT,
        histogram_enabled INTEGER NOT NULL DEFAULT 0,
        created_at     TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_round_org ON bid_round (org_id, season, ordinal)`,

      // Append-only: a revision is a new row. Current bid = latest per household.
      `CREATE TABLE IF NOT EXISTS bid (
        id            TEXT PRIMARY KEY,
        org_id        TEXT NOT NULL,
        round_id      TEXT NOT NULL REFERENCES bid_round(id) ON DELETE CASCADE,
        household_id  TEXT NOT NULL,
        amount_cents  INTEGER NOT NULL,
        share_weight  REAL NOT NULL DEFAULT 1.0,
        source        TEXT NOT NULL DEFAULT 'digital',
        created_at    TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_bid_round ON bid (org_id, round_id, household_id, created_at DESC)`,

      `CREATE TABLE IF NOT EXISTS bid_comment (
        id         TEXT PRIMARY KEY,
        org_id     TEXT NOT NULL,
        round_id   TEXT NOT NULL REFERENCES bid_round(id) ON DELETE CASCADE,
        body       TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
    ],
  },
];

export type DisplayMode = 'live_bar' | 'final_only';
export type RoundStatus = 'draft' | 'open' | 'closed';

/** Below this many bids a live bar cannot be made safe; we force final-only. */
export const MIN_BIDS_FOR_LIVE_BAR = 15;
/** Never batch below this, whatever the farm configures. */
export const MIN_BATCH_SIZE = 3;
/** Histogram suppression thresholds. */
export const MIN_BIDS_FOR_HISTOGRAM = 15;
export const MIN_PER_BUCKET = 3;

export interface Round {
  id: string; org_id: string; season: string; ordinal: number;
  target_cents: number; share_equivalents: number;
  display_mode: DisplayMode; batch_size: number; status: RoundStatus;
  opened_at: string | null; closed_at: string | null;
  histogram_enabled: number; created_at: string;
}

export const biddingModule: SolawiModule = {
  manifest: {
    id: 'bidding',
    number: 9,
    maturity: 'alpha',
    phases: ['operating'],
    suggests: ['members', 'finance-model'],
    migrations: MIGRATIONS,
  },
};

export async function createRound(
  ctx: ModuleContext,
  input: {
    season: string; targetCents: number; shareEquivalents: number;
    ordinal?: number; displayMode?: DisplayMode; batchSize?: number; histogram?: boolean;
  },
): Promise<Round> {
  if (input.shareEquivalents <= 0) {
    throw new Error('shareEquivalents must be > 0: the Richtwert is budget ÷ share equivalents.');
  }
  const id = ctx.platform.crypto.randomUUID();
  const now = ctx.platform.clock.now().toISOString();
  const batch = Math.max(MIN_BATCH_SIZE, input.batchSize ?? 5);

  await ctx.store.run(
    `INSERT INTO bid_round
       (id, org_id, season, ordinal, target_cents, share_equivalents, display_mode, batch_size, status, histogram_enabled, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
    [
      id, ctx.orgId, input.season, input.ordinal ?? 1, input.targetCents,
      input.shareEquivalents, input.displayMode ?? 'final_only', batch,
      input.histogram ? 1 : 0, now,
    ],
  );
  return {
    id, org_id: ctx.orgId, season: input.season, ordinal: input.ordinal ?? 1,
    target_cents: input.targetCents, share_equivalents: input.shareEquivalents,
    display_mode: input.displayMode ?? 'final_only', batch_size: batch,
    status: 'draft', opened_at: null, closed_at: null,
    histogram_enabled: input.histogram ? 1 : 0, created_at: now,
  };
}

export async function openRound(ctx: ModuleContext, roundId: string): Promise<void> {
  await ctx.store.run(
    `UPDATE bid_round SET status = 'open', opened_at = ? WHERE id = ? AND org_id = ?`,
    [ctx.platform.clock.now().toISOString(), roundId, ctx.orgId],
  );
  await ctx.emit('bidding.round_opened', { roundId });
}

export async function closeRound(ctx: ModuleContext, roundId: string): Promise<void> {
  await ctx.store.run(
    `UPDATE bid_round SET status = 'closed', closed_at = ? WHERE id = ? AND org_id = ?`,
    [ctx.platform.clock.now().toISOString(), roundId, ctx.orgId],
  );
  const result = await roundResult(ctx, roundId);
  await ctx.emit('bidding.round_closed', { roundId, ...result });
}

/**
 * Place or revise a bid. Appends; never updates.
 * `source` distinguishes app entry from a paper slip typed in by the team —
 * indistinguishable in the result, per ADR-0005 §4.
 */
export async function placeBid(
  ctx: ModuleContext,
  input: {
    roundId: string; householdId: string; amountCents: number;
    shareWeight?: number; source?: 'digital' | 'paper';
  },
): Promise<void> {
  const round = await getRound(ctx, input.roundId);
  if (!round) throw new Error('Unknown round');
  if (round.status !== 'open') throw new Error('Round is not open');
  if (input.amountCents < 0) throw new Error('Amount must be positive');

  await ctx.store.run(
    `INSERT INTO bid (id, org_id, round_id, household_id, amount_cents, share_weight, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ctx.platform.crypto.randomUUID(), ctx.orgId, input.roundId, input.householdId,
      input.amountCents, input.shareWeight ?? 1.0, input.source ?? 'digital',
      ctx.platform.clock.now().toISOString(),
    ],
  );
  await ctx.emit('bidding.bid_placed', { roundId: input.roundId, source: input.source ?? 'digital' });
}

export async function getRound(ctx: ModuleContext, roundId: string): Promise<Round | null> {
  return ctx.store.first<Round>(
    `SELECT * FROM bid_round WHERE id = ? AND org_id = ?`, [roundId, ctx.orgId],
  );
}

/** Latest bid per household — the current state of the round. */
async function currentBids(ctx: ModuleContext, roundId: string) {
  return ctx.store.all<{ household_id: string; amount_cents: number; share_weight: number }>(
    `SELECT b.household_id, b.amount_cents, b.share_weight
       FROM bid b
       JOIN (SELECT household_id, MAX(created_at) AS mx
               FROM bid WHERE org_id = ? AND round_id = ?
              GROUP BY household_id) latest
         ON latest.household_id = b.household_id AND latest.mx = b.created_at
      WHERE b.org_id = ? AND b.round_id = ?`,
    [ctx.orgId, roundId, ctx.orgId, roundId],
  );
}

export interface RoundResult {
  bidCount: number;
  totalCents: number;
  targetCents: number;
  /** Guide value per full share, in cents. */
  richtwertCents: number;
  /** Weighted mean bid per share-equivalent, in cents. */
  meanPerShareCents: number;
  differenceCents: number;
  covered: boolean;
  coverageRatio: number;
}

/**
 * Full result. Team/finance only — never exposed to member endpoints.
 */
export async function roundResult(ctx: ModuleContext, roundId: string): Promise<RoundResult> {
  const round = await getRound(ctx, roundId);
  if (!round) throw new Error('Unknown round');

  const bids = await currentBids(ctx, roundId);
  const totalCents = bids.reduce((s, b) => s + b.amount_cents, 0);
  const weightSum = bids.reduce((s, b) => s + b.share_weight, 0);

  const richtwertCents = Math.round(round.target_cents / round.share_equivalents);
  const meanPerShareCents = weightSum > 0 ? Math.round(totalCents / weightSum) : 0;

  return {
    bidCount: bids.length,
    totalCents,
    targetCents: round.target_cents,
    richtwertCents,
    meanPerShareCents,
    differenceCents: totalCents - round.target_cents,
    covered: totalCents >= round.target_cents,
    coverageRatio: round.target_cents === 0 ? 0 : totalCents / round.target_cents,
  };
}

export interface BarState {
  /** 'collecting' until the first batch threshold is reached. */
  phase: 'collecting' | 'showing' | 'final';
  /**
   * Bar position in [-1, 1]: negative = below Richtwert (red),
   * positive = above (green). Deliberately coarse — 20 discrete steps.
   */
  position: number | null;
  /** Never the exact count; a coarse bucket, so the room cannot difference it. */
  participationHint: string;
}

/**
 * THE PROJECTOR VIEW — the only bidding data safe to show a room.
 *
 * Batching + rounding defeat the differencing attack. Note what is absent:
 * no euro amounts, no exact counts, no running average, no bid list.
 */
export async function barState(ctx: ModuleContext, roundId: string): Promise<BarState> {
  const round = await getRound(ctx, roundId);
  if (!round) throw new Error('Unknown round');

  const bids = await currentBids(ctx, roundId);
  const n = bids.length;

  if (round.status === 'closed') {
    const res = await roundResult(ctx, roundId);
    return {
      phase: 'final',
      position: clampRound(res.meanPerShareCents / Math.max(1, res.richtwertCents) - 1),
      participationHint: bucketed(n),
    };
  }

  if (round.display_mode === 'final_only' || n < MIN_BIDS_FOR_LIVE_BAR) {
    return { phase: 'collecting', position: null, participationHint: bucketed(n) };
  }

  // Only reveal on completed batches: the visible count lags behind the real one,
  // so no single bid can be isolated by watching the bar move.
  const revealed = Math.floor(n / round.batch_size) * round.batch_size;
  if (revealed < round.batch_size) {
    return { phase: 'collecting', position: null, participationHint: bucketed(n) };
  }

  const subset = bids.slice(0, revealed);
  const total = subset.reduce((s, b) => s + b.amount_cents, 0);
  const weight = subset.reduce((s, b) => s + b.share_weight, 0);
  const mean = weight > 0 ? total / weight : 0;
  const richtwert = round.target_cents / round.share_equivalents;

  return {
    phase: 'showing',
    position: clampRound(mean / Math.max(1, richtwert) - 1),
    participationHint: bucketed(n),
  };
}

/** Quantise to 20 steps in [-1, 1] so the bar carries ~4 bits, not a number. */
function clampRound(ratio: number): number {
  const clamped = Math.max(-1, Math.min(1, ratio));
  return Math.round(clamped * 20) / 20;
}

function bucketed(n: number): string {
  if (n === 0) return 'none';
  if (n < 5) return 'few';
  if (n < 15) return 'some';
  if (n < 40) return 'many';
  return 'most';
}

export interface HistogramBucket { fromCents: number; toCents: number; count: number }

/**
 * Optional anonymised distribution, off by default (ADR-0005 §5a).
 * Returns null whenever it cannot be shown safely.
 */
export async function histogram(ctx: ModuleContext, roundId: string): Promise<HistogramBucket[] | null> {
  const round = await getRound(ctx, roundId);
  if (!round || !round.histogram_enabled || round.status !== 'closed') return null;

  const bids = await currentBids(ctx, roundId);
  if (bids.length < MIN_BIDS_FOR_HISTOGRAM) return null;

  const perShare = bids
    .map((b) => (b.share_weight > 0 ? b.amount_cents / b.share_weight : b.amount_cents))
    .sort((a, b) => a - b);

  const min = perShare[0]!;
  const max = perShare[perShare.length - 1]!;
  if (max === min) return null;

  // Few, wide buckets: never one bucket per bid.
  const bucketCount = Math.max(3, Math.min(8, Math.floor(perShare.length / MIN_PER_BUCKET)));
  const width = (max - min) / bucketCount;

  const buckets: HistogramBucket[] = Array.from({ length: bucketCount }, (_, i) => ({
    fromCents: Math.round(min + i * width),
    toCents: Math.round(min + (i + 1) * width),
    count: 0,
  }));
  for (const v of perShare) {
    const idx = Math.min(bucketCount - 1, Math.floor((v - min) / width));
    buckets[idx]!.count++;
  }

  // Sparse tails identify individuals — especially at the top end.
  if (buckets.some((b) => b.count > 0 && b.count < MIN_PER_BUCKET)) return null;
  return buckets;
}

/**
 * Individual bids. Team/finance only.
 * Callers MUST pass the acting person so the access is auditable (ADR-0005 §2).
 */
export async function listBidsForFinance(
  ctx: ModuleContext, roundId: string, actingPersonId: string,
): Promise<Array<{ householdId: string; amountCents: number; shareWeight: number; source: string }>> {
  const rows = await currentBids(ctx, roundId);
  await ctx.emit('bidding.amounts_accessed', { roundId, actingPersonId, count: rows.length });
  return rows.map((r) => ({
    householdId: r.household_id,
    amountCents: r.amount_cents,
    shareWeight: r.share_weight,
    source: 'current',
  }));
}

export async function addComment(ctx: ModuleContext, roundId: string, body: string): Promise<void> {
  await ctx.store.run(
    `INSERT INTO bid_comment (id, org_id, round_id, body, created_at) VALUES (?, ?, ?, ?, ?)`,
    [ctx.platform.crypto.randomUUID(), ctx.orgId, roundId, body, ctx.platform.clock.now().toISOString()],
  );
}
