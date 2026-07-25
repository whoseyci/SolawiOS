import type { Kernel } from './kernel.js';
import type { OrgId, PersonId, Role } from './types.js';

const SESSION_DAYS = 30;

export interface AuthedPerson {
  id: PersonId;
  email: string;
  displayName: string;
  locale: string | null;
}

export interface AuthContext {
  person: AuthedPerson;
  orgId: OrgId | null;
  roles: Role[];
}

/**
 * Credential authentication and role checks.
 *
 * Password hashing uses PBKDF2-SHA256 via the platform's Crypto capability,
 * because Workers has no native Argon2/bcrypt. Iterations are deliberately high
 * and constant-time comparison is used for verification.
 */
export class Auth {
  constructor(private readonly kernel: Kernel) {}

  async register(input: {
    email: string; password: string; displayName: string; locale?: string;
  }): Promise<AuthedPerson> {
    const existing = await this.kernel.findPersonByEmail(input.email);
    if (existing) throw new AuthError('email_taken', 'An account with this email already exists.');
    if (input.password.length < 10) {
      throw new AuthError('weak_password', 'Password must be at least 10 characters.');
    }

    const { crypto, clock } = this.kernel.platform;
    const id = crypto.randomUUID();
    const salt = crypto.randomHex(16);
    const hash = await crypto.hashPassword(input.password, salt);

    await this.kernel.store.run(
      `INSERT INTO person (id, email, display_name, password_hash, password_salt, locale, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, input.email, input.displayName, hash, salt, input.locale ?? null, clock.now().toISOString()],
    );
    return { id, email: input.email, displayName: input.displayName, locale: input.locale ?? null };
  }

  /** Verify credentials and open a session. Returns null on any failure. */
  async login(email: string, password: string, userAgent?: string): Promise<{ token: string; person: AuthedPerson } | null> {
    const row = await this.kernel.findPersonByEmail(email);
    // Constant work regardless of whether the account exists, to avoid leaking
    // account existence through response timing.
    const salt = row?.password_salt ?? 'dummy-salt-value';
    const hash = row?.password_hash ?? 'x'.repeat(64);
    const ok = await this.kernel.platform.crypto.verifyPassword(password, salt, hash);

    if (!row || !ok || row.disabled_at) return null;

    const token = await this.openSession(row.id, userAgent);
    return {
      token,
      person: { id: row.id, email: row.email, displayName: row.display_name, locale: row.locale },
    };
  }

  async openSession(personId: PersonId, userAgent?: string): Promise<string> {
    const { crypto, clock } = this.kernel.platform;
    const token = crypto.randomHex(32);
    const now = clock.now();
    const expires = new Date(now.getTime() + SESSION_DAYS * 86_400_000);
    await this.kernel.store.run(
      `INSERT INTO session (id, person_id, created_at, expires_at, user_agent) VALUES (?, ?, ?, ?, ?)`,
      [token, personId, now.toISOString(), expires.toISOString(), userAgent ?? null],
    );
    return token;
  }

  async resolve(token: string | undefined | null): Promise<AuthedPerson | null> {
    if (!token) return null;
    const row = await this.kernel.store.first<{
      person_id: string; expires_at: string;
      email: string; display_name: string; locale: string | null; disabled_at: string | null;
    }>(
      `SELECT s.person_id, s.expires_at, p.email, p.display_name, p.locale, p.disabled_at
         FROM session s JOIN person p ON p.id = s.person_id
        WHERE s.id = ?`,
      [token],
    );
    if (!row || row.disabled_at) return null;
    if (new Date(row.expires_at) < this.kernel.platform.clock.now()) {
      await this.logout(token);
      return null;
    }
    return { id: row.person_id, email: row.email, displayName: row.display_name, locale: row.locale };
  }

  async logout(token: string): Promise<void> {
    await this.kernel.store.run(`DELETE FROM session WHERE id = ?`, [token]);
  }

  async addToOrg(orgId: OrgId, personId: PersonId, roles: Role[]): Promise<void> {
    const now = this.kernel.platform.clock.now().toISOString();
    await this.kernel.store.batch(
      roles.map((role) => ({
        sql: `INSERT OR IGNORE INTO membership (org_id, person_id, role, created_at) VALUES (?, ?, ?, ?)`,
        params: [orgId, personId, role, now],
      })),
    );
  }

  async removeFromOrg(orgId: OrgId, personId: PersonId): Promise<void> {
    await this.kernel.store.run(
      `DELETE FROM membership WHERE org_id = ? AND person_id = ?`, [orgId, personId],
    );
  }
}

/** Role implications: holding the key role grants the listed roles too. */
const IMPLIES: Record<string, Role[]> = {
  owner: ['owner', 'admin', 'finance', 'grower', 'depot', 'member', 'guest'],
  admin: ['admin', 'grower', 'depot', 'member', 'guest'],
  // finance is deliberately NOT implied by admin (ADR-0005): seeing individual
  // bid amounts is a separate grant, so a farm can keep that circle small.
  finance: ['finance', 'member', 'guest'],
  grower: ['grower', 'member', 'guest'],
  depot: ['depot', 'member', 'guest'],
  member: ['member', 'guest'],
  guest: ['guest'],
};

export function expandRoles(roles: readonly Role[]): Set<Role> {
  const out = new Set<Role>();
  for (const r of roles) for (const implied of IMPLIES[r] ?? [r]) out.add(implied);
  return out;
}

export function hasRole(roles: readonly Role[], required: Role): boolean {
  return expandRoles(roles).has(required);
}

export function requireRole(ctx: AuthContext, required: Role): void {
  if (!hasRole(ctx.roles, required)) {
    throw new AuthError('forbidden', `Requires role: ${required}`);
  }
}

export class AuthError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'AuthError';
  }
}
