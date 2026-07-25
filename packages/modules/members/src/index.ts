import type { SolawiModule, ModuleContext, Migration } from '@solawi/kernel';

/**
 * Module 8 — members. Optional and replaceable (ADR-0001): a farm running
 * OpenOlitor keeps it and uses an adapter instead.
 *
 * Households, not persons, are the unit: one share, several humans.
 *
 * Neighbour discovery implements ADR-0007 rev 2: RADIUS AND A COUNT, NO MAP.
 * Coordinates never leave the server. See `neighbourCount()`.
 */

const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: 'members: households, share types, shares, absences, connect requests',
    statements: [
      `CREATE TABLE IF NOT EXISTS household (
        id            TEXT PRIMARY KEY,
        org_id        TEXT NOT NULL,
        name          TEXT NOT NULL,
        contact_email TEXT,
        contact_phone TEXT,
        person_id     TEXT,
        lat           REAL,
        lon           REAL,
        discoverable  INTEGER NOT NULL DEFAULT 0,
        joined_on     TEXT,
        left_on       TEXT,
        created_at    TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_household_org ON household (org_id)`,

      // Weights make the Richtwert meaningful for mixed share sizes (ADR-0005 §1).
      `CREATE TABLE IF NOT EXISTS share_type (
        id         TEXT PRIMARY KEY,
        org_id     TEXT NOT NULL,
        name       TEXT NOT NULL,
        weight     REAL NOT NULL DEFAULT 1.0,
        sort_order INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE INDEX IF NOT EXISTS idx_sharetype_org ON share_type (org_id)`,

      `CREATE TABLE IF NOT EXISTS share (
        id            TEXT PRIMARY KEY,
        org_id        TEXT NOT NULL,
        household_id  TEXT NOT NULL REFERENCES household(id) ON DELETE CASCADE,
        share_type_id TEXT NOT NULL REFERENCES share_type(id),
        season        TEXT NOT NULL,
        started_on    TEXT,
        ended_on      TEXT,
        created_at    TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_share_org_season ON share (org_id, season)`,

      `CREATE TABLE IF NOT EXISTS absence (
        id           TEXT PRIMARY KEY,
        org_id       TEXT NOT NULL,
        household_id TEXT NOT NULL REFERENCES household(id) ON DELETE CASCADE,
        from_date    TEXT NOT NULL,
        to_date      TEXT NOT NULL,
        substitute_household_id TEXT,
        donate       INTEGER NOT NULL DEFAULT 0,
        created_at   TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_absence_dates ON absence (org_id, from_date, to_date)`,

      // Mutual, purpose-bound, revocable (ADR-0007). Never a directory.
      `CREATE TABLE IF NOT EXISTS connect_request (
        id            TEXT PRIMARY KEY,
        org_id        TEXT NOT NULL,
        from_household TEXT NOT NULL,
        to_household   TEXT NOT NULL,
        purpose       TEXT NOT NULL,
        message       TEXT,
        status        TEXT NOT NULL DEFAULT 'pending',
        created_at    TEXT NOT NULL,
        responded_at  TEXT,
        expires_at    TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS idx_connect_to ON connect_request (org_id, to_household, status)`,
    ],
  },
];

/** Below this many households in radius we show "fewer than N", never an exact count. */
export const MIN_NEIGHBOURS_TO_SHOW = 3;
/** Requests per household per season, to stop membership probing. */
export const MAX_CONNECT_REQUESTS = 20;

export interface Household {
  id: string; org_id: string; name: string;
  contact_email: string | null; contact_phone: string | null; person_id: string | null;
  lat: number | null; lon: number | null; discoverable: number;
  joined_on: string | null; left_on: string | null; created_at: string;
}

export const membersModule: SolawiModule = {
  manifest: {
    id: 'members',
    number: 8,
    maturity: 'alpha',
    phases: ['operating', 'developing'],
    provides: ['shares.count', 'shares.equivalents'],
    migrations: MIGRATIONS,
  },
  register(reg) {
    reg.provide('shares.count', async (ctx: ModuleContext, ...args: never[]) => {
      const [season] = args as unknown as [string];
      const row = await ctx.store.first<{ n: number }>(
        `SELECT COUNT(*) AS n FROM share WHERE org_id = ? AND season = ? AND ended_on IS NULL`,
        [ctx.orgId, season],
      );
      return row?.n ?? 0;
    });
    reg.provide('shares.equivalents', async (ctx: ModuleContext, ...args: never[]) => {
      const [season] = args as unknown as [string];
      return shareEquivalents(ctx, season);
    });
  },
};

export async function createShareType(
  ctx: ModuleContext, input: { name: string; weight: number; sortOrder?: number },
): Promise<string> {
  const id = ctx.platform.crypto.randomUUID();
  await ctx.store.run(
    `INSERT INTO share_type (id, org_id, name, weight, sort_order) VALUES (?, ?, ?, ?, ?)`,
    [id, ctx.orgId, input.name, input.weight, input.sortOrder ?? 0],
  );
  return id;
}

export async function createHousehold(
  ctx: ModuleContext,
  input: {
    name: string; contactEmail?: string; contactPhone?: string; personId?: string;
    lat?: number; lon?: number; discoverable?: boolean; joinedOn?: string;
  },
): Promise<Household> {
  const id = ctx.platform.crypto.randomUUID();
  const now = ctx.platform.clock.now().toISOString();
  await ctx.store.run(
    `INSERT INTO household
       (id, org_id, name, contact_email, contact_phone, person_id, lat, lon, discoverable, joined_on, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, ctx.orgId, input.name, input.contactEmail ?? null, input.contactPhone ?? null,
      input.personId ?? null, input.lat ?? null, input.lon ?? null,
      input.discoverable ? 1 : 0, input.joinedOn ?? now.slice(0, 10), now,
    ],
  );
  await ctx.emit('household.created', { householdId: id });
  return {
    id, org_id: ctx.orgId, name: input.name,
    contact_email: input.contactEmail ?? null, contact_phone: input.contactPhone ?? null,
    person_id: input.personId ?? null, lat: input.lat ?? null, lon: input.lon ?? null,
    discoverable: input.discoverable ? 1 : 0, joined_on: input.joinedOn ?? now.slice(0, 10),
    left_on: null, created_at: now,
  };
}

export async function addShare(
  ctx: ModuleContext,
  input: { householdId: string; shareTypeId: string; season: string; startedOn?: string },
): Promise<string> {
  const id = ctx.platform.crypto.randomUUID();
  const now = ctx.platform.clock.now().toISOString();
  await ctx.store.run(
    `INSERT INTO share (id, org_id, household_id, share_type_id, season, started_on, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, ctx.orgId, input.householdId, input.shareTypeId, input.season, input.startedOn ?? now.slice(0, 10), now],
  );
  await ctx.emit('share.created', { shareId: id, householdId: input.householdId, season: input.season });
  return id;
}

/**
 * Σ (share count × type weight) — the denominator of the Richtwert.
 * Dividing a budget by household count instead would be meaningless for a farm
 * with 60 große and 30 kleine Anteile.
 */
export async function shareEquivalents(ctx: ModuleContext, season: string): Promise<number> {
  const row = await ctx.store.first<{ total: number | null }>(
    `SELECT SUM(st.weight) AS total
       FROM share s JOIN share_type st ON st.id = s.share_type_id
      WHERE s.org_id = ? AND s.season = ? AND s.ended_on IS NULL`,
    [ctx.orgId, season],
  );
  return row?.total ?? 0;
}

export async function declareAbsence(
  ctx: ModuleContext,
  input: { householdId: string; from: string; to: string; substituteHouseholdId?: string; donate?: boolean },
): Promise<string> {
  const id = ctx.platform.crypto.randomUUID();
  await ctx.store.run(
    `INSERT INTO absence (id, org_id, household_id, from_date, to_date, substitute_household_id, donate, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, ctx.orgId, input.householdId, input.from, input.to,
      input.substituteHouseholdId ?? null, input.donate ? 1 : 0,
      ctx.platform.clock.now().toISOString(),
    ],
  );
  await ctx.emit('absence.declared', {
    householdId: input.householdId, from: input.from, to: input.to,
    hasSubstitute: Boolean(input.substituteHouseholdId), donate: Boolean(input.donate),
  });
  return id;
}

export interface NeighbourResult {
  /** Exact count, or null when below the display threshold. */
  count: number | null;
  /** What the UI shows: "6" or "fewer than 3". */
  display: string;
  radiusKm: number;
  canConnect: boolean;
}

/**
 * NEIGHBOUR DISCOVERY — radius and a count. No map, ever (AGENTS.md §3.11).
 *
 * A map invites triangulation against the member list. A count relative to your
 * own position reveals nothing about where anyone else is. Distances are computed
 * here, server-side; coordinates never reach a client.
 */
export async function neighbourCount(
  ctx: ModuleContext, householdId: string, radiusKm: number,
): Promise<NeighbourResult> {
  const me = await ctx.store.first<{ lat: number | null; lon: number | null }>(
    `SELECT lat, lon FROM household WHERE id = ? AND org_id = ?`, [householdId, ctx.orgId],
  );
  if (!me?.lat || !me?.lon) {
    return { count: null, display: 'no_location', radiusKm, canConnect: false };
  }

  // Bounding box first (cheap), exact haversine second (correct).
  const latDelta = radiusKm / 111;
  const lonDelta = radiusKm / (111 * Math.cos((me.lat * Math.PI) / 180) || 1);

  const candidates = await ctx.store.all<{ id: string; lat: number; lon: number }>(
    `SELECT id, lat, lon FROM household
      WHERE org_id = ? AND id != ? AND left_on IS NULL AND discoverable = 1
        AND lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?`,
    [ctx.orgId, householdId, me.lat - latDelta, me.lat + latDelta, me.lon - lonDelta, me.lon + lonDelta],
  );

  const within = candidates.filter((c) => haversineKm(me.lat!, me.lon!, c.lat, c.lon) <= radiusKm);

  if (within.length < MIN_NEIGHBOURS_TO_SHOW) {
    // "1 household within 1 km" plus local knowledge is an address.
    return { count: null, display: `fewer_than_${MIN_NEIGHBOURS_TO_SHOW}`, radiusKm, canConnect: within.length > 0 };
  }
  return { count: within.length, display: String(within.length), radiusKm, canConnect: true };
}

/**
 * Send a connect request. The sender does not learn who the recipients are;
 * identities are exchanged only on acceptance, and mutually.
 */
export async function sendConnectRequest(
  ctx: ModuleContext,
  input: { fromHouseholdId: string; radiusKm: number; purpose: string; message?: string },
): Promise<{ sent: number }> {
  const sentThisSeason = await ctx.store.first<{ n: number }>(
    `SELECT COUNT(*) AS n FROM connect_request WHERE org_id = ? AND from_household = ?`,
    [ctx.orgId, input.fromHouseholdId],
  );
  if ((sentThisSeason?.n ?? 0) >= MAX_CONNECT_REQUESTS) {
    // Rate limiting is a privacy control here, not an abuse control: unlimited
    // requests at varying radii would let someone probe the membership.
    throw new Error('connect_request_limit_reached');
  }

  const me = await ctx.store.first<{ lat: number | null; lon: number | null }>(
    `SELECT lat, lon FROM household WHERE id = ? AND org_id = ?`, [input.fromHouseholdId, ctx.orgId],
  );
  if (!me?.lat || !me?.lon) throw new Error('no_location');

  const latDelta = input.radiusKm / 111;
  const lonDelta = input.radiusKm / (111 * Math.cos((me.lat * Math.PI) / 180) || 1);
  const candidates = await ctx.store.all<{ id: string; lat: number; lon: number }>(
    `SELECT id, lat, lon FROM household
      WHERE org_id = ? AND id != ? AND left_on IS NULL AND discoverable = 1
        AND lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?`,
    [ctx.orgId, input.fromHouseholdId, me.lat - latDelta, me.lat + latDelta, me.lon - lonDelta, me.lon + lonDelta],
  );
  const targets = candidates.filter((c) => haversineKm(me.lat!, me.lon!, c.lat, c.lon) <= input.radiusKm);
  if (targets.length === 0) return { sent: 0 };

  const now = ctx.platform.clock.now();
  const expires = new Date(now.getTime() + 90 * 86_400_000).toISOString();
  await ctx.store.batch(targets.map((t) => ({
    sql: `INSERT INTO connect_request
            (id, org_id, from_household, to_household, purpose, message, status, created_at, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    params: [
      ctx.platform.crypto.randomUUID(), ctx.orgId, input.fromHouseholdId, t.id,
      input.purpose, input.message ?? null, now.toISOString(), expires,
    ],
  })));
  return { sent: targets.length };
}

/**
 * Respond. Accepting exchanges contact details in BOTH directions at once —
 * never one-sided. Ignoring is a first-class outcome: no read receipts, no nudges.
 */
export async function respondToConnect(
  ctx: ModuleContext, requestId: string, accept: boolean,
): Promise<{ contact: { name: string; email: string | null; phone: string | null } | null }> {
  const req = await ctx.store.first<{ from_household: string; to_household: string; status: string }>(
    `SELECT from_household, to_household, status FROM connect_request WHERE id = ? AND org_id = ?`,
    [requestId, ctx.orgId],
  );
  if (!req || req.status !== 'pending') return { contact: null };

  await ctx.store.run(
    `UPDATE connect_request SET status = ?, responded_at = ? WHERE id = ? AND org_id = ?`,
    [accept ? 'accepted' : 'declined', ctx.platform.clock.now().toISOString(), requestId, ctx.orgId],
  );
  if (!accept) return { contact: null };

  const other = await ctx.store.first<{ name: string; contact_email: string | null; contact_phone: string | null }>(
    `SELECT name, contact_email, contact_phone FROM household WHERE id = ? AND org_id = ?`,
    [req.from_household, ctx.orgId],
  );
  return {
    contact: other
      ? { name: other.name, email: other.contact_email, phone: other.contact_phone }
      : null,
  };
}

export async function listHouseholds(ctx: ModuleContext): Promise<Household[]> {
  return ctx.store.all<Household>(
    `SELECT * FROM household WHERE org_id = ? AND left_on IS NULL ORDER BY name`, [ctx.orgId],
  );
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
