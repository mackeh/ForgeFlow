#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"
AUTO_UPDATE="${AUTO_UPDATE:-1}"
AUTO_X11_AUTH="${AUTO_X11_AUTH:-1}"

if [ ! -f ".env" ]; then
  echo ".env not found, creating it from .env.example"
  cp .env.example .env
  echo "Created .env. Update credentials/secrets if needed, then rerun if you want custom values."
fi

if [ "$AUTO_X11_AUTH" = "1" ]; then
  if command -v xhost >/dev/null 2>&1; then
    if [ -n "${DISPLAY:-}" ]; then
      if xhost +local: >/dev/null 2>&1; then
        echo "X11 local access enabled for containers."
      else
        echo "Warning: unable to set X11 access with xhost. Desktop automation may fail."
      fi
    else
      echo "DISPLAY not set in shell. Desktop automation may fail unless DISPLAY is configured."
    fi
  else
    echo "xhost not found. Desktop automation may fail unless X11 access is granted manually."
  fi
fi

if [ "$AUTO_UPDATE" = "1" ]; then
  echo "Auto-update enabled: pulling latest service images..."
  docker compose pull

  echo "Auto-update enabled: rebuilding app images with latest base layers and dependency patches..."
  docker compose build --pull --no-cache server web agent
else
  echo "Auto-update disabled (AUTO_UPDATE=$AUTO_UPDATE)"
fi

echo "Running database migration..."
docker compose up -d db redis
docker compose run --rm --no-deps server npm run prisma:migrate

echo "Starting ForgeFlow..."
docker compose up --build
