import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { passkey, session, user } from "@/db/auth-schema";
import type { Database } from "@/db/create-database";
import { deleteAccount, deletePasskey } from "@/features/account/actions";
import { aDeviceOf, aTestAuth } from "../helpers/devices";
import { startServerStack } from "../helpers/functional";
import { allRows } from "../helpers/rows";
import { BASE_URL, registerWith } from "../helpers/signup-ceremony";

// The real session read (no session mock): a session aged in the database
// must be refused, whatever the signed cache still says.
vi.mock("next/headers");
vi.mock("next/cache");

const DAY = 24 * 60 * 60 * 1000;

let auth: ReturnType<typeof aTestAuth>;
let db: Database;
let emptied = async () => {};
beforeAll(async () => {
  const stack = await startServerStack();
  auth = aTestAuth(stack.db);
  ({ db, reset: emptied } = stack);
});
beforeEach(() => emptied());

/** Zoé, signed in on this device, with two passkeys (one may go). */
async function zoe(signedInDaysAgo: number) {
  const device = await aDeviceOf(auth, "Zoé");
  await db.insert(passkey).values(
    ["zoe-1", "zoe-2"].map((id) => ({
      id,
      userId: device.userId,
      publicKey: "key",
      credentialID: id,
      counter: 0,
      deviceType: "multiDevice",
      backedUp: true,
    })),
  );
  const signedInAt = new Date(Date.now() - signedInDaysAgo * DAY);
  await db
    .update(session)
    .set({ createdAt: signedInAt, updatedAt: signedInAt })
    .where(eq(session.id, device.sessionId));
  // The request of each Server Action comes from this device, cache included.
  vi.mocked(headers).mockResolvedValue(device.headers as never);
  return device;
}

/** The first step of « AJOUTER UNE CLÉ D’ACCÈS », from `cookies`. */
const registerOptions = (cookies: string[]) =>
  auth.handler(
    new Request(`${BASE_URL}/api/auth/passkey/generate-register-options`, {
      headers: { cookie: cookies.join("; ") },
    }),
  );

const passkeysOf = async (userId: string) =>
  (
    await db
      .select({ id: passkey.id })
      .from(passkey)
      .where(eq(passkey.userId, userId))
  ).map((row) => row.id);

const STALE = { ok: false, reason: "stale" };

describe("session de 59 jours : rien de ce qui peut m’enfermer dehors (fonctionnel)", () => {
  it("ajouter une clé : refusé en 403 « SESSION_NOT_FRESH », dès les options, sans défi ni clé écrits", async () => {
    const device = await zoe(59);
    const before = await allRows(db);

    const options = await registerOptions(device.cookies);

    expect(options.status).toBe(403);
    expect(await options.json()).toMatchObject({ code: "SESSION_NOT_FRESH" });
    // Only Better Auth's attempt counter moves (ip|path).
    expect(await allRows(db)).toEqual({
      ...before,
      rate_limit: [expect.objectContaining({ count: 1 })],
    });
  });

  it("ajouter une clé jusqu’au bout (la preuve de l’audit) : aucune clé ajoutée", async () => {
    const device = await zoe(59);

    const { response } = await registerWith(auth.handler, {
      credentialId: new Uint8Array([7, 7, 7, 1]),
      cookies: device.cookies,
    }).catch(() => ({ response: null }));

    expect(response?.status).not.toBe(200);
    expect(await passkeysOf(device.userId)).toEqual(["zoe-1", "zoe-2"]);
  });

  it("supprimer une clé : « stale », rien n’est supprimé ni compté", async () => {
    const device = await zoe(59);
    const before = await allRows(db);

    await expect(deletePasskey("zoe-1")).resolves.toEqual(STALE);

    expect(await allRows(db)).toEqual(before);
    expect(await passkeysOf(device.userId)).toEqual(["zoe-1", "zoe-2"]);
  });

  it("supprimer mon compte, prénom exact compris : « stale », rien n’est supprimé ni compté", async () => {
    await zoe(59);
    const before = await allRows(db);
    const form = new FormData();
    form.set("name", "Zoé");

    await expect(deleteAccount(form)).resolves.toEqual(STALE);

    expect(await allRows(db)).toEqual(before);
  });
});

describe("session neuve : les trois passent (fonctionnel)", () => {
  it("ajouter une clé", async () => {
    const device = await zoe(0);

    const { response } = await registerWith(auth.handler, {
      credentialId: new Uint8Array([7, 7, 7, 2]),
      cookies: device.cookies,
    });

    expect(response.status).toBe(200);
    expect(await passkeysOf(device.userId)).toHaveLength(3);
  });

  it("supprimer une clé", async () => {
    const device = await zoe(0);

    await expect(deletePasskey("zoe-1")).resolves.toEqual({ ok: true });
    expect(await passkeysOf(device.userId)).toEqual(["zoe-2"]);
  });

  it("supprimer mon compte", async () => {
    const device = await zoe(0);
    const form = new FormData();
    form.set("name", "Zoé");

    await expect(deleteAccount(form)).resolves.toEqual({ ok: true });
    expect(await db.$count(user, eq(user.id, device.userId))).toBe(0);
  });
});

describe("l’inscription, sans session, ne change pas (fonctionnel)", () => {
  it("les options d’une inscription ne demandent pas de session récente", async () => {
    const options = await registerOptions([]);

    // No ticket: refused for that (400), never as a stale session.
    expect(options.status).not.toBe(403);
  });
});
