import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { passkey, session, user } from "@/db/auth-schema";
import type { Database } from "@/db/create-database";
import { createDecisions } from "@/db/decisions";
import { group, membership, movieWant } from "@/db/group-schema";
import { GROUP_COOKIE } from "@/domain/group";
import {
  deleteAccount,
  listMySessions,
  renameMe,
  revokeSession,
} from "@/features/account/actions";
import { assertSignedIn } from "@/server/session";
import { aDeviceOf, aTestAuth } from "../helpers/devices";
import { startServerStack } from "../helpers/functional";
import { aGroup } from "../helpers/groups";
import { aSnapshot } from "../helpers/movies";
import { allRows } from "../helpers/rows";

// The real session read and Better Auth (no session mock): each test signs
// devices in and makes the request come from one of them.
vi.mock("next/headers");
vi.mock("next/cache");

const SESSION_COOKIES = [
  "better-auth.session_token",
  "better-auth.session_data",
  "better-auth.dont_remember",
];

let db: Database;
let reset: () => Promise<void>;
let auth: ReturnType<typeof aTestAuth>;
beforeAll(async () => {
  ({ db, reset } = await startServerStack());
  auth = aTestAuth(db);
});
beforeEach(async () => {
  await reset();
  const jar = await cookies();
  for (const name of [GROUP_COOKIE, ...SESSION_COOKIES]) {
    jar.delete(name);
  }
});

/** The request now comes from `device`. */
const from = (device: { headers: Headers }) =>
  vi.mocked(headers).mockResolvedValue(device.headers as never);

const aForm = (name: string) => {
  const form = new FormData();
  form.set("name", name);
  return form;
};

const nameOf = async (userId: string) =>
  (
    await db.select({ name: user.name }).from(user).where(eq(user.id, userId))
  )[0]?.name;

const sessionIds = async () =>
  (await db.select({ id: session.id }).from(session).orderBy(session.id)).map(
    (row) => row.id,
  );

async function expectSignedOutHere() {
  const jar = await cookies();
  for (const name of [GROUP_COOKIE, ...SESSION_COOKIES]) {
    expect(jar.get(name), name).toMatchObject({ value: "", maxAge: 0 });
  }
}

describe("mon prénom (fonctionnel)", () => {
  it("renameMe passe par Better Auth côté serveur, malgré /update-user coupé en HTTP", async () => {
    const zoe = await aDeviceOf(auth, "Zoé");
    from(zoe);

    await expect(renameMe(aForm("  Zoé   la  Grande "))).resolves.toEqual({
      ok: true,
    });

    expect(await nameOf(zoe.userId)).toBe("Zoé la Grande");
  });

  it("un prénom invalide n’écrit rien", async () => {
    const zoe = await aDeviceOf(auth, "Zoé");
    from(zoe);

    await expect(renameMe(aForm("\u200B"))).resolves.toMatchObject({
      ok: false,
    });
    expect(await nameOf(zoe.userId)).toBe("Zoé");
  });
});

describe("mes appareils (fonctionnel)", () => {
  it("listMySessions donne les miens seulement, sans jeton, « CET APPAREIL » sur celui de la requête", async () => {
    const phone = await aDeviceOf(auth, "Zoé");
    const ctx = await auth.$context;
    const laptop = await ctx.test.login({ userId: phone.userId });
    await aDeviceOf(auth, "Hugo");
    from(phone);

    const sessions = await listMySessions();

    expect(sessions.map(({ id, current }) => [id, current]).sort()).toEqual(
      [
        [phone.sessionId, true],
        [laptop.session.id, false],
      ].sort(),
    );
    expect(JSON.stringify(sessions)).not.toContain(phone.token);
    expect(Object.keys(sessions[0] ?? {}).sort()).toEqual([
      "current",
      "device",
      "id",
      "lastActiveAt",
    ]);
  });

  it("revokeSession d’un autre de mes appareils : supprimée, je reste connecté ici", async () => {
    const phone = await aDeviceOf(auth, "Zoé");
    const ctx = await auth.$context;
    const laptop = await ctx.test.login({ userId: phone.userId });
    from(phone);

    await expect(revokeSession(laptop.session.id)).resolves.toBe(true);

    expect(await sessionIds()).toEqual([phone.sessionId]);
    expect((await cookies()).get("better-auth.session_token")).toBeUndefined();
    await expect(assertSignedIn()).resolves.toMatchObject({
      userId: phone.userId,
    });
  });

  it("revokeSession de cet appareil : supprimée et cookies effacés, la requête suivante est refusée", async () => {
    const phone = await aDeviceOf(auth, "Zoé");
    from(phone);

    await expect(revokeSession(phone.sessionId)).resolves.toBe(true);

    await expectSignedOutHere();
    await expect(assertSignedIn()).rejects.toThrow("not signed in");
  });

  it("revokeSession de la session d’un autre : false, rien n’est écrit", async () => {
    const zoe = await aDeviceOf(auth, "Zoé");
    const hugo = await aDeviceOf(auth, "Hugo");
    from(zoe);
    const before = await allRows(db);

    await expect(revokeSession(hugo.sessionId)).resolves.toBe(false);

    expect(await allRows(db)).toEqual(before);
  });
});

describe("supprimer mon compte (fonctionnel)", () => {
  async function aListShared(zoe: string, hugo: string) {
    const groupId = await aGroup(db, "NOUS DEUX", [zoe, hugo]);
    for (const userId of [zoe, hugo]) {
      await createDecisions(db).swipe({
        groupId,
        userId,
        tmdbId: 550,
        decision: "keep",
        snapshot: aSnapshot(550),
      });
    }
    return groupId;
  }

  it("un prénom faux : refus, rien n’est écrit", async () => {
    const zoe = await aDeviceOf(auth, "Zoé");
    from(zoe);
    const before = await allRows(db);

    await expect(deleteAccount(aForm("Hugo"))).resolves.toEqual({
      ok: false,
      error: "TAPE TON PRÉNOM EXACT",
    });

    expect(await allRows(db)).toEqual(before);
  });

  it("un ancien prénom, écrit avant les règles actuelles, se confirme encore, apostrophe du téléphone comprise", async () => {
    const zoe = await aDeviceOf(auth, "Zoé");
    await db
      .update(user)
      .set({ name: "D'Artagnan\u2800" })
      .where(eq(user.id, zoe.userId));
    from(zoe);

    await expect(
      deleteAccount(aForm("D\u2019Artagnan\u2800")),
    ).resolves.toEqual({ ok: true });
    expect(await nameOf(zoe.userId)).toBeUndefined();
  });

  it("mon prénom exact : mon compte disparaît, cet appareil est déconnecté, les autres gardent leur liste", async () => {
    const zoe = await aDeviceOf(auth, "Zoé");
    const hugo = await aDeviceOf(auth, "Hugo");
    const shared = await aListShared(zoe.userId, hugo.userId);
    const solo = await aGroup(db, "SOLO", [zoe.userId]);
    from(zoe);

    await expect(deleteAccount(aForm("Zoé"))).resolves.toEqual({ ok: true });

    expect(await nameOf(zoe.userId)).toBeUndefined();
    expect(await db.$count(session, eq(session.userId, zoe.userId))).toBe(0);
    expect(await db.$count(passkey, eq(passkey.userId, zoe.userId))).toBe(0);
    expect(await db.$count(group, eq(group.id, solo))).toBe(0);
    expect(
      await db
        .select({ userId: membership.userId })
        .from(membership)
        .where(eq(membership.groupId, shared)),
    ).toEqual([{ userId: hugo.userId }]);
    expect(
      await db
        .select({ userId: movieWant.userId })
        .from(movieWant)
        .where(eq(movieWant.groupId, shared)),
    ).toEqual([{ userId: hugo.userId }]);
    await expectSignedOutHere();
    await expect(assertSignedIn()).rejects.toThrow("not signed in");
    from(hugo);
    await expect(assertSignedIn()).resolves.toMatchObject({
      userId: hugo.userId,
    });
  });
});
