# ADR-0001 — Relationship to OpenOlitor and existing CSA admin tools

**Status:** proposed
**Date:** 2026-07-25

## Context

Established open-source CSA administration software exists, most notably
[OpenOlitor](https://openolitor.org) (AGPL-3.0, Scala, maintained by Tegonal with the
Swiss OpenOlitor association and German non-profit sunu), plus juntagrico (Django, mainly
Switzerland) and ACP Admin (mainly France/Switzerland). They cover member management,
shares, delivery planning, invoicing and SEPA direct debit, and OpenOlitor is already
multilingual.

Solawi OS targets areas these tools do not cover: the founding journey, the field/plot
layer, tooling and infrastructure, and a long-term development/metrics layer.

Rebuilding member administration would duplicate mature work, split a small contributor
community, and force farms into a migration they did not ask for.

## Decision

1. Solawi OS treats member administration as an **optional, replaceable module**.
2. We define a stable internal capability interface for member/share data. Two
   implementations are foreseen: a native `members` module, and an **adapter** backed by
   an existing system (OpenOlitor first).
3. Before building any administrative feature that overlaps with OpenOlitor, we evaluate
   whether contributing upstream is the better path, and record the reasoning.
4. We publish our data models openly and make import/export mandatory in every module.
5. We approach the OpenOlitor/sunu community early, present the scope, and look for
   collaboration rather than competition.

## Consequences

**Positive**
- Farms already on OpenOlitor can adopt Solawi OS for field, tooling and founding without
  migrating their member data.
- Avoids the most expensive and legally sensitive work (payments, SEPA, invoicing).
- Positions the project as complementary, easing community acceptance.

**Negative**
- The capability interface must be general enough for two very different backends, which
  costs design effort and constrains the native module.
- Dependence on an external project's data model and release cycle for adapter users.
- Two supported paths mean more testing surface.

**Open**
- Adapter technology depends on OpenOlitor's API surface; needs investigation.
- If the adapter proves impractical, this ADR should be superseded rather than quietly
  ignored.
