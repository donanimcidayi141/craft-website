#!/usr/bin/env bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f "dist/index.html" ] || [ -n "$(find src electron index.html package.json -newer dist/index.html -print -quit 2>/dev/null)" ]; then
  npm run build
fi

exec ./node_modules/.bin/electron .
