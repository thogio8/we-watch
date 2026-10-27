#!/usr/bin/env bash
# Production deployment through the Vercel REST API (the CLI's promote and
# rollback need a user token; ours is a team token). Needs VERCEL_TOKEN,
# VERCEL_ORG_ID (team) and VERCEL_PROJECT_ID; prints no secret.
#   vercel-prod.sh current          → id of the deployment in production
#   vercel-prod.sh promote <id|url> → puts that deployment in production
set -euo pipefail

api() {
  curl -sS -H "Authorization: Bearer $VERCEL_TOKEN" "$@"
}
team="teamId=$VERCEL_ORG_ID"
json() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s)$1??''))"; }

case "${1:-}" in
  current)
    api "https://api.vercel.com/v9/projects/$VERCEL_PROJECT_ID?$team" | json ".targets?.production?.id"
    ;;
  promote)
    target="${2:?deployment id or url}"
    id="$(api "https://api.vercel.com/v13/deployments/${target#https://}?$team" | json ".id")"
    status="$(api -o /tmp/promote.json -w '%{http_code}' -X POST \
      "https://api.vercel.com/v10/projects/$VERCEL_PROJECT_ID/promote/$id?$team")"
    if [[ "$status" == 2* ]] || grep -q "already the current production" /tmp/promote.json; then
      echo "✓ $id in production"
    else
      echo "✕ promote $id answered $status"; cat /tmp/promote.json; exit 1
    fi
    ;;
  *) echo "usage: vercel-prod.sh current | promote <id|url>"; exit 2 ;;
esac
