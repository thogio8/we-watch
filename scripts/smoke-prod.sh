#!/usr/bin/env bash
# After a deploy: the app answers, its environment is valid (the proxy checks
# it on every request), and the whole stack works (the daily refresh reads the
# database and TMDB). Needs PROD_URL and CRON_SECRET; prints no secret.
set -euo pipefail

status="$(curl -s -o /dev/null -w '%{http_code}' "$PROD_URL/unlock")"
[ "$status" = 200 ] || { echo "✕ /unlock answered $status"; exit 1; }
echo "✓ /unlock 200"

body="$(curl -sf -H "Authorization: Bearer $CRON_SECRET" "$PROD_URL/api/cron/refresh-movies")" \
  || { echo "✕ the daily refresh failed"; exit 1; }
[[ "$body" == *'"failed":[]'* ]] || { echo "✕ refresh: $body"; exit 1; }
echo "✓ refresh $body"
