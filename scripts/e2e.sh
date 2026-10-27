#!/usr/bin/env bash
# End-to-end and visual tests, always inside the official Playwright image
# (same browser, fonts and rendering here and on GitHub), so screenshots
# compare equal everywhere. Arguments go to `playwright test`, e.g.
#   npm run test:e2e -- --update-snapshots=all
set -euo pipefail

if [ "${PLAYWRIGHT_IN_DOCKER:-}" = 1 ]; then
  npx next build
  exec npx playwright test "$@"
fi

version="$(node -p 'require("@playwright/test/package.json").version')"
exec docker run --rm --ipc=host \
  --user "$(id -u):$(id -g)" -e HOME=/tmp -e CI -e PLAYWRIGHT_IN_DOCKER=1 \
  -v "$PWD:$PWD" -w "$PWD" \
  "mcr.microsoft.com/playwright:v${version}-noble" \
  bash scripts/e2e.sh "$@"
