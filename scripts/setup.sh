#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
git submodule update --init --recursive
pnpm --dir vendor/typescript-sdk install --frozen-lockfile
pnpm --dir vendor/typescript-sdk --filter '@modelcontextprotocol/server...' --filter '@modelcontextprotocol/client...' --filter '@modelcontextprotocol/node...' build
if [[ ! -e node_modules ]]; then
  ln -s vendor/typescript-sdk/node_modules node_modules
fi
npm --prefix flight-app ci
npm --prefix flight-app run build
echo 'Ready. Run npm start, then npm test in a second terminal.'
