# Mehrsprachigkeit & Lokalisierung

Mehrsprachigkeit ist hier keine Übersetzungsschicht am Ende, sondern eine
Architekturentscheidung am Anfang. Nachrüsten kostet ein Vielfaches.

## 1. Vier Ebenen

Wichtig, weil sie oft verwechselt werden:

| Ebene | Was | Wer pflegt | Wo |
|---|---|---|---|
| **UI-Sprache** | Knöpfe, Labels, Meldungen | Übersetzungscommunity | `locales/<lang>/` |
| **Inhalte** | Gründungsleitfäden, Stolperfallen, Checklisten | Fachcommunity | `content/<lang>/` |
| **Jurisdiktion** | Rechtsformen, Fristen, Steuer, SEPA | Fachkundige je Land | `content/jurisdictions/<iso>/` |
| **Stammdaten** | Kulturnamen, Sorten, Einheiten | Fachcommunity | Datenbank, mehrsprachige Felder |

Der entscheidende Punkt: **Sprache ≠ Jurisdiktion.** Eine Solawi in Südtirol arbeitet auf
Deutsch unter italienischem Recht. Eine Genfer CSA auf Französisch unter Schweizer Recht.
Wer Recht an Sprache koppelt, baut das falsch.

## 2. Quellsprache Deutsch

Ungewöhnlich, aber richtig: die Nutzer:innen sind deutschsprachige Solawi-Praktiker:innen,
und die Domäne hat ihr Vokabular auf Deutsch. Also:

- Quelltexte der UI-Strings: **Deutsch**
- Schlüssel: sprachneutral und semantisch — `cultivation.planting.overdue.title`,
  nie `cultivation.text42` und nie der deutsche Text als Schlüssel
- Alle anderen Sprachen: Übersetzungen aus dem Deutschen
- Code und Bezeichner: Englisch (siehe `AGENTS.md` §2)

## 3. Regeln für UI-Strings

1. **Keine Stringverkettung.** `"Es fehlen " + n + " Anteile"` bricht in jeder anderen
   Sprache. Interpolation mit benannten Platzhaltern.
2. **Plural über ICU MessageFormat.** Deutsch hat 2 Pluralformen, Polnisch 4,
   Arabisch 6. Ein `if (n === 1)` ist ein Bug.
3. **Genderformen als Inhalt, nicht als Code.** Deutsch ist hier heikel; die
   Schreibweise (Doppelpunkt, Sternchen, Neutralformulierung) ist pro Instanz
   konfigurierbar. Solawis haben dazu Meinungen, und das ist legitim.
4. **Kontext für Übersetzende.** Jeder Schlüssel bekommt einen Kommentar, wo er auftaucht.
   „Satz" ohne Kontext ist unübersetzbar — Aussaateinheit oder Grammatik?
5. **Platz einplanen.** Deutsche Komposita sind lang, Layouts müssen 40 % Überlänge aushalten.

## 4. Jurisdiktions-Pakete

Alles Rechtliche ist **Inhalt**, nie Code.

```
content/jurisdictions/
  de/
    legal-forms/      e.V., eG, GbR, GmbH, gGmbH, Kombimodelle
    deadlines/        Registerfristen, Förderstichtage
    taxes/            Gemeinnützigkeit, Umsatzsteuer, Kleinunternehmer
    payments/         SEPA-Lastschrift, Mandatspflichten
    templates/        Satzung, Mitgliedsvertrag, Pachtvertrag
  at/
  ch/
```

Ein Paket ist Daten + Markdown, kein Programm. Es kann von Jurist:innen gepflegt werden,
die nicht programmieren. Jedes Paket trägt Stand, Quelle und einen sichtbaren Hinweis,
dass es keine Rechtsberatung ersetzt.

**Fallback-Kette:** angefragte Jurisdiktion → Nachbarjurisdiktion (nur wenn ausdrücklich
erlaubt) → generisch. Niemals stillschweigend deutsches Recht in Österreich anzeigen.

## 5. Kulturdaten mehrsprachig

Kulturnamen sind ein eigenes Problem: „Grünkohl", „Braunkohl", „Krauskohl" sind
dasselbe; Regionalbezeichnungen sind stark.

- Stabiler Schlüssel: botanischer Name (`brassica-oleracea-sabellica`)
- Anzeigenamen pro Sprache, mehrere Synonyme erlaubt
- Regionale Bevorzugung pro Instanz einstellbar
- Suche findet über alle Synonyme

## 6. Formate

Nicht selbst bauen, Plattform-Intl nutzen:

- Datum, Zahl, Währung: locale-abhängig
- **Einheiten**: metrisch als Default, aber Stück/Bund/Kiste sind eigene Einheiten mit
  Umrechnung — „3 Bund Radieschen" ist die Realität, nicht „0,4 kg"
- Wochenbeginn, Kalenderwochen (ISO vs. US) — für Anbauplanung kritisch
- Zeitzonen: Hof hat eine, Mitglieder können andere haben

## 7. Übersetzungsprozess

- Format: Standard-Katalogdateien, kompatibel mit Weblate
- Vollständigkeitsanzeige pro Sprache in der App
- Fehlende Übersetzung → Rückfall auf Deutsch, sichtbar markiert, nie leer
- Übersetzungen sind Beiträge wie Code: gleiche Wertschätzung, gleicher Review
- Zielsprachen nach Priorität: DE (Quelle) → EN → FR → NL → IT → PL → ES

## 8. Prüfliste vor jedem Merge

- [ ] Kein hartkodierter Text in Komponenten
- [ ] Alle neuen Schlüssel haben Kontextkommentar
- [ ] Plural über ICU gelöst
- [ ] Keine Annahme über Jurisdiktion im Code
- [ ] Layout hält 40 % längere Strings aus
- [ ] Datum/Zahl/Einheit über Intl formatiert
