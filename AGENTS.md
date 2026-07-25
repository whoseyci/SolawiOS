# AGENTS.md — Working agreement for AI agents and contributors

This file is the entry point for any AI agent (or human) working in this repository.
**It is a living document: every substantial change to the repo should leave this file
accurate.** If you finish a task and something here became wrong, fix it in the same
change.

---

## 1. What this project is

Solawi OS is a modular, open-source operating system for CSA farms
(*Solidarische Landwirtschaft* / Community Supported Agriculture), covering the full
lifecycle: **founding → daily operations → long-term development**.

Read before touching anything:
1. `docs/00-konzept.md` — the vision and scope
2. `docs/10-modulkatalog.md` — what modules exist and their maturity
3. `docs/20-domaenenmodell.md` — the domain model and module boundaries

Current phase: **alpha — running code**. The monorepo builds, tests pass, and both
platform targets boot. `docs/` remains the source of truth for *intent*; when code and
docs disagree, that is a bug in one of them — fix it, do not paper over it.

Quick start: `npm install && npm run verify` (typecheck + tests), then
`npm run dev` for a local server on :8787. See `DEPLOY.md`.

## 2. Language policy — read this carefully

This trips people up constantly, so it is explicit:

| Layer | Language | Rationale |
|---|---|---|
| Code, identifiers, types, DB columns | **English** | Contributor accessibility; avoids `MitgliedRepository` / `getMitglied` hybrids |
| Code comments, commit messages, PR titles | **English** | Same |
| `AGENTS.md`, ADRs, technical READMEs in `packages/` | **English** | Aimed at contributors, incl. non-German |
| `docs/*.md` (concept, module catalogue, domain) | **German** | Aimed at Solawi practitioners, our primary stakeholders |
| UI strings | **German is the source locale**, everything else translated from it | Primary user base |
| Domain terms with no good English equivalent | Keep German, define once in the glossary | `Bieterrunde`, `Ernteanteil`, `Depot` |

**Glossary is authoritative:** `docs/20-domaenenmodell.md#glossar`. If you introduce a
domain term, add it there. Never silently translate a domain term — `Bieterrunde` is not
"auction", and calling it one will produce a wrong feature.

## 2a. Decided architecture (read the ADRs before proposing alternatives)

| Area | Decision | ADR |
|---|---|---|
| Platform | Cloudflare Workers for the managed instance; **self-hosting is first-class**, both targets in CI | 0004 |
| Language | **TypeScript end-to-end** | 0004 (supersedes 0003) |
| Database | **SQLite is the baseline dialect** (D1 on CF, file locally). PostgreSQL optional, never required | 0004 |
| Geometry | GeoJSON in text columns, computed in app code. **No PostGIS** | 0004 |
| Bidding | Hybrid on-site; bids are **ordinary records the team can read**; peer-privacy is the boundary; two display modes (semi-live bar / final reveal); revisions append; optional histogram | 0005 |
| OpenOlitor | Import first, read-only adapter second, write-back only by agreement | 0006 |
| Member location | **Radius + count, no map.** Coordinates never leave the server; mutual consented exchange | 0007 |
| Operational data | Observations attach to **beds, never people**. No person column, by design | 0008 |

## 3. Non-negotiable architecture rules

1. **The kernel stays small.** If a feature can live in a module, it lives in a module.
   Anything you want to add to the kernel needs an ADR.
2. **Modules never import each other directly.** They communicate through the event bus
   and through capability interfaces declared by the kernel. A Solawi that disables
   `cultivation` must still boot.
3. **No hardcoded strings in UI code.** Ever. Not even placeholders, not even "TODO".
   Use the i18n layer from the first commit of any component.
4. **No jurisdiction assumptions in code.** German legal forms, tax rules, SEPA specifics
   and deadlines live in *content packs* (`content/jurisdictions/de/`), not in `if` branches.
   See `docs/30-i18n-und-lokalisierung.md`.
5. **Offline-first is a constraint, not a feature.** Any write path that assumes
   connectivity is a bug. Assume a phone in a field with no signal and a cracked screen.
6. **Personal data is minimised by default.** Before adding a field to a member record,
   justify it in the PR description. Precise location never leaves the server; members
   see only a count within a radius (ADR-0007), and contact details are exchanged only by
   mutual consent.
7. **The software advises, the community decides.** Never auto-execute anything with
   social or financial consequences (assigning work, changing contributions, removing
   members). Suggest, explain the reasoning, let a human confirm.
8. **No module may import a platform-specific type.** Cloudflare types live behind the
   kernel's capability interfaces (`Store`, `BlobStore`, `KeyValue`, `Queue`, `Realtime`,
   `Scheduler`). A module that imports from a CF namespace is broken by definition.
   The self-hosted target must stay green in CI — an untested self-host path rots within
   two releases.
9. **Bid amounts are peer-private, not team-private.** Bids are ordinary records linked to
   households; the team can read them whenever they need to, and billing depends on it.
   What must never happen is *members seeing each other's amounts*. Role-bind and
   audit-log access, keep amounts out of exports and out of the commons. **Do not add
   encryption, sealing or key escrow** — that was tried in ADR-0005 rev 2 and rejected as
   unjustified complexity that gets in the team's way.
10. **Aggregates can leak individuals.** Before displaying or exporting any aggregate,
    ask whether differencing it over time, or over a small population, reveals a person.
    Apply batching, rounding and minimum-count suppression. This shaped the live bidding
    bar and the neighbour count; assume it applies to your feature too.
11. **Never ship a member map.** Neighbour discovery is a radius and a count, computed
    server-side. Precise coordinates never reach a client. A map invites triangulation
    against the member list; a count relative to your own position reveals nothing.
12. **`Observation` has no person column.** Operational records attach to a bed and a
    time. Task *assignment* (forward-looking, "who will do this") lives in `tasks`; the
    completion record that feeds analysis does not carry the assignee forward. Per-person
    throughput, speed, rankings and reliability stats are **permanently out of scope** —
    reject such contributions rather than deferring them. Aggregate labour per crop is
    fine: the unit is the crop, not the human. See ADR-0008.

## 4. Working style expected from agents

- **Ask before inventing domain facts.** If you don't know how a Bieterrunde is run, ask
  or research it — do not guess and encode the guess. Wrong domain assumptions are the
  most expensive kind of error in this repo.
- **Small, reviewable changes.** One concern per change.
- **Cite sources for domain claims.** If a doc asserts something about German
  association law or CSA practice, it carries a source link.
- **Prefer deleting to adding.** This project's main risk is bloat.
- **Never invent references.** No fake ADR numbers, no links to files that don't exist,
  no citations to sources you haven't read.

## 5. Repo conventions

```
docs/                 German concept & design documents (numbered by topic)
docs/adr/             Architecture Decision Records, NNNN-kebab-title.md, English
docs/integrations/    Per-integration mapping notes incl. verified upstream versions
content/              Localisable non-code content (guides, checklists, crop data)
content/jurisdictions/<iso>/   Legal & fiscal content per jurisdiction
packages/
  web/                the PWA (Vite, no framework, offline-first)
  platform/           capability INTERFACES only (Store, BlobStore, Queue, Realtime, …)
  platform-cf/        Cloudflare implementation (D1, R2, KV, Durable Objects)
  platform-node/      self-host implementation (SQLite, filesystem, in-process)
  kernel/             tenancy, identity, roles, module registry, events, audit
  i18n/               Translator, plural rules, Intl formatting
  modules/<name>/     one directory per catalogue module
  app/                HTTP routes, locale catalogues, module wiring
  server-cf/          Workers entry point + BiddingRoom Durable Object
  server-node/        self-hosted entry point
tests/                cross-cutting tests, incl. the privacy guarantee suite
```

**Adding a module:** create `packages/modules/<id>/`, export a `SolawiModule` with a
manifest (id, catalogue number, maturity, migrations), register it in
`packages/app/src/modules.ts`, add a tsconfig reference. Tables are prefixed with the
module id. Never import another module — use events and capabilities.

**ADRs**: any decision that is expensive to reverse gets one. Format: Context → Decision
→ Consequences → Status (`proposed` / `accepted` / `superseded by NNNN`). Never edit an
accepted ADR's decision; supersede it with a new one.

**Module maturity** is tracked in `docs/10-modulkatalog.md` as one of
`idea` → `spec` → `alpha` → `stable`. Keep it honest; an over-claimed maturity is worse
than an ambitious one.

## 5a. A caution learned the hard way

Three designs in this repo were rejected for the same reason: **privacy engineering that
broke the actual job.** Separated bid tables broke billing. Encrypted sealing blocked the
team from its own numbers. A postcode grid map was more complex *and* less private than a
plain radius count.

Before adding a protection mechanism, ask: *who is the realistic adversary, and does this
stop them?* In a Solawi the adversary is almost never the treasurer — it is peer
visibility, casual browsing, and data leaving the farm. Protections that obstruct the
people doing the work push them back to spreadsheets, where there are no protections at all.

## 6. Maintaining this file

Update `AGENTS.md` when you:
- add or remove a module, or change a module boundary
- accept an ADR that changes any rule in §3
- change the repo layout in §5
- discover a recurring misunderstanding worth documenting (add it to §2 or §4)

Append a line to the changelog below for anything beyond a typo fix.

### Changelog
- `2026-07-25` — **Blank screen after deploy, fixed.** Three bugs in the delivery path:
  (a) `packages/server-cf/public/` was gitignored, so Cloudflare cloned a repo with no
  assets and wrangler deployed nothing; the SPA fallback then answered `/assets/*.js`
  with HTML and strict MIME checking blanked the page. (b) The service worker fell back
  to `index.html` for ANY failed request, reproducing the same MIME error from cache even
  after the server was fixed. (c) The CF deploy command used `npm run --prefix`, which
  does not put the root `node_modules/.bin` on PATH — `tsc: not found`.
  Now: the directory is tracked via `.gitkeep`, `scripts/check-assets.mjs` fails the
  deploy when `index.html` references a file that is not on disk, the SW only falls back
  for navigations (hashed assets cache-first, document network-first, cache `v3`), and
  the deploy command `cd`s to the root. Stale workers self-replace with a one-time reload;
  `/?reset=sw` is the manual escape hatch. Verified by building from a clean clone.
- `2026-07-25` — **App completed.** Fixed the "cannot create an account" bug: on Cloudflare
  the migration ran in `ctx.waitUntil()`, which does not block the response, so the first
  request after a cold start could hit the database before the tables existed. It is now
  awaited (idempotent, once per isolate) and a failure returns 503 rather than an opaque 500.
  Added **household linking** (`/api/me/context`, `/api/me/household`, `/api/me/discoverable`) —
  the web app previously expected a `solawi.household` value in localStorage that nothing set,
  so neighbour discovery and bidding silently did nothing. Session context is now loaded once
  per boot and shared. New modules: **7 `distribution`** (depots, days, pickups, absences joined
  live), **11 `inventory`** (loans, condition, service intervals), **2 `finance`** (full-cost
  accounting, multi-source income with dependency warnings, wage reality check for SF-002).
  New screens: crops/plantings (the time slider had no way to get data before), distribution,
  inventory, finance, household linking. Nav is now role- AND module-aware with overflow.
  11 modules, 37 tests.
- `2026-07-25` — **Frontend built.** `packages/web`: PWA in plain TypeScript + Vite, no
  framework (target device is an old phone). 11 kB gzipped. Offline-first via an
  IndexedDB outbox — writes queue when there is no signal and flush on reconnect;
  observations carry client-generated ids so replays are idempotent. Screens: auth,
  farm picker (incl. established-farm skip), field with the TIME SLIDER and one-tap
  observation capture, tasks with the sequencing assistant, members with radius-based
  neighbour counts, Bieterrunde with the batched bar (+ projector mode), founding
  milestone graph, settings with live module toggles, and the feedback reporter with
  its mandatory preview. Served by the same Worker as the API via `[assets]` with
  `run_worker_first` — one deploy, one origin, no CORS.
  Fixed a real bug found while testing: the org slug pattern required 3+ characters,
  so a farm called "cs" could not sign up. Regression test added.
- `2026-07-25` — Published to `github.com/whoseyci/solawios` as **`main`**. The previous
  localStorage SPA was discarded on the owner's instruction; it is preserved as tags
  `archive/static-spa-v2`, `archive/spa-early-1`, `archive/spa-early-2` and is not a
  development branch. There is currently **no frontend** —
  see `docs/61-frontend-plan.md`. Added module 23 `feedback` (in-app bug reporting → GitHub Issues, mandatory
  preview, automatic redaction of emails/phones/IBANs/coords/tokens, stored
  locally first so delivery is retryable), `scripts/generate-schema.mjs`
  (idempotent schema.sql from all module migrations, so Cloudflare Builds can
  apply D1 changes before deploying), `docs/60-cloudflare-builds.md`.
  28 tests passing.
- `2026-07-25` — Onboarding: `scripts/setup.sh` (prereq checks, install, build, test),
  `scripts/deploy-cf.sh` (creates D1/KV/R2 and **writes the ids into wrangler.toml
  automatically**, degrades gracefully when R2 needs a card), `scripts/demo.mjs`
  (in-memory end-to-end walkthrough), `START-HIER.md` (German, three paths compared).
  npm scripts: `setup`, `demo`, `deploy`.
- `2026-07-25` — **Implementation landed.** Monorepo: platform abstraction with two live
  implementations (CF: D1/R2/KV/DO; Node: SQLite/fs/in-process), kernel (multi-tenant orgs,
  credential auth + sessions, role expansion where `finance` is NOT implied by `admin`,
  module registry, event bus, capability broker with declared empty values, audit log),
  i18n runtime (DE source locale, Intl plurals, DE+EN catalogues), 7 modules
  (founding, land, cultivation, tasks, members, bidding, observations), Hono API,
  both server entry points, CI enforcing both targets. 22 tests green.
  Verified live: rotation guard warns-not-blocks; bar does not move for a 9 999 € outlier
  bid (differencing attack); histogram self-suppresses on sparse tails; `observation` has
  no attribution column; offline sync is replay-idempotent; skip-founding marks milestones
  `not_applicable`, not `done`.
- `2026-07-25` — Initial version. Concept phase, no code. Rules §3.1–3.7 established.
- `2026-07-25` — Added `docs/00`–`docs/30`, ADR-0001..0003 (all `proposed`), and the
  first content sample `content/de/founding/stolperfallen.md` incl. its draft YAML schema.
  16 modules catalogued in `docs/10-modulkatalog.md`.
- `2026-07-25` — Owner decided the five open questions. Added ADR-0004 (hosting/platform,
  supersedes 0003), ADR-0005 (hybrid Bieterrunde), ADR-0006 (OpenOlitor import→adapter),
  ADR-0007 (member location + anonymised commons), and
  `docs/40-profile-und-modulbaukasten.md`. New §2a summarises decided architecture;
  rules §3.8–3.10 added (no platform types in modules; never join bid identity with
  amount; aggregates can leak individuals).
- `2026-07-25` — **Two corrections after owner review.** (a) ADR-0005 rev 2: separating bid
  identity from amount was wrong — it broke billing. Bids now link to households normally.
  Richtwert confirmed as mean, but over **share equivalents**, so `ShareType.weight`
  entered the domain model. Two display modes (semi-live bar / final reveal).
  (b) ADR-0007 rev 2: the postcode/grid map is dropped in favour of **radius + count with
  no map** — strictly better privacy and simpler. New rule §3.11: never ship a member map.
- `2026-07-25` — **ADR-0005 rev 3 + hand-drawn mindmap incorporated.** Sealing/encryption
  removed entirely: the team is meant to see the numbers (rule §3.9 rewritten; new §5a
  records the pattern behind three rejected over-engineered designs). Bid revisions
  **append**; distribution histogram is **optional, off by default**. Mindmap transcribed
  in `docs/50-mindmap-abgleich.md`; it added modules 17 `processing`, 18 `livestock`,
  19 `events`, extended `finance-model` (multiple income streams) and `insights`
  (right-size analysis, "sticky business" — community-level only), and produced the
  **Kreislaufansicht** in `docs/00-konzept.md` §2a.
- `2026-07-25` — Mindmap redrawn as validated Mermaid in `docs/51-mindmap-mermaid.md`
  (3 diagrams, all parse-checked). Split Bildungsarbeit out of `events` into its own
  module **20 `education`** — different counterparty (institutions), rhythm (school
  years), funding logic (grants with reporting duties) and staffing.
- `2026-07-25` — **All eight mindmap readings resolved by the owner.** "Merch" confirmed,
  but **Märkte added as module 21 `markets`** (some Solawis sell at markets; the module's
  job is making the share-vs-market competition for the same harvest visible).
  Crop count is per-farm, not a constant. 87 = current shares at CS. Investitionen flow
  both ways. **Personal is a cross-cutting concern**, not a pipeline step.
  "Connections" = network to other farms. Lager→Einwecken and Ernte→Einwecken both hold.
  Biggest outcome: **ADR-0008** defines operational data (rhythms, quantities, causes)
  as explicitly *not* staff tracking, enforced structurally — `Observation` has no person
  column. Added rule §3.12 and the **sequencing assistant** to `tasks`.
