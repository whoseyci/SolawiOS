# Deployment

Two supported paths, both first-class (ADR-0004). Same code, same SQL dialect,
same schema — the only difference is which platform implementation is bound.

---

## A. Cloudflare (managed or your own account)

### 1. Prerequisites

```bash
npm install
npx wrangler login
```

### 2. Create the resources

```bash
cd packages/server-cf

npx wrangler d1 create solawi-os
# → copy the printed database_id into wrangler.toml

npx wrangler kv namespace create CACHE
# → copy the printed id into wrangler.toml

npx wrangler r2 bucket create solawi-os-blobs
```

Edit `wrangler.toml` and replace both `REPLACE_WITH_YOUR_*` placeholders.

### 3. Deploy

```bash
npm run cf:deploy
```

Migrations run automatically on the first request of a fresh isolate and are
idempotent. To verify:

```bash
curl https://solawi-os.<your-subdomain>.workers.dev/health
# {"ok":true,"flavour":"cloudflare","modules":7,"version":"0.1.0"}
```

### 4. Custom domain

Add a route in `wrangler.toml` or bind a custom domain in the Cloudflare
dashboard. Nothing in the application depends on the hostname.

### Cost

For a handful of farms this fits comfortably in Cloudflare's free tier: Workers
requests, D1 rows read/written and R2 storage are all far below the thresholds
at Solawi scale. It scales to zero between requests, which is what makes a
volunteer-run managed instance plausible.

---

## B. Self-hosting (your own hardware, a VPS, a Raspberry Pi)

No Cloudflare account, no cloud dependency, no telemetry.

```bash
npm install
npm run build

DATABASE_PATH=./data/solawi.db \
BLOB_ROOT=./data/blobs \
PORT=8787 \
node packages/server-node/dist/index.js
```

That is the whole thing. SQLite file, local blob directory, one process.

### systemd

```ini
[Unit]
Description=Solawi OS
After=network.target

[Service]
Type=simple
User=solawi
WorkingDirectory=/opt/solawi-os
Environment=DATABASE_PATH=/var/lib/solawi/solawi.db
Environment=BLOB_ROOT=/var/lib/solawi/blobs
Environment=PORT=8787
ExecStart=/usr/bin/node packages/server-node/dist/index.js
Restart=always

[Install]
WantedBy=multi-user.target
```

Put nginx or Caddy in front for TLS. Back up by copying the SQLite file —
`sqlite3 solawi.db ".backup backup.db"` while running.

### Hardware

A Raspberry Pi 4 is ample for a single farm. The database for a 90-household
Solawi with a full season of observations is measured in megabytes.

---

## Migrating between the two

Because both use SQLite, moving is a file copy in one direction and a D1 export
in the other:

```bash
# Cloudflare → self-hosted
npx wrangler d1 export solawi-os --output=solawi.sql
sqlite3 data/solawi.db < solawi.sql

# self-hosted → Cloudflare
sqlite3 data/solawi.db .dump > dump.sql
npx wrangler d1 execute solawi-os --file=dump.sql
```

No lock-in was the point (ADR-0002).

---

## First run

1. `POST /api/auth/register` — creates a person, not a farm
2. `POST /api/orgs` — creates a farm; you become `owner`
   - **Established Solawi?** Pass `{"established": true}` and the founding phase
     is skipped entirely: the farm starts in `operating`, milestones are marked
     `not_applicable`, and the module is switched off.
3. `POST /api/org/setup/recommend` — answer the five questions, get a suggested
   module set with reasons
4. `POST /api/org/modules` — enable what you want; change it any time

Every subsequent request carries `x-solawi-org: <slug>` to select the farm. One
login can belong to many farms.

---

## Multi-tenancy

One deployment serves unlimited farms. Every domain table carries `org_id`,
every query filters on it, and membership is verified in middleware before any
route runs — a farm id in a header is never trusted without checking the
requesting person actually belongs to it.

Farms needing hard isolation can run their own deployment; the schema is
identical, so this is a deployment choice rather than a code path.
