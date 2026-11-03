import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createAuth } from "@/auth/create-auth";
import { createDatabase, type Database } from "@/db/create-database";
import { createRateLimits } from "@/db/rate-limit";
import { startServerStack } from "../helpers/functional";
import { BASE_URL } from "../helpers/signup-ceremony";

// Better Auth turns its origin (and CSRF) check off when it believes it runs
// tests: NODE_ENV=test or any truthy TEST variable. A stray TEST=1 in the
// production environment must not reopen cross-site requests.

let db: Database;
beforeAll(async () => {
  await startServerStack();
  db = createDatabase(process.env.DATABASE_URL as string);
});
afterEach(() => vi.unstubAllEnvs());

/** A signed-in looking POST from another site, as a CSRF attempt sends it. */
async function crossSitePost() {
  const auth = createAuth({
    db,
    secret: "functional-auth-secret-0123456789abcdef",
    baseURL: BASE_URL,
    rateLimits: createRateLimits(db),
  });
  const response = await auth.handler(
    new Request(`${BASE_URL}/api/auth/passkey/verify-authentication`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://evil.example",
        cookie: "x=1",
      },
      body: "{}",
    }),
  );
  return response.status;
}

describe("contrôle d'origine de Better Auth (fonctionnel)", () => {
  it("en production, une variable TEST ne le coupe pas : une autre origine reçoit 403", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TEST", "1");

    expect(await crossSitePost()).toBe(403);
  });

  it("hors production (ces tests), Better Auth le coupe : la même requête passe", async () => {
    expect(await crossSitePost()).not.toBe(403);
  });
});
