#!/usr/bin/env bash
# After a deploy: the app answers, its environment is valid (the proxy checks
# it on every request), sign-in is wired (redirect, security headers, passkey
# options for this host, unused auth paths closed) and the whole stack works
# (the daily cron purges and refreshes: database and TMDB). Needs PROD_URL and
# CRON_SECRET. A failure prints what was expected and what was received, never
# a secret nor a response body. One passkey options call per run: far below
# its limit (30 per 10 min per IP).
set -euo pipefail

fail() {
  echo "✕ $1: expected $2, received $3"
  exit 1
}

# The passkeys' rpID is the host of BETTER_AUTH_URL, which must equal PROD_URL.
host="${PROD_URL#*://}"
host="${host%%/*}"
host="${host%%:*}"
base="${PROD_URL%/}"
# curl prints 000 when it gets no answer: reported like any other status.
request() { curl -s --max-time 60 "$@" || true; }

status="$(request -o /dev/null -w '%{http_code}' "$base/connexion")"
[ "$status" = 200 ] || fail /connexion 200 "$status"
echo "✓ /connexion 200"

read -r status location < <(request -o /dev/null \
  -w '%{http_code} %{redirect_url}\n' "$base/")
[[ "$status" = 307 && "$location" == */connexion ]] ||
  fail "/ without a session" "307 …/connexion" "$status ${location:-(none)}"
echo "✓ / 307 → /connexion"

csp="$(request -o /dev/null -D - "$base/connexion" |
  sed -n 's/^content-security-policy: *//Ip' | tr -d '\r')"
[[ "$csp" == *"frame-ancestors 'none'"* ]] ||
  fail "/connexion CSP" "frame-ancestors 'none'" \
    "${csp:-(no content-security-policy)}"
echo "✓ /connexion content-security-policy with frame-ancestors 'none'"

# Writes one verification row: the auth tables answer, rpID is this host.
options="$base/api/auth/passkey/generate-authenticate-options"
body="$(request -w '\n%{http_code}' "$options")"
status="${body##*$'\n'}"
[ "$status" = 200 ] || fail "passkey options" "200 \"rpId\":\"$host\"" "$status"
rp_id="$(grep -o '"rpId":"[^"]*"' <<<"$body" || true)"
[ "$rp_id" = "\"rpId\":\"$host\"" ] ||
  fail "passkey options" "\"rpId\":\"$host\"" "${rp_id:-(no rpId)}"
echo "✓ passkey options 200, rpId $host"

status="$(request -o /dev/null -w '%{http_code}' "$base/api/auth/ok")"
[ "$status" = 404 ] || fail "/api/auth/ok (not an app auth path)" 404 "$status"
echo "✓ /api/auth/ok 404"

body="$(request -w '\n%{http_code}' \
  -H "Authorization: Bearer $CRON_SECRET" "$base/api/cron/refresh-movies")"
status="${body##*$'\n'}"
report="${body%$'\n'*}"
[ "$status" = 200 ] || fail "daily purge and refresh" 200 "$status"
failed="$(grep -o '"failed":\[[^]]*\]' <<<"$report" || true)"
[ "$failed" = '"failed":[]' ] ||
  fail "daily refresh" '"failed":[]' "${failed:-(no failed list)}"
echo "✓ purge and refresh $report"
