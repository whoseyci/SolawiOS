#!/usr/bin/env bash
# Solawi OS — Cloudflare deployment.
#
# Creates D1, KV and R2 resources, writes their IDs into wrangler.toml for you
# (the fiddly copy-paste step), and deploys. Idempotent: existing resources are
# reused rather than duplicated.
#
# You need: a free Cloudflare account. Nothing else installed — wrangler runs
# via npx.

set -euo pipefail

BOLD=$'\033[1m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; DIM=$'\033[2m'; OFF=$'\033[0m'
ok()   { echo "${GREEN}✓${OFF} $*"; }
warn() { echo "${YELLOW}!${OFF} $*"; }
step() { echo; echo "${BOLD}$*${OFF}"; }

cd "$(dirname "$0")/../packages/server-cf"
TOML=wrangler.toml

step "1/6  Signing in to Cloudflare"
if npx --yes wrangler whoami 2>/dev/null | grep -qi "you are logged in"; then
  ok "Already signed in"
else
  echo "${DIM}A browser window will open — approve the login there.${OFF}"
  npx --yes wrangler login
  ok "Signed in"
fi

step "2/6  Database (D1)"
if grep -q 'REPLACE_WITH_YOUR_D1_ID' "$TOML"; then
  OUT="$(npx --yes wrangler d1 create solawi-os 2>&1 || true)"
  # Reuse the existing database if it is already there.
  if echo "$OUT" | grep -qi "already exists"; then
    OUT="$(npx --yes wrangler d1 list --json 2>/dev/null || echo '[]')"
    D1_ID="$(node -e "
      const l=JSON.parse(process.argv[1]||'[]');
      const d=l.find(x=>x.name==='solawi-os');
      process.stdout.write(d?d.uuid||d.database_id||'':'');
    " "$OUT")"
  else
    D1_ID="$(echo "$OUT" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)"
  fi
  if [ -z "${D1_ID:-}" ]; then
    warn "Could not read the database id automatically."
    echo "  Run: ${DIM}npx wrangler d1 list${OFF}"
    echo "  Then paste the id into $TOML (replace REPLACE_WITH_YOUR_D1_ID)."
    exit 1
  fi
  node -e "
    const fs=require('fs');
    fs.writeFileSync('$TOML', fs.readFileSync('$TOML','utf8').replace('REPLACE_WITH_YOUR_D1_ID','$D1_ID'));
  "
  ok "D1 ready ($D1_ID)"
else
  ok "D1 already configured"
fi

step "3/6  Cache (KV)"
if grep -q 'REPLACE_WITH_YOUR_KV_ID' "$TOML"; then
  OUT="$(npx --yes wrangler kv namespace create CACHE 2>&1 || true)"
  KV_ID="$(echo "$OUT" | grep -oE '[0-9a-f]{32}' | head -1)"
  if [ -z "${KV_ID:-}" ]; then
    OUT="$(npx --yes wrangler kv namespace list 2>/dev/null || echo '[]')"
    KV_ID="$(node -e "
      let l=[];try{l=JSON.parse(process.argv[1])}catch{}
      const n=l.find(x=>(x.title||'').includes('CACHE'));
      process.stdout.write(n?n.id:'');
    " "$OUT")"
  fi
  if [ -z "${KV_ID:-}" ]; then
    warn "Could not read the KV id — the app runs fine without cache."
    echo "  To enable later: ${DIM}npx wrangler kv namespace list${OFF} and paste the id."
  else
    node -e "
      const fs=require('fs');
      fs.writeFileSync('$TOML', fs.readFileSync('$TOML','utf8').replace('REPLACE_WITH_YOUR_KV_ID','$KV_ID'));
    "
    ok "KV ready ($KV_ID)"
  fi
else
  ok "KV already configured"
fi

step "4/6  File storage (R2)"
# R2 needs a payment method on file even for the free tier, so it is optional.
if npx --yes wrangler r2 bucket create solawi-os-blobs 2>&1 | grep -qiE "created|already"; then
  ok "R2 bucket ready"
else
  warn "R2 not available (it asks for a card even on the free tier)."
  echo "  ${DIM}Photos and exports will be disabled; everything else works.${OFF}"
  echo "  Commenting out the R2 binding …"
  node -e "
    const fs=require('fs');
    let t=fs.readFileSync('$TOML','utf8');
    t=t.replace(/\[\[r2_buckets\]\]\nbinding = \"BLOBS\"\nbucket_name = \"solawi-os-blobs\"/,
      '# [[r2_buckets]]\n# binding = \"BLOBS\"\n# bucket_name = \"solawi-os-blobs\"');
    fs.writeFileSync('$TOML',t);
  "
fi

step "5/6  Deploying"
npx --yes wrangler deploy

step "6/6  Checking it works"
URL="$(npx --yes wrangler deployments list 2>/dev/null | grep -oE 'https://[a-z0-9.-]+workers\.dev' | head -1 || true)"
if [ -n "$URL" ]; then
  sleep 3
  if curl -fsS "$URL/health" 2>/dev/null | grep -q '"ok":true'; then
    ok "Live at $URL"
    echo
    echo "  ${BOLD}Health check:${OFF} $URL/health"
  else
    warn "Deployed, but /health did not answer yet — give it a minute and retry."
  fi
else
  ok "Deployed. Find the URL in the Cloudflare dashboard under Workers."
fi

cat <<EOF

  ${BOLD}Create your first account and farm:${OFF}

    curl -X POST \$URL/api/auth/register \\
      -H 'content-type: application/json' \\
      -d '{"email":"you@example.org","password":"choose-a-long-one","displayName":"Your Name"}'

  Save the returned token, then:

    curl -X POST \$URL/api/orgs \\
      -H 'content-type: application/json' -H "authorization: Bearer \$TOKEN" \\
      -d '{"slug":"crowdsalat","name":"solawi crowd salat","established":true}'

  ${DIM}"established": true skips the founding phase — right for an existing Solawi.${OFF}

EOF
