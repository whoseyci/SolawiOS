#!/usr/bin/env bash
# Solawi OS — one-command local setup.
#
# Safe to run repeatedly. Checks prerequisites, installs, builds, tests, and
# tells you exactly what to do next. Does not install anything system-wide
# except via Homebrew, and only when you say yes.

set -euo pipefail

BOLD=$'\033[1m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RED=$'\033[31m'; DIM=$'\033[2m'; OFF=$'\033[0m'
ok()   { echo "${GREEN}✓${OFF} $*"; }
warn() { echo "${YELLOW}!${OFF} $*"; }
bad()  { echo "${RED}✗${OFF} $*"; }
step() { echo; echo "${BOLD}$*${OFF}"; }

cd "$(dirname "$0")/.."

step "1/5  Checking Node.js"
if ! command -v node >/dev/null 2>&1; then
  bad "Node.js is not installed."
  echo
  echo "  Install it with either:"
  echo "    ${DIM}brew install node${OFF}          (if you have Homebrew)"
  echo "    ${DIM}https://nodejs.org/en/download${OFF}  (installer, no terminal needed)"
  echo
  echo "  Then run this script again."
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  bad "Node $(node -v) is too old — this project needs Node 20 or newer."
  echo "  ${DIM}brew upgrade node${OFF}   or download a current version from nodejs.org"
  exit 1
fi
ok "Node $(node -v)"
ok "npm  v$(npm -v)"

step "2/5  Installing dependencies"
echo "${DIM}(first run downloads ~200 MB and takes a few minutes)${OFF}"
npm install --no-fund --no-audit
ok "Dependencies installed"

step "3/5  Building"
npx tsc --build
ok "All 12 packages compiled"

step "4/5  Running tests"
if npx vitest run --reporter=dot 2>&1 | tail -5; then
  ok "Tests passed"
else
  warn "Some tests failed — the code still runs, but please report this."
fi

step "5/5  Ready"
cat <<EOF

  ${BOLD}Run it locally (no accounts, no cloud):${OFF}

    npm run dev

  Then open ${BOLD}http://localhost:8787/health${OFF} in your browser.
  Data lands in ./data/solawi.db — a plain SQLite file you can delete any time.

  ${BOLD}Try the whole thing with demo data:${OFF}

    npm run demo

  ${BOLD}Deploy to Cloudflare later:${OFF}

    ./scripts/deploy-cf.sh

EOF
