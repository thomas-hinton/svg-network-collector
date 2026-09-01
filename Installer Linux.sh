#!/usr/bin/env bash
set -euo pipefail
APP_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js et npm sont requis (version 18 ou plus récente)."
  echo "Ubuntu/Debian : sudo apt install nodejs npm"
  exit 1
fi

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Node.js 18 ou plus récent est requis. Version actuelle : $(node --version)"
  exit 1
fi

echo "Installation des composants de l'application..."
npm install --omit=dev

echo "Installation de Chromium..."
npx playwright install chromium

echo
echo "Installation terminée."
echo "Démarrez avec : bash \"Lancer SVG Collector.sh\""
echo "Si Chromium signale des bibliothèques manquantes, exécutez :"
echo "sudo npx playwright install-deps chromium"
