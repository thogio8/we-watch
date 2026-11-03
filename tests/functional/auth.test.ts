import { testUtils } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createSignupTicket } from "@/access/signup-ticket";
import { createAuth } from "@/auth/create-auth";
import { passkey, user } from "@/db/auth-schema";
import { createDatabase, type Database } from "@/db/create-database";
import { group, membership } from "@/db/group-schema";
import { createGroups } from "@/db/groups";
import { createRateLimits } from "@/db/rate-limit";
import { rateLimit } from "@/db/rate-limit-schema";
import {
  GROUP_COOKIE,
  LEGACY_GROUP_ID,
  LEGACY_GROUP_NAME,
} from "@/domain/group";
import { startServerStack } from "../helpers/functional";
import { BASE_URL, cookiesOf, signUpWith } from "../helpers/signup-ceremony";

const SECRET = "functional-auth-secret-0123456789abcdef";

function buildAuth(baseURL = BASE_URL) {
  return createAuth({
    db,
    secret: SECRET,
    baseURL,
    rateLimits: createRateLimits(db),
    plugins: [testUtils()],
  });
}

let db: Database;
let auth: ReturnType<typeof buildAuth>;
let reset: () => Promise<void>;
beforeAll(async () => {
  ({ reset } = await startServerStack());
  db = createDatabase(process.env.DATABASE_URL as string);
  auth = buildAuth();
});
// Every ceremony below counts against the attempt limits: start each test
// with none.
beforeEach(() => db.delete(rateLimit));

async function saveUser(name: string) {
  const ctx = await auth.$context;
  return ctx.test.saveUser(ctx.test.createUser({ name }));
}

describe("Better Auth (fonctionnel)", () => {
  it("une session valide donne l'utilisateur", async () => {
    const ctx = await auth.$context;
    const user = await saveUser("Léa");
    const headers = await ctx.test.getAuthHeaders({ userId: user.id });

    const session = await auth.api.getSession({ headers });

    expect(session?.user.name).toBe("Léa");
  });

  it("sans en-têtes, pas de session", async () => {
    expect(await auth.api.getSession({ headers: new Headers() })).toBeNull();
  });

  it("un cookie forgé ne donne pas de session, sans exception", async () => {
    const headers = new Headers({
      cookie: "better-auth.session_token=forge.abc",
    });

    expect(await auth.api.getSession({ headers })).toBeNull();
  });

  it("un jeton forgé avec un cache de session bidon ne donne pas de session, sans exception", async () => {
    const headers = new Headers({
      cookie:
        "better-auth.session_token=forge.abc; better-auth.session_data=bidon",
    });

    await expect(auth.api.getSession({ headers })).resolves.toBeNull();
  });

  it("le jeton d'une session supprimée ne donne plus de session, sans exception", async () => {
    const ctx = await auth.$context;
    const lea = await saveUser("Léa");
    const { headers, token } = await ctx.test.login({ userId: lea.id });
    expect(await auth.api.getSession({ headers })).not.toBeNull();

    await ctx.internalAdapter.deleteSession(token);

    await expect(auth.api.getSession({ headers })).resolves.toBeNull();
  });

  it("le nom est normalisé à la création", async () => {
    const user = await saveUser("  Léa   Martin ");

    expect(user.name).toBe("Léa Martin");
  });

  it("un nom invisible est refusé à la création", async () => {
    await expect(saveUser("\u200B")).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("un nom invisible est refusé à la mise à jour", async () => {
    const ctx = await auth.$context;
    const user = await saveUser("Léa");

    await expect(
      ctx.internalAdapter.updateUser(user.id, { name: "\u200B" }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect((await ctx.internalAdapter.findUserById(user.id))?.name).toBe("Léa");
  });

  it("le nom est normalisé à la mise à jour, et une mise à jour sans nom passe", async () => {
    const ctx = await auth.$context;
    const user = await saveUser("Léa");

    await ctx.internalAdapter.updateUser(user.id, { name: " Zoé  B " });
    await ctx.internalAdapter.updateUser(user.id, { emailVerified: true });

    expect(await ctx.internalAdapter.findUserById(user.id)).toMatchObject({
      name: "Zoé B",
      emailVerified: true,
    });
  });

  it.each([
    [BASE_URL, false],
    ["https://wewatch.example", true],
  ])(
    "sur %s, la déconnexion efface aussi le groupe affiché (cookie ww_group, secure: %s)",
    async (baseURL, secure) => {
      const instance = buildAuth(baseURL);
      const ctx = await instance.$context;
      const lea = await ctx.test.saveUser(ctx.test.createUser({ name: "Léa" }));
      const signedIn = await ctx.test.getAuthHeaders({ userId: lea.id });

      const response = await instance.handler(
        new Request(`${baseURL}/api/auth/sign-out`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: baseURL,
            cookie: `${signedIn.get("cookie")}; ${GROUP_COOKIE}=groupe-1`,
          },
          body: "{}",
        }),
      );

      expect(response.status).toBe(200);
      const cleared = response.headers
        .getSetCookie()
        .find((line) => line.startsWith(`${GROUP_COOKIE}=`));
      expect(cleared).toBeDefined();
      expect(cleared).toMatch(new RegExp(`^${GROUP_COOKIE}=;`));
      expect(cleared).toMatch(/Max-Age=0/);
      expect(cleared).toMatch(/Path=\//);
      expect(cleared).toMatch(/HttpOnly/);
      expect(cleared).toMatch(/SameSite=Lax/i);
      expect(/; Secure/i.test(cleared ?? "")).toBe(secure);
    },
  );

  it("sans plugin supplémentaire, l'instance répond aussi", async () => {
    const bare = createAuth({
      db,
      secret: SECRET,
      baseURL: BASE_URL,
      rateLimits: createRateLimits(db),
    });

    expect(await bare.api.getSession({ headers: new Headers() })).toBeNull();
  });

  it("une inscription par passkey sans ticket est refusée", async () => {
    const response = await auth.handler(
      new Request(
        `${BASE_URL}/api/auth/passkey/generate-register-options?context=faux`,
      ),
    );

    expect(response.status).toBe(400);
  });

  it("une inscription par passkey avec un ticket valide donne des options WebAuthn", async () => {
    const ticket = await createSignupTicket(
      { name: "Léa", owner: false, invite: null },
      SECRET,
    );

    const response = await auth.handler(
      new Request(
        `${BASE_URL}/api/auth/passkey/generate-register-options?context=${encodeURIComponent(ticket)}`,
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      rp: { id: "localhost", name: "WeWatch" },
      user: { name: "Léa", displayName: "Léa" },
    });
  });

  describe("cérémonie d'inscription complète", () => {
    const ticketFor = (name: string) =>
      createSignupTicket({ name, owner: false, invite: null }, SECRET);

    async function signUp(options: {
      name: string;
      credentialId: Uint8Array;
      cookies?: string[];
      createSession?: boolean;
      /** Defaults to a fresh ticket for `name`. */
      ticket?: string;
    }) {
      const { name, ...registration } = options;
      const ticket = options.ticket ?? (await ticketFor(name));
      return signUpWith(auth.handler, { ...registration, ticket });
    }

    /** The session the response's cookies open, if any. */
    const sessionOf = (response: Response) =>
      auth.api.getSession({
        headers: new Headers({ cookie: cookiesOf(response).join("; ") }),
      });

    const names = async () =>
      (await db.select({ name: user.name }).from(user)).map((row) => row.name);

    it("crée le compte, sa passkey et une session ouverte", async () => {
      const response = await signUp({
        name: "Nina",
        credentialId: new Uint8Array([1, 2, 3, 4]),
        createSession: true,
      });

      expect(response.status).toBe(200);
      const session = await sessionOf(response);
      expect(session?.user).toMatchObject({ name: "Nina" });
      expect(session?.user.email).toMatch(/@passkey\.invalid$/);
      expect(await db.select().from(passkey)).toContainEqual(
        expect.objectContaining({ userId: session?.user.id }),
      );
      // Ids written through the adapter keep Better Auth's default format.
      expect(session?.user.id).toMatch(/^[A-Za-z0-9]{32}$/);
      expect(session?.session.id).toMatch(/^[A-Za-z0-9]{32}$/);
    });

    it.each([
      ["omis", undefined],
      ["à false", false],
    ])(
      "createSession %s par le client : le compte a quand même sa session",
      async (_label, createSession) => {
        const response = await signUp({
          name: "Tom",
          credentialId: new Uint8Array([7, 7, createSession === false ? 1 : 0]),
          createSession,
        });

        expect(response.status).toBe(200);
        expect((await sessionOf(response))?.user).toMatchObject({
          name: "Tom",
        });
      },
    );

    it("si la passkey ne peut pas être enregistrée, aucun compte orphelin ne reste", async () => {
      const credentialId = new Uint8Array([9, 9, 9, 9]);
      await signUp({ name: "Omar", credentialId });

      const again = await signUp({ name: "Paul", credentialId });

      expect(again.status).not.toBe(200);
      expect(await names()).not.toContain("Paul");
    });

    it("un ticket rejoué ne crée qu'un compte : la seconde inscription est refusée", async () => {
      const ticket = await ticketFor("Ugo");

      const first = await signUp({
        name: "Ugo",
        credentialId: new Uint8Array([3, 1, 4, 1]),
        ticket,
      });
      const replay = await signUp({
        name: "Ugo",
        credentialId: new Uint8Array([3, 1, 4, 2]),
        ticket,
      });

      expect(first.status).toBe(200);
      expect(replay.status).toBe(400);
      expect(await replay.json()).toMatchObject({
        message: "Signup ticket already used",
      });
      expect((await names()).filter((name) => name === "Ugo")).toHaveLength(1);
    });

    it("une inscription annulée par la base ne consomme pas le ticket", async () => {
      const taken = new Uint8Array([2, 7, 1, 8]);
      await signUp({ name: "Vera", credentialId: taken });
      const ticket = await ticketFor("Willy");

      const failed = await signUp({
        name: "Willy",
        credentialId: taken,
        ticket,
      });
      const retried = await signUp({
        name: "Willy",
        credentialId: new Uint8Array([2, 7, 1, 9]),
        ticket,
      });

      expect(failed.status).not.toBe(200);
      expect(retried.status).toBe(200);
      expect((await names()).filter((name) => name === "Willy")).toHaveLength(
        1,
      );
    });

    describe("avec le code propriétaire", () => {
      const ownerTicket = (name: string) =>
        createSignupTicket({ name, owner: true, invite: null }, SECRET);

      const legacyMembers = async () =>
        db
          .select()
          .from(membership)
          .where(eq(membership.groupId, LEGACY_GROUP_ID));

      beforeEach(async () => {
        await reset();
        await db
          .insert(group)
          .values({ id: LEGACY_GROUP_ID, name: LEGACY_GROUP_NAME });
      });

      it("le compte rejoint « NOUS DEUX », qui devient son groupe affiché", async () => {
        const before = Date.now();

        const response = await signUp({
          name: "Max",
          credentialId: new Uint8Array([4, 0, 0, 1]),
          ticket: await ownerTicket("Max"),
        });

        expect(response.status).toBe(200);
        const userId = (await sessionOf(response))?.user.id as string;
        const [joined] = await legacyMembers();
        expect(joined).toMatchObject({ groupId: LEGACY_GROUP_ID, userId });
        expect(joined?.joinedAt.getTime()).toBeGreaterThanOrEqual(before);
        expect(joined?.lastUsedAt).toEqual(joined?.joinedAt);
        expect(await createGroups(db).groupsOf(userId)).toEqual([
          { id: LEGACY_GROUP_ID, name: LEGACY_GROUP_NAME, memberCount: 1 },
        ]);
      });

      it("sans groupe « NOUS DEUX » (instance neuve), le compte est créé sans appartenance", async () => {
        await db.delete(group);

        const response = await signUp({
          name: "Noé",
          credentialId: new Uint8Array([4, 0, 0, 2]),
          ticket: await ownerTicket("Noé"),
        });

        expect(response.status).toBe(200);
        expect((await sessionOf(response))?.user.name).toBe("Noé");
        expect(await db.select().from(membership)).toEqual([]);
        expect(await db.select().from(group)).toEqual([]);
      });

      it("sans le code, le compte ne rejoint pas « NOUS DEUX »", async () => {
        const response = await signUp({
          name: "Olga",
          credentialId: new Uint8Array([4, 0, 0, 3]),
        });

        expect(response.status).toBe(200);
        expect(await legacyMembers()).toEqual([]);
      });

      it("un ticket propriétaire rejoué est refusé : une seule appartenance", async () => {
        const ticket = await ownerTicket("Pia");

        const first = await signUp({
          name: "Pia",
          credentialId: new Uint8Array([4, 0, 0, 4]),
          ticket,
        });
        const replay = await signUp({
          name: "Pia",
          credentialId: new Uint8Array([4, 0, 0, 5]),
          ticket,
        });

        expect(first.status).toBe(200);
        expect(replay.status).toBe(400);
        expect(await legacyMembers()).toHaveLength(1);
      });

      it("une inscription qui échoue après l'appartenance l'annule aussi", async () => {
        const taken = new Uint8Array([4, 0, 0, 6]);
        await signUp({ name: "Quentin", credentialId: taken });

        const failed = await signUp({
          name: "Rémi",
          credentialId: taken,
          ticket: await ownerTicket("Rémi"),
        });

        expect(failed.status).not.toBe(200);
        expect(await names()).not.toContain("Rémi");
        expect(await legacyMembers()).toEqual([]);
      });
    });

    it("connecté, une inscription est refusée et ne crée aucun compte", async () => {
      const ctx = await auth.$context;
      const signedIn = await saveUser("Rose");
      const { cookies } = await ctx.test.login({ userId: signedIn.id });
      const before = (await db.select().from(user)).length;

      const response = await signUp({
        name: "Sam",
        credentialId: new Uint8Array([5, 6, 7, 8]),
        cookies: cookies.map(({ name, value }) => `${name}=${value}`),
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        message: "Already signed in",
      });
      expect(await db.select().from(user)).toHaveLength(before);
      expect(await names()).not.toContain("Sam");
    });
  });
});

describe("limites de tentatives (fonctionnel)", () => {
  const from = (ip: string, path: string) =>
    auth.handler(
      new Request(`${BASE_URL}/api/auth${path}`, {
        headers: { "x-forwarded-for": ip },
      }),
    );
  const statusesFrom = async (ip: string, path: string, times: number) => {
    const statuses: number[] = [];
    for (let i = 0; i < times; i++) {
      statuses.push((await from(ip, path)).status);
    }
    return statuses;
  };

  it("la 11ᵉ demande d'options d'inscription de la même IP en 10 minutes répond 429, une autre IP non", async () => {
    const path = "/passkey/generate-register-options";

    const first = await statusesFrom("203.0.113.1", path, 10);
    const eleventh = await from("203.0.113.1", path);

    expect(first).not.toContain(429);
    expect(eleventh.status).toBe(429);
    expect(Number(eleventh.headers.get("x-retry-after"))).toBeGreaterThan(590);
    expect((await from("203.0.113.2", path)).status).not.toBe(429);
  });

  it("la 31ᵉ demande d'options de connexion de la même IP répond 429, une autre IP répond 200", async () => {
    const path = "/passkey/generate-authenticate-options";

    expect(await statusesFrom("203.0.113.1", path, 30)).toEqual(
      Array(30).fill(200),
    );
    expect((await from("203.0.113.1", path)).status).toBe(429);
    expect((await from("203.0.113.2", path)).status).toBe(200);
  });

  it("un chemin inconnu répond 404 sans rien écrire dans rate_limit", async () => {
    for (let i = 0; i < 50; i++) {
      expect((await from("203.0.113.1", `/x${i}`)).status).toBe(404);
    }

    expect(await db.select().from(rateLimit)).toEqual([]);
  });

  it("chaque tentative est comptée par IP et chemin, avant toute validation", async () => {
    await from(
      "203.0.113.1",
      "/passkey/generate-register-options?context=faux",
    );

    expect(await db.select().from(rateLimit)).toEqual([
      expect.objectContaining({
        key: "203.0.113.1|/passkey/generate-register-options",
        count: 1,
      }),
    ]);
  });
});
