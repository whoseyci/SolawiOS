# ADR-0006 — OpenOlitor: import first, adapter later

**Status:** proposed
**Date:** 2026-07-25
**Refines:** ADR-0001

## Context

Project owner: *"if you can easily build an adapter for Olitor, do that first —
alternatively an import from Olitor into our system; this isn't about competition but
about moving things forward."*

Findings from inspecting the project:

- `OpenOlitor/openolitor-server` — Scala, **actively maintained** (v2.6.46, March 2026;
  3,182 commits), AGPL-3.0 since April 2018 (GPL-3.0 before).
- Architecture is a **REST backend with a separate JS client**, so a machine-readable
  surface exists.
- Persistence is **MySQL/MariaDB**.
- Documentation lives in the project wiki; there is no published, versioned, stable
  public API contract aimed at third-party integrators.

The distinction that matters:

**Import** = one-off or periodic copy of member/share data into Solawi OS. Solawi OS owns
the data afterwards.
**Adapter** = OpenOlitor stays the system of record; Solawi OS reads (and possibly
writes) live.

An adapter is the better end state but carries a hard risk: an internal API with no
third-party stability guarantee can change under us at any release, and we would be
silently broken in production on someone's farm during harvest season.

## Decision

Staged, in this order:

### Stage 1 — Import (build this first)

- CSV/Excel import for members, households, shares, contributions, depots.
- Mapping UI: the farm maps its columns to our fields, with preview and validation.
- Idempotent and repeatable: re-importing updates rather than duplicating.
- **Not OpenOlitor-specific.** Most farms migrating are coming from spreadsheets anyway,
  so this serves the larger group and is the lower-risk build.

*Rationale:* delivers value to every farm, has no dependency on another project's
release cycle, and is a prerequisite for any migration story regardless.

### Stage 2 — Read-only adapter

- Implements the `members` capability interface (ADR-0001) against a live OpenOlitor.
- Read-only: Solawi OS shows members, shares and depots; OpenOlitor stays authoritative.
- Unlocks the actual goal — a farm keeps OpenOlitor for administration and adds
  Solawi OS for field, tooling and founding.
- Marked **experimental** and pinned to tested OpenOlitor versions.

### Stage 3 — Write-back, only if the community wants it

- Not started unilaterally. Requires talking to the OpenOlitor/sunu maintainers first.
- The right long-term form is a documented integration API agreed *with* them, possibly
  contributed by us upstream, rather than a scraper we maintain alone.

### Cross-cutting

- Reach out to OpenOlitor/sunu **before** stage 2, present the scope, and be explicit
  that we are not building a competing administration product.
- Every mapping assumption is documented in `docs/integrations/openolitor.md` with the
  OpenOlitor version it was verified against.
- Licence compatibility is unproblematic in principle: both AGPL-3.0.

## Consequences

**Positive**
- Fastest path to usefulness, with the riskiest dependency deferred.
- Import serves spreadsheet farms too — the majority.
- Keeps the door open for genuine upstream collaboration instead of a fork-by-accident.

**Negative**
- Import-first means the "keep OpenOlitor, add Solawi OS" story is not available at launch.
- Stage 2 carries ongoing maintenance against an unstable-by-nature surface; it may need
  version pinning and will occasionally break.
- Some duplicate data entry during the period when both systems are used with import only.

**Open**
- Does OpenOlitor expose an authentication mode suitable for a service integration, or
  only user sessions? Needs investigation before stage 2 is scheduled.
- Is a MySQL read-replica a more stable integration point than the REST API? Ugly, but
  possibly more durable — decide after inspecting the API surface.
