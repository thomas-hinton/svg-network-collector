#!/usr/bin/env bash
set -u
APP_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js est introuvable. Installez Node.js 18 ou plus récent."
  echo "Puis lancez : bash \"Installer Linux.sh\""
  exit 1
fi

if ! node -e "require.resolve('playwright')" >/dev/null 2>&1; then
  echo "Playwright n'est pas encore installé."
  echo "Lancez d'abord : bash \"Installer Linux.sh\""
  exit 1
fi

exec node app.js
