# Domänenmodell & Modulgrenzen

## 1. Grundsatz

Module besitzen ihre Daten allein. Kein Modul liest die Tabellen eines anderen.
Austausch läuft über **Ereignisse** (asynchron, entkoppelt) und **Fähigkeiten**
(synchrone, vom Kern vermittelte Schnittstellen).

Test für jede Modulgrenze: *Lässt sich das Modul abschalten, ohne dass das System
kaputtgeht?* Wenn nein, ist die Grenze falsch gezogen.

## 2. Kernentitäten

Nur diese leben im Kern:

```
Organization    ein Hof / eine Initiative; Mandantengrenze
Person          ein Mensch mit Login
Role            Rollenzuweisung innerhalb einer Organization
Capability      was eine Rolle darf, von Modulen deklariert
ModuleState     aktiviert/deaktiviert + Konfiguration je Organization
Event           unveränderliches Ereignisprotokoll
Locale          Sprach- und Formatpräferenz je Person und Organization
```

Bewusst **nicht** im Kern: `Member`, `Share`, `Bed`, `Crop`. Das ist Fachlichkeit und
gehört in Module — sonst wächst der Kern, bis alles von ihm abhängt.

## 3. Wichtige Modulentitäten

**`land`**
```
Field        Schlag/Fläche, Geometrie, Bodenprofil
Bed          Beet/Abschnitt innerhalb eines Field
Feature      Wasserstelle, Weg, Gewächshaus, Kompost, Agroforststreifen
Perennial    mehrjährige Pflanzung mit Standzeit über Jahre
```

**`cultivation`**
```
Crop         Kulturart, botanischer Name als stabiler Schlüssel, Familie
Variety      Sorte
Planting     ein Satz: Crop + Bed + Zeitraum + Mengenerwartung
Stage        Aussaat → Pflanzung → Pflege → Ernte → Räumung
```

**`members`**
```
Household    Haushalt — die eigentliche Einheit, nicht die Einzelperson
ShareType    Anteilsart mit Gewicht (groß 1,0 / klein 0,5 / …), pro Hof konfigurierbar
Share        Anteil eines Haushalts, verweist auf ShareType, Laufzeit
Contribution Beitrag, Rhythmus, Zahlungsweg
Absence      Abwesenheit mit optionaler Vertretung
```

**`bidding`**
```
Round        Bieterrunde, Zielsumme, Status, Anzeigemodus
Bid          Runde + Haushalt + Betrag + ShareType — normale Verknüpfung,
             während der Runde versiegelt, danach nur für die Finanzrolle sichtbar
Comment      anonym, ohne Bezug zum Betrag
```

**`inventory`**
```
Item         Werkzeug, Maschine, Verbrauchsmaterial
Location     Lagerort (fest) vs. aktueller Standort
Loan         Ausleihe: Item, Person, seit wann
Maintenance  Intervall, letzte Durchführung, Status
```

## 4. Ereignisse

Ereignisse sind Vergangenheitsform, unveränderlich und modulübergreifend interessant.
Interne Zustandsänderungen eines Moduls sind *keine* Ereignisse.

Beispiele:
```
planting.sown              cultivation → tasks, insights
planting.harvest_expected  cultivation → distribution
harvest.recorded           harvest     → distribution, insights
absence.declared           members     → distribution
share.created              members     → distribution, insights
bidding.round_closed       bidding     → finance-model, members
item.overdue               inventory   → communication
milestone.completed        founding    → insights
task.completed             tasks       → participation, insights
```

Regel: Ein Ereignis trägt genug Kontext, dass Empfänger nicht zurückfragen müssen —
aber keine personenbezogenen Daten, die der Empfänger nicht ohnehin sehen darf.

## 5. Fähigkeiten (synchron)

Wenn ein Modul *jetzt* eine Antwort braucht, fragt es nicht ein anderes Modul, sondern
eine im Kern registrierte Fähigkeit. Fehlt der Anbieter, liefert der Kern einen
definierten Leerwert — nie einen Fehler.

```
locations.list()        angeboten von land        → tasks, inventory
people.list()           angeboten von kernel      → alle
share.count()           angeboten von members     → distribution, finance-model
budget.target()         angeboten von finance-model → bidding
```

So bleibt `tasks` lauffähig, auch wenn `land` fehlt — dann gibt es eben keine
Ortsauswahl.

## 6. Offline & Synchronisation

Feldnutzung ist der Normalfall, nicht die Ausnahme.

- Lokal-first: der Client schreibt in eine lokale Datenbank und synchronisiert später
- Konflikte: „letzter Schreibvorgang gewinnt" ist für Erntemengen **falsch**.
  Additive Werte (geerntete Kilo) werden zusammengeführt, nicht überschrieben.
- Jeder Datensatz trägt Herkunftsgerät und Zeitstempel
- Bei echten Konflikten: Mensch entscheidet, System vermutet nicht

## 7. Datenschutz im Modell

- **Datensparsamkeit als Default.** Neues Feld an einer Person? Begründungspflicht im PR.
- **Keine Mitgliederkarte.** Nachbarschaft ist Radius + Anzahl, serverseitig berechnet.
  Koordinaten verlassen den Server nie. Eine Karte mit Wohnorten aller Mitglieder ist ein
  Datenleck mit Kartenansicht.
- **Gebote sind peer-privat, nicht admin-privat.** Mitglieder sehen einander nie, die
  Finanzrolle sieht alles Nötige — Abrechnung braucht das. Während der Runde versiegelt,
  jeder Zugriff im Audit-Log.
- **Löschung ist echt.** Austritt löscht personenbezogene Daten; Statistik bleibt
  anonymisiert erhalten.
- **Audit-Log** für Zugriffe auf sensible Daten.

## 8. Glossar

Verbindlich. Diese Begriffe werden **nicht** übersetzt, sondern als Fachbegriffe geführt.

| Begriff | Bedeutung | Warum nicht übersetzen |
|---|---|---|
| **Solawi** | Solidarische Landwirtschaft | Eigenname der Bewegung im dt. Raum |
| **CSA** | Community Supported Agriculture | internationales Pendant |
| **Ernteanteil** | Anteil an der Jahresernte eines Haushalts | „share" verliert den Erntebezug |
| **Bieterrunde** | Verfahren, in dem Mitglieder anonym ihren Jahresbeitrag nennen, bis die Zielsumme gedeckt ist | **kein** „auction" — es gibt keine Konkurrenz um ein Gut, das ist der ganze Punkt |
| **Depot** | Abholstelle | „pickup point" ok als Übersetzung, Datenmodell heißt Depot |
| **Satz** | eine Aussaat-/Pflanzeinheit einer Kultur zu einem Zeitpunkt | im Code `Planting` |
| **Schlag** | zusammenhängende Bewirtschaftungsfläche | im Code `Field` |
| **Anteilsschein / Anteil** | vertragliche Einheit der Mitgliedschaft | |
| **Solidartafel** | Tisch für abgegebene/überschüssige Ware | |
| **Mitarbeit** | Arbeitsbeitrag von Mitgliedern | nicht „volunteering" — Erwartung ist oft verbindlich |
