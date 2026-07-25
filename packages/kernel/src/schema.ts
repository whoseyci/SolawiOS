import type { Migration } from './types.js';

/**
 * Kernel schema. Deliberately tiny (docs/20-domaenenmodell.md §2): identity,
 * tenancy, roles, module state, events, audit. No domain concepts whatsoever —
 * no Member, no Bed, no Crop. Those belong to modules.
 *
 * Multi-tenancy: a single database holds many orgs; every domain table carries
 * org_id and every query filters on it. On Cloudflare a farm may additionally be
 * isolated in its own D1 database (ADR-0004 §4); the schema is identical either
 * way, which is what makes both deployment shapes possible.
 */
export const KERNEL_MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: 'kernel: orgs, people, memberships, module state, events, audit',
    statements: [
      `CREATE TABLE IF NOT EXISTS org (
        id           TEXT PRIMARY KEY,
        slug         TEXT NOT NULL UNIQUE,
        name         TEXT NOT NULL,
        phase        TEXT NOT NULL DEFAULT 'founding',
        locale       TEXT NOT NULL DEFAULT 'de',
        jurisdiction TEXT NOT NULL DEFAULT 'de',
        timezone     TEXT NOT NULL DEFAULT 'Europe/Berlin',
        created_at   TEXT NOT NULL,
        archived_at  TEXT
      )`,

      `CREATE TABLE IF NOT EXISTS person (
        id            TEXT PRIMARY KEY,
        email         TEXT NOT NULL,
        display_name  TEXT NOT NULL,
        password_hash TEXT,
        password_salt TEXT,
        locale        TEXT,
        created_at    TEXT NOT NULL,
        disabled_at   TEXT
      )`,
      // Email is unique per instance, not per org: one human, one login, many farms.
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_person_email ON person (lower(email))`,

      `CREATE TABLE IF NOT EXISTS membership (
        org_id     TEXT NOT NULL REFERENCES org(id) ON DELETE CASCADE,
        person_id  TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
        role       TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (org_id, person_id, role)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_membership_person ON membership (person_id)`,

      `CREATE TABLE IF NOT EXISTS session (
        id         TEXT PRIMARY KEY,
        person_id  TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        user_agent TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS idx_session_person ON session (person_id)`,

      `CREATE TABLE IF NOT EXISTS module_state (
        org_id     TEXT NOT NULL REFERENCES org(id) ON DELETE CASCADE,
        module_id  TEXT NOT NULL,
        enabled    INTEGER NOT NULL DEFAULT 0,
        config     TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL,
        PRIMARY KEY (org_id, module_id)
      )`,

      `CREATE TABLE IF NOT EXISTS schema_version (
        module_id  TEXT NOT NULL,
        version    INTEGER NOT NULL,
        applied_at TEXT NOT NULL,
        PRIMARY KEY (module_id, version)
      )`,

      `CREATE TABLE IF NOT EXISTS event_log (
        id      TEXT PRIMARY KEY,
        org_id  TEXT NOT NULL,
        type    TEXT NOT NULL,
        source  TEXT NOT NULL,
        payload TEXT NOT NULL,
        at      TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_event_org_at ON event_log (org_id, at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_event_type ON event_log (org_id, type, at DESC)`,

      // Audit log for access to sensitive data (ADR-0005, ADR-0007).
      `CREATE TABLE IF NOT EXISTS audit_log (
        id         TEXT PRIMARY KEY,
        org_id     TEXT NOT NULL,
        person_id  TEXT,
        action     TEXT NOT NULL,
        subject    TEXT,
        detail     TEXT,
        at         TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_audit_org_at ON audit_log (org_id, at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_audit_subject ON audit_log (org_id, subject, at DESC)`,
    ],
  },
];
