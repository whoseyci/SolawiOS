import type { Platform, Store } from '@solawi/platform';
import type {
  OrgId, PersonId, Role, Phase, DomainEvent, ModuleContext, Logger, SolawiModule,
} from './types.js';
import { Registry } from './registry.js';
import { KERNEL_MIGRATIONS } from './schema.js';
import { Translator } from '@solawi/i18n';

export interface OrgRecord {
  id: OrgId;
  slug: string;
  name: string;
  phase: Phase;
  locale: string;
  jurisdiction: string;
  timezone: string;
  created_at: string;
  archived_at: string | null;
}

/**
 * The kernel. Owns tenancy, identity, module state, events and audit — and
 * nothing else. It knows the *word* "module" but no module's contents.
 */
export class Kernel {
  readonly registry: Registry;
  private readonly enabledCache = new Map<OrgId, Set<string>>();

  constructor(
    readonly platform: Platform,
    readonly log: Logger,
    readonly translator: Translator,
  ) {
    this.registry = new Registry(platform, log);
  }

  get store(): Store { return this.platform.store; }

  use(...mods: SolawiModule[]): this {
    for (const m of mods) this.registry.add(m);
    return this;
  }

  /** Apply kernel + module migrations. Safe to run repeatedly. */
  async migrate(): Promise<{ applied: number }> {
    let applied = 0;
    // Kernel first: everything else has foreign keys into org/person.
    for (const m of KERNEL_MIGRATIONS) {
      if (await this.isApplied('kernel', m.version)) continue;
      for (const sql of m.statements) await this.store.run(sql);
      await this.markApplied('kernel', m.version);
      applied++;
    }
    for (const mig of this.registry.allMigrations()) {
      if (await this.isApplied(mig.moduleId, mig.version)) continue;
      for (const sql of mig.statements) await this.store.run(sql);
      await this.markApplied(mig.moduleId, mig.version);
      applied++;
    }
    this.log.info('migrations complete', { applied, flavour: this.platform.flavour });
    return { applied };
  }

  private async isApplied(moduleId: string, version: number): Promise<boolean> {
    try {
      const row = await this.store.first<{ n: number }>(
        `SELECT COUNT(*) AS n FROM schema_version WHERE module_id = ? AND version = ?`,
        [moduleId, version],
      );
      return (row?.n ?? 0) > 0;
    } catch {
      return false; // schema_version itself does not exist yet
    }
  }

  private async markApplied(moduleId: string, version: number): Promise<void> {
    await this.store.run(
      `INSERT OR IGNORE INTO schema_version (module_id, version, applied_at) VALUES (?, ?, ?)`,
      [moduleId, version, this.platform.clock.now().toISOString()],
    );
  }

  // ---------------------------------------------------------------- orgs

  async createOrg(input: {
    slug: string; name: string; phase?: Phase;
    locale?: string; jurisdiction?: string; timezone?: string;
  }): Promise<OrgRecord> {
    const id = this.platform.crypto.randomUUID();
    const now = this.platform.clock.now().toISOString();
    const rec: OrgRecord = {
      id,
      slug: input.slug,
      name: input.name,
      phase: input.phase ?? 'founding',
      locale: input.locale ?? 'de',
      jurisdiction: input.jurisdiction ?? 'de',
      timezone: input.timezone ?? 'Europe/Berlin',
      created_at: now,
      archived_at: null,
    };
    await this.store.run(
      `INSERT INTO org (id, slug, name, phase, locale, jurisdiction, timezone, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [rec.id, rec.slug, rec.name, rec.phase, rec.locale, rec.jurisdiction, rec.timezone, now],
    );
    return rec;
  }

  async getOrg(id: OrgId): Promise<OrgRecord | null> {
    return this.store.first<OrgRecord>(`SELECT * FROM org WHERE id = ?`, [id]);
  }

  async getOrgBySlug(slug: string): Promise<OrgRecord | null> {
    return this.store.first<OrgRecord>(`SELECT * FROM org WHERE slug = ?`, [slug]);
  }

  async setPhase(orgId: OrgId, phase: Phase): Promise<void> {
    await this.store.run(`UPDATE org SET phase = ? WHERE id = ?`, [phase, orgId]);
  }

  // ------------------------------------------------------- module state

  /**
   * Enabled module ids for an org. Cached per request-scoped kernel instance;
   * callers that mutate state must call invalidate().
   */
  async enabledModules(orgId: OrgId): Promise<ReadonlySet<string>> {
    const hit = this.enabledCache.get(orgId);
    if (hit) return hit;
    const rows = await this.store.all<{ module_id: string }>(
      `SELECT module_id FROM module_state WHERE org_id = ? AND enabled = 1`,
      [orgId],
    );
    const set = new Set(rows.map((r) => r.module_id));
    this.enabledCache.set(orgId, set);
    return set;
  }

  invalidate(orgId: OrgId): void { this.enabledCache.delete(orgId); }

  /**
   * Enable or disable a module.
   *
   * Disabling never deletes data (docs/40 §3.3) — it hides the module. Deleting
   * is a separate, explicit operation.
   */
  async setModuleEnabled(orgId: OrgId, moduleId: string, enabled: boolean): Promise<void> {
    if (!this.registry.get(moduleId)) throw new Error(`Unknown module: ${moduleId}`);
    const now = this.platform.clock.now().toISOString();
    await this.store.run(
      `INSERT INTO module_state (org_id, module_id, enabled, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (org_id, module_id) DO UPDATE SET enabled = excluded.enabled, updated_at = excluded.updated_at`,
      [orgId, moduleId, enabled ? 1 : 0, now],
    );
    this.invalidate(orgId);
  }

  async getModuleConfig<T = Record<string, unknown>>(orgId: OrgId, moduleId: string): Promise<T> {
    const row = await this.store.first<{ config: string }>(
      `SELECT config FROM module_state WHERE org_id = ? AND module_id = ?`, [orgId, moduleId],
    );
    return (row ? JSON.parse(row.config) : {}) as T;
  }

  async setModuleConfig(orgId: OrgId, moduleId: string, config: unknown): Promise<void> {
    const now = this.platform.clock.now().toISOString();
    await this.store.run(
      `INSERT INTO module_state (org_id, module_id, enabled, config, updated_at)
       VALUES (?, ?, 0, ?, ?)
       ON CONFLICT (org_id, module_id) DO UPDATE SET config = excluded.config, updated_at = excluded.updated_at`,
      [orgId, moduleId, JSON.stringify(config), now],
    );
  }

  // ------------------------------------------------------------- events

  async emit(orgId: OrgId, type: string, payload: unknown, source: string): Promise<void> {
    const at = this.platform.clock.now().toISOString();
    const event: DomainEvent = { type, orgId, at, payload, source };
    await this.store.run(
      `INSERT INTO event_log (id, org_id, type, source, payload, at) VALUES (?, ?, ?, ?, ?, ?)`,
      [this.platform.crypto.randomUUID(), orgId, type, source, JSON.stringify(payload), at],
    );
    const enabled = await this.enabledModules(orgId);
    await this.registry.dispatch(event, enabled);
  }

  // -------------------------------------------------------------- audit

  /** Record access to sensitive data. Never optional where an ADR requires it. */
  async audit(input: {
    orgId: OrgId; personId?: PersonId | null; action: string;
    subject?: string; detail?: Record<string, unknown>;
  }): Promise<void> {
    await this.store.run(
      `INSERT INTO audit_log (id, org_id, person_id, action, subject, detail, at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        this.platform.crypto.randomUUID(), input.orgId, input.personId ?? null,
        input.action, input.subject ?? null,
        input.detail ? JSON.stringify(input.detail) : null,
        this.platform.clock.now().toISOString(),
      ],
    );
  }

  // ------------------------------------------------------------ context

  /** Build the context handed to a module for one operation. */
  contextFor(orgId: OrgId, moduleId: string, locale = 'de'): ModuleContext {
    const self = this;
    return {
      orgId,
      platform: this.platform,
      store: this.platform.store,
      log: this.log,
      async emit(type, payload) { await self.emit(orgId, type, payload, moduleId); },
      async ask<R>(capability: string, ...args: unknown[]): Promise<R> {
        const enabled = await self.enabledModules(orgId);
        return self.registry.ask<R>(capability, this as ModuleContext, enabled, args);
      },
      t(key, vars) { return self.translator.t(locale, key, vars); },
    };
  }

  // ------------------------------------------------------------- people

  async findPersonByEmail(email: string) {
    return this.store.first<{
      id: string; email: string; display_name: string;
      password_hash: string | null; password_salt: string | null;
      locale: string | null; disabled_at: string | null;
    }>(`SELECT * FROM person WHERE lower(email) = lower(?)`, [email]);
  }

  async rolesFor(orgId: OrgId, personId: PersonId): Promise<Role[]> {
    const rows = await this.store.all<{ role: string }>(
      `SELECT role FROM membership WHERE org_id = ? AND person_id = ?`, [orgId, personId],
    );
    return rows.map((r) => r.role as Role);
  }

  /** Orgs this person belongs to, for the farm switcher. */
  async orgsFor(personId: PersonId): Promise<Array<OrgRecord & { roles: string }>> {
    return this.store.all<OrgRecord & { roles: string }>(
      `SELECT o.*, group_concat(m.role) AS roles
         FROM org o JOIN membership m ON m.org_id = o.id
        WHERE m.person_id = ? AND o.archived_at IS NULL
        GROUP BY o.id
        ORDER BY o.name`,
      [personId],
    );
  }
}
