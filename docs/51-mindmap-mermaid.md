# Die Handskizze als Mermaid-Diagramm

Rekonstruktion von `uploads/IMG_9988.jpeg` (lesbar: `uploads/mm_rot.jpg`).

**Stand: alle Unsicherheiten geklärt** (Rückmeldung vom 25.07.2026, siehe §4).
Die Diagramme unten bilden die korrigierte Fassung ab.

---

## 1. Gesamtbild

```mermaid
flowchart TB
    %% ============ GELD & QUELLEN ============
    subgraph FIN["💰 Geld & Quellen"]
        direction TB
        GELD["Geld"]
        RUECK["Rücklagen"]
        INVEST["Investitionen"]
        MERCH["Merch"]
        SPENDEN["Spenden"]
        MAERKTE["Märkte"]
    end

    %% ============ PRODUKTIONSMITTEL ============
    subgraph MITTEL["🚜 Produktionsmittel"]
        direction TB
        SAAT["Saatgut<br/><small>Kulturenzahl pro Hof<br/>CS: ca. 55 auf 2 ha</small>"]
        MASCH["Maschinerie<br/><small>Zustand · Verfügbarkeit<br/>Ort · Anzahl</small>"]
    end

    %% ============ QUERSCHNITT ============
    PERS["👥 Personal<br/><small>Querschnitt über die<br/>gesamte Wertschöpfungskette</small>"]

    %% ============ ANBAU ============
    subgraph ANBAU["🌱 Anbau & Ernte"]
        direction TB
        AUSSAAT["Aussaat"]
        WASSER["Wasser"]
        DUENGER["Dünger"]
        JAETEN["Jäten"]
        ERNTE["Ernte"]
    end

    %% ============ NACHERNTE ============
    subgraph NACH["🥫 Nachernte"]
        direction TB
        LAGER["Lager"]
        EINWECK["Einwecken"]
        KOMPOST["Kompost"]
        GEMUESE["Gemüse<br/><small>wie viel · was · wann</small>"]
    end

    %% ============ DATEN ============
    DATEN["📊 Daten<br/><small>Rhythmen · Mengen · Ursachen<br/>→ Transparenz &amp; Optimierung</small>"]

    %% ============ ANTEIL ============
    ANTEIL(("ANTEIL"))
    ANTEIL_D["Wer · Welchen · Wie viele → 87 Anteile<br/>Warteliste · Urlaub · Retention?"]

    %% ============ GEMEINSCHAFT ============
    subgraph GEM["🤝 Gemeinschaft"]
        direction TB
        GEMEIN["Gemeinschaft"]
        COMM["Community"]
        WISSEN["Wissen"]
        CONN["Connections<br/><small>Netzwerk zu anderen Höfen</small>"]
        VEREIN["Verein"]
        EVENTS["Events"]
        HOFCAFE["Hofcafé"]
        HOFTOUR["Hoftouren"]
        BILDUNG["Bildungsstätte"]
        WOCHEN["Wochenevents"]
        MITMACH["Mitmachtage"]
    end

    %% ---- Geldflüsse ----
    GELD --> SAAT
    GELD --> MASCH
    GELD --> PERS
    GELD --> INVEST
    GELD --> RUECK
    MERCH --> GELD
    SPENDEN --> GELD
    MAERKTE --> GELD
    GEMEIN --> GELD

    %% ---- Personal als Querschnitt ----
    PERS -.-> AUSSAAT
    PERS -.-> ERNTE
    PERS -.-> NACH
    PERS -.-> GEM

    %% ---- Produktion ----
    SAAT --> AUSSAAT
    MASCH --> AUSSAAT
    WASSER --> AUSSAAT
    DUENGER --> AUSSAAT
    JAETEN --> AUSSAAT
    AUSSAAT --> ERNTE

    %% ---- Daten entstehen überall ----
    AUSSAAT --> DATEN
    JAETEN --> DATEN
    WASSER --> DATEN
    ERNTE --> DATEN
    DATEN -.->|Optimierung| AUSSAAT

    %% ---- Nachernte ----
    ERNTE --> EINWECK
    ERNTE --> LAGER
    ERNTE --> KOMPOST
    LAGER --> EINWECK
    ERNTE --> GEMUESE
    KOMPOST -.->|Rückfluss| AUSSAAT

    %% ---- Zum Anteil ----
    GEMUESE --> ANTEIL
    GEMUESE -.-> MAERKTE
    ANTEIL --- ANTEIL_D
    ANTEIL -->|Beiträge| GELD

    %% ---- Gemeinschaft ----
    ANTEIL --> GEMEIN
    GEMEIN --> COMM
    COMM --> EVENTS
    COMM --> VEREIN
    COMM --> CONN
    GEMEIN --> WISSEN
    EVENTS --> HOFCAFE
    EVENTS --> HOFTOUR
    EVENTS --> BILDUNG
    EVENTS --> WOCHEN
    EVENTS --> MITMACH

    %% ============ STYLES ============
    classDef sure fill:#d4edda,stroke:#28a745,stroke-width:2px,color:#000
    classDef cross fill:#e2d9f3,stroke:#6f42c1,stroke-width:3px,color:#000
    classDef data fill:#d1ecf1,stroke:#0c5460,stroke-width:3px,color:#000
    classDef hub fill:#cce5ff,stroke:#004085,stroke-width:4px,color:#000

    class GELD,RUECK,INVEST,MERCH,SPENDEN,MAERKTE,SAAT,MASCH,AUSSAAT,WASSER,DUENGER,JAETEN,ERNTE,LAGER,EINWECK,KOMPOST,GEMUESE,GEMEIN,COMM,WISSEN,CONN,VEREIN,EVENTS,HOFCAFE,HOFTOUR,BILDUNG,WOCHEN,MITMACH,ANTEIL_D sure
    class PERS cross
    class DATEN data
    class ANTEIL hub
```

---

## 2. Der Kreislauf, freigelegt

Dasselbe ohne Details — das ist die eigentliche Aussage der Skizze:

```mermaid
flowchart LR
    GELD["💰 Geld"] -->|"Saatgut · Maschinerie<br/>Personal · Investitionen"| PROD["🌱 Produktion"]
    PROD -->|Aussaat → Ernte| ERNTE["🥬 Ernte"]
    ERNTE -->|"Gemüse<br/>Lager · Einwecken"| ANTEIL(("ANTEIL"))
    ANTEIL -->|Beiträge| GELD
    ANTEIL --> GEM["🤝 Gemeinschaft"]
    GEM -->|"Events · Spenden<br/>Merch · Bildung"| GELD
    ERNTE -.->|Überschuss| MKT["🏪 Märkte"]
    MKT --> GELD
    ERNTE -.->|Kompost| PROD
    ERNTE -.->|Daten| LERN["📊 Lernen"]
    LERN -.->|bessere Planung| PROD

    classDef n fill:#d4edda,stroke:#28a745,stroke-width:2px,color:#000
    classDef h fill:#cce5ff,stroke:#004085,stroke-width:4px,color:#000
    classDef d fill:#d1ecf1,stroke:#0c5460,stroke-width:2px,color:#000
    class GELD,PROD,ERNTE,GEM,MKT n
    class ANTEIL h
    class LERN d
```

**Zwei große Kreise, ein Knoten.** Produktionskreis (Geld → Anbau → Ernte → Anteil →
Beiträge → Geld) und Gemeinschaftskreis (Anteil → Gemeinschaft → Events/Spenden/Merch →
Geld). Dazu drei kleine Rückflüsse: **Kompost** in die Produktion, **Märkte** für
Überschuss, und **Daten** als Lernschleife.

---

## 3. Die offenen Fragen der Skizze — und wo sie gelandet sind

```mermaid
flowchart TB
    Q1["❓ Daten?"]
    Q2["❓ Animals?"]
    Q3["❓ Sticky Business?"]
    Q4["❓ Was ist die richtige Größe<br/>für meine Unternehmung?<br/><small>→ Fläche / Personal</small>"]

    Q1 -.->|"wird Querschnittsthema"| A1["ADR-0008<br/>Betriebsdaten: Rhythmen, Mengen,<br/>Ursachen — <b>ohne</b> Personentracking"]
    Q2 -.->|wird Modul| A2["Modul 18<br/>livestock"]
    Q3 -.->|wird Kennzahl| A3["insights<br/>nur auf Gemeinschaftsebene,<br/>kein Score pro Mitglied"]
    Q4 -.->|wird Analyse| A4["insights<br/>Schwellenanalyse<br/>Fläche · Personal · Anteile · Budget"]

    classDef q fill:#e9ecef,stroke:#6c757d,stroke-width:2px,stroke-dasharray:5 5,color:#000
    classDef a fill:#d4edda,stroke:#28a745,stroke-width:2px,color:#000
    class Q1,Q2,Q3,Q4 q
    class A1,A2,A3,A4 a
```

---

## 4. Geklärte Lesungen

| # | Stelle | Klärung | Folge |
|---|---|---|---|
| 1 | Wort links von „Geld" | **Merch** — bestätigt | Merch bleibt Einnahmeposten in `finance-model`. **Aber:** Märkte sind trotzdem relevant, weil manche Solawis auf Märkten verkaufen → **neues Modul 21 `markets`** |
| 2 | „ca. 55 Kulturen" | Richtig, gilt für crowd salat auf 2 ha — **aber pro Hof frei** | Keine Annahme im Modell. Kulturenzahl ist Betriebsdatum, keine Konstante |
| 3 | „87" | **87 Anteile** (aktueller Stand CS) | Bestätigt das gewichtete Anteilsmodell aus ADR-0005 |
| 4 | Investitionen ↔ Geld | **Beide Richtungen**: Geld → Investitionen *und* zurück | Pfeil korrigiert |
| 5 | Personal | **Querschnitt über die gesamte Wertschöpfungskette**, nicht ein Schritt | Als eigener Querschnittsknoten dargestellt (violett) |
| 6 | „Daten" | **Betriebsdaten zur Transparenz und Optimierung** — siehe unten | Eigene ADR-0008, Erweiterung von `tasks` und `insights` |
| 7 | „Connections" | **Netzwerk zu anderen Höfen** | Gehört zu `knowledge` / `governance` |
| 8 | Lager ↔ Einwecken | **Beides**: direkt von der Ernte *und* aus dem Lager | Beide Pfeile bleiben |

---

## 5. Zu Punkt 6: was „Daten" wirklich bedeutet

Die Erläuterung dazu war die inhaltsreichste Rückmeldung und verdient eine eigene
Zusammenfassung, weil sie ein Querschnittsthema beschreibt, kein Modul.

**Gemeint ist:** welche Daten wären interessant zu sammeln, um daraus Erkenntnisse zu
gewinnen — innerhalb einer Saison und über Jahre hinweg.

Beispiele aus der Rückmeldung:

- In welchem **Rhythmus** wird ein Beet gejätet, gewässert, geerntet?
- **Wie viel** wird geerntet — und warum mal mehr, mal weniger, mal schneller, mal langsamer?
- **Arbeitsreihenfolge im Raum**: ein Beet mulchen oder jäten, während direkt daneben
  gepflanzt werden soll, ist unklug — erst alles andere erledigen, dann pflanzen, weil
  man dann noch frei rangieren kann.

**Ausdrücklich nicht gemeint:** Tracking von Mitarbeitenden. Es geht um Transparenz,
Best Practices und Optimierung.

Diese Abgrenzung ist heikel genug für eine eigene Entscheidung:
[**ADR-0008 — Betriebsdaten ohne Personentracking**](adr/0008-betriebsdaten-ohne-personentracking.md).

Das dritte Beispiel ist besonders interessant, weil es kein Auswertungs-, sondern ein
**Planungsproblem** ist: Aufgaben haben eine räumliche und zeitliche Ordnung, und die
richtige Reihenfolge spart real Arbeit. Das wird als **Reihenfolge-Assistent** in `tasks`
aufgenommen (Modulkatalog Nr. 5).
