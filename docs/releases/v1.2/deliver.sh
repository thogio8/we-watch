#!/usr/bin/env bash
# Livraison de la V1.2 « Ce soir » en prod, dans l'ordre qui ne casse rien :
# sauvegarde → migration Turso → CRON_SECRET sur Vercel → push → remplissage.
# À lancer depuis la racine du repo : bash docs/releases/v1.2/deliver.sh
# Aucun secret n'est affiché.
set -euo pipefail

PROD_URL="https://we-watch-lac.vercel.app"
ENV_FILE=".env.production.local"
BACKUP="$HOME/we-watch-backups/prod-$(date +%F-%H%M)-before-v1.2.json"

[ -f "$ENV_FILE" ] || { echo "✕ $ENV_FILE introuvable (lancer depuis la racine du repo)"; exit 1; }
set -a; . "./$ENV_FILE"; set +a
[[ "${DATABASE_URL:-}" == libsql://* ]] || { echo "✕ DATABASE_URL de prod manquante"; exit 1; }

echo "1/5 · Sauvegarde de la table movies → $BACKUP"
mkdir -p "$(dirname "$BACKUP")"
node -e '
const { createClient } = require("@libsql/client");
const c = createClient({ url: process.env.DATABASE_URL, authToken: process.env.DATABASE_AUTH_TOKEN });
c.execute("select * from movies").then((r) => {
  require("fs").writeFileSync(process.argv[1], JSON.stringify(r.rows));
  console.log(`    ${r.rows.length} films sauvegardés`);
});' "$BACKUP"

echo "2/5 · Migration Turso (colonnes genre_ids et trailer_key)"
npm run db:migrate --silent

echo "3/5 · CRON_SECRET sur Vercel (Production)"
if [ -z "${CRON_SECRET:-}" ]; then
  CRON_SECRET="$(openssl rand -hex 32)"
  printf '%s' "$CRON_SECRET" | vercel env add CRON_SECRET production >/dev/null
  printf '\nCRON_SECRET=%s\n' "$CRON_SECRET" >> "$ENV_FILE"
  echo "    ajouté sur Vercel et dans $ENV_FILE"
else
  echo "    déjà présent dans $ENV_FILE, rien à faire"
fi

echo "4/5 · Push sur main (déploiement automatique Vercel)"
git push origin main

echo "5/5 · Attente du déploiement, puis remplissage des genres et bandes-annonces"
for _ in $(seq 1 60); do
  body="$(curl -s -H "Authorization: Bearer $CRON_SECRET" "$PROD_URL/api/cron/refresh-movies" || true)"
  if [[ "$body" == *'"refreshed"'* ]]; then
    echo "    $body"
    echo "✓ V1.2 en prod. Vérifier sur le téléphone : LA SOIRÉE, un thème au swipe, ↺ ANNULER."
    exit 0
  fi
  sleep 10
done
echo "✕ La route du cron ne répond pas après 10 min : regarder le déploiement sur Vercel."
exit 1
