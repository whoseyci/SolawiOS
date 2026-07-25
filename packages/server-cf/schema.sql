-- GENERATED FILE — do not edit.
-- Regenerate with: npm run schema
--
-- Idempotent: safe to run against a fresh or an existing database.
-- Schema changes belong in a module migration, not here.

-- ============================================================
-- kernel
-- ============================================================

-- v1: kernel: orgs, people, memberships, module state, events, audit
CREATE TABLE IF NOT EXISTS org (
        id           TEXT PRIMARY KEY,
        slug         TEXT NOT NULL UNIQUE,
        name         TEXT NOT NULL,
        phase        TEXT NOT NULL DEFAULT 'founding',
        locale       TEXT NOT NULL DEFAULT 'de',
        jurisdiction TEXT NOT NULL DEFAULT 'de',
        timezone     TEXT NOT NULL DEFAULT 'Europe/Berlin',
        created_at   TEXT NOT NULL,
        archived_at  TEXT
      );

CREATE TABLE IF NOT EXISTS person (
        id            TEXT PRIMARY KEY,
        email         TEXT NOT NULL,
        display_name  TEXT NOT NULL,
        password_hash TEXT,
        password_salt TEXT,
        locale        TEXT,
        created_at    TEXT NOT NULL,
        disabled_at   TEXT
      );

CREATE UNIQUE INDEX IF NOT EXISTS idx_person_email ON person (lower(email));

CREATE TABLE IF NOT EXISTS membership (
        org_id     TEXT NOT NULL REFERENCES org(id) ON DELETE CASCADE,
        person_id  TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
        role       TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (org_id, person_id, role)
      );

CREATE INDEX IF NOT EXISTS idx_membership_person ON membership (person_id);

CREATE TABLE IF NOT EXISTS session (
        id         TEXT PRIMARY KEY,
        person_id  TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        user_agent TEXT
      );

CREATE INDEX IF NOT EXISTS idx_session_person ON session (person_id);

CREATE TABLE IF NOT EXISTS module_state (
        org_id     TEXT NOT NULL REFERENCES org(id) ON DELETE CASCADE,
        module_id  TEXT NOT NULL,
        enabled    INTEGER NOT NULL DEFAULT 0,
        config     TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL,
        PRIMARY KEY (org_id, module_id)
      );

CREATE TABLE IF NOT EXISTS schema_version (
        module_id  TEXT NOT NULL,
        version    INTEGER NOT NULL,
        applied_at TEXT NOT NULL,
        PRIMARY KEY (module_id, version)
      );

CREATE TABLE IF NOT EXISTS event_log (
        id      TEXT PRIMARY KEY,
        org_id  TEXT NOT NULL,
        type    TEXT NOT NULL,
        source  TEXT NOT NULL,
        payload TEXT NOT NULL,
        at      TEXT NOT NULL
      );

CREATE INDEX IF NOT EXISTS idx_event_org_at ON event_log (org_id, at DESC);

CREATE INDEX IF NOT EXISTS idx_event_type ON event_log (org_id, type, at DESC);

CREATE TABLE IF NOT EXISTS audit_log (
        id         TEXT PRIMARY KEY,
        org_id     TEXT NOT NULL,
        person_id  TEXT,
        action     TEXT NOT NULL,
        subject    TEXT,
        detail     TEXT,
        at         TEXT NOT NULL
      );

CREATE INDEX IF NOT EXISTS idx_audit_org_at ON audit_log (org_id, at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_subject ON audit_log (org_id, subject, at DESC);

-- ============================================================
-- founding (module 1)
-- ============================================================

-- v1: founding: milestone progress and pitfall acknowledgements
CREATE TABLE IF NOT EXISTS founding_milestone (
        org_id       TEXT NOT NULL,
        milestone_id TEXT NOT NULL,
        status       TEXT NOT NULL DEFAULT 'open',
        note         TEXT,
        due_at       TEXT,
        completed_at TEXT,
        updated_at   TEXT NOT NULL,
        PRIMARY KEY (org_id, milestone_id)
      );

CREATE INDEX IF NOT EXISTS idx_founding_status ON founding_milestone (org_id, status);

CREATE TABLE IF NOT EXISTS founding_pitfall_seen (
        org_id     TEXT NOT NULL,
        pitfall_id TEXT NOT NULL,
        seen_at    TEXT NOT NULL,
        PRIMARY KEY (org_id, pitfall_id)
      );

-- ============================================================
-- land (module 3)
-- ============================================================

-- v1: land: fields, beds, features, perennials, soil samples
CREATE TABLE IF NOT EXISTS land_field (
        id         TEXT PRIMARY KEY,
        org_id     TEXT NOT NULL,
        name       TEXT NOT NULL,
        geometry   TEXT,
        area_sqm   REAL,
        soil_note  TEXT,
        created_at TEXT NOT NULL,
        retired_at TEXT
      );

CREATE INDEX IF NOT EXISTS idx_field_org ON land_field (org_id);

CREATE TABLE IF NOT EXISTS land_bed (
        id          TEXT PRIMARY KEY,
        org_id      TEXT NOT NULL,
        field_id    TEXT NOT NULL REFERENCES land_field(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        geometry    TEXT,
        length_m    REAL,
        width_m     REAL,
        area_sqm    REAL,
        kind        TEXT NOT NULL DEFAULT 'bed',
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL,
        retired_at  TEXT
      );

CREATE INDEX IF NOT EXISTS idx_bed_org_field ON land_bed (org_id, field_id);

CREATE TABLE IF NOT EXISTS land_feature (
        id         TEXT PRIMARY KEY,
        org_id     TEXT NOT NULL,
        field_id   TEXT REFERENCES land_field(id) ON DELETE SET NULL,
        kind       TEXT NOT NULL,
        name       TEXT NOT NULL,
        geometry   TEXT,
        note       TEXT,
        created_at TEXT NOT NULL
      );

CREATE INDEX IF NOT EXISTS idx_feature_org ON land_feature (org_id, kind);

CREATE TABLE IF NOT EXISTS land_perennial (
        id           TEXT PRIMARY KEY,
        org_id       TEXT NOT NULL,
        field_id     TEXT REFERENCES land_field(id) ON DELETE SET NULL,
        bed_id       TEXT REFERENCES land_bed(id) ON DELETE SET NULL,
        species      TEXT NOT NULL,
        variety      TEXT,
        planted_on   TEXT NOT NULL,
        expected_years INTEGER,
        removed_on   TEXT,
        geometry     TEXT,
        note         TEXT,
        created_at   TEXT NOT NULL
      );

CREATE INDEX IF NOT EXISTS idx_perennial_org ON land_perennial (org_id);

CREATE TABLE IF NOT EXISTS land_soil_sample (
        id         TEXT PRIMARY KEY,
        org_id     TEXT NOT NULL,
        field_id   TEXT NOT NULL REFERENCES land_field(id) ON DELETE CASCADE,
        taken_on   TEXT NOT NULL,
        ph         REAL,
        humus_pct  REAL,
        nutrients  TEXT,
        note       TEXT
      );

CREATE INDEX IF NOT EXISTS idx_soil_field ON land_soil_sample (org_id, field_id, taken_on DESC);

-- ============================================================
-- cultivation (module 4)
-- ============================================================

-- v1: cultivation: crops, varieties, plantings
CREATE TABLE IF NOT EXISTS cult_crop (
        id             TEXT PRIMARY KEY,
        org_id         TEXT NOT NULL,
        botanical_name TEXT NOT NULL,
        family         TEXT NOT NULL,
        display_name   TEXT NOT NULL,
        synonyms       TEXT,
        days_to_harvest INTEGER,
        rotation_years  INTEGER NOT NULL DEFAULT 3,
        yield_per_sqm   REAL,
        created_at     TEXT NOT NULL
      );

CREATE INDEX IF NOT EXISTS idx_crop_org ON cult_crop (org_id);

CREATE INDEX IF NOT EXISTS idx_crop_family ON cult_crop (org_id, family);

CREATE TABLE IF NOT EXISTS cult_planting (
        id            TEXT PRIMARY KEY,
        org_id        TEXT NOT NULL,
        crop_id       TEXT NOT NULL REFERENCES cult_crop(id) ON DELETE CASCADE,
        bed_id        TEXT NOT NULL,
        variety       TEXT,
        stage         TEXT NOT NULL DEFAULT 'planned',
        sown_on       TEXT,
        planted_on    TEXT,
        harvest_from  TEXT,
        harvest_to    TEXT,
        cleared_on    TEXT,
        expected_kg   REAL,
        actual_kg     REAL,
        note          TEXT,
        created_at    TEXT NOT NULL
      );

CREATE INDEX IF NOT EXISTS idx_planting_org_bed ON cult_planting (org_id, bed_id);

CREATE INDEX IF NOT EXISTS idx_planting_dates ON cult_planting (org_id, harvest_from, harvest_to);

-- ============================================================
-- tasks (module 5)
-- ============================================================

-- v1: tasks: work items with location, window, tool and skill needs
CREATE TABLE IF NOT EXISTS task (
        id             TEXT PRIMARY KEY,
        org_id         TEXT NOT NULL,
        title          TEXT NOT NULL,
        activity       TEXT,
        bed_id         TEXT,
        window_from    TEXT,
        window_to      TEXT,
        urgency        TEXT NOT NULL DEFAULT 'soft',
        est_minutes    INTEGER,
        needs_tool     TEXT,
        needs_skill    TEXT,
        weather_dependent INTEGER NOT NULL DEFAULT 0,
        recurrence_days INTEGER,
        status         TEXT NOT NULL DEFAULT 'open',
        assigned_to    TEXT,
        completed_at   TEXT,
        created_at     TEXT NOT NULL
      );

CREATE INDEX IF NOT EXISTS idx_task_org_status ON task (org_id, status, window_to);

CREATE INDEX IF NOT EXISTS idx_task_bed ON task (org_id, bed_id);

-- ============================================================
-- members (module 8)
-- ============================================================

-- v1: members: households, share types, shares, absences, connect requests
CREATE TABLE IF NOT EXISTS household (
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
      );

CREATE INDEX IF NOT EXISTS idx_household_org ON household (org_id);

CREATE TABLE IF NOT EXISTS share_type (
        id         TEXT PRIMARY KEY,
        org_id     TEXT NOT NULL,
        name       TEXT NOT NULL,
        weight     REAL NOT NULL DEFAULT 1.0,
        sort_order INTEGER NOT NULL DEFAULT 0
      );

CREATE INDEX IF NOT EXISTS idx_sharetype_org ON share_type (org_id);

CREATE TABLE IF NOT EXISTS share (
        id            TEXT PRIMARY KEY,
        org_id        TEXT NOT NULL,
        household_id  TEXT NOT NULL REFERENCES household(id) ON DELETE CASCADE,
        share_type_id TEXT NOT NULL REFERENCES share_type(id),
        season        TEXT NOT NULL,
        started_on    TEXT,
        ended_on      TEXT,
        created_at    TEXT NOT NULL
      );

CREATE INDEX IF NOT EXISTS idx_share_org_season ON share (org_id, season);

CREATE TABLE IF NOT EXISTS absence (
        id           TEXT PRIMARY KEY,
        org_id       TEXT NOT NULL,
        household_id TEXT NOT NULL REFERENCES household(id) ON DELETE CASCADE,
        from_date    TEXT NOT NULL,
        to_date      TEXT NOT NULL,
        substitute_household_id TEXT,
        donate       INTEGER NOT NULL DEFAULT 0,
        created_at   TEXT NOT NULL
      );

CREATE INDEX IF NOT EXISTS idx_absence_dates ON absence (org_id, from_date, to_date);

CREATE TABLE IF NOT EXISTS connect_request (
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
      );

CREATE INDEX IF NOT EXISTS idx_connect_to ON connect_request (org_id, to_household, status);

-- ============================================================
-- bidding (module 9)
-- ============================================================

-- v1: bidding: rounds, bids (append-only), anonymous comments
CREATE TABLE IF NOT EXISTS bid_round (
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
      );

CREATE INDEX IF NOT EXISTS idx_round_org ON bid_round (org_id, season, ordinal);

CREATE TABLE IF NOT EXISTS bid (
        id            TEXT PRIMARY KEY,
        org_id        TEXT NOT NULL,
        round_id      TEXT NOT NULL REFERENCES bid_round(id) ON DELETE CASCADE,
        household_id  TEXT NOT NULL,
        amount_cents  INTEGER NOT NULL,
        share_weight  REAL NOT NULL DEFAULT 1.0,
        source        TEXT NOT NULL DEFAULT 'digital',
        created_at    TEXT NOT NULL
      );

CREATE INDEX IF NOT EXISTS idx_bid_round ON bid (org_id, round_id, household_id, created_at DESC);

CREATE TABLE IF NOT EXISTS bid_comment (
        id         TEXT PRIMARY KEY,
        org_id     TEXT NOT NULL,
        round_id   TEXT NOT NULL REFERENCES bid_round(id) ON DELETE CASCADE,
        body       TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

-- ============================================================
-- observations (module 22)
-- ============================================================

-- v1: observations: bed-scoped operational records (no person column, by design)
CREATE TABLE IF NOT EXISTS observation (
        id          TEXT PRIMARY KEY,
        org_id      TEXT NOT NULL,
        bed_id      TEXT NOT NULL,
        activity    TEXT NOT NULL,
        observed_at TEXT NOT NULL,
        quantity    REAL,
        unit        TEXT,
        minutes     INTEGER,
        conditions  TEXT,
        note        TEXT,
        device_id   TEXT,
        created_at  TEXT NOT NULL
      );

CREATE INDEX IF NOT EXISTS idx_obs_bed_time ON observation (org_id, bed_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_obs_activity ON observation (org_id, activity, observed_at DESC);

-- ============================================================
-- feedback (module 23)
-- ============================================================

-- v1: feedback: locally stored reports with GitHub delivery state
CREATE TABLE IF NOT EXISTS feedback_report (
        id            TEXT PRIMARY KEY,
        org_id        TEXT NOT NULL,
        kind          TEXT NOT NULL,
        title         TEXT NOT NULL,
        body          TEXT NOT NULL,
        severity      TEXT NOT NULL DEFAULT 'normal',
        context       TEXT NOT NULL DEFAULT '{}',
        reporter_hint TEXT,
        status        TEXT NOT NULL DEFAULT 'pending',
        issue_number  INTEGER,
        issue_url     TEXT,
        error         TEXT,
        attempts      INTEGER NOT NULL DEFAULT 0,
        created_at    TEXT NOT NULL,
        delivered_at  TEXT
      );

CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback_report (status, created_at);

CREATE INDEX IF NOT EXISTS idx_feedback_org ON feedback_report (org_id, created_at DESC);

-- ============================================================
-- migration bookkeeping
-- ============================================================

INSERT OR IGNORE INTO schema_version (module_id, version, applied_at) VALUES ('kernel', 1, '2026-07-25T12:17:02.933Z');
INSERT OR IGNORE INTO schema_version (module_id, version, applied_at) VALUES ('founding', 1, '2026-07-25T12:17:02.933Z');
INSERT OR IGNORE INTO schema_version (module_id, version, applied_at) VALUES ('land', 1, '2026-07-25T12:17:02.933Z');
INSERT OR IGNORE INTO schema_version (module_id, version, applied_at) VALUES ('cultivation', 1, '2026-07-25T12:17:02.933Z');
INSERT OR IGNORE INTO schema_version (module_id, version, applied_at) VALUES ('tasks', 1, '2026-07-25T12:17:02.933Z');
INSERT OR IGNORE INTO schema_version (module_id, version, applied_at) VALUES ('members', 1, '2026-07-25T12:17:02.933Z');
INSERT OR IGNORE INTO schema_version (module_id, version, applied_at) VALUES ('bidding', 1, '2026-07-25T12:17:02.933Z');
INSERT OR IGNORE INTO schema_version (module_id, version, applied_at) VALUES ('observations', 1, '2026-07-25T12:17:02.933Z');
INSERT OR IGNORE INTO schema_version (module_id, version, applied_at) VALUES ('feedback', 1, '2026-07-25T12:17:02.933Z');
