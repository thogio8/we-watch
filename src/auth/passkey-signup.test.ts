import type * as betterAuthApi from "better-auth/api";
import { getSessionFromCtx } from "better-auth/api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSignupTicket } from "@/access/signup-ticket";
import { passkeySignup } from "./passkey-signup";

vi.mock("better-auth/api", async (importOriginal) => ({
  ...(await importOriginal<typeof betterAuthApi>()),
  getSessionFromCtx: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(getSessionFromCtx).mockResolvedValue(null);
});

const SECRET = "a-long-enough-better-auth-secret";
const ELEVEN_MINUTES = 11 * 60 * 1000;

function fakeCtx() {
  const createUser = vi.fn(async (data: { name: string }) => ({
    id: "user-1",
    ...data,
  }));
  return { createUser, ctx: { context: { internalAdapter: { createUser } } } };
}

/** The verification arguments the plugin passes, reduced to what we read. */
function afterVerificationArgs(ctx: unknown, context: string | null) {
  return { ctx, context } as unknown as Parameters<
    ReturnType<typeof passkeySignup>["afterVerification"]
  >[0];
}

const resolveArgs = (context: string | null | undefined) =>
  ({ ctx: {}, context }) as unknown as Parameters<
    ReturnType<typeof passkeySignup>["resolveUser"]
  >[0];

describe("passkeySignup", () => {
  it("n'exige pas de session pour créer une passkey", () => {
    expect(passkeySignup(SECRET).requireSession).toBe(false);
  });

  it("resolveUser : un ticket valide donne le nom du ticket et un identifiant", async () => {
    const ticket = await createSignupTicket(
      { name: "Léa", owner: false },
      SECRET,
    );

    const user = await passkeySignup(SECRET).resolveUser(resolveArgs(ticket));

    expect(user).toMatchObject({ name: "Léa", displayName: "Léa" });
    expect(user.id).not.toBe("");
  });

  it("resolveUser : deux inscriptions n'ont pas le même identifiant", async () => {
    const ticket = await createSignupTicket(
      { name: "Léa", owner: false },
      SECRET,
    );
    const signup = passkeySignup(SECRET);

    const first = await signup.resolveUser(resolveArgs(ticket));
    const second = await signup.resolveUser(resolveArgs(ticket));

    expect(first.id).not.toBe(second.id);
  });

  it.each([
    ["sans ticket", undefined],
    ["avec un ticket nul", null],
    ["avec un ticket invalide", "pas.un-ticket"],
  ])("resolveUser %s : rejette", async (_, context) => {
    await expect(
      passkeySignup(SECRET).resolveUser(resolveArgs(context)),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("resolveUser : un ticket signé avec un autre secret est rejeté", async () => {
    const ticket = await createSignupTicket(
      { name: "Léa", owner: false },
      "another-long-enough-secret-value",
    );

    await expect(
      passkeySignup(SECRET).resolveUser(resolveArgs(ticket)),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("afterVerification : crée l'utilisateur une fois, avec ce nom et une adresse en @passkey.invalid", async () => {
    const ticket = await createSignupTicket(
      { name: "Léa", owner: true },
      SECRET,
    );
    const { createUser, ctx } = fakeCtx();

    const result = await passkeySignup(SECRET).afterVerification(
      afterVerificationArgs(ctx, ticket),
    );

    expect(result).toEqual({ userId: "user-1" });
    expect(createUser).toHaveBeenCalledTimes(1);
    expect(createUser).toHaveBeenCalledWith(
      {
        name: "Léa",
        email: expect.stringMatching(/^[0-9a-f-]{36}@passkey\.invalid$/),
        emailVerified: false,
      },
      { method: "passkey" },
    );
  });

  it("afterVerification : un ticket expiré est rejeté et aucun utilisateur n'est créé", async () => {
    const ticket = await createSignupTicket(
      { name: "Léa", owner: false },
      SECRET,
      Date.now() - ELEVEN_MINUTES,
    );
    const { createUser, ctx } = fakeCtx();

    await expect(
      passkeySignup(SECRET).afterVerification(
        afterVerificationArgs(ctx, ticket),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(createUser).not.toHaveBeenCalled();
  });

  it("afterVerification : connecté, on ne crée pas de second compte", async () => {
    const ticket = await createSignupTicket(
      { name: "Léa", owner: false },
      SECRET,
    );
    vi.mocked(getSessionFromCtx).mockResolvedValue({
      session: {},
      user: { id: "already-here" },
    } as never);
    const { createUser, ctx } = fakeCtx();

    await expect(
      passkeySignup(SECRET).afterVerification(
        afterVerificationArgs(ctx, ticket),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(getSessionFromCtx).toHaveBeenCalledWith(ctx);
    expect(createUser).not.toHaveBeenCalled();
  });

  it("afterVerification : sans ticket, aucun utilisateur n'est créé", async () => {
    const { createUser, ctx } = fakeCtx();

    await expect(
      passkeySignup(SECRET).afterVerification(afterVerificationArgs(ctx, null)),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(createUser).not.toHaveBeenCalled();
  });
});
