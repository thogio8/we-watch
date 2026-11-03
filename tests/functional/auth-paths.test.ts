import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AUTH_PATHS } from "@/auth/auth-paths";
import { createAuth } from "@/auth/create-auth";
import { createDatabase, type Database } from "@/db/create-database";
import { createRateLimits } from "@/db/rate-limit";
import { rateLimit } from "@/db/rate-limit-schema";
import { startServerStack } from "../helpers/functional";
import { BASE_URL } from "../helpers/signup-ceremony";

const SECRET = "functional-auth-secret-0123456789abcdef";

type Handler = (request: Request) => Promise<Response>;

/** A request as the browser client sends it, signed in when `cookie` is. */
function call(handler: Handler, method: string, path: string, cookie = "") {
  return handler(
    new Request(`${BASE_URL}/api/auth${path}`, {
      method,
      headers: { "content-type": "application/json", origin: BASE_URL, cookie },
      body: method === "GET" ? null : "{}",
    }),
  );
}

type Endpoint = {
  path?: string;
  options?: { method?: string | string[]; metadata?: { SERVER_ONLY?: true } };
};

/**
 * Every route Better Auth serves (`:param` → `x`), each with its methods:
 * an endpoint a Better Auth update adds is tested without a line here.
 */
function routesOf(api: object): [string, string][] {
  return (Object.values(api) as Endpoint[]).flatMap(({ path, options }) => {
    if (path === undefined || options?.metadata?.SERVER_ONLY) return [];
    const route = path.replace(/:[^/]+/g, "x");
    return [options?.method ?? []]
      .flat()
      .map((method): [string, string] => [method, route]);
  });
}

let db: Database;
let auth: ReturnType<typeof createAuth>;
beforeAll(async () => {
  await startServerStack();
  db = createDatabase(process.env.DATABASE_URL as string);
  auth = createAuth({
    db,
    secret: SECRET,
    baseURL: BASE_URL,
    rateLimits: createRateLimits(db),
  });
});
beforeEach(() => db.delete(rateLimit));

const open: ReadonlySet<string> = new Set(AUTH_PATHS);
const closedRoutes = () =>
  routesOf(auth.api).filter(([, path]) => !open.has(path));

describe("chemins Better Auth (fonctionnel)", () => {
  it("sans la liste blanche, la même requête atteint Better Auth : GET /ok répond 200", async () => {
    const bare = betterAuth({ secret: SECRET, baseURL: BASE_URL });

    expect((await call(bare.handler, "GET", "/ok")).status).toBe(200);
  });

  it("la liste des routes vient de Better Auth et nomme les chemins sensibles", () => {
    expect(closedRoutes()).toEqual(
      expect.arrayContaining([
        ["GET", "/get-session"],
        ["GET", "/ok"],
        ["GET", "/error"],
        ["GET", "/callback/x"],
        ["POST", "/callback/x"],
        ["GET", "/reset-password/x"],
        ["POST", "/update-user"],
        ["GET", "/list-sessions"],
        ["POST", "/revoke-session"],
        ["POST", "/passkey/delete-passkey"],
      ]),
    );
  });

  it("chaque route hors de AUTH_PATHS répond 404, même connecté, sans rien écrire dans rate_limit", async () => {
    const ctx = await createAuth({
      db,
      secret: SECRET,
      baseURL: BASE_URL,
      rateLimits: createRateLimits(db),
      plugins: [testUtils()],
    }).$context;
    const lea = await ctx.test.saveUser(ctx.test.createUser({ name: "Léa" }));
    const cookie = (await ctx.test.getAuthHeaders({ userId: lea.id })).get(
      "cookie",
    ) as string;

    const answers = await Promise.all(
      closedRoutes().map(async ([method, path]) => [
        `${method} ${path}`,
        (await call(auth.handler, method, path, cookie)).status,
      ]),
    );

    expect(answers.filter(([, status]) => status !== 404)).toEqual([]);
    expect(await db.select().from(rateLimit)).toEqual([]);
  });

  it.each(AUTH_PATHS)("%s reste ouverte : ne répond pas 404", async (path) => {
    const [method] = routesOf(auth.api).find(([, route]) => route === path)!;

    expect((await call(auth.handler, method, path)).status).not.toBe(404);
  });

  it("chaque chemin de AUTH_PATHS est une vraie route de Better Auth", () => {
    const routes = routesOf(auth.api).map(([, path]) => path);

    expect(routes).toEqual(expect.arrayContaining([...AUTH_PATHS]));
  });
});
