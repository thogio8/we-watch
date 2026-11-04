#!/usr/bin/env bash
# End-to-end and visual tests, always inside the official Playwright image
# (same browser, fonts and rendering here and on GitHub), so screenshots
# compare equal everywhere. Arguments go to `playwright test`, e.g.
#   npm run test:e2e -- --update-snapshots=all
# `npm run test:lighthouse` passes --config=playwright.lighthouse.config.ts.
set -euo pipefail

if [ "${PLAYWRIGHT_IN_DOCKER:-}" = 1 ]; then
  npx next build
  exec npx playwright test "$@"
fi

version="$(node -p 'require("@playwright/test/package.json").version')"
# GitHub's job summary, appended to from inside (Lighthouse's scores).
summary=()
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  summary=(-e GITHUB_STEP_SUMMARY -v "$GITHUB_STEP_SUMMARY:$GITHUB_STEP_SUMMARY")
fi
exec docker run --rm --ipc=host "${summary[@]}" \
  --user "$(id -u):$(id -g)" -e HOME=/tmp -e CI -e PLAYWRIGHT_IN_DOCKER=1 \
  -v "$PWD:$PWD" -w "$PWD" \
  "mcr.microsoft.com/playwright:v${version}-noble" \
  bash scripts/e2e.sh "$@"
