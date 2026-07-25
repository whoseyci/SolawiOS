# Modulkatalog

Alle Fähigkeiten von Solawi OS sind Module. Der Kern kann fast nichts allein — er hält
Identitäten, Rechte, Ereignisse, Übersetzungen und die Modulregistrierung.

**Reifegrade:** `idea` → `spec` → `alpha` → `stable`. Aktuell ist alles `idea` oder
`spec`; das ist ehrlich so gemeint.

## Übersicht

| # | Modul | Phase | Reife | Braucht |
|---|---|---|---|---|
| 0 | `kernel` | alle | spec | — |
| 1 | `founding` | Gründen | spec | kernel |
| 2 | `finance-model` | Gründen/Betrieb | idea | kernel |
| 3 | `land` | Betrieb | spec | kernel |
| 4 | `cultivation` | Betrieb | spec | land |
| 5 | `tasks` | Betrieb | spec | kernel |
| 6 | `harvest` | Betrieb | idea | cultivation |
| 7 | `distribution` | Betrieb | idea | harvest, members |
| 8 | `members` | Betrieb | spec | kernel |
| 9 | `bidding` | Betrieb | spec | members, finance-model |
| 10 | `participation` | Betrieb | idea | members, tasks |
| 11 | `inventory` | Betrieb | spec | kernel |
| 12 | `governance` | alle | idea | members |
| 13 | `communication` | alle | idea | members |
| 14 | `insights` | Entwickeln | idea | mehrere (lesend) |
| 15 | `knowledge` | alle | idea | kernel |
| 16 | `public` | alle | idea | kernel |
| 17 | `processing` | Betrieb | idea | harvest |
| 18 | `livestock` | Betrieb | idea | tasks |
| 19 | `events` | alle | idea | kernel |
| 20 | `education` | alle | idea | events |
| 21 | `markets` | Betrieb | idea | harvest |

Module 17–21 stammen aus dem Abgleich mit der Handskizze,
siehe [`50-mindmap-abgleich.md`](50-mindmap-abgleich.md) und
[`51-mindmap-mermaid.md`](51-mindmap-mermaid.md).

---

## 0. `kernel` — Kern

Das Einzige, was immer läuft.

Enthält: Identität & Authentifizierung, Rollen/Rechte, Organisationseinheit (Hof),
Modulregistrierung & Feature-Flags, Event-Bus, i18n-Laufzeit, Audit-Log, Datenexport,
Synchronisation für Offline-Clients.

Enthält **nicht**: irgendeine Solawi-Fachlichkeit. Kein Wort über Gemüse.

---

## 1. `founding` — Gründungsbegleiter

**Zweck:** von der Idee zur ersten Saison.

- Meilensteingraph mit Abhängigkeiten, kein starrer Wizard
- Pro Meilenstein: Ziel, Dauer, Voraussetzungen, Ergebnis, Stolperfallen, Vorlagen,
  Plenumsfragen
- Fristen- und Erinnerungslogik (Registeranmeldung, Förderstichtage, Aussaatzeitpunkte —
  eine verpasste Frist im Februar kostet ein Jahr)
- Entscheidungsassistent Rechtsform: Fragebogen → Vergleich, ausdrücklich mit dem
  Hinweis, dass er keine Rechtsberatung ersetzt
- Fortschrittsbild, das die Gruppe motiviert, ohne zu drängeln
- Inhalte kommen aus `content/jurisdictions/<iso>/founding/` — Recht und Fristen sind
  Inhalt, nicht Code

**Stolperfallenbibliothek** ist der Kern dieses Moduls. Jede Falle: Symptom, Ursache,
Kosten, Vermeidung, Quelle. Gespeist aus Netzwerk-Wissen und (opt-in) aus `insights`
laufender Höfe.

---

## 2. `finance-model` — Wirtschaftlichkeit

Vollkostenrechnung, die Solawis systematisch zu niedrig ansetzen.

- Kostenarten inkl. der oft vergessenen: Sozialabgaben, Urlaub, Krankheit,
  Wiederbeschaffungsrücklage, Verwaltung, Versicherung
- Lohnrechner mit Realitätscheck („Das entspricht 9,40 €/h bei 48 Wochenstunden")
- Liquiditätsverlauf übers Jahr — Solawi-Beiträge kommen monatlich, Kosten nicht
- Szenarien: Anteilszahl, Flächenerweiterung, Stellenumfang, Ernteausfall
- Budget → Zielsumme für `bidding`
- **Mehrere Einnahmequellen** (aus der Skizze): Anteile, **Merch**, **Märkte**, Spenden,
  Events, Bildungsarbeit, Förderungen. Je Quelle Anteil am Budget und Abhängigkeitsgrad —
  ein Hof mit 30 % aus dem Hofcafé hat ein anderes Risikoprofil als einer mit reinen
  Anteilsbeiträgen
- **Rücklagen** als eigene Größe, nicht als Restbetrag
- **Investitionen in beide Richtungen**: Geld fließt in Investitionen, und Investitionen
  wirken auf die Finanzlage zurück (Abschreibung, Wiederbeschaffung, gesparte Kosten)

---

## 3. `land` — Flächen & Karte

Die Landkarte des Betriebs.

- Hierarchie: Betrieb → Schlag → Beet/Abschnitt → Segment
- Zeichnen auf Luftbild oder freihändig, GPS-Vermessung im Feld
- Nicht nur Beete: Gewächshaus, Wege, Wasserstellen, Kompost, Zaun, Agroforststreifen
- Bodenprofil je Fläche (pH, Analysen, Beobachtungen), historisierbar
- Offline-fähige Kartendarstellung mit Vektorkacheln

Wichtig für crowd salat: **mehrjährige Pflanzungen sind erstklassige Objekte**, nicht
Sonderfälle von Gemüsesätzen.

---

## 4. `cultivation` — Anbauplanung

Das Herz des Ackerbetriebs.

- Kulturen-Stammdaten (lokalisierbar, botanischer Name als stabiler Schlüssel)
- Sätze: Aussaat, Pflanzung, Standzeit, Erntefenster, erwarteter Ertrag
- **Zeitachsen-Regler**: der Acker an jedem beliebigen Tag, rückwärts und vorwärts
- Fruchtfolge-Wächter mit Familien-Karenzzeiten und Begründung
- Mischkultur- und Beikulturhinweise
- Automatische Ableitung von Pflegeaufgaben an `tasks`
- Ertragsprognose je Woche → Grundlage für `distribution`
- Soll/Ist-Vergleich am Saisonende → `insights`

---

## 5. `tasks` — Aufgaben

Ein Aufgabensystem, das Acker versteht.

- Aufgaben mit Ort (Beet), Zeitfenster, Dauer, benötigtem Werkzeug, Fähigkeit,
  Wetterabhängigkeit
- Wiederkehrend und regelbasiert („alle 10 Tage hacken, solange Kultur X steht")
- Dringlichkeit statt Deadline: Unkraut hat ein weiches, Ernte ein hartes Fenster
- Feldtaugliche Ansicht: große Ziele, Offline-Abhaken, Foto als Kommentar
- Verknüpft `inventory` (Werkzeug da?) und `participation` (wer macht's?)

**Reihenfolge-Assistent** (aus der Skizze, siehe
[ADR-0008](adr/0008-betriebsdaten-ohne-personentracking.md) §5c):
Aufgaben haben eine **räumliche** Ordnung, nicht nur eine zeitliche. Ein Beet mulchen,
während nebenan gepflanzt werden soll, macht das Rangieren unnötig schwer — klüger ist,
erst alles andere zu erledigen und zuletzt zu pflanzen.

Der Assistent schlägt für die anstehenden Aufgaben eine Reihenfolge vor, die
- nicht über Boden arbeitet, der gleich gestört wird,
- Beete nicht verdichtet, die zur Pflanzung anstehen,
- Aufgaben nach benötigtem Werkzeug bündelt.

Er **schlägt vor**. Er teilt nicht zu, und schon gar nicht an namentliche Personen.

**Erfassung** (ADR-0008 §6): Abhaken erzeugt eine `Observation` am **Beet**, nicht an
der Person. Ein Tipp, Menge optional, offline, nie ein Pflichtfeld.

---

## 6. `harvest` — Ernte

- Erfassung nach Menge/Gewicht/Stück, schnell, offline, mit Waagen-Anbindung optional
- Ernte bucht gegen den Satz → Ist-Ertrag füllt sich automatisch
- Qualitätsstufen, Ausschuss, Verlustgründe
- Lagerbestände für Lagergemüse

---

## 7. `distribution` — Verteilung

- Anteilsgrößen und Zusammenstellung der Woche
- Depots mit Öffnungszeiten, Ansprechperson, Kapazität
- Verteilliste als Aushang und als App-Ansicht
- Abholquittierung, Restemanagement, Solidartafel
- **Abwesenheiten**: Urlaub melden, Vertretung benennen, sonst automatisch in den
  Restetopf oder an die Warteliste
- Ausgleichslogik über Wochen, damit niemand dauerhaft schlechter wegkommt

---

## 8. `members` — Mitglieder

*Optional und ersetzbar — Adapter zu OpenOlitor möglich, siehe ADR-0001.*

- Haushalte statt nur Personen (ein Anteil, mehrere Menschen)
- Anteile mit Typ und Gewicht, Verträge, Laufzeiten, Kündigung, Warteliste
- Beiträge, Zahlungsart, SEPA, Zahlungsstand
- **Nachbarschaftsfunktion ohne Karte**: Radius wählen, „# Haushalte im Umkreis",
  Kontaktaufnahme nur bei beidseitiger Zustimmung ([ADR-0007](adr/0007-mitgliederdaten-und-anonymes-teilen.md))
- Datenschutz: Sichtbarkeit feingranular, Minimaldatensatz als Default

---

## 9. `bidding` — Bieterrunde

Sensibelstes Modul des Systems. Details in [ADR-0005](adr/0005-bieterrunde-hybrid.md).

- Zielsumme aus `finance-model`; **Richtwert = Budget ÷ Anteilsäquivalente**
- Anteilsgewichte pro Hof konfigurierbar (groß 1,0 / klein 0,5 / …); Gebote werden vor
  der Mittelung normalisiert, sonst ist der Richtwert bei gemischten Anteilsgrößen wertlos
- Gebotsabgabe digital, Zettel vom Team nacherfassbar — im Ergebnis ununterscheidbar
- **Während der Runde versiegelt**: niemand sieht Gebote eintreffen, auch nicht das Team
  am Laptop. Nach Rundenschluss sieht die Finanzrolle alles, was sie zur Abrechnung braucht
- **Gebote bleiben mit dem Haushalt verknüpft** — Mitglieder sehen einander nie,
  Abrechnung funktioniert normal
- Zwei Anzeigemodi: halb-live Balken (gebündelt, gejittert, gerundet) oder Auflösung erst
  am Ende. Unter ~15 Geboten ist der Endmodus Standard
- Mehrere Runden mit anonymer Kommentarphase
- Der Ritualcharakter bleibt erhalten — die Software ersetzt nicht den Saal, sie zählt

---

## 10. `participation` — Mitarbeit & Ehrenamt

- Mitarbeitstermine, Aktionstage, Schichten
- Fähigkeiten und Einweisungen (wer darf den Traktor fahren)
- **Sanftes Matching**: Vorschläge nach Wohnort, Fähigkeit, bisheriger Belastung
- Belastungsausgleich mit ausdrücklichem Verzicht auf Ranking oder Scoring
- Erinnerungen, Absagen, Vertretungssuche

---

## 11. `inventory` — Werkzeug & Infrastruktur

Unterschätzt, spart real Zeit.

- Werkzeug, Maschinen, Kleingeräte, Verbrauchsmaterial
- **Wo ist es**: fester Lagerort + aktueller Standort, QR-Code am Griff
- Ausleihe: wer hat's seit wann, sanfte Rückholerinnerung
- Wartungsintervalle, Reparaturstatus, Ersatzteile
- Bedarfsmeldung: welche Aufgabe braucht welches Werkzeug — Konflikte vorher sichtbar
- Saatgut- und Substratlager mit Bestellvorschlag

---

## 12. `governance` — Selbstverwaltung

- Gremien, Arbeitsgruppen, Mandate mit Laufzeit
- Plenumstermine, Tagesordnung, Beschlussprotokoll, Beschlussregister
- Entscheidungsverfahren abbildbar (Konsens, Konsent, Mehrheit)
- Konfliktprozess, den man in ruhigen Zeiten vereinbart

---

## 13. `communication` — Kommunikation

- Ankündigungen, Wochenbrief, Depot-Aushang
- Kanäle: App, E-Mail, PDF; bewusst **kein** eigener Chat (das machen die Leute woanders)
- Mehrsprachiger Versand: jede:r bekommt die eigene Sprache
- Vorlagen für Wiederkehrendes

---

## 14. `insights` — Kennzahlen & Entwicklung

Nur lesend, keine eigenen Kerndaten.

- Saisonrückblick Plan vs. Ist
- Ertrag pro Fläche, pro Kultur, pro Arbeitsstunde
- Mitgliederbindung, Fluktuation, Warteliste
- Solidaritätsverlauf der Beiträge über Jahre
- Arbeitsbelastung inkl. Überlastungswarnung fürs Hauptamt
- Szenarien und Was-wäre-wenn
- Opt-in-Beitrag zur netzwerkweiten, anonymisierten Wissensbasis

**„Was ist die richtige Größe?"** (aus der Skizze) — eigener Bereich, der Fläche,
Personal, Anteile und Budget zusammen betrachtet und **Schwellen** sichtbar macht:
Untergrenze der Wirtschaftlichkeit, Obergrenze der aktuellen Ausstattung, nächster
Investitionssprung (vgl. Stolperfalle SF-004).

**„Sticky Business?"** (aus der Skizze) — wird Mitgliedschaft selbstverständlich?
Messbar über Verbleibquote, Eventbeteiligung, Mitarbeitsstunden, Abholtreue.
**Ausdrücklich nur auf Gemeinschaftsebene.** Kein Score pro Mitglied, kein Ranking —
Regel §3.7. Bindung ist eine Eigenschaft der Gemeinschaft, keine Note für Einzelne.

---

## 15. `knowledge` — Wissen

- Betriebshandbuch, das sich aus dem laufenden System speist
- Onboarding neuer Mitglieder und neuer Gärtner:innen
- Stolperfallen und gelernte Lektionen
- Übergabe: was passiert, wenn die Person geht, die alles wusste

---

## 16. `public` — Außenauftritt

- Öffentliche Seite: wer wir sind, freie Anteile, Warteliste, Termine
- Interessent:innen-Formular mit Übergabe an `members`
- Eintrag in Solawi-Verzeichnisse
- Bewusst schlank — die meisten Höfe haben schon eine Website

---

## 17. `processing` — Verarbeitung, Lager & Kompost

Aus der Skizze: `Ernte → Einwecken / Lager / Kompost`. Im Winter lebt eine Solawi vom
Lager, nicht vom Feld — das fehlte im Katalog.

- **Lager**: Lagerorte, Mengen, Haltbarkeit, Abgänge, Schwund
- **Verarbeitung**: Einkochen, Fermentieren, Trocknen, Saft — Chargen mit Eingangs- und
  Ausgangsmenge, Rezept, Haltbarkeitsdatum
- Verarbeitete Ware kann in Anteile fließen, verkauft oder für Events genutzt werden
- **Kompost als Rückfluss**, nicht als Entsorgung: Menge, Reifegrad, Ausbringung → `land`
- Überschussmeldung: wenn `harvest` mehr liefert als `distribution` braucht, schlägt das
  Modul Verarbeitung statt Wegwerfen vor

## 18. `livestock` — Tiere

Aus der Skizze: „Animals?". Bewusst eigenes Modul, weil die meisten Höfe es nicht brauchen.

- Tierarten und Bestand, Zu- und Abgänge, Kennzeichnung
- **Versorgung, die nicht ausfallen darf** — anders als Jäten. Aufgaben aus diesem Modul
  sind in `tasks` besonders markiert und brauchen eine Vertretungskette
- Gesundheit, Behandlungen, Tierarzt
- Erträge: Eier, Honig, Wolle → fließen in `distribution`
- Rechtliches: Bestandsregister, Tierseuchenkasse — Inhalte je Jurisdiktion
- Weideflächen und Ställe → verknüpft mit `land`

## 19. `events` — Veranstaltungen

Aus der Skizze: Hofcafé, Hoftouren, Wochenevents, Mitmachtage.
Nicht dasselbe wie `participation`: Events richten sich **auch nach außen**.

- Veranstaltungen mit Anmeldung, Kapazität, Zielgruppe, ggf. Eintritt
- Hofcafé/Hofladen als wiederkehrender Betrieb mit Schichten
- Events sind **Einnahmequelle** (→ `finance-model`) und **Mitgliederquelle** (→ `public`)
- Helferplanung überschneidet sich mit `participation`, bleibt aber getrennt: hier zählt
  die Veranstaltung, dort der Beitrag der Mitglieder

## 20. `education` — Bildungsarbeit

Aus der Skizze: „Bildungsstätte". Bewusst **eigenes Modul, nicht Teil von `events`** —
Bildungsarbeit ist bei vielen Höfen ein zweites Standbein mit eigener Logik, eigenen
Partnern und eigener Finanzierung. Ein Hoffest und ein Schuljahresprogramm haben fast
nichts gemeinsam außer dem Wort „Termin".

**Warum getrennt:**

| | `events` | `education` |
|---|---|---|
| Zielgruppe | Mitglieder, Nachbarschaft, Öffentlichkeit | Schulklassen, Kitas, Gruppen, Fachpublikum |
| Rhythmus | einzelne Termine | Programme über Wochen/Schuljahre |
| Gegenüber | Einzelpersonen | **Institutionen** mit Ansprechpersonen |
| Geld | Eintritt, Verkauf | Honorare, **Förderprogramme**, Bildungsträger |
| Nachweis | keiner | Berichte, Teilnahmelisten, Verwendungsnachweis |
| Personal | Helfende | **qualifizierte Kräfte**, ggf. pädagogische Ausbildung |

**Umfang:**

- **Angebotskatalog**: Führungen, Projekttage, Schuljahresbegleitung, Workshops,
  Fortbildungen, Praktika — je mit Dauer, Gruppengröße, Altersstufe, Lernzielen, Preis
- **Kooperationen**: Schulen, Kitas, Bildungsinitiativen, Volkshochschulen als
  wiederkehrende Partner mit Ansprechperson und Historie
- **Buchungen** mit Vor- und Nachbereitung, Ausweichtermin bei Wetter, Verpflegung
- **Förderfähigkeit**: viele Bildungsangebote sind förderbar; Fristen, Anträge und
  Verwendungsnachweise gehören hierher, nicht in eine allgemeine Terminliste
- **Material und Curriculum**: wiederverwendbare Bausteine, die nicht an einer Person
  hängen — zentral für Übergaben (→ `knowledge`)
- **Referent:innen**: interne und externe, Qualifikation, Honorar, Verfügbarkeit
- **Wirkung**: Teilnehmendenzahlen, Rückmeldungen, wiederkehrende Partner — für
  Förderberichte *und* für `insights`

**Warum das ein Standbein ist:** Bildungsarbeit ist saisonal **antizyklisch** — sie
funktioniert im Frühjahr und Herbst, wenn Schulen aktiv sind, und puffert damit
Einnahmen außerhalb der Erntespitze. Sie ist zudem die wirksamste
Mitgliedergewinnung, die es gibt: Eltern von Kindern, die auf dem Acker waren, werden
überdurchschnittlich oft Mitglied.

Praxisbeispiele in der Region: SoLaWi maingrün arbeitet seit 2017 mit der Initiative
„Umweltlernen" der Stadt Frankfurt und empfängt regelmäßig Grundschulklassen
([Quelle](https://www.xn--solawi-maingrn-ssb.de/)).

## 21. `markets` — Marktverkauf

Manche Solawis verkaufen auf Wochenmärkten — als Einnahmequelle, zur Überschussverwertung
und als Sichtbarkeit in der Stadt.

**Der wichtige Punkt:** Markt und Anteil **konkurrieren um dieselbe Ernte**. Genau das
muss das Modul sichtbar machen, sonst wird der Markt zur stillen Konkurrenz der
Mitglieder.

- Marktstandorte, Termine, Standgebühren, Genehmigungen
- Preisliste — anders als beim Anteil gibt es hier echte Stückpreise
- **Kontingent**: welcher Anteil der Ernte darf auf den Markt? Vorschlag: erst Anteile
  bedienen, dann Überschuss. Regel pro Kultur konfigurierbar
- Warenmitnahme und Rückläufer, Erlös je Termin
- Personalbedarf je Markttag (→ `tasks`, `participation`)
- Erlöse → `finance-model` als eigene Einnahmeart mit Abhängigkeitsgrad
- Verknüpfung zu `processing`: Eingemachtes verkauft sich auf Märkten oft besser als
  Frischware

**Transparenzpflicht:** Mitglieder sollten sehen können, wie viel der Ernte über den
Markt ging. Eine Solawi, die heimlich das beste Gemüse verkauft, verliert ihre
Geschäftsgrundlage.

## Beispielkonfigurationen

**Gründungsinitiative, 6 Personen, kein Acker**
`kernel` + `founding` + `finance-model` + `governance`

**Kleine Solawi, 25 Anteile, ein Depot**
`kernel` + `land` + `cultivation` + `tasks` + `harvest` + `distribution` + `members`

**crowd salat, ~90 Haushalte, Bieterrunde, Agroforst**
oben + `bidding` + `participation` + `inventory` + `communication` + `insights`
+ `processing` (Lager/Einwecken) + `events`

**Hof mit Bildungsstandbein**
oben + `education` — antizyklische Einnahmen im Frühjahr/Herbst, stärkste
Mitgliedergewinnung

**Große Genossenschaft mit OpenOlitor im Bestand**
`kernel` + `land` + `cultivation` + `tasks` + `inventory` + `insights`
+ OpenOlitor-Adapter statt `members`/`distribution`
