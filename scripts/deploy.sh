#!/usr/bin/env bash
# Reliable manual production deploy.
#
# Two things go wrong with a plain `vercel --prod` on this project:
#
# 1. Vercel's zero-config build reliably (not just sometimes — reproduced
#    locally on 2026-09-05) emits a routing rule that 404s every /api/*
#    request before the real function-serving rule ever runs:
#      { "src": "^/api(/.*)?$", "status": 404 }
#    Fix: build locally (`vercel build`) so the generated
#    .vercel/output/config.json can be inspected and that one rule
#    stripped out before deploying the prebuilt output.
#
# 2. Building locally on Windows/macOS installs sharp's Windows/macOS
#    native binary, which then fails to load once deployed to Vercel's
#    Linux runtime ("Could not load the sharp module using the linux-x64
#    runtime"). Fix: force npm's optional-dependency resolution to the
#    Linux/x64/glibc target during the build's `npm install`, via env vars
#    npm still honors even when running on a different host platform.
#
# Usage: node scripts/render-catalogue-into.js is run first automatically
# so this always deploys the current live database's product catalogue,
# not the static placeholder cards committed to products/index.html.
#
# Requires VERCEL_TOKEN in the environment.
set -euo pipefail

VERCEL_PROJECT_ID="${VERCEL_PROJECT_ID:-prj_DrhK5kyBPbI6yE2nKtYmIlxONSgY}"
VERCEL_ORG_ID="${VERCEL_ORG_ID:-team_YqlvSMFfX0jzDSCCthrRgkm0}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$(mktemp -d)/sbt-deploy"

echo "==> Copying repo to $DEST"
node -e "
const fs = require('fs');
const path = require('path');
const EXCLUDE = new Set(['.git', 'node_modules', '.env.local', '.env', '.vercel']);
fs.cpSync(process.argv[1], process.argv[2], {
  recursive: true,
  filter: (p) => !EXCLUDE.has(path.basename(p)),
});
" "$REPO_ROOT" "$DEST"

mkdir -p "$DEST/.vercel"
cat > "$DEST/.vercel/project.json" <<EOF
{"projectId":"$VERCEL_PROJECT_ID","orgId":"$VERCEL_ORG_ID","projectName":"shreyaahs-bliss-trails"}
EOF

echo "==> Rendering catalogue from the live database"
(cd "$REPO_ROOT" && node scripts/render-catalogue-into.js "$DEST")

echo "==> Building (forcing linux/x64/glibc target so sharp gets the right binary)"
(
  cd "$DEST"
  npm_config_os=linux npm_config_cpu=x64 npm_config_libc=glibc \
    vercel build --prod --token "$VERCEL_TOKEN" --yes
)

echo "==> Patching routing config"
node -e "
const fs = require('fs');
const p = process.argv[1];
const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
const before = cfg.routes.length;
cfg.routes = cfg.routes.filter((r) => !(r.status === 404 && r.src === '^/api(/.*)?\$'));
if (cfg.routes.length !== before) console.log('    Removed broken blanket /api 404 route.');
fs.writeFileSync(p, JSON.stringify(cfg, null, 2));
" "$DEST/.vercel/output/config.json"

echo "==> Deploying prebuilt output"
(cd "$DEST" && vercel deploy --prebuilt --prod --token "$VERCEL_TOKEN" --yes)

rm -rf "$DEST" 2>/dev/null || true
echo "==> Done."
