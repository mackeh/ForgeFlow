#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if [ ! -f ".env" ]; then
  echo ".env not found, creating it from .env.example"
  cp .env.example .env
  echo "Created .env. Update credentials/secrets if needed, then rerun if you want custom values."
fi

echo "Running database migration..."
docker compose run --rm server npm run prisma:migrate

echo "Starting ForgeFlow..."
docker compose up --build
