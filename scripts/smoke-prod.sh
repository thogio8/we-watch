#!/usr/bin/env bash
# After a deploy: the app answers, its environment is valid (the proxy checks
# it on every request), sign-in is wired (redirect, security headers, passkey
# options for this host, unused auth paths closed, other origins refused) and
# the whole stack works (the daily cron purges and refreshes: database and
# TMDB). Needs PROD_URL and CRON_SECRET. A failure prints what was expected
# and what was received, never a secret nor a response body. One passkey
# options call per run: far below its limit (30 per 10 min per IP).
# EXPECT_SIGNUP (invite by default, or open) is the signup mode production
# must show: with invite, /connexion must say so (SIGNUP lost or mistyped in
# Vercel opens signup to anyone who knows the address).
set -euo pipefail

fail() {
  echo "✕ $1: expected $2, received $3"
  exit 1
}

expect_signup="${EXPECT_SIGNUP:-invite}"
[[ "$expect_signup" =~ ^(invite|open)$ ]] ||
  fail EXPECT_SIGNUP "invite or open" "$expect_signup"

# The passkeys' rpID is the host of BETTER_AUTH_URL, which must equal PROD_URL.
host="${PROD_URL#*://}"
host="${host%%/*}"
host="${host%%:*}"
base="${PROD_URL%/}"
# curl prints 000 when it gets no answer: reported like any other status.
request() { curl -s --max-time 60 "$@" || true; }

# Vercel may report the promote done before the domain serves the new
# deployment (2026-11-03: one second after the promote, /connexion was still
# the 1.3.x's 307). Wait, bounded, for /connexion to answer 200; a broken
# deployment never does, and fails once the wait is over.
ready_timeout="${SMOKE_READY_TIMEOUT:-120}"
ready_interval="${SMOKE_READY_INTERVAL:-5}"
deadline=$((SECONDS + ready_timeout))
while true; do
  status="$(request -o /dev/null -w '%{http_code}' "$base/connexion")"
  [ "$status" = 200 ] && break
  [ "$SECONDS" -lt "$deadline" ] || fail /connexion 200 "$status"
  sleep "$ready_interval"
done
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

# CLOSED_ERROR in src/features/signin/messages.ts, the note /connexion shows
# when signup is by invitation (SigninHome): a test keeps the two equal. Its
# spaces may be non-breaking (U+00A0, &nbsp;, &#160;, &#xa0;).
invite_only="WEWATCH SE REJOINT SUR INVITATION"
if [ "$expect_signup" = invite ]; then
  page="$(request "$base/connexion" |
    LC_ALL=C sed -E $'s/&nbsp;|&#160;|&#[xX][aA]0;|\xc2\xa0/ /g')"
  [[ "$page" == *"$invite_only"* ]] ||
    fail "/connexion signup" "$invite_only" "signup open"
  echo "✓ /connexion signup by invitation only"
else
  echo "– signup mode not checked (EXPECT_SIGNUP=open)"
fi

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

# A cross-site POST that looks signed in (a cookie): Better Auth's origin
# check must refuse it whatever the environment (src/auth/create-auth.ts).
status="$(request -o /dev/null -w '%{http_code}' -X POST \
  -H 'Origin: https://evil.example' -H 'Content-Type: application/json' \
  -H 'Cookie: x=1' --data '{}' "$base/api/auth/passkey/verify-authentication")"
[ "$status" = 403 ] || fail "POST from another origin (origin check)" 403 "$status"
echo "✓ POST from another origin 403"

body="$(request -w '\n%{http_code}' \
  -H "Authorization: Bearer $CRON_SECRET" "$base/api/cron/refresh-movies")"
status="${body##*$'\n'}"
report="${body%$'\n'*}"
[ "$status" = 200 ] || fail "daily purge and refresh" 200 "$status"
failed="$(grep -o '"failed":\[[^]]*\]' <<<"$report" || true)"
[ "$failed" = '"failed":[]' ] ||
  fail "daily refresh" '"failed":[]' "${failed:-(no failed list)}"
echo "✓ purge and refresh $report"
