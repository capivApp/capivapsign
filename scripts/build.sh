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

start_time=$(date +%s)

echo "[build] Instalando dependências"
npm ci

echo "[build] Gerando o cliente Prisma"
npm run prisma:generate

echo "[build] Compilando o app e os pacotes de que ele depende"
npx turbo run build --filter=@documenso/remix...

echo "[build] Concluído em $(($(date +%s) - start_time))s"
