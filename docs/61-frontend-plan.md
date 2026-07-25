# Frontend — Plan

Das Repository enthält aktuell **kein Frontend**. Ein früherer statischer
Prototyp (localStorage-SPA) wurde verworfen; er liegt noch als Git-Tag
`archive/static-spa-v2` (plus `archive/spa-early-1` / `-2`) und lässt sich bei
Bedarf ansehen, ist aber kein Entwicklungsstand mehr.

## Warum neu bauen statt reparieren

Der Prototyp war als reines Browser-Frontend gedacht: alle Daten in
`localStorage`, ein Gerät, ein Mensch. Genau das trägt für eine Solawi nicht —
gemeinsame Daten für mehrere Menschen sind der ganze Zweck. Die Datenschicht
wäre also ohnehin vollständig ersetzt worden, und was danach übrig bleibt, ist
weniger, als es zunächst aussieht.

## Anforderungen

Aus den bestehenden Entscheidungen ergibt sich das meiste von selbst:

**Feldtauglich (ADR-0004 §6)**
- PWA, installierbar, kein App-Store
- Offline-first: lokale Datenbank im Browser (OPFS/IndexedDB), Sync über
  `/api/observations/sync` — idempotent, additive Zusammenführung
- Große Ziele, hoher Kontrast, bedienbar mit Handschuhen und Sonne auf dem
  Display
- Erfassung in einem Tipp, Menge optional, nie ein Pflichtfeld

**Rollenbasierte Startpunkte (docs/00 §3)**
Nicht sieben Apps, sondern ein System mit unterschiedlichen Einstiegen. Wer nur
Gemüse abholt, sieht nie eine Fruchtfolgematrix.

**Mehrsprachig ab Zeile 1 (docs/30)**
Keine hartkodierten Strings, nie. Die Kataloge `de` und `en` liegen bereits in
`packages/app/src/locales/`.

**Modulbewusst (docs/40)**
Deaktivierte Module sind **nicht vorhanden**, nicht ausgegraut.

## Reihenfolge

| Stufe | Inhalt | Warum zuerst |
|---|---|---|
| **F1** | Login, Hofauswahl, Einrichtungsfragen | ohne Konten kein Mehrbenutzerbetrieb |
| **F2** | Ackerkarte + Zeitachse | das Herzstück; validiert Offline-Sync |
| **F3** | Aufgaben + Ein-Tipp-Erfassung | der tägliche Gebrauch |
| **F4** | Mitglieder, Anteile, Abwesenheiten | die geteilten Daten |
| **F5** | Bieterrunden-Ansicht + Beamer-Balken | eigener Bildschirm, eigene Regeln |
| **F6** | Kreislaufansicht (docs/00 §2a) | Übersicht, sobald Daten da sind |

F2 ist bewusst früh: Die Ackerkarte mit Zeitregler ist der Teil, an dem sich
zeigt, ob Offline-Sync und Modularität in der Praxis tragen. Wenn das steht,
ist der Rest Fleißarbeit.

## Technische Leitplanken

- **TypeScript**, gleiche Sprache wie das Backend (ADR-0004 §5)
- Typen aus den API-Antworten ableiten statt parallel pflegen — sonst driften
  Frontend und Backend auseinander, und das merkt man erst in Produktion
- Vektorkacheln für die Karte, kein kommerzieller Kartenanbieter
- Ein Worker liefert am Ende statische Assets **und** API aus: ein Deployment
- Kein schweres Framework ohne Grund; die Zielgeräte sind alte Handys

## Was der Prototyp gut gemacht hat

Zwei Ideen sind es wert, übernommen zu werden:

- **Command Palette** (⌘K) für schnelle Navigation
- **Globale Suche** über Mitglieder, Kulturen, Beete, Aufgaben

Beides passt gut zu einem System mit vielen Modulen und sollte ab F3 mitgedacht
werden.
