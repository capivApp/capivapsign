#!/usr/bin/env bash
#
# Builds CapivaSign for production on the server itself (no Docker).
#
#   ./scripts/build.sh
#
# Afterwards restart the service (`sudo systemctl restart capivasign`) so it
# picks up the new build. Migrations run on start (see scripts/start.sh).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

if [ ! -f .env ]; then
  echo "[build] .env não encontrado em $ROOT_DIR. Copie o .env.example e preencha antes de buildar." >&2
  exit 1
fi

# The app typecheck (tsc) needs more than Node's default ~2GB heap. Override
# with NODE_OPTIONS if the server has less memory (add swap in that case).
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}"

start_time=$(date +%s)

echo "[build] Instalando dependências"
npm ci

echo "[build] Gerando o cliente Prisma"
npm run prisma:generate

echo "[build] Compilando o app e os pacotes de que ele depende"
npx turbo run build --filter=@documenso/remix...

# The app build extracts the translation catalogs, rewriting the tracked .po
# files; restore them so the next `git pull` is not blocked. The compiled
# catalogs the server uses are untracked and stay.
git checkout -- packages/lib/translations

echo "[build] Concluído em $(($(date +%s) - start_time))s"
