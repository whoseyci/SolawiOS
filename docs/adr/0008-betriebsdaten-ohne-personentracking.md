# ADR-0008 — Operational data for transparency and optimisation, without tracking people

**Status:** proposed
**Date:** 2026-07-25

## Context

The hand-drawn mindmap has a boxed "Daten?" as one of its four open questions. Clarified
by the project owner:

> Which data would be interesting to collect in order to generate insights — either
> within a running season or across years? Simple example: at what rhythm is a bed
> weeded, watered, harvested? How much is harvested, and why sometimes more, sometimes
> less, sometimes faster, sometimes slower? **This is not about tracking staff** — it is
> about transparency, best practices and optimisation. Another example: mulching or
> weeding one bed while the bed right next to it is due to be planted — it would be
> smarter to do everything else first and plant last, because then you can still
> manoeuvre freely.

This is the most valuable and most dangerous idea in the project so far.

**Valuable**, because nobody in the German-speaking CSA movement has this data. Farms
plan from intuition and the previous year's memory. A farm that knows its actual weeding
rhythms and yield variance plans better, and a movement that shares those figures
improves collectively.

**Dangerous**, because the distance between "this bed was weeded 6 times" and "Anna
weeds slower than Bernd" is one join. Every workforce-surveillance system in history was
built from data collected for optimisation, usually sincerely. The line has to be drawn
in the data model, not in a policy document, because policies change and schemas persist.

## Decision

### 1. The unit of observation is the **bed**, never the person

Operational records attach to a place and a time, not to a worker.

```
Observation
  bed / area        where            REQUIRED
  activity          what             REQUIRED   (weeding, watering, harvest, mulching …)
  timestamp         when             REQUIRED
  quantity          how much         optional   (kg, bunches, minutes)
  conditions        context          optional   (weather, soil state)
  note              why              optional   (free text: "very dry", "flea beetle")
```

There is **no person column on `Observation`.** Not nullable, not optional, not
"for later" — absent. A schema without the column cannot grow a report that uses it.

### 2. Who did it is recorded separately, and only where it has an operational purpose

Some tasks genuinely need an assignee: someone must know who is milking on Sunday, and
`participation` must avoid overloading the same five people. That lives in `tasks` and
`participation` as an assignment — *forward-looking*, "who will do this".

The **completion record** that feeds analysis is the `Observation`, and it does not carry
the assignee forward. The link is deliberately cut at the point where planning becomes
history.

### 3. Prohibited analyses, stated explicitly

The following are not features to be prioritised later. They are **out of scope
permanently**, and a contribution implementing one should be rejected on sight:

- per-person throughput, speed, or output
- comparison of individuals, ranking, leaderboards, "top helper"
- per-person reliability, punctuality or no-show statistics
- any metric where an individual is the unit of analysis in an operational context

Aggregate labour figures **are** allowed and needed — "this crop cost 40 hours per 100 m²
this season" — because the unit is the crop, not the human.

### 4. Aggregation floors

Where a figure could resolve to one person's work (a task only one member ever does),
suppress it. Same reasoning as the neighbour-count floor in ADR-0007: small *n* turns an
aggregate into an identification.

### 5. What the data is actually for

Three concrete uses, in increasing ambition:

**a) Rhythms** — how often is a bed actually weeded, watered, harvested? Compare to plan.
Most farms genuinely do not know, and the answer changes next year's labour budget.

**b) Yield variance with causes** — not just "we harvested 180 kg" but "180 kg, three
weeks late, after a cold May". Over years this becomes the only realistic basis for
planning, and it is exactly what the anonymised commons (ADR-0007) should carry.

**c) Work sequencing** — the owner's manoeuvring example. This is a *planning* problem,
not an analysis one: tasks have a spatial and temporal order, and getting it wrong costs
real work. Specified as a **sequencing assistant** in `tasks`:

> Given the tasks due on adjacent beds this week, suggest an order that avoids working
> over ground that is about to be disturbed, avoids compacting beds due for planting, and
> groups tasks by the tool they need.
>
> It suggests. It never assigns, and it never assigns to a named person.

### 6. Capture must be near-free, or it will not happen

The binding constraint is not analysis, it is data entry. A gardener with wet hands in
November will not fill in a form.

- one tap from the bed view: "weeded" / "watered" / "harvested"
- quantity optional; a record without a number is still useful for rhythm analysis
- fully offline, syncing later (ADR-0004)
- voice note as an acceptable observation body — transcription later, never blocking
- **never a mandatory field.** A required field converts a useful dataset into a fictional one.

## Consequences

**Positive**
- The farm learns its own rhythms and variance, which is the foundation for every other
  insight in the project.
- The structural guarantee is credible to members and staff: there is no person column,
  so there is nothing to promise about how it will be used.
- Feeds the commons dataset (ADR-0007) with genuinely novel, genuinely non-personal data.
- The sequencing assistant delivers value from the same data without any analytics UI.

**Negative**
- Cutting the assignment→observation link means some legitimate questions are
  unanswerable ("did the new volunteer's training help?"). Accepted deliberately; that
  question is better answered by asking the person.
- Voluntary, optional capture produces uneven data. Better uneven and honest than
  complete and coerced.
- Aggregation floors will occasionally hide figures a small farm wanted to see.

**Open**
- Does `livestock` need an exception? Animal welfare records may legally require naming
  who administered a treatment. If so, that is a separate, legally-mandated record — not
  an `Observation`, and never an input to analysis.
- Sensor data (soil moisture, weather stations) fits this model cleanly and could be
  added later; deliberately out of scope for now.
