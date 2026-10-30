import { revalidatePath } from "next/cache";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { passkey } from "@/db/auth-schema";
import type { Database } from "@/db/create-database";
import { deletePasskey, listMyPasskeys } from "@/features/account/actions";
import { startServerStack } from "../helpers/functional";
import { aUser } from "../helpers/groups";

vi.mock("@/server/session");
vi.mock("next/cache");

const LEA_ID = "user-1";
const T0 = new Date(2026, 9, 1);

let db: Database;
let reset: () => Promise<void>;
beforeAll(async () => ({ db, reset } = await startServerStack()));
beforeEach(async () => {
  await reset();
  await db.delete(passkey);
  vi.mocked(revalidatePath).mockReset();
});

async function aPasskey(userId: string, id: string, name: string | null) {
  await db.insert(passkey).values({
    id,
    name,
    userId,
    publicKey: "key",
    credentialID: `credential-${id}`,
    counter: 0,
    deviceType: "multiDevice",
    backedUp: true,
    createdAt: T0,
  });
}

const ids = async () =>
  (await db.select({ id: passkey.id }).from(passkey)).map((row) => row.id);

describe("mes passkeys (fonctionnel)", () => {
  it("listMyPasskeys donne les miennes seulement, nommées", async () => {
    const hugo = await aUser(db, "Hugo");
    await aPasskey(LEA_ID, "p-1", "iPhone · Safari");
    await aPasskey(LEA_ID, "p-2", null);
    await aPasskey(hugo, "p-3", "Mac · Chrome");

    expect(await listMyPasskeys()).toEqual([
      { id: "p-1", name: "iPhone · Safari", createdAt: T0 },
      { id: "p-2", name: "CLÉ D’ACCÈS", createdAt: T0 },
    ]);
  });

  it("deletePasskey supprime la mienne", async () => {
    await aPasskey(LEA_ID, "p-1", null);
    await aPasskey(LEA_ID, "p-2", null);

    await expect(deletePasskey("p-1")).resolves.toEqual({ ok: true });
    expect(await ids()).toEqual(["p-2"]);
    expect(revalidatePath).toHaveBeenCalledWith("/compte");
  });

  it("deletePasskey garde la dernière", async () => {
    await aPasskey(LEA_ID, "p-1", null);

    await expect(deletePasskey("p-1")).resolves.toEqual({
      ok: false,
      error: "GARDE AU MOINS UNE CLÉ D’ACCÈS",
    });
    expect(await ids()).toEqual(["p-1"]);
  });

  it("deletePasskey refuse celle d’un autre sans rien supprimer", async () => {
    const hugo = await aUser(db, "Hugo");
    await aPasskey(LEA_ID, "p-1", null);
    await aPasskey(LEA_ID, "p-2", null);
    await aPasskey(hugo, "p-3", null);
    await aPasskey(hugo, "p-4", null);

    await expect(deletePasskey("p-3")).rejects.toThrow(
      "deletePasskey: not found",
    );
    expect(await ids()).toEqual(["p-1", "p-2", "p-3", "p-4"]);
  });

  it("deux suppressions simultanées des deux dernières en laissent une", async () => {
    await aPasskey(LEA_ID, "p-1", null);
    await aPasskey(LEA_ID, "p-2", null);

    const results = await Promise.all([
      deletePasskey("p-1"),
      deletePasskey("p-2"),
    ]);

    expect(results).toContainEqual({ ok: true });
    expect(results).toContainEqual({
      ok: false,
      error: "GARDE AU MOINS UNE CLÉ D’ACCÈS",
    });
    expect(await ids()).toHaveLength(1);
  });
});
