# Automatisches Deployment über das Cloudflare-Dashboard

Ziel: Push nach GitHub → Cloudflare baut und deployt selbst, inklusive
Datenbankschema. Kein Terminal nötig, nachdem es einmal eingerichtet ist.

---

## Einmalige Einrichtung (ca. 10 Minuten, nur Browser)

### 1. Repository verbinden

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages**
2. **Create** → **Workers** → **Import a repository**
3. GitHub autorisieren, `whoseyci/solawios` auswählen

### 2. Build-Einstellungen

Cloudflare erkennt `wrangler.toml` und schlägt meist das Richtige vor. Falls
nicht, exakt so eintragen:

| Feld | Wert |
|---|---|
| **Build command** | `npm install && npm run build` |
| **Deploy command** | `npm run deploy --workspace @solawi/server-cf` |
| **Root directory** | *(leer lassen)* |

Der Deploy-Befehl macht drei Dinge in dieser Reihenfolge:

```
npm run schema   →  schema.sql aus allen Modul-Migrationen erzeugen
wrangler d1 execute --remote --file=./schema.sql
wrangler deploy
```

**Das Schema läuft vor dem Deploy.** Ein Release, das eine neue Tabelle
mitbringt, kann also nie auf eine Datenbank treffen, die sie noch nicht hat.

### 3. Ressourcen anlegen

Im Dashboard unter **Storage & Databases**:

- **D1** → Create → Name: `solawi-os` → die ID kopieren
- **KV** → Create → Name beliebig → die ID kopieren

Beide IDs stehen bereits in `wrangler.toml`. Wenn du die Ressourcen neu anlegst,
dort ersetzen — sie sind keine Geheimnisse, sondern nur Referenzen, die ohne
Account-Zugang wertlos sind.

**Wichtig:** `name` in `wrangler.toml` muss zum Projektnamen in Workers Builds
passen (`solawios`). Sonst überschreibt das CI den Namen und warnt bei jedem
Deploy.

**R2** (Fotos, Exporte) ist **standardmäßig deaktiviert**, weil Cloudflare dafür
eine Zahlungsmethode verlangt — auch im kostenlosen Kontingent. Ein Deploy mit
R2-Binding, aber ohne existierenden Bucket, **schlägt fehl**
(`R2 bucket not found [code: 10085]`). Zum Aktivieren:

```bash
npx wrangler r2 bucket create solawi-os-blobs
```

und dann die drei Zeilen in `wrangler.toml` einkommentieren. Ohne R2 läuft alles
außer Dateiupload.

### 4. Das einzige nötige Secret

Worker → **Settings** → **Variables and Secrets** → **Add secret**:

| Name | Wert | Pflicht? |
|---|---|---|
| `GITHUB_ISSUE_TOKEN` | dein Fine-grained PAT (siehe unten) | nur für In-App-Fehlermeldungen |

Als **Secret** anlegen, nicht als Variable — Secrets sind nach dem Speichern
nicht mehr lesbar.

`GITHUB_ISSUE_OWNER` und `GITHUB_ISSUE_REPO` sind **nicht nötig**: Der Code fällt
auf `whoseyci` / `solawios` zurück. Nur setzen, wenn das Repo umzieht oder
umbenannt wird.

Ohne Token läuft die App normal — Fehlermeldungen werden dann lokal gespeichert
und können später zugestellt werden.

---

## Der Token für Fehlermeldungen

Genau so eng wie möglich zuschneiden:

1. GitHub → Settings → Developer settings →
   **Fine-grained personal access tokens** → *Generate new token*
2. **Repository access**: *Only select repositories* → nur `whoseyci/solawios`
3. **Permissions** → Repository permissions → **Issues: Read and write**
   — sonst **nichts**. Kein Contents, kein Actions, kein Metadata-Write.
4. Ablaufdatum setzen (90 Tage ist ein guter Kompromiss)

Dieser Token kann Issues schreiben und sonst gar nichts. Er kann keinen Code
lesen, nichts pushen, nichts löschen. Selbst wenn er ausliefe, wäre der Schaden
auf „jemand kann Issues in einem Repo anlegen" begrenzt.

---

## Danach

Jeder Push auf `main`:

```
GitHub push
   ↓
Cloudflare Workers Builds
   ↓  npm install && npm run build
   ↓  npm run schema        (DDL aus den Modulen erzeugen)
   ↓  wrangler d1 execute   (idempotent, ändert nichts Bestehendes)
   ↓  wrangler deploy
   ↓
live
```

Fortschritt und Logs im Dashboard unter **Workers → dein Worker → Builds**.

---

## Wie Schemaänderungen laufen

Neue Tabelle oder Spalte? **Nicht** `schema.sql` bearbeiten — die Datei ist
generiert. Stattdessen eine neue Migration im zuständigen Modul:

```ts
// packages/modules/land/src/index.ts
const MIGRATIONS: readonly Migration[] = [
  { version: 1, description: '…', statements: [ /* … */ ] },
  {
    version: 2,
    description: 'land: Bewässerungszonen',
    statements: [
      `CREATE TABLE IF NOT EXISTS land_irrigation_zone (
         id TEXT PRIMARY KEY, org_id TEXT NOT NULL, name TEXT NOT NULL
       )`,
    ],
  },
];
```

Committen, pushen — fertig. `npm run schema` nimmt die neue Version beim
nächsten Build automatisch mit.

**Zwei Regeln:**

1. **Immer `IF NOT EXISTS`.** Das Skript läuft bei jedem Deploy erneut.
2. **Nur additiv.** Spalten hinzufügen ist sicher; Spalten umbenennen oder
   löschen braucht einen bewussten, zweistufigen Plan (erst neue Spalte
   befüllen, in einem späteren Release die alte entfernen). SQLite kann
   `DROP COLUMN` erst seit 3.35 und D1 verhält sich hier konservativ.

---

## Selbst-Hosting bleibt davon unberührt

Die Node-Variante migriert beim Start über denselben Code
(`kernel.migrate()`), liest also dieselben Modul-Migrationen. `schema.sql`
existiert nur, weil Workers Builds keinen Ort hat, an dem Anwendungscode vor
dem Deploy gegen D1 laufen könnte.

Beide Wege bleiben in der CI grün — ADR-0004.
