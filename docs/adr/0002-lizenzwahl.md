# ADR-0002 — Licence

**Status:** proposed
**Date:** 2026-07-25

## Context

Solawi OS is intended as a commons for the CSA movement. The relevant risk is not someone
reading the code — it is a provider running a closed, modified fork as a hosted service
and giving nothing back, while farms become dependent on it.

Web delivery is the expected deployment model (farms will mostly use hosted instances),
which is exactly the gap the AGPL closes relative to the GPL. OpenOlitor, the most
relevant neighbouring project, is AGPL-3.0, so compatibility eases mutual code exchange.

Content (guides, checklists, jurisdiction packs, crop data) is not code and benefits from
a licence built for documents and data reuse.

## Decision

- **Code: AGPL-3.0-or-later.** Network use triggers the obligation to share modifications.
- **Content and documentation: CC BY-SA 4.0.** Covers `content/` and `docs/`.
- **Crop and cultivation base data: CC0 / public domain dedication**, so it can flow into
  any project, including non-copyleft ones. Shared agronomic facts should have no friction.
- Every contribution carries a Developer Certificate of Origin sign-off. **No CLA** — we
  do not want the power to relicense, and asking volunteers to sign away rights would
  contradict the project's premise.

## Consequences

**Positive**
- Hosted forks must publish their changes; the commons stays a commons.
- Licence compatibility with OpenOlitor enables code sharing in both directions.
- No CLA lowers the barrier for casual contributors.

**Negative**
- AGPL deters some commercial contributors and integrators.
- Without a CLA, relicensing later is effectively impossible — accepted deliberately.
- Mixed licensing requires clear per-directory documentation to avoid confusion.

**Note**
- Jurisdiction packs may contain material derived from official or third-party sources
  with their own terms; each pack must state its provenance and licence separately.
