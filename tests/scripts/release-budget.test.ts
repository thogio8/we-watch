import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// GitHub cancels a job past its timeout-minutes, and a cancelled job skips
// the rollback step (if: failure()). The release job's timeout must cover
// its slowest bounded path: setup, then the current production id, the
// promote of the new deployment, the smoke test and the rollback (a second
// promote), each at the bounds the scripts set themselves.

const read = (path: string) => readFileSync(path, "utf8");

function number(text: string, pattern: RegExp) {
  const value = Number(text.match(pattern)?.[1]);
  expect(value, String(pattern)).toBeGreaterThan(0);
  return value;
}

/** Checkout, setup-node, npm ci, backup and migration: a generous bound. */
const SETUP = 240;
/** The last poll of the promote wait (state() --max-time) and its interval. */
const LAST_POLL = 15;

describe("le budget du job release (.github/workflows/ci.yml)", () => {
  it("son timeout couvre le pire cas borné, retour arrière compris", () => {
    const prod = read("scripts/vercel-prod.sh");
    const smoke = read("scripts/smoke-prod.sh");
    const ci = read(".github/workflows/ci.yml");
    const wait = number(prod, /VERCEL_PROMOTE_TIMEOUT:-(\d+)/);
    const request = number(prod, /VERCEL_MAX_TIME:-(\d+)/);
    const smokeRequest = number(smoke, /--max-time (\d+)/);
    const smokeRequests = smoke.match(/\brequest (?=[-"])/g)?.length ?? 0;
    const release = ci.slice(ci.indexOf("\n  release:"));
    const timeout = number(release, /timeout-minutes: (\d+)/);
    // The promote looks the deployment up, posts, then waits.
    const promote = 2 * request + wait + LAST_POLL;

    const worst =
      SETUP + request + promote + smokeRequests * smokeRequest + promote;

    expect(smokeRequests).toBe(8);
    expect(timeout * 60).toBeGreaterThanOrEqual(worst);
  });

  it("l'attente de la mise en ligne laisse à Vercel trois minutes", () => {
    const wait = number(
      read("scripts/vercel-prod.sh"),
      /VERCEL_PROMOTE_TIMEOUT:-(\d+)/,
    );

    expect(wait).toBe(180);
  });
});
