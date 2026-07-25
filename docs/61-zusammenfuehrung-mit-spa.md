# Zusammenführung mit der bestehenden SPA

## Was vorgefunden wurde

Auf `main` liegt bereits ein Projekt: **SolawiOS v2.0.0**, eine statische
Single-Page-App.

| | bestehende SPA (`main`) | dieses Backend (`backend`) |
|---|---|---|
| Art | statisches Frontend, kein Server | API, Datenmodell, Module |
| Speicher | `localStorage` im Browser | SQLite / D1, mandantenfähig |
| Deployment | Cloudflare **Pages** | Cloudflare **Workers** |
| Stack | Vite, TypeScript, Phosphor Icons | Hono, TypeScript, Monorepo |
| Tests | 79 Playwright-E2E | 28 Unit/Integration |
| Module | 15 UI-Bereiche | 8 implementiert, 23 katalogisiert |
| Mehrbenutzer | nein (ein Browser) | ja (Login, Rollen, viele Höfe) |

**Deshalb wurde nichts überschrieben.** Der Branch heißt `backend`; `main`
bleibt unangetastet.

## Die beiden passen erstaunlich gut zusammen

Das ist kein Zufall: Die SPA hat genau das, was dem Backend fehlt (eine fertige
Oberfläche), und das Backend hat genau das, was die SPA nicht haben kann
(gemeinsame Daten, mehrere Menschen, mehrere Höfe, Server-Logik).

Die Modulnamen überlappen weitgehend — Members, Shares, Distribution, Crops,
Field Plan, Harvest, Tasks, Inventory, Finance, Reports finden sich in beiden.

## Vorgeschlagener Weg

### Stufe 1 — Nebeneinander betreiben

- SPA bleibt auf Cloudflare **Pages** (`main`)
- Backend läuft als Worker unter z. B. `api.solawi-os.eu` (`backend`)
- Keine Änderung am bestehenden Deployment

### Stufe 2 — Datenschicht der SPA austauschen

Der eigentliche Eingriff ist klein und lokal: Die SPA schreibt heute in
`localStorage`. In `src/store/` wird das durch `fetch()`-Aufrufe gegen die API
ersetzt — die Oberfläche selbst bleibt, wie sie ist.

Reihenfolge nach Nutzen:

1. **Login** (`/api/auth/*`) — ohne Konten kein Mehrbenutzerbetrieb
2. **Members + Shares** (`/api/members/*`) — die Daten, die alle teilen müssen
3. **Field Plan + Crops** (`/api/land/*`, `/api/cultivation/*`)
4. **Tasks + Harvest** (`/api/tasks/*`, `/api/observations/*`)
5. **Bieterrunde** (`/api/bidding/*`) — in der SPA noch nicht vorhanden

### Stufe 3 — Offline weiterhin möglich

Der `localStorage`-Ansatz der SPA ist kein Nachteil, sondern die halbe Miete für
Offline-Betrieb. Statt ihn zu entfernen, wird er zum **lokalen Cache**:
schreiben nach lokal, Hintergrund-Sync gegen `/api/observations/sync`
(idempotent, additive Zusammenführung). Das ist genau das Verhalten, das
ADR-0004 §6 für die Feldnutzung vorsieht.

### Stufe 4 — Ein Deployment

Ein Worker kann statische Assets ausliefern *und* die API bedienen. Am Ende also
ein einziger Deploy statt Pages + Worker getrennt — aber erst, wenn Stufe 2
steht.

## Was jetzt zu entscheiden ist

1. **Branch `backend` als PR nach `main` mergen** — dann liegt alles in einem
   Repo nebeneinander, ohne dass sich etwas gegenseitig stört. Empfehlung: ja,
   das Monorepo verträgt beides.
2. **Modulnamen angleichen** — die SPA nennt es „Field Plan", das Backend
   `land` + `cultivation`. Vor der Verdrahtung einmal festlegen.
3. **Welche SPA-Module bleiben eigenständig?** „Orders" und „Messages" haben im
   Backend-Katalog noch keine Entsprechung (`markets` bzw. `communication` sind
   spezifiziert, aber nicht gebaut).

## Was nicht passieren sollte

Die Datenmodelle doppelt pflegen. Sobald die SPA gegen die API läuft, ist das
Backend die Wahrheit, und `src/types/` in der SPA sollte aus den API-Typen
erzeugt oder gegen sie geprüft werden — sonst driften die beiden auseinander,
und das merkt man erst in Produktion.
