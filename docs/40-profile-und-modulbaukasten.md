# Profile & Modulbaukasten

Entscheidung: **eine Solawi stellt sich ihr System selbst zusammen.** Es gibt keine
Größenklassen, keine „Pro-Version", keine Annahme darüber, wie verteilt wird.

Das ist richtig, hat aber eine Falle: ein Baukasten mit 16 Modulen und dutzenden Optionen
ist für eine Gründungsgruppe am Küchentisch nicht bedienbar. Deshalb zwei Ebenen.

## 1. Zwei Ebenen: Profil und Feinjustierung

**Profil** = ein Startpunkt, kein Käfig. Fünf Fragen beim Einrichten, daraus ein
Vorschlag, alles danach frei änderbar.

Die fünf Fragen:

1. In welcher Phase seid ihr? *(Gründung / erste Saison / laufender Betrieb)*
2. Wie kommt das Gemüse zu den Menschen? *(Abholung am Hof / Depots / Lieferung / gemischt)*
3. Wie werden die Beiträge bestimmt? *(Bieterrunde / Festbeitrag / Beitragsstufen)*
4. Wird Mitarbeit erwartet? *(verpflichtend / erwartet / freiwillig / gar nicht)*
5. Wie viele Haushalte, ungefähr?

Daraus ergibt sich ein Modulvorschlag mit Begründung — nie eine stille Vorauswahl.
Jedes Modul lässt sich danach einzeln an- und abschalten, jederzeit.

## 2. Verteilung als Beispiel für echte Variantenvielfalt

Der Verteilweg ist die Variable, die sich am stärksten zwischen Höfen unterscheidet, und
genau hier scheitern starre Systeme. Deshalb ist `distribution` selbst modular aufgebaut:

| Variante | Was gebraucht wird |
|---|---|
| **Abholung am Hof** | Öffnungszeiten, Abholquittierung. Keine Tourenplanung, keine Depotbetreuung. |
| **Depots** | Depotorte, Betreuungspersonen, Kapazitäten, Lieferlisten, Kistenrückläufe |
| **Lieferung an die Haustür** | Adressen (heikel!), Tourenplanung, Zeitfenster |
| **Selbsternte** | keine Anteilszusammenstellung, dafür Beetzuordnung und Erntehinweise |
| **Gemischt** | mehrere der obigen parallel, pro Haushalt wählbar |

Wer am Hof abholt, sieht nie ein Tourenplanungsfeld. Wer Selbsternte macht, sieht keine
Kistenpackliste. **Nicht ausgegraut — nicht vorhanden.**

Analog bei Anbausystemen: Marktgarten mit festen Beetbreiten, Feldgemüsebau in Reihen,
Agroforst mit mehrjährigen Streifen, Gewächshaus, Mischkultur. Das Modul `land` kennt
Beetraster *und* freie Geometrien, weil beides real vorkommt.

## 3. Regeln für den Baukasten

1. **Abschalten muss folgenlos sein.** Ein deaktiviertes Modul darf nichts kaputtmachen.
   Fähigkeiten liefern definierte Leerwerte (siehe Domänenmodell §5).
2. **Kein Modul ist Voraussetzung für den Betrieb** außer dem Kern.
3. **Wiedereinschalten stellt Daten wieder her.** Abschalten löscht nicht, es blendet aus.
   Löschen ist ein eigener, ausdrücklicher Vorgang.
4. **Vorschläge statt Zwang.** Wenn ein Modul ein anderes sinnvoll ergänzt, wird das
   erklärt — nicht erzwungen.
5. **Komplexität wächst mit Nutzung.** Funktionen, die nie benutzt werden, dürfen nach
   einer Saison in ein „Mehr"-Menü rutschen.

## 4. Skalierung ohne Größenklassen

Die Frage war, ob ein System für 20 und für 650 Anteile funktioniert. Antwort: ja, aber
nicht durch Größenprofile, sondern durch **Mengenverhalten**:

- Listen sind ab Anfang paginiert und durchsuchbar — auch wenn erst 12 Einträge da sind
- Massenaktionen existieren immer, stören aber bei kleinen Mengen nicht
- Kennzahlen brauchen Mindestmengen, sonst zeigen sie Rauschen als Erkenntnis
  (`insights` blendet Auswertungen unterhalb sinnvoller Fallzahlen aus)
- Rollen sind bei kleinen Höfen mehrfach besetzt durch dieselbe Person — das System darf
  nie erzwingen, dass Vorstand, Depotbetreuung und Gärtner:in verschiedene Menschen sind

## 5. Was der Baukasten *nicht* darf

Er darf nicht dazu führen, dass zwei Solawis so unterschiedlich konfiguriert sind, dass
sie sich nicht mehr gegenseitig helfen können. Deshalb:

- Kerndatenmodelle sind überall gleich, nur sichtbar oder nicht
- Anonymisierte Kennzahlen (siehe ADR-0007) sind über Konfigurationen hinweg vergleichbar
- Die Stolperfallenbibliothek ist gemeinsam, mit Filtern nach Konfiguration
