# Stolperfallen — Gründungsphase (Beispielinhalte)

Format-Demonstration für das Modul `founding`. Jede Falle folgt derselben Struktur und
ist damit maschinenlesbar an einen Meilenstein knüpfbar.

> **Kein Rechtsrat.** Diese Sammlung ist Erfahrungswissen der Community. Bei
> Rechtsform, Vertrag und Steuer gehört fachlicher Rat dazu.

---

## SF-001 — Pachtvertrag ohne fixierten Verhandlungszeitpunkt

**Meilenstein:** Fläche → Pachtvertrag
**Schwere:** hoch · **Häufigkeit:** häufig

**Symptom**
Der erste Pachtvertrag läuft nur fünf Jahre. Investitionen in Infrastruktur werden
aufgeschoben, weil niemand weiß, ob es danach weitergeht.

**Ursache**
Verpächter — oft Kommunen — sichern sich mit kurzen Laufzeiten ab, gerade wenn sie mit
Vorbetreibern schlechte Erfahrungen gemacht haben. Die Solawi akzeptiert, weil sie die
Fläche will.

**Kosten**
Jahre ohne Gewächshaus, Lager oder Wasseranschluss. Im schlimmsten Fall Aufgabe.

**Vermeidung**
Nicht auf eine lange Laufzeit pochen, sondern **im Vertrag festschreiben, wann über den
Folgevertrag verhandelt wird**. Ein früh fixierter Verhandlungstermin erlaubt es, mit
zwei Jahren nachweislicher Arbeit in ein Gespräch über 30 oder 99 Jahre zu gehen.

**Quelle**
Praxis DIE KOOPERATIVE eG, Frankfurt-Oberrad — Pachtvertrag über zunächst fünf Jahre mit
im Vertrag verankertem Verhandlungszeitpunkt, danach Aussicht auf Langfristpacht
([Interview, Netzwerk Solawi](https://www.youtube.com/watch?v=6vDVzi2XcWo)).

---

## SF-002 — Gärtner:innenlohn zu niedrig kalkuliert

**Meilenstein:** Geld → Vollkostenrechnung
**Schwere:** hoch · **Häufigkeit:** sehr häufig

**Symptom**
Die erste Bieterrunde ergibt einen Beitrag, der sich gut anfühlt. Zwei Jahre später
brennt das Anbauteam aus, und eine Erhöhung ist sozial kaum durchsetzbar.

**Ursache**
Idealismus in der Gründungsgruppe, Angst vor abschreckenden Beiträgen, und eine
Kalkulation, die Sozialabgaben, Urlaub, Krankheit und Fortbildung vergisst.

**Kosten**
Personalwechsel im Anbauteam — der teuerste Verlust, den eine Solawi erleiden kann, weil
Ortskenntnis nicht übertragbar ist.

**Vermeidung**
Lohn **vor** allen anderen Posten festlegen, nicht als Restgröße. Immer als Stundenlohn
gegenrechnen und in Realstunden der Hochsaison prüfen, nicht in Vertragsstunden.
Jährliche Steigerung von Beginn an einplanen und kommunizieren, statt sie später zu
erkämpfen.

**Prüffrage fürs Plenum**
„Würden wir diese Stelle selbst annehmen — bei diesem Lohn, in diesem Alter, mit Familie?"

---

## SF-003 — Verbindlichkeit der Mitarbeit nie geklärt

**Meilenstein:** Vision → Verbindlichkeit
**Schwere:** mittel · **Häufigkeit:** sehr häufig

**Symptom**
Immer dieselben zehn Leute kommen zum Aktionstag. Unmut wächst auf beiden Seiten, wird
aber nicht offen verhandelt, weil „solidarisch" Verpflichtung auszuschließen scheint.

**Ursache**
In der Gründungseuphorie wird Mitarbeit als selbstverständlich angenommen und deshalb
nicht definiert.

**Vermeidung**
Vor der ersten Saison entscheiden und schriftlich festhalten: Ist Mitarbeit
Voraussetzung, Erwartung oder Angebot? Wie viele Stunden? Was passiert, wenn jemand nicht
kann — Ersatzbeitrag, Tausch, oder nichts? Jede dieser Antworten ist legitim; **keine
Antwort ist die einzige falsche.**

---

## SF-004 — Wachstum ohne Schwellenplanung

**Meilenstein:** Vision → Größe
**Schwere:** mittel · **Häufigkeit:** mittel

**Symptom**
Die Solawi wächst stetig, und plötzlich reichen Gewächshaus, Waschplatz, Kühlung und
Personal gleichzeitig nicht mehr. Alles muss auf einmal investiert werden.

**Ursache**
Wachstum wird als gleitend gedacht, ist aber sprunghaft: Betriebsmittel skalieren in
Stufen, nicht linear.

**Vermeidung**
Schwellen im Voraus benennen — „bei X Anteilen brauchen wir eine weitere Stelle, bei Y
ein größeres Gewächshaus" — und die Untergrenze der Wirtschaftlichkeit ebenso klar
definieren wie die Obergrenze der aktuellen Ausstattung.

---

## SF-005 — Boden nicht vor Vertragsabschluss geprüft

**Meilenstein:** Fläche → Bodenprobe
**Schwere:** hoch · **Häufigkeit:** mittel

**Symptom**
Nach der ersten Saison zeigt sich: Paprika geht nicht, Gurken werden gefressen, der
pH-Wert legt Spurennährstoffe fest, das Bodenleben ist nach Jahren konventioneller
Nutzung am Boden.

**Ursache**
Fläche wird nach Lage, Größe und Preis ausgewählt — Bodenanalyse kommt danach.

**Vermeidung**
Bodenprobe **vor** Vertragsunterschrift, inkl. pH, Nährstoffen, Humusgehalt und
Vornutzung. Kein Ausschlusskriterium, aber es verändert Kulturenwahl und die ersten
Investitionen erheblich. Erste Jahre mit robusten Kulturen planen und Bodenaufbau
(Gründüngung, Mulch, Kompost) als eigenen Posten budgetieren.

**Quelle**
Praxis DIE KOOPERATIVE eG: hoher pH-Wert und wenig lebendiger Boden führten zu einem
angepassten Kulturportfolio und mehrjährigem Bodenaufbau
([Interview](https://www.youtube.com/watch?v=6vDVzi2XcWo)).

---

## Datenschema (Entwurf)

```yaml
id: SF-001
milestone: land.lease-contract
severity: high        # low | medium | high
frequency: common     # rare | medium | common | very-common
jurisdiction: [de, at, ch]   # oder null = allgemeingültig
symptom: …
cause: …
cost: …
prevention: …
plenum_question: …    # optional
sources: [url, …]
```

Fallen mit `jurisdiction: null` gelten überall; rechtsbezogene Fallen werden pro
Jurisdiktion gepflegt und dürfen sich widersprechen.
