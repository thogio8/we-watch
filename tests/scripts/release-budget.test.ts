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

    // The smoke test first waits for the domain to serve the new deployment:
    // its bound, then one last request.
    const ready =
      number(smoke, /SMOKE_READY_TIMEOUT:-(\d+)/) +
      number(smoke, /SMOKE_READY_INTERVAL:-(\d+)/) +
      smokeRequest;

    const worst =
      SETUP +
      request +
      promote +
      ready +
      smokeRequests * smokeRequest +
      promote;

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

describe("le retour arrière du job release (.github/workflows/ci.yml)", () => {
  // The production id is read first: a failed backup or migration must not
  // "roll back" (promote what already serves) before any promote ran.
  it("ne se lance qu'après une mise en ligne tentée", () => {
    const ci = read(".github/workflows/ci.yml");
    const step = (name: string) => {
      const start = ci.indexOf(`- name: ${name}`);
      expect(start, name).toBeGreaterThan(-1);
      const end = ci.indexOf("\n      - ", start + 1);
      return ci.slice(start, end === -1 ? undefined : end);
    };

    expect(step("Put the new deployment online")).toMatch(/\n\s+id: promote\n/);
    expect(step("Roll back if production is broken")).toContain(
      "if: failure() && steps.previous.outputs.id != '' && steps.promote.outcome != 'skipped'",
    );
  });
});
