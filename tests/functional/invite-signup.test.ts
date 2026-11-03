import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createAuth } from "@/auth/create-auth";
import { user } from "@/db/auth-schema";
import type { Database } from "@/db/create-database";
import { group, membership } from "@/db/group-schema";
import { createGroups, type Groups } from "@/db/groups";
import { createRateLimits } from "@/db/rate-limit";
import { joinGroup } from "@/features/groups/actions";
import { prepareSignup } from "@/features/signin/actions";
import { startServerStack } from "../helpers/functional";
import { BASE_URL, cookiesOf, signUpWith } from "../helpers/signup-ceremony";

vi.mock("next/headers");
vi.mock("next/cache");

const SECRET = "functional-auth-secret-0123456789abcdef";
const OWNER_CODE = "code-proprietaire-fonctionnel";
const LEA_ID = "user-1";
const INVITE_INVALID = "CE LIEN N’EST PLUS VALABLE";

let db: Database;
let groups: Groups;
let reset: () => Promise<void>;
let auth: ReturnType<typeof createAuth>;
beforeAll(async () => {
  ({ db, reset } = await startServerStack());
  // Signup on invitation only, read once by getServerEnv.
  vi.stubEnv("SIGNUP", "invite");
  vi.stubEnv("OWNER_CODE", OWNER_CODE);
  groups = createGroups(db);
  auth = createAuth({
    db,
    secret: SECRET,
    baseURL: BASE_URL,
    rateLimits: createRateLimits(db),
  });
});
beforeEach(() => reset());

/** A group of Léa's, with its invite link's token. */
async function invitingGroup(name = "LA COLOC") {
  const { id } = await groups.create({ name, userId: LEA_ID });
  return { id, token: await groups.ensureInvite(id) };
}

/** « CRÉER MON COMPTE »: the real Server Action, then its ticket. */
async function prepared(fields: Record<string, string>): Promise<string> {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  const result = await prepareSignup(form);
  if (!result.ok) throw new Error(result.error);
  return result.ticket;
}

let nextCredential = 0;
const signUp = (ticket: string, credentialId?: Uint8Array) =>
  signUpWith(auth.handler, {
    ticket,
    credentialId: credentialId ?? new Uint8Array([8, 0, 0, ++nextCredential]),
  });

const sessionOf = (response: Response) =>
  auth.api.getSession({
    headers: new Headers({ cookie: cookiesOf(response).join("; ") }),
  });

async function userIdOf(response: Response): Promise<string> {
  expect(response.status).toBe(200);
  return (await sessionOf(response))?.user.id as string;
}

const membersOf = async (groupId: string) =>
  (
    await db
      .select({ userId: membership.userId })
      .from(membership)
      .where(eq(membership.groupId, groupId))
  ).map((row) => row.userId);

const names = async () =>
  (await db.select({ name: user.name }).from(user)).map((row) => row.name);

describe("inscription par une invitation (fonctionnel, SIGNUP=invite)", () => {
  it("le compte devient membre du groupe, qui est son groupe affiché", async () => {
    const coloc = await invitingGroup();
    const logs = [
      vi.spyOn(console, "log"),
      vi.spyOn(console, "info"),
      vi.spyOn(console, "warn"),
      vi.spyOn(console, "error"),
    ];

    const ticket = await prepared({ name: "Nina", invite: coloc.token });
    const userId = await userIdOf(await signUp(ticket));

    expect((await membersOf(coloc.id)).sort()).toEqual([LEA_ID, userId].sort());
    expect((await groups.groupsOf(userId))[0]).toEqual({
      id: coloc.id,
      name: "LA COLOC",
      memberCount: 2,
    });
    // The token only ever travels in the link's path.
    expect(ticket).not.toContain(coloc.token);
    for (const log of logs) {
      expect(JSON.stringify(log.mock.calls)).not.toContain(coloc.token);
    }
  });

  it("sans invitation : refusé, aucun ticket", async () => {
    await expect(prepared({ name: "Omar" })).rejects.toThrow(
      "WEWATCH SE REJOINT SUR INVITATION",
    );
  });

  it("un lien régénéré avant la préparation : refusé", async () => {
    const coloc = await invitingGroup();
    await groups.regenerateInvite(coloc.id);

    await expect(
      prepared({ name: "Paul", invite: coloc.token }),
    ).rejects.toThrow(INVITE_INVALID);
  });

  it("un lien régénéré après la préparation : le ticket reste valable", async () => {
    const coloc = await invitingGroup();
    const ticket = await prepared({ name: "Rita", invite: coloc.token });
    await groups.regenerateInvite(coloc.id);

    const userId = await userIdOf(await signUp(ticket));

    expect(await membersOf(coloc.id)).toContain(userId);
  });

  it("un groupe supprimé entre la préparation et la vérification : compte créé sans appartenance", async () => {
    const coloc = await invitingGroup();
    const ticket = await prepared({ name: "Sacha", invite: coloc.token });
    await groups.leave(coloc.id, LEA_ID);

    const userId = await userIdOf(await signUp(ticket));

    expect(await groups.groupsOf(userId)).toEqual([]);
    expect(await db.select().from(group)).toEqual([]);
  });

  it("un ticket rejoué : une seule appartenance", async () => {
    const coloc = await invitingGroup();
    const ticket = await prepared({ name: "Théo", invite: coloc.token });

    const first = await signUp(ticket);
    const replay = await signUp(ticket);

    expect(first.status).toBe(200);
    expect(replay.status).toBe(400);
    expect(await membersOf(coloc.id)).toHaveLength(2);
    expect((await names()).filter((name) => name === "Théo")).toHaveLength(1);
  });

  it("une passkey déjà enregistrée, après l’appartenance : tout est annulé", async () => {
    const coloc = await invitingGroup();
    const taken = new Uint8Array([8, 1, 0, 0]);
    await signUp(await prepared({ name: "Ugo", invite: coloc.token }), taken);
    const members = await membersOf(coloc.id);

    const failed = await signUp(
      await prepared({ name: "Vera", invite: coloc.token }),
      taken,
    );

    expect(failed.status).not.toBe(200);
    expect(await names()).not.toContain("Vera");
    expect(await membersOf(coloc.id)).toEqual(members);
  });

  describe("avec le code propriétaire", () => {
    it("sans invitation : le compte est créé, sans aucun groupe", async () => {
      const userId = await userIdOf(
        await signUp(await prepared({ name: "Wanda", ownerCode: OWNER_CODE })),
      );

      expect(await names()).toContain("Wanda");
      expect(await groups.groupsOf(userId)).toEqual([]);
    });

    it("avec une invitation : rejoint seulement le groupe de l’invitation, affiché", async () => {
      const coloc = await invitingGroup();

      const userId = await userIdOf(
        await signUp(
          await prepared({
            name: "Xavier",
            ownerCode: OWNER_CODE,
            invite: coloc.token,
          }),
        ),
      );

      const rows = await db
        .select()
        .from(membership)
        .where(eq(membership.userId, userId));
      expect(rows).toEqual([
        expect.objectContaining({ groupId: coloc.id, userId }),
      ]);
      expect(rows[0]?.lastUsedAt).toEqual(rows[0]?.joinedAt);
    });
  });

  it("le lien laisse passer les Server Actions sans session : joinGroup les refuse quand même", async () => {
    const coloc = await invitingGroup();

    await expect(joinGroup(coloc.token)).rejects.toThrow(
      "Server Action refused: not signed in",
    );
    expect(await membersOf(coloc.id)).toEqual([LEA_ID]);
  });
});
