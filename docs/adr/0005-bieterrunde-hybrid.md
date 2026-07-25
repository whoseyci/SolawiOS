# ADR-0005 — Bieterrunde: hybrid on-site, sealed during the round

**Status:** proposed
**Date:** 2026-07-25
**Revision:** 3 — rev 1 proposed cryptographically separating identity from amount (broke
billing). Rev 2 kept an encryption-at-rest "sealing" mechanism. Rev 3 removes sealing
too: the team is meant to see the numbers when needed, and key management was
unjustified complexity. See §2.

## Context

How the round should run (from the project owner):

1. Physical meeting for everyone who wants to attend, with a presentation
   ("what do we need, and what for").
2. The team **starts the round in the app**.
3. Members **enter their bids digitally** on their own devices.
4. A desktop projection shows progress against the *Richtwert*.
5. The team can **enter paper slips** for members who are not comfortable with the app.

## 1. The Richtwert is a mean — over share-equivalents, not over households

Confirmed: `Richtwert = total required ÷ shares`, i.e. the arithmetic mean.

**But shares are not uniform.** crowd salat has ~60 große and ~30 kleine Anteile. Dividing
by 90 households would produce a meaningless number. The model therefore needs:

```
ShareType        name, weight (große = 1.0, kleine = 0.5, …), configurable per farm
share_equiv      Σ (count of each type × its weight)
Richtwert        budget ÷ share_equiv      → "guide value per full share"
```

Every bid is **normalised to its share weight** before entering the average. A household
with a half share bidding 60 € contributes the same as a full share bidding 120 €. The
bar compares like with like, and each member sees their own guide value
(`Richtwert × own weight`), not the abstract full-share figure.

Weights are a farm-level setting. Some farms use 3+ tiers, some use none.

## 2. Bids are ordinary records; the team can see them

Revision 1 proposed separate tables with no foreign key. Revision 2 kept encryption at
rest during the round. **Both were over-engineered and are dropped.**

The treasurer must know who owes what — SEPA mandates, contracts, payment tracking and
dunning all require it. The team must be able to look at the numbers when something needs
sorting out. A system where the people running the Solawi cannot see their own data is
not more ethical, it is just broken, and it would push the real work back into a
spreadsheet where there are no protections at all.

**Model:**

- `Bid(round, household, amount, share_type)` — a normal record with a normal foreign key.
- **The team can read individual bids at any time**, during and after the round.
- **Other members never see individual amounts.** Not in the app, not in exports, not in
  aggregates fine-grained enough to difference. This is the boundary that actually matters.
- Access to individual amounts is bound to a role and written to the audit log — not to
  restrict the team, but so that access is traceable and members can see the rules are real.
- Amounts never enter the anonymised commons in any form (ADR-0007 already forbids this).

**No encryption-at-rest sealing, no key escrow, no unsealing step.** The threat this
guarded against — someone at the laptop reacting to a bid mid-round — is a social
question, not a cryptographic one, and it is handled by the display rules in §3, which
already keep individual amounts off the projector.

## 3. Two display modes, both built

Per the owner's request, the farm chooses:

### Mode A — Semi-live bar

A bar swinging right into green (above Richtwert) or left into red (below), updating
during the round. Because a naive live average leaks individual bids by differencing
(`bid = avg(n+1)·(n+1) − avg(n)·n`, recoverable from two photos of the projector), Mode A
applies:

- **Batching** — updates only after ≥ *k* new bids (default 5, never below 3)
- **Jitter** — update timing randomised, so a movement cannot be tied to the person who
  just submitted
- **Position, not number** — no euro figure, no running average, no bid count on screen
- **Edge suppression** — "collecting…" below the first threshold; the final movement is
  released only after the round closes, so the last bid is not isolatable

The room learns *are we above or below?*, which is the only question it needs, and
individuals stay unexposed even to a person photographing the screen.

### Mode B — Final reveal only

No live display. A neutral "X of Y households have submitted" progress indicator, then
the result is revealed once when the round closes.

**Mode B is the default for farms below ~15 bids**, where no amount of batching makes a
live bar safe. It is also the honest choice for communities that find the live bar
creates exactly the pressure the secret round is meant to remove.

Both modes are the same underlying round; only the projection differs.

## 4. Paper slips

- Entered by the team through a dedicated flow; the household is recorded, since billing
  needs it.
- Recommended practice, shown in-app: collect in a box, enter after the round rather than
  one-by-one as they arrive, ideally four-eyes. This is guidance, not enforcement.
- Slips and digital bids are indistinguishable in the result.

## 5. Multiple rounds, and revisions append

- Rounds are explicit objects; round 2 typically follows a comment phase if round 1 falls short.
- Members see their own previous bid and may revise it.
- **Revisions append rather than overwrite** (owner decision). Each bid is an immutable
  record with a timestamp; the current bid is the latest one for that household in that
  round. This preserves the history of how a round developed, which is genuinely useful
  for understanding whether a second round actually moved the community or just
  reshuffled it.
- Consequence to handle: bid history is sensitive data with a longer life. It is covered
  by the same role restriction and audit logging, is excluded from exports by default,
  and is deleted with the household on departure.
- Comments are anonymous and stored detached from amounts — this separation *is* safe,
  because comments have no billing function.

## 5a. Distribution histogram — optional, off by default

Owner decision: make it **optional**. After a round closes, a farm may enable an
anonymised histogram of the bid distribution for members.

- Off by default; enabled per farm, per round.
- Buckets are wide and their number adapts to *n*; never one bucket per bid.
- Suppressed entirely below a minimum number of bids (default 15) and whenever any
  bucket would contain fewer than 3 bids — sparse tails are where individuals become
  identifiable, especially at the top end.
- Shows shape only: no counts on the axis fine enough to reconstruct individual amounts.

Value: a community seeing that the distribution is genuinely spread — that solidarity is
happening — is one of the strongest arguments for the Bieterrunde model. Worth offering,
not worth forcing.

## 6. Technical shape

A round is a live, transient, single-farm session: one **Durable Object** per round
holding session state, fanning out WebSocket updates to the projector and enforcing the
batching rules in one place. Falls back to the self-hosted in-process WebSocket server
per ADR-0004.

## Consequences

**Positive**
- Billing, SEPA and contracts work normally — the treasurer and team have the data they need.
- No key management, no unsealing step, no way to lose a round to a lost key.
- Two modes let each community choose its own culture; small farms are not pushed into an
  unsafe live display.
- Share weighting makes the Richtwert meaningful for mixed share sizes.
- Append-only history shows how rounds actually developed.

**Negative**
- Mode A is deliberately less responsive than a smooth live line, and this needs
  explaining in the UI or it reads as lag.
- Individual amounts existing in plain form means **access control and audit logging carry
  the entire privacy burden**. That is the normal, correct place for it — but it must
  actually be implemented, not assumed.
- Append-only bid history extends the retention of sensitive data; needs deletion on
  household departure and exclusion from default exports.

**Open**
- Should the *finance role* be separable from *team admin* in small farms where one
  person is both? Probably a soft distinction (a confirmation step) rather than a hard one.
