#!/usr/bin/env bash
#
# Runs the CapivaSign production server built by scripts/build.sh. Meant to be
# the ExecStart of a systemd unit (see scripts/capivasign.service), so it stays
# in the foreground and hands the process over to node with `exec`, letting
# systemd's SIGTERM reach the server directly.
#
# Reads configuration from .env (and .env.local, if present) at the repo root.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN="$ROOT_DIR/node_modules/.bin"
WITH_ENV=("$BIN/dotenv" -e "$ROOT_DIR/.env" -e "$ROOT_DIR/.env.local" --)

if [ ! -f "$ROOT_DIR/apps/remix/build/server/main.js" ]; then
  echo "[start] Build não encontrado. Rode ./scripts/build.sh primeiro." >&2
  exit 1
fi

echo "[start] Aplicando migrations do banco"
"${WITH_ENV[@]}" "$BIN/prisma" migrate deploy --schema "$ROOT_DIR/packages/prisma/schema.prisma"

echo "[start] Iniciando o CapivaSign"
# The server serves static files from the relative `build/client`, so it must
# run from apps/remix.
cd "$ROOT_DIR/apps/remix"

exec "${WITH_ENV[@]}" env NODE_ENV=production node build/server/main.js
