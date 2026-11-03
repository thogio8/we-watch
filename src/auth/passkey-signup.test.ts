import type * as betterAuthApi from "better-auth/api";
import { getAuthoritativeSessionFromCtx } from "better-auth/api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSignupTicket, readSignupTicket } from "@/access/signup-ticket";
import type * as groupJoin from "./group-join";
import { joinInvitedGroup } from "./group-join";
import { passkeySignup } from "./passkey-signup";

vi.mock("better-auth/api", async (importOriginal) => ({
  ...(await importOriginal<typeof betterAuthApi>()),
  getAuthoritativeSessionFromCtx: vi.fn(),
}));
// The conditional insert runs on the real transaction: tested in group-join.
vi.mock("./group-join", async (importOriginal) => ({
  ...(await importOriginal<typeof groupJoin>()),
  joinInvitedGroup: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(getAuthoritativeSessionFromCtx).mockResolvedValue(null);
  vi.mocked(joinInvitedGroup).mockReset();
});

const SECRET = "a-long-enough-better-auth-secret";
const ELEVEN_MINUTES = 11 * 60 * 1000;

/** `used`: the ticket's jti is already in the signup_ticket_use table. */
function fakeCtx({ used = false } = {}) {
  const createUser = vi.fn(async (data: { name: string }) => ({
    id: "user-1",
    ...data,
  }));
  const findOne = vi.fn(async () => (used ? { id: "jti" } : null));
  const create = vi.fn(async ({ data }: { data: object }) => data);
  return {
    createUser,
    findOne,
    create,
    ctx: {
      context: {
        internalAdapter: { createUser },
        adapter: { findOne, create },
      },
    },
  };
}

/**
 * The verification arguments the plugin passes, reduced to what we read:
 * `user` is who the options were generated for (the session's user, if any).
 */
function afterVerificationArgs(
  ctx: unknown,
  context: string | null,
  userId = "already-here",
) {
  return { ctx, context, user: { id: userId } } as unknown as Parameters<
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
      { name: "Léa", invite: null },
      SECRET,
    );

    const user = await passkeySignup(SECRET).resolveUser(resolveArgs(ticket));

    expect(user).toMatchObject({ name: "Léa", displayName: "Léa" });
    expect(user.id).not.toBe("");
  });

  it("resolveUser : deux inscriptions n'ont pas le même identifiant", async () => {
    const ticket = await createSignupTicket(
      { name: "Léa", invite: null },
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
      { name: "Léa", invite: null },
      "another-long-enough-secret-value",
    );

    await expect(
      passkeySignup(SECRET).resolveUser(resolveArgs(ticket)),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("afterVerification : crée l'utilisateur une fois, avec ce nom et une adresse en @passkey.invalid", async () => {
    const ticket = await createSignupTicket(
      { name: "Léa", invite: null },
      SECRET,
    );
    const { createUser, create, ctx } = fakeCtx();

    const result = await passkeySignup(SECRET).afterVerification(
      afterVerificationArgs(ctx, ticket),
    );

    expect(result).toEqual({ userId: "user-1" });
    expect(createUser).toHaveBeenCalledTimes(1);
    expect(create.mock.invocationCallOrder[0]).toBeLessThan(
      createUser.mock.invocationCallOrder[0] as number,
    );
    expect(createUser).toHaveBeenCalledWith(
      {
        name: "Léa",
        email: expect.stringMatching(/^[0-9a-f-]{36}@passkey\.invalid$/),
        emailVerified: false,
      },
      { method: "passkey" },
    );
  });

  it("afterVerification : consomme le jti du ticket, dans la base de Better Auth", async () => {
    const ticket = await createSignupTicket(
      { name: "Léa", invite: null },
      SECRET,
    );
    const jti = (await readSignupTicket(ticket, SECRET))?.jti;
    const { findOne, create, ctx } = fakeCtx();

    await passkeySignup(SECRET).afterVerification(
      afterVerificationArgs(ctx, ticket),
    );

    expect(findOne).toHaveBeenCalledWith({
      model: "signupTicketUse",
      where: [{ field: "id", value: jti }],
    });
    expect(create).toHaveBeenCalledWith({
      model: "signupTicketUse",
      data: { id: jti, usedAt: expect.any(Date) },
      forceAllowId: true,
    });
  });

  it("afterVerification : un ticket déjà utilisé est rejeté et aucun utilisateur n'est créé", async () => {
    const ticket = await createSignupTicket(
      { name: "Léa", invite: null },
      SECRET,
    );
    const { createUser, create, ctx } = fakeCtx({ used: true });

    await expect(
      passkeySignup(SECRET).afterVerification(
        afterVerificationArgs(ctx, ticket),
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      body: { message: "Signup ticket already used" },
    });
    expect(create).not.toHaveBeenCalled();
    expect(createUser).not.toHaveBeenCalled();
  });

  it("afterVerification : un ticket expiré est rejeté et aucun utilisateur n'est créé", async () => {
    const ticket = await createSignupTicket(
      { name: "Léa", invite: null },
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

  const signedIn = () =>
    vi.mocked(getAuthoritativeSessionFromCtx).mockResolvedValue({
      session: {},
      user: { id: "already-here" },
    } as never);

  it("afterVerification : connecté, avec un ticket, on ne crée pas de second compte", async () => {
    const ticket = await createSignupTicket(
      { name: "Léa", invite: null },
      SECRET,
    );
    signedIn();
    const { createUser, create, ctx } = fakeCtx();

    await expect(
      passkeySignup(SECRET).afterVerification(
        afterVerificationArgs(ctx, ticket),
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      body: { message: "Already signed in" },
    });
    expect(getAuthoritativeSessionFromCtx).toHaveBeenCalledWith(ctx);
    expect(createUser).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("afterVerification : connecté, sans ticket, la passkey va à l’utilisateur de la session", async () => {
    signedIn();
    const { createUser, create, ctx } = fakeCtx();

    const result = await passkeySignup(SECRET).afterVerification(
      afterVerificationArgs(ctx, null),
    );

    expect(result).toBeUndefined();
    expect(createUser).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("afterVerification : connecté, des options faites pour un autre utilisateur sont refusées", async () => {
    signedIn();
    const { createUser, ctx } = fakeCtx();

    await expect(
      passkeySignup(SECRET).afterVerification(
        afterVerificationArgs(ctx, null, "someone-else"),
      ),
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(createUser).not.toHaveBeenCalled();
  });

  it("afterVerification : sans ticket, aucun utilisateur n'est créé", async () => {
    const { createUser, ctx } = fakeCtx();

    await expect(
      passkeySignup(SECRET).afterVerification(afterVerificationArgs(ctx, null)),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(createUser).not.toHaveBeenCalled();
  });

  it("afterVerification : sans invitation, aucun groupe rejoint", async () => {
    const ticket = await createSignupTicket(
      { name: "Léa", invite: null },
      SECRET,
    );
    const { ctx } = fakeCtx();

    await passkeySignup(SECRET).afterVerification(
      afterVerificationArgs(ctx, ticket),
    );

    expect(joinInvitedGroup).not.toHaveBeenCalled();
  });

  it("afterVerification : après la création du compte, rejoint le groupe de l’invitation", async () => {
    const ticket = await createSignupTicket(
      { name: "Léa", invite: "g-5" },
      SECRET,
    );
    const { createUser, ctx } = fakeCtx();

    await passkeySignup(SECRET).afterVerification(
      afterVerificationArgs(ctx, ticket),
    );

    expect(vi.mocked(joinInvitedGroup).mock.calls).toEqual([
      ["user-1", "g-5", expect.any(Date)],
    ]);
    expect(createUser.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(joinInvitedGroup).mock.invocationCallOrder[0] as number,
    );
  });
});
