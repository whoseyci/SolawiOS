# Solawi OS

**Das Betriebssystem für Solidarische Landwirtschaft.**
Von „Ich will eine Solawi gründen" bis „Wir wirtschaften seit zehn Jahren gemeinsam".

> **Status: Alpha.** Backend, Datenmodell und API laufen (28 Tests grün, beide
> Deployment-Wege in der CI). Ein Frontend gibt es noch nicht —
> siehe [`docs/61-frontend-plan.md`](docs/61-frontend-plan.md).
>
> Einstieg: **[START-HIER.md](START-HIER.md)** · `npm run setup` · `npm run demo`

---

> **Noch nichts installiert?** → **[START-HIER.md](START-HIER.md)** führt dich in
> ~15 Minuten von null zur laufenden Instanz. Kurzfassung: `npm run setup`, dann
> `npm run demo`.

## Warum noch eine Solawi-Software?

Es gibt bereits gute Verwaltungssoftware für Solawis — allen voran
[OpenOlitor](https://openolitor.org), daneben juntagrico und ACP Admin. Sie lösen
**Mitgliederverwaltung, Anteile, Lieferplanung, Rechnungen, Lastschrift**. Das ist viel
wert, und Solawi OS will das nicht ein zweites Mal bauen.

Was fehlt, sind zwei Hälften des Solawi-Lebens:

**1. Die Gründung.** Zwischen „Wir sind fünf Leute mit einer Idee" und „Wir haben eine
Rechtsform, Fläche, einen Finanzplan und 60 Mitglieder" liegen zwei Jahre Arbeit, über
die es PDFs, Handbücher und Wissen in Köpfen gibt — aber kein Werkzeug, das einen
Schritt für Schritt durchführt, an Fristen erinnert und vor bekannten Fehlern warnt.

**2. Der Acker und das Alltagsgeschäft.** Was steht wo, wie lange noch, wer gießt,
wo ist die Grelinette, wer holt diese Woche für die Familie im Urlaub ab? Das läuft in
den meisten Solawis über WhatsApp, Excel und Zurufe.

Solawi OS deckt **Gründung → Betrieb → Weiterentwicklung** ab und versteht sich als
guter Nachbar der bestehenden Tools, nicht als deren Ersatz.
Siehe [Abgrenzung & Interoperabilität](docs/00-konzept.md#5-abgrenzung--interoperabilität).

## Leitprinzipien

| Prinzip | Bedeutung |
|---|---|
| **Modular bis auf die Knochen** | Ein schlanker Kern, alles andere sind Module, die man einzeln aktiviert. Eine 20-Anteile-Solawi soll nicht das Werkzeug einer 650-Anteile-Genossenschaft ertragen müssen. |
| **Mehrsprachig ab Zeile 1** | Deutsch ist die Quellsprache, aber keine Annahme ist hart verdrahtet. Auch Rechtsinhalte sind lokalisierbar (DE/AT/CH unterscheiden sich stark). |
| **Feldtauglich** | Offline-first. Auf dem Acker gibt es kein LTE, aber Handschuhe und Sonne auf dem Display. |
| **Sanft schlau** | Die Software rechnet, erinnert und warnt. Sie entscheidet nicht und ersetzt kein Plenum. |
| **Datensparsam** | Mitgliederdaten sind sensibel. DSGVO ist Default, nicht Feature. |
| **Gemeingut** | AGPL-3.0, offene Datenmodelle, Export jederzeit. Kein Lock-in für Höfe. |

## Dokumente

| Datei | Inhalt |
|---|---|
| [`docs/00-konzept.md`](docs/00-konzept.md) | Vision, Nutzergruppen, die drei Phasen, Abgrenzung, Roadmap, Entscheidungen |
| [`docs/10-modulkatalog.md`](docs/10-modulkatalog.md) | Alle 21 Module mit Zweck, Reifegrad und Abhängigkeiten |
| [`docs/20-domaenenmodell.md`](docs/20-domaenenmodell.md) | Kernentitäten, Modulgrenzen, Event-Bus, Glossar |
| [`docs/30-i18n-und-lokalisierung.md`](docs/30-i18n-und-lokalisierung.md) | Übersetzung, Jurisdiktions-Packs, Formate |
| [`docs/40-profile-und-modulbaukasten.md`](docs/40-profile-und-modulbaukasten.md) | Wie sich eine Solawi ihr System zusammenstellt |
| [`docs/50-mindmap-abgleich.md`](docs/50-mindmap-abgleich.md) | Transkription der Handskizze und was daraus neu entstand |
| [`docs/60-cloudflare-builds.md`](docs/60-cloudflare-builds.md) | Automatisches Deployment über das CF-Dashboard, inkl. D1-Migrationen |
| [`docs/61-frontend-plan.md`](docs/61-frontend-plan.md) | Frontend: Anforderungen und Reihenfolge (noch nicht gebaut) |
| [`docs/51-mindmap-mermaid.md`](docs/51-mindmap-mermaid.md) | Die Skizze als Mermaid-Diagramm, Unsicherheiten farbig markiert |
| [`content/de/founding/stolperfallen.md`](content/de/founding/stolperfallen.md) | Beispielinhalte Stolperfallenbibliothek + Datenschema |
| [`AGENTS.md`](AGENTS.md) | Arbeitsanweisung für KI-Agenten und neue Mitwirkende |

### Architekturentscheidungen

| ADR | Thema | Status |
|---|---|---|
| [0001](docs/adr/0001-verhaeltnis-zu-openolitor.md) | Verhältnis zu OpenOlitor & Co. | proposed |
| [0002](docs/adr/0002-lizenzwahl.md) | Lizenz: AGPL-3.0 / CC BY-SA / CC0 | proposed |
| [0003](docs/adr/0003-technologie-stack.md) | Technologie-Stack | superseded by 0004 |
| [0004](docs/adr/0004-hosting-und-plattform.md) | Cloudflare + vollwertiges Self-Hosting, TypeScript, SQLite | proposed |
| [0005](docs/adr/0005-bieterrunde-hybrid.md) | Hybride Bieterrunde mit anonymitätssicherem Balken | proposed |
| [0006](docs/adr/0006-openolitor-import-und-adapter.md) | OpenOlitor: erst Import, dann Adapter | proposed |
| [0007](docs/adr/0007-mitgliederdaten-und-anonymes-teilen.md) | Wohnortdaten, Einwilligung, anonyme Wissensbasis | proposed |
| [0008](docs/adr/0008-betriebsdaten-ohne-personentracking.md) | Betriebsdaten für Transparenz & Optimierung, ohne Personentracking | proposed |

## Referenzprojekt

Entwickelt entlang der Praxis von **solawi crowd salat** (Bieterrunde, ~90 Haushalte,
Agroforst) — aber jede Designentscheidung wird gegen mindestens zwei weitere
Solawi-Typen geprüft, damit nichts Hofspezifisches in den Kern rutscht.

## Lizenz

AGPL-3.0 (geplant, siehe [ADR-0002](docs/adr/0002-lizenzwahl.md)).
