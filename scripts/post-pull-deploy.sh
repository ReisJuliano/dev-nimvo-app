#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

if [ "$(id -u)" -eq 0 ]; then
  export COMPOSER_ALLOW_SUPERUSER=1
fi

changed_files=''
if git rev-parse --verify ORIG_HEAD >/dev/null 2>&1; then
  changed_files="$(git diff --name-only ORIG_HEAD HEAD || true)"
fi

has_changed() {
  local pattern="$1"
  printf '%s\n' "$changed_files" | grep -Eq "$pattern"
}

echo '[deploy] clearing Laravel caches'
php artisan optimize:clear

if [ ! -d vendor ] || has_changed '^(composer\.json|composer\.lock)$'; then
  echo '[deploy] installing PHP dependencies'
  composer install --no-dev --optimize-autoloader --no-interaction
fi

if command -v npm >/dev/null 2>&1; then
  if [ ! -d node_modules ] || has_changed '^(package\.json|package-lock\.json)$'; then
    echo '[deploy] installing Node dependencies'
    npm ci
  fi

  if [ ! -f public/build/manifest.json ] || has_changed '^(resources/|package\.json|package-lock\.json|vite\.config\.)'; then
    echo '[deploy] building frontend assets'
    npm run build
  fi
fi

echo '[deploy] running database migrations'
php artisan migrate --force

echo '[deploy] caching Laravel config'
php artisan config:cache

echo '[deploy] restarting queue workers'
php artisan queue:restart || true

if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files | grep -q '^nimvo-queue\.service'; then
  systemctl restart nimvo-queue.service || true
fi

if id -u www-data >/dev/null 2>&1; then
  chown -R www-data:www-data bootstrap/cache storage public/build 2>/dev/null || true
fi

echo '[deploy] done'
