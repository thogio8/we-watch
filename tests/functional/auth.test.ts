import { testUtils } from "better-auth/plugins";
import { beforeAll, describe, expect, it } from "vitest";
import { createAuth } from "@/auth/create-auth";
import { createDatabase } from "@/db/create-database";
import { startServerStack } from "../helpers/functional";

const BASE_URL = "http://localhost:3000";

function buildAuth() {
  return createAuth({
    db: createDatabase(process.env.DATABASE_URL as string),
    secret: "functional-auth-secret-0123456789abcdef",
    baseURL: BASE_URL,
    plugins: [testUtils()],
  });
}

let auth: ReturnType<typeof buildAuth>;
beforeAll(async () => {
  await startServerStack();
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

  it.each([
    "/update-user",
    "/sign-up/email",
    "/sign-in/email",
    "/change-email",
    "/delete-user",
  ])("la route %s inutilisée répond 404", async (path) => {
    const response = await auth.handler(
      new Request(`${BASE_URL}/api/auth${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE_URL },
        body: JSON.stringify({ name: "​" }),
      }),
    );

    expect(response.status).toBe(404);
  });

  it("sans plugin supplémentaire, l'instance répond aussi", async () => {
    const bare = createAuth({
      db: createDatabase(process.env.DATABASE_URL as string),
      secret: "functional-auth-secret-0123456789abcdef",
      baseURL: BASE_URL,
    });

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
    const { createSignupTicket } = await import("@/access/signup-ticket");
    const ticket = await createSignupTicket(
      { name: "Léa", owner: false },
      "functional-auth-secret-0123456789abcdef",
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
});
