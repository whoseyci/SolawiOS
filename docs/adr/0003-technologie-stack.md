# ADR-0003 — Technology stack

**Status:** superseded by [ADR-0004](0004-hosting-und-plattform.md)
**Date:** 2026-07-25

> **Outcome:** the hosting decision in ADR-0004 (Cloudflare-managed instance + first-class
> self-hosting) forces **option A, TypeScript end-to-end**. It also reverses the
> "PostgreSQL + PostGIS" assumption below in favour of SQLite as the baseline dialect
> with GeoJSON geometry handled in application code. This document is kept for the
> reasoning; read ADR-0004 for what actually applies.

## Context

Constraints that actually drive the choice, in order of weight:

1. **Offline-first in the field.** Gardeners work without connectivity; writes must
   succeed locally and sync later. This is the hardest constraint and should dominate.
2. **Modularity.** Modules must be separately buildable, activatable and removable
   without breaking the kernel.
3. **Contributor pool.** A volunteer-driven agriculture project cannot depend on a niche
   language. The realistic contributor is a web developer donating evenings.
4. **Self-hosting on modest hardware.** Many farms will run this on a small VPS. A stack
   needing a Kubernetes cluster is disqualified.
5. **Longevity.** This should still build in ten years. Fashionable churn is a real risk.
6. **Map rendering, offline capable.** Required by `land` and `cultivation`.

## Decision

Deferred. The following directions are on the table and need a spike each before a
decision:

**A. TypeScript end-to-end** — shared types across client and server, largest contributor
pool, mature local-first ecosystem, strong PWA/offline story. Risk: ecosystem churn.

**B. Server-rendered Python or Ruby with a thin offline client** — simpler operation,
excellent data/reporting libraries, familiar to many civic-tech contributors. Risk:
offline-first is bolted on rather than native.

**C. Local-first with CRDTs as the foundation** — solves sync properly instead of
patching it, and matches the field reality best. Risk: smaller ecosystem, higher
conceptual barrier, harder for casual contributors.

Cross-cutting choices that likely hold regardless:
- **PostgreSQL** with PostGIS for spatial data
- **Vector tiles** for offline maps; no dependency on a commercial map provider
- **PWA before native apps** — installing from an app store is a barrier, and app store
  review is a poor fit for a volunteer project
- **ICU MessageFormat** for i18n, Weblate-compatible catalogues

## Consequences

- Concept work (`docs/`, `content/`) proceeds independently and is not blocked by this.
- Each spike must implement the same vertical slice — record a harvest offline on a
  phone, sync it, see it in the plot view — so the comparison is real rather than
  theoretical.
- Whoever runs the spikes documents operational cost on a single small VPS, not just
  developer experience.
