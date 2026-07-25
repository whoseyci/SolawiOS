# Start hier

Du hast noch nichts installiert. Das ist völlig in Ordnung — hier sind drei
Wege, vom schnellsten zum vollständigsten.

---

## Kurzantwort auf die Frage „Mac oder Cloudflare-Dashboard?"

**Das Cloudflare-Dashboard allein reicht nicht.** Im Dashboard lässt sich nur eine
einzelne Datei per Copy-Paste einfügen. Dieses Projekt sind 12 Pakete, die vor
dem Deploy gebaut werden müssen — das kann der Dashboard-Editor nicht.

Es gibt aber einen Dashboard-Weg *ohne* lokale Installation: **GitHub + Workers
Builds** (Weg 3 unten). Cloudflare baut dann in der Cloud, du klickst nur.

**Meine Empfehlung: Weg 1.** Fünfzehn Minuten, und du hast alles lokal.

---

## Weg 1 — Auf dem Mac (empfohlen)

Du brauchst **nur Node.js**. Kein GitHub, kein Cloudflare, kein Account.

### Schritt 1: Node installieren

Lade den Installer von **[nodejs.org](https://nodejs.org)** (Version 20 oder
neuer, „LTS" nehmen) und klick dich durch. Kein Terminal nötig.

*Falls du Homebrew hast, geht auch:* `brew install node`

### Schritt 2: Terminal öffnen

`Cmd + Leertaste` → „Terminal" tippen → Enter.

### Schritt 3: Ins Projekt wechseln und einrichten

```bash
cd ~/Downloads/solawi-os     # oder wohin du den Ordner gelegt hast
npm run setup
```

Das Skript prüft alles, installiert, baut und testet. Beim ersten Mal dauert es
ein paar Minuten (~200 MB Download).

### Schritt 4: Anschauen

```bash
npm run demo
```

Legt eine Solawi nach dem Vorbild von crowd salat an, führt eine komplette
Bieterrunde mit 87 Anteilen durch und zeigt, dass der Balken sich bei einem
9.999-€-Gebot **nicht** bewegt. Läuft im Arbeitsspeicher, schreibt nichts.

### Schritt 5: Echt laufen lassen

```bash
npm run dev
```

Dann im Browser: **http://localhost:8787/health**

Die Daten liegen in `./data/solawi.db` — eine normale SQLite-Datei. Löschen =
alles zurückgesetzt.

> **Wichtig:** Das läuft komplett auf deinem Rechner. Nichts geht ins Internet,
> niemand sonst sieht etwas. Zum Ausprobieren ideal.

---

## Weg 2 — Cloudflare, vom Mac aus

Wenn Weg 1 läuft und du es online haben willst:

```bash
npm run deploy
```

Das Skript meldet dich an (Browserfenster geht auf), legt Datenbank, Cache und
Speicher an, **trägt die IDs automatisch ein** — genau der fummelige Teil — und
deployt.

Du brauchst dafür einen kostenlosen Cloudflare-Account.

**Kosten:** Für ein paar Solawis bleibt das im kostenlosen Kontingent. Zwischen
den Anfragen skaliert es auf null.

**Ein Hinweis zu R2** (Fotos, Exporte): Cloudflare verlangt dafür eine
Zahlungsmethode, selbst im Gratis-Tarif. Wenn du keine hinterlegen willst, merkt
das Skript das und deaktiviert nur diesen Teil. Alles andere läuft.

---

## Weg 3 — Ganz ohne lokale Installation (GitHub + Cloudflare)

Wenn du wirklich nichts auf dem Mac installieren willst:

1. **GitHub-Account** anlegen (kostenlos), Repository erstellen, Projektordner
   per Drag-and-Drop im Browser hochladen
2. Im **Cloudflare-Dashboard**: *Workers & Pages* → *Create* → *Connect to Git*
3. Repository auswählen. Cloudflare erkennt `wrangler.toml`, baut in der Cloud
   und deployt bei jedem Push automatisch
4. Die Bindings (D1, KV) müssen einmalig im Dashboard unter *Settings →
   Bindings* angelegt werden

**Ehrlich gesagt:** Das klingt einfacher, als es ist. Die Bindings von Hand
anzulegen ist mühsamer als `npm run deploy`, und ohne lokale Umgebung kannst du
nichts ausprobieren, bevor es online geht. Nimm diesen Weg nur, wenn du
prinzipiell nichts installieren möchtest.

---

## Womit vergleichen?

| | Weg 1 (lokal) | Weg 2 (CF vom Mac) | Weg 3 (nur Browser) |
|---|---|---|---|
| Zu installieren | Node.js | Node.js | nichts |
| Accounts | keine | Cloudflare | GitHub + Cloudflare |
| Dauer | ~15 Min | +10 Min | ~45 Min |
| Ausprobieren vor dem Deploy | ja | ja | nein |
| Für andere erreichbar | nein | ja | ja |
| Rückgängig machen | Ordner löschen | Worker löschen | Repo + Worker löschen |

---

## Wenn etwas klemmt

**`command not found: npm`**
Node ist nicht installiert oder das Terminal war schon offen. Terminal schließen,
neu öffnen.

**`EACCES` / Rechteprobleme**
Kein `sudo` verwenden. Verschieb den Projektordner in dein Benutzerverzeichnis,
z. B. `~/solawi-os`.

**`better-sqlite3` bricht beim Installieren ab**
Das ist ein natives Modul und braucht Apple-Build-Tools:
```bash
xcode-select --install
npm install
```

**Port 8787 belegt**
```bash
PORT=3000 npm run dev
```

**Alles zurücksetzen**
```bash
rm -rf node_modules data
npm run setup
```

---

## Wenn es läuft

- `README.md` — was das Projekt ist und warum
- `DEPLOY.md` — beide Deployment-Wege im Detail
- `docs/00-konzept.md` — die Idee, die drei Phasen
- `docs/adr/` — warum die Dinge so entschieden wurden, wie sie sind
- `AGENTS.md` — für Mitwirkende und KI-Agenten
