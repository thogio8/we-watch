import { headers } from "next/headers";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createAuth } from "@/auth/create-auth";
import type { Database } from "@/db/create-database";
import { createRateLimits } from "@/db/rate-limit";
import { rateLimit } from "@/db/rate-limit-schema";
import { prepareSignup } from "@/features/signin/actions";
import { startServerStack } from "../helpers/functional";
import { BASE_URL } from "../helpers/signup-ceremony";

// Under test (NODE_ENV=test, or TEST), Better Auth reads a request without a
// trusted IP as 127.0.0.1. It reads NODE_ENV once, when first loaded: unset
// here before any import, this file (its own process) sees a request as
// production does.
vi.hoisted(() => {
  Reflect.deleteProperty(process.env, "NODE_ENV");
  process.env.TEST = "false";
});

vi.mock("next/headers");
vi.mock("next/cache");

const SECRET = "functional-auth-secret-0123456789abcdef";

/** No IP, then one Better Auth does not trust (a chain of proxies). */
const UNTRUSTED: HeadersInit[] = [
  {},
  { "x-forwarded-for": "203.0.113.1, 10.0.0.1" },
];

let db: Database;
let auth: ReturnType<typeof createAuth>;
beforeAll(async () => {
  ({ db } = await startServerStack());
  auth = createAuth({
    db,
    secret: SECRET,
    baseURL: BASE_URL,
    rateLimits: createRateLimits(db),
  });
});
beforeEach(() => db.delete(rateLimit));

const counters = () => db.select().from(rateLimit);

describe("sans IP de confiance (fonctionnel)", () => {
  it("Better Auth compte toutes ces requêtes dans un seul seau par chemin, « no-trusted-ip »", async () => {
    const path = "/passkey/generate-authenticate-options";
    for (const init of UNTRUSTED) {
      await auth.handler(
        new Request(`${BASE_URL}/api/auth${path}`, { headers: init }),
      );
    }

    expect(await counters()).toEqual([
      expect.objectContaining({ key: `no-trusted-ip|${path}`, count: 2 }),
    ]);
  });

  it("les actions serveur aussi : la clé « signup:no-trusted-ip », partagée", async () => {
    for (const init of UNTRUSTED) {
      vi.mocked(headers).mockResolvedValueOnce(new Headers(init) as never);
      await prepareSignup(new FormData());
    }

    expect(await counters()).toEqual([
      expect.objectContaining({ key: "signup:no-trusted-ip", count: 2 }),
    ]);
  });
});
