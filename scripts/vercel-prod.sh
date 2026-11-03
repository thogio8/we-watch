#!/usr/bin/env bash
# Production deployment through the Vercel REST API (the CLI's promote and
# rollback need a user token; ours is a team token). Needs VERCEL_TOKEN,
# VERCEL_ORG_ID (team) and VERCEL_PROJECT_ID; prints no secret.
#   vercel-prod.sh current          → id of the deployment in production, or
#                                     a failure (never an empty id: the
#                                     CI's rollback needs it)
#   vercel-prod.sh promote <id|url> → puts that deployment in production and
#                                     waits until it serves production
set -euo pipefail

API="${VERCEL_API_URL:-https://api.vercel.com}"
# Vercel may answer the promote (202) before production switches: the smoke
# test that follows must not hit the previous deployment.
TIMEOUT="${VERCEL_PROMOTE_TIMEOUT:-60}"
INTERVAL="${VERCEL_POLL_INTERVAL:-3}"
# Every request is bounded: a stalled call would get the job cancelled, and a
# cancelled job skips the rollback (if: failure()).
MAX_TIME="${VERCEL_MAX_TIME:-30}"

# Answers any status (the caller reads it with -w); get fails on 4xx/5xx
# without printing the body.
api() {
  curl -sS --max-time "$MAX_TIME" -H "Authorization: Bearer $VERCEL_TOKEN" "$@"
}
get() { api -f "$@"; }
team="teamId=$VERCEL_ORG_ID"
project="$API/v9/projects/$VERCEL_PROJECT_ID?$team"
# Prints the field ('' if absent); not JSON: fails without a Node trace.
json() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
  try { console.log(JSON.parse(s)$1??''); } catch { process.exit(1); } })"; }

# "<production deployment id> <status of the alias job promoting $1, or none>"
# (GET /v9/projects: targets.production.id, lastAliasRequest), or
# "unreachable none" on any failure (network, timeout, 4xx/5xx, not JSON):
# the caller polls again until its deadline. Each request is bounded, so one
# stalled call cannot outlive the deadline (a killed job skips the rollback).
state() {
  local body
  body="$(get --max-time 10 "$project")" || { echo "unreachable none"; return; }
  node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
    try {
      const p=JSON.parse(s), job=p.lastAliasRequest;
      const ours=job && job.toDeploymentId===process.argv[1];
      console.log((p.targets?.production?.id??'none')+' '+(ours?job.jobStatus:'none'));
    } catch { console.log('unreachable none'); }
  })" "$1" <<<"$body"
}

# Production serves $1 once the project's production target is $1 and the
# alias job promoting it, if it is the latest, is over: succeeded, or skipped
# (terminal success for Vercel's own CLI, commands/promote/status.ts).
wait_for() {
  local id="$1" deadline=$(($(date +%s%3N) + TIMEOUT * 1000)) production job
  while true; do
    read -r production job < <(state "$id") || true
    production="${production:-unreachable}" job="${job:-none}"
    if [[ "$production" = "$id" && "$job" =~ ^(succeeded|skipped|none)$ ]]; then
      echo "✓ $id in production"
      return
    fi
    if [[ "$job" = failed || $(date +%s%3N) -ge $deadline ]]; then
      echo "✕ production after $TIMEOUT s: expected $id (alias job succeeded)," \
        "received $production (alias job $job)"
      exit 1
    fi
    sleep "$INTERVAL"
  done
}

case "${1:-}" in
  current)
    id="$(get "$project" | json ".targets?.production?.id")" || id=""
    [ -n "$id" ] || {
      echo "✕ current production: unknown (Vercel API failed or no production deployment)" >&2
      exit 1
    }
    echo "$id"
    ;;
  promote)
    target="${2:?deployment id or url}"
    id="$(get "$API/v13/deployments/${target#https://}?$team" | json ".id")" || id=""
    [ -n "$id" ] || { echo "✕ deployment ${target#https://}: unknown (Vercel API failed or not found)"; exit 1; }
    answer="$(mktemp)"
    # Without -f: a refusal's body may say production already serves it.
    status="$(api -o "$answer" -w '%{http_code}' -X POST \
      "$API/v10/projects/$VERCEL_PROJECT_ID/promote/$id?$team")" || true
    if [[ "$status" == 2* ]] || grep -q "already the current production" "$answer"; then
      wait_for "$id"
    else
      echo "✕ promote $id answered $status"; cat "$answer"; exit 1
    fi
    ;;
  *) echo "usage: vercel-prod.sh current | promote <id|url>"; exit 2 ;;
esac
