# ADR-0004 — Hosting: Cloudflare-managed instance + first-class self-hosting

**Status:** proposed
**Date:** 2026-07-25
**Supersedes part of:** ADR-0003 (the "PostgreSQL + PostGIS" cross-cutting assumption)

## Context

Decision from the project owner:

- **Self-hosting is encouraged and documented** (own hardware, or a Cloudflare account
  of one's own).
- A **managed instance on Cloudflare** will additionally be operated for farms that do
  not want to run infrastructure.
- Farms may **optionally share anonymised data** to help other Solawis (see ADR-0006).

These two goals pull in opposite directions. Cloudflare Workers is not a generic server
environment: no long-running processes, no POSIX filesystem, no PostgreSQL by default.
If we build naively against Cloudflare primitives, "self-hosting on your own hardware"
quietly becomes a lie. If we build for a generic VPS and deploy that to Cloudflare, we
throw away exactly what makes Cloudflare attractive.

There is also a direct conflict with ADR-0003, which assumed PostgreSQL + PostGIS.

## Decision

### 1. A portability layer is mandatory from the first line of code

All platform-specific capabilities sit behind narrow interfaces owned by the kernel:

```
Store        relational persistence
BlobStore    photos, documents, exports
KeyValue     config, feature flags
Queue        deferred work, notifications
Realtime     live sessions (bidding, presence)
Scheduler    cron-like recurring jobs
```

Two implementations are maintained **in parallel from day one**, both covered by CI:

| Capability | Cloudflare | Self-host (Node) |
|---|---|---|
| Store | D1 (SQLite) | SQLite file, or PostgreSQL |
| BlobStore | R2 | local filesystem, or S3-compatible |
| KeyValue | Workers KV | SQLite table |
| Queue | Cloudflare Queues | in-process queue, or Redis |
| Realtime | Durable Objects + WebSocket | in-process WebSocket server |
| Scheduler | Cron Triggers | node-cron |

**Rule:** no module imports a Cloudflare type. Ever. A module that does is broken.

*Rationale for the parallel CI:* a self-hosting path that is not continuously tested
degrades into a broken path within two releases. This is the single most likely way this
ADR fails in practice.

### 2. SQLite is the baseline dialect

Because D1 is SQLite, SQLite is the lowest common denominator. PostgreSQL stays
*supported* for large self-hosted installations, but no feature may depend on it.

### 3. No PostGIS — geometry is small enough to handle in application code

This reverses ADR-0003. Honest assessment: a Solawi's spatial data is *tiny* — a few
hundred beds, a handful of fields, some perennial rows. That is kilobytes of GeoJSON.

- Geometry stored as **GeoJSON** in a text column
- Area, centroid, intersection, distance computed in application code (turf.js or similar)
- Bounding boxes stored as plain indexed numeric columns for coarse filtering

Trade-off accepted: no server-side spatial SQL. We lose nothing at this data scale, and
we gain a database that runs identically on a Raspberry Pi and on D1.

### 4. Per-farm isolation via SQLite-backed Durable Objects (managed instance)

On the managed instance each farm gets its own Durable Object with SQLite storage:
strong tenant isolation, data locality near the farm, and a natural home for live
sessions. Self-hosted installs are single-tenant and skip this entirely.

### 5. Consequence for ADR-0003: the stack is effectively decided

Cloudflare Workers means **TypeScript end-to-end** (option A). Options B (Python/Ruby)
and C (CRDT-first) are ruled out for the primary implementation. ADR-0003 should be
updated to `accepted: TypeScript` with this as the stated reason. CRDT ideas survive
only where they matter — additive merge of harvest quantities, per §6 of the domain model.

### 6. Offline-first within these constraints

- PWA with a local SQLite in the browser (OPFS-backed), mirroring the server schema
- Change log per client, synced through a Worker
- Additive merge for quantities; human resolution for genuine conflicts
- No dependency on an app store

## Consequences

**Positive**
- Managed instance is cheap to operate and scales to zero — plausible for a volunteer project.
- Self-hosting stays genuinely viable, including on modest hardware.
- One SQL dialect for everyone; a farm can export its D1 database and run it locally.
- Durable Objects are an unusually good fit for the Bieterrunde (see ADR-0005).

**Negative**
- The portability layer costs real effort and constrains us to the intersection of two
  platforms.
- Two CI targets, two sets of bugs.
- No PostGIS means implementing (a little) geometry ourselves.
- Cloudflare-managed hosting concentrates data with one US provider — mitigated by
  self-hosting being first-class and by data minimisation, but it must be stated openly
  in the privacy policy of the managed instance.

**Open**
- GDPR review for the managed instance: data location, processor agreement, what leaves the EU.
- Cost model: who pays for the managed instance, and what happens if it grows.
