import { testUtils } from "better-auth/plugins";
import { beforeAll, describe, expect, it } from "vitest";
import { createSignupTicket } from "@/access/signup-ticket";
import { createAuth, DISABLED_PATHS } from "@/auth/create-auth";
import { passkey, user } from "@/db/auth-schema";
import { createDatabase, type Database } from "@/db/create-database";
import { startServerStack } from "../helpers/functional";
import { fakeRegistration } from "../helpers/webauthn";

const BASE_URL = "http://localhost:3000";
const SECRET = "functional-auth-secret-0123456789abcdef";

function buildAuth() {
  return createAuth({
    db,
    secret: SECRET,
    baseURL: BASE_URL,
    plugins: [testUtils()],
  });
}

let db: Database;
let auth: ReturnType<typeof buildAuth>;
beforeAll(async () => {
  await startServerStack();
  db = createDatabase(process.env.DATABASE_URL as string);
  auth = buildAuth();
});

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
    await expect(saveUser("​")).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("un nom invisible est refusé à la mise à jour", async () => {
    const ctx = await auth.$context;
    const user = await saveUser("Léa");

    await expect(
      ctx.internalAdapter.updateUser(user.id, { name: "​" }),
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

  it.each(
    DISABLED_PATHS.flatMap((path) => [
      ["GET", path],
      ["POST", path],
    ]),
  )("%s %s inutilisée répond 404", async (method, path) => {
    const response = await auth.handler(
      new Request(`${BASE_URL}/api/auth${path}`, {
        method,
        headers: { "content-type": "application/json", origin: BASE_URL },
        body: method === "POST" ? JSON.stringify({ name: "\u200B" }) : null,
      }),
    );

    expect(response.status).toBe(404);
  });

  it("sans plugin supplémentaire, l'instance répond aussi", async () => {
    const bare = createAuth({ db, secret: SECRET, baseURL: BASE_URL });

    expect(await bare.api.getSession({ headers: new Headers() })).toBeNull();
  });

  it("la route de session reste ouverte", async () => {
    const response = await auth.handler(
      new Request(`${BASE_URL}/api/auth/get-session`),
    );

    expect(response.status).toBe(200);
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
      { name: "Léa", owner: false },
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
    /** Cookies `name=value` a response sets, ready for a `cookie` header. */
    const cookiesOf = (response: Response) =>
      response.headers.getSetCookie().map((line) => line.split(";")[0]);

    const ticketFor = (name: string) =>
      createSignupTicket({ name, owner: false }, SECRET);

    async function signUp(options: {
      name: string;
      credentialId: Uint8Array;
      cookies?: string[];
      /** What the client asks for; the server opens a session regardless. */
      createSession?: boolean;
      /** Defaults to a fresh ticket for `name`. */
      ticket?: string;
    }) {
      const ticket = options.ticket ?? (await ticketFor(options.name));
      const cookies = options.cookies ?? [];
      const challenge = await auth.handler(
        new Request(
          `${BASE_URL}/api/auth/passkey/generate-register-options?context=${encodeURIComponent(ticket)}`,
          { headers: { cookie: cookies.join("; ") } },
        ),
      );
      const { challenge: value } = (await challenge.json()) as {
        challenge: string;
      };
      const response = await fakeRegistration({
        challenge: value,
        origin: BASE_URL,
        rpId: "localhost",
        credentialId: options.credentialId,
      });
      return auth.handler(
        new Request(`${BASE_URL}/api/auth/passkey/verify-registration`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: BASE_URL,
            cookie: [...cookies, ...cookiesOf(challenge)].join("; "),
          },
          body: JSON.stringify({
            response,
            createSession: options.createSession,
          }),
        }),
      );
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
