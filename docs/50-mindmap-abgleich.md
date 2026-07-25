# Abgleich mit der Handskizze

Transkription der Mindmap vom 25.07.2026 und Abgleich mit dem bisherigen Modulkatalog.
Quelldatei: `uploads/IMG_9988.jpeg` (HEIC trotz `.jpeg`-Endung), lesbar konvertiert als
`uploads/mm_rot.jpg`.

## 1. Transkription

**Zentrum: `Anteil`** (eingekreist) — alles läuft darauf zu oder davon weg.

**Produktionskreislauf (oben)**
```
Rücklagen ← Geld
Märkte(?) → Geld                     ← Lesung unsicher
Spenden? → Geld
Gemeinschaft → Geld
Geld → Saatgut → Aussaat             (Notiz: „ca. 55 Kulturen")
Geld → Maschinerie → Aussaat         (Notiz: Zustand, Verfügbarkeit, Ort, Anzahl)
Geld → Personal
Geld → Investitionen
Aussaat ← Wasser, Dünger, Jäten, Daten
Aussaat → Ernte
Ernte → Einwecken
Ernte → Lager → Einwecken
Ernte → Kompost
Ernte → Gemüse (wie viel / was / wann) → Anteil
```

**Anteil (Mitte)**
```
Wer · Welchen · Wie viele → 87
Warteliste · Urlaub · Retention?
```

**Gemeinschaft (unten links)**
```
Investitionen · Wissen · Gemeinschaft · Spenden?
Community → Events → Hofcafé, Hoftouren, Bildungsstätte,
                     Wochenevents, Mitmachtage
Connections · Verein
```

**Offene Fragen (rechts)**
```
[Daten?]
Animals?
Sticky Business?
Was ist die richtige Größe für meine Unternehmung? → Fläche / Personal
```

## 2. Die zentrale Erkenntnis

Die Skizze ist **anteilszentriert**, mein Modulkatalog war **funktionszentriert**.
Das ist kein Widerspruch, aber die Skizze zeigt etwas, das der Katalog verdeckt hat:

> **Der Anteil ist der Knoten, an dem Produktion und Gemeinschaft sich treffen.**
> Geld → Produktionsmittel → Ernte → Gemüse → Anteil → Beiträge → Geld.
> Ein geschlossener Kreislauf, plus Nebenkreisläufe: Kompost zurück in die Produktion,
> Events und Spenden zurück ins Geld.

Konsequenz für die Oberfläche: es sollte eine **Kreislaufansicht** geben, die genau
dieses Bild zeigt — mit echten Zahlen an den Pfeilen. Das ist kein Diagramm zur Zierde,
sondern die ehrlichste Zusammenfassung dessen, ob der Betrieb funktioniert.

## 3. Was die Skizze bestätigt

| Skizze | Modul |
|---|---|
| Maschinerie: Zustand, Verfügbarkeit, Ort, Anzahl | `inventory` — exakt diese vier Felder |
| Wasser, Dünger, Jäten | `tasks` |
| ca. 55 Kulturen, Aussaat | `cultivation` |
| Wer / Welchen / Wie viele / 87 | `members` |
| Warteliste, Urlaub | `members`, `distribution` |
| Retention? | `insights` |
| Rücklagen, Investitionen, Personal | `finance-model` |
| Gemüse: wie viel, was, wann | `harvest` → `distribution` |
| Verein, Connections | `governance` |
| Wissen | `knowledge` |

Erfreulich: die Skizze hat kein Modul erfunden, das es nicht gibt. Aber sie hat vier
Dinge, die **fehlen**.

## 4. Lücken — was neu dazukommt

### 4.1 Verarbeitung & Lager (`processing`) — echte Lücke

`Einwecken`, `Lager`, `Kompost` standen bei mir bestenfalls als Nebensatz unter `harvest`.
Die Skizze macht daraus einen eigenen Zweig, und zu Recht:

- Einkochen, Fermentieren, Trocknen, Saft — Überschuss wird haltbar statt zu Abfall
- Lagergemüse mit Lagerort, Menge, Haltbarkeit, Abgang
- Kompost als **Rückfluss in die Produktion**, nicht als Entsorgung
- Verarbeitete Ware kann in Anteile fließen oder verkauft werden

Das schließt eine Lücke im Jahreslauf: im Winter lebt eine Solawi vom Lager, nicht vom Feld.

### 4.2 Tiere (`livestock`) — echte Lücke

„Animals?" kam im Katalog überhaupt nicht vor. Viele Solawis halten Hühner, manche
Bienen, Schafe, Schweine. Das ist kein Gemüsebau mit Federn:

- tägliche Versorgung, die **nicht ausfallen darf** (anders als Jäten)
- Tierbestand, Zu- und Abgänge, Gesundheit
- Erträge: Eier, Honig, Wolle — fließen in Anteile
- eigene rechtliche Auflagen (Tierseuchenkasse, Bestandsregister)

Bewusst als eigenes Modul, weil die meisten Höfe es **nicht** brauchen und es sonst
Ballast wäre.

### 4.3 Events (`events`) und Bildungsarbeit (`education`) — zwei Lücken

Hofcafé, Hoftouren, Bildungsstätte, Wochenevents, Mitmachtage. Im Katalog gab es nur
`participation` (Mitarbeit der Mitglieder) — Events sind etwas anderes:

- richten sich auch nach außen, nicht nur an Mitglieder
- Anmeldung, Kapazität, ggf. Eintritt
- sind eine **Einnahmequelle** und eine Mitgliederquelle

**Nach Rücksprache getrennt:** „Bildungsstätte" wurde zu einem eigenen Modul
`education` (20). Begründung im Modulkatalog — kurz: Schulprogramme haben Institutionen
statt Einzelpersonen als Gegenüber, laufen über Schuljahre statt Termine, hängen an
Förderlogik mit Verwendungsnachweisen und brauchen qualifiziertes Personal. Das in eine
Terminliste zu pressen würde beides schlecht abbilden. Praxis: SoLaWi maingrün arbeitet
seit 2017 mit „Umweltlernen" der Stadt Frankfurt.

### 4.4 Mehrere Einnahmequellen — Erweiterung von `finance-model`

Die Skizze zeigt vier Pfeile, die auf `Geld` zeigen: Anteile, Märkte, Spenden,
Gemeinschaft/Events. Mein `finance-model` kannte praktisch nur Anteilsbeiträge.

Ergänzung: Einnahmearten als eigene Größen, mit der Frage, wie abhängig der Betrieb von
jeder einzelnen ist. Eine Solawi, die 30 % ihres Budgets aus dem Hofcafé zieht, hat ein
anderes Risikoprofil als eine, die nur Anteile hat.

## 5. Die drei Fragezeichen der Skizze

**„Was ist die richtige Größe für meine Unternehmung? → Fläche / Personal"**
Das ist die wichtigste Frage auf dem Blatt und verdient mehr als eine Szenariofunktion.
Vorschlag: ein eigener Bereich in `insights`, der Fläche, Personal, Anteile und Budget
zusammen betrachtet und **Schwellen** sichtbar macht (vgl. Stolperfalle SF-004) —
inklusive Untergrenze der Wirtschaftlichkeit und Obergrenze der aktuellen Ausstattung.

**„Sticky Business?"**
Übersetzt: wie wird Mitgliedschaft selbstverständlich statt jährlich neu verhandelt?
Messbar über Verbleibquote, Beteiligung an Events, Mitarbeitsstunden, Abholtreue.
Gehört zu `insights` — mit der ausdrücklichen Warnung, dass daraus **kein Score pro
Mitglied** werden darf (Regel §3.7). Bindung ist eine Eigenschaft der Gemeinschaft, nicht
eine Note für Einzelne.

**„Daten?"**
Beantwortet durch ADR-0007: eigene Daten bleiben beim Hof, Kennzahlen können anonymisiert
geteilt werden, Beiträge und Gebote nie.

## 6. Folgen für den Katalog

Neu: `processing` (17), `livestock` (18), `events` (19), `education` (20),
`markets` (21).
Erweitert: `finance-model` um Einnahmearten und beidseitige Investitionen, `insights` um
Größen- und Bindungsanalyse, `tasks` um den **Reihenfolge-Assistenten**.
Neu als Querschnittsthema: **Betriebsdaten ohne Personentracking**
([ADR-0008](adr/0008-betriebsdaten-ohne-personentracking.md)).
Neu in der Oberfläche: **Kreislaufansicht** als Startbild für Orga und Betriebsleitung.

Die Skizze als Mermaid-Diagramm, alle Lesungen geklärt:
[`51-mindmap-mermaid.md`](51-mindmap-mermaid.md).

## 7. Nachtrag: geklärte Lesungen

Alle acht Unsicherheiten wurden bestätigt oder korrigiert (Details in
[`51-mindmap-mermaid.md`](51-mindmap-mermaid.md) §4). Die zwei folgenreichsten:

**„Merch", nicht „Märkte"** — aber Märkte sind trotzdem relevant, weil manche Solawis auf
Märkten verkaufen. Also beides: Merch als Einnahmeposten, Märkte als eigenes Modul (21).

**„Daten"** meint Betriebsdaten zur Transparenz und Optimierung — Rhythmen, Mengen,
Ursachen — und **ausdrücklich kein Mitarbeitenden-Tracking**. Diese Abgrenzung ist so
heikel, dass sie eine eigene Entscheidung bekam: ADR-0008 verankert sie im Datenmodell
(die Beobachtungstabelle hat **keine Personenspalte**), nicht in einer Richtlinie.

Außerdem: **Personal ist ein Querschnitt** über die gesamte Wertschöpfungskette, kein
einzelner Schritt — im Diagramm entsprechend dargestellt. Und **87** ist der aktuelle
Stand an Anteilen bei crowd salat.
