# ADR-0007 — Member location data, consent-based sharing, and the anonymised commons

**Status:** proposed
**Date:** 2026-07-25

## Context

Two related decisions from the project owner:

**A. Neighbour discovery.** Members should see *who lives nearby* and either approach
them in person or **send an in-app request to share data** for carpooling and similar.
Data is shared **only on request, with consent**. Postcode grid as the default resolution.

**B. Anonymised sharing between farms.** Self-hosting instances can optionally share
anonymised data to help other Solawis.

Both are good ideas with sharp edges. Location data about named individuals is among the
most sensitive data a Solawi holds, and "anonymised" is a word that is very often wrong.

## Decision A — Neighbour discovery by radius, never by map

**Revision 2.** Revision 1 proposed a postcode/grid map. The owner proposed something
better: **no map at all** — just a radius and a count.

> "# Households within #km — want to connect?"

This is a genuine improvement, not merely a simplification. A map invites triangulation:
cells, boundaries and counts can be cross-referenced against a member list. A single
count relative to *your own* position reveals nothing about where anyone else is. The
user gets the only fact they actually need, and the system gives away nothing else.

### How it works

- Each member optionally stores a precise location. It is **never sent to any client**.
- The server computes distances and returns **one number**: how many households are
  within the chosen radius.
- Radius is member-selectable — 1 / 2 / 5 / 10 km (upper end matters for rural farms).
- No map, no dots, no direction, no cell, no "nearest is 800 m away".

### Minimum count before display

If the count is below a threshold (default 3), show **"fewer than 3"** rather than the
exact number. Otherwise "1 household within 1 km" plus local knowledge is an
identification. Rural members simply widen the radius until the count is usable.

### The connect flow

1. Alice sees "6 households within 5 km — want to connect?"
2. She sends a request: purpose (carpool / share a pickup / other), a short message, and
   what she offers in return. It goes to those households **without revealing to Alice
   who they are**.
3. Recipients may accept, decline, or ignore. **Ignoring is a first-class outcome** —
   no read receipts, no reminders, no "3 people haven't replied".
4. On acceptance, contact details are exchanged **mutually** — Alice learns who Bob is at
   the same moment Bob learns who Alice is. No one-sided reveal.
5. The share is purpose-bound, revocable in one click without justification, and expires
   at season end unless renewed.

### Hard rules

- Precise coordinates never leave the server. All distance computation is server-side.
- Rate-limit requests per member per season. Without this, someone can probe the
  membership by sending requests at varying radii and correlating who responds.
- Counts are computed fresh, not cached per member — a cached count that changes when a
  new member joins leaks that member's approximate location.
- Delivery-to-door farms hold precise addresses for logistics in `distribution`. Those
  are for delivery only and are **not** a source for neighbour discovery.
- Every use of precise location is audit-logged and visible to the member concerned.

### What this replaces

No member map, no postcode grid, no "who lives near me" directory. If a farm genuinely
wants a member map, that is a separate, explicitly opt-in feature with its own decision —
not a side effect of carpooling.

## Decision B — The anonymised commons

### What may be shared

Only **farm-level aggregates**, never member-level records:

- yields per crop per area, sowing and harvest dates, crop failures and their causes
- planning accuracy (planned vs. actual)
- founding milestones: how long each step actually took
- pitfalls encountered (the `Stolperfallen` contributions)
- coarse structural facts: size class, region class, distribution mode, participation model

### What may never be shared

- anything about individuals, including k-anonymised individuals
- **contribution amounts and bidding data in any form** — this is the most sensitive
  financial data in a Solawi and it does not leave the farm, full stop
- precise farm location (region class only)
- free text that has not been reviewed by a human at the farm

### Mechanics

- **Off by default.** Sharing is an explicit decision by the farm, taken once and
  reviewable at any time.
- **Preview before every submission**: the farm sees exactly the payload that would be
  sent, in plain language, and confirms.
- **Farm-level consent is not enough where individuals could be implicated** — which is
  precisely why the shareable set above is restricted to agronomic and process data.
- Small-number suppression: aggregates computed from too few observations are withheld
  rather than published.
- Withdrawal removes the farm's future contributions; already-aggregated statistics
  cannot be un-mixed, and this is stated plainly *before* the first submission rather
  than buried in terms.

### Why this is worth doing anyway

A shared, honest dataset of "what actually yields how much, and how long founding really
takes" does not exist for the German-speaking CSA movement. It is the single most
valuable thing a network of instances could produce, and it is achievable **without
touching a single personal record.**

## Consequences

**Positive**
- Carpooling and pickup-sharing become possible without building a member address directory.
- Default-private with an easy opt-in tends to produce genuine, informed participation.
- The commons dataset creates a network effect that no single farm could generate.

**Negative**
- A count with no map is less immediately gratifying than seeing dots, and some members
  will ask for the map. The reasoning above needs to be visible in the UI, not buried.
- Minimum-count suppression means sparse rural members must widen the radius to see anything.
- Aggregate-only sharing rules out some analyses people will ask for.

**Open**
- Should the requester be able to target a subset ("only households that already offered
  carpooling") without that becoming a filterable directory? Probably yes via
  self-declared tags, but it needs care.
- Governance of the commons dataset: who curates it, who may query it, under what licence
  (CC0 per ADR-0002 is the intent, but for derived statistics this needs confirming).

## Resolved

- ~~Grid resolution / postcode vs. geographic grid~~ — dropped entirely in revision 2.
  Radius + count replaces the map, which removes the question.
