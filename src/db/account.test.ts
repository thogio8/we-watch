import { beforeEach, describe, expect, it } from "vitest";
import { aDatabase, aUser } from "@tests/helpers/groups";
import { createAccount, type Account } from "./account";
import { passkey, session } from "./auth-schema";
import type { Database } from "./create-database";

const T0 = new Date(2026, 9, 1);
const T1 = new Date(2026, 9, 2);

let db: Database;
let account: Account;
let lea: string;
let hugo: string;

beforeEach(async () => {
  db = await aDatabase();
  account = createAccount(db);
  lea = await aUser(db, "Léa");
  hugo = await aUser(db, "Hugo");
});

async function aPasskey(
  userId: string,
  id: string,
  { name = null as string | null, createdAt = T0 } = {},
) {
  await db.insert(passkey).values({
    id,
    name,
    userId,
    publicKey: "key",
    credentialID: `credential-${id}`,
    counter: 0,
    deviceType: "singleDevice",
    backedUp: false,
    createdAt,
  });
}

const ids = async () =>
  (await db.select({ id: passkey.id }).from(passkey)).map((row) => row.id);

describe("passkeys du compte", () => {
  it("passkeysOf donne les miennes, les plus anciennes d’abord, sans clé publique", async () => {
    await aPasskey(lea, "p-2", { name: "Mac · Safari", createdAt: T1 });
    await aPasskey(lea, "p-1", { name: "iPhone · Safari" });
    await aPasskey(hugo, "p-3");

    expect(await account.passkeysOf(lea)).toEqual([
      { id: "p-1", name: "iPhone · Safari", createdAt: T0 },
      { id: "p-2", name: "Mac · Safari", createdAt: T1 },
    ]);
    expect(await account.passkeysOf(hugo)).toEqual([
      { id: "p-3", name: null, createdAt: T0 },
    ]);
  });

  it("deletePasskey supprime la mienne quand il m’en reste une autre", async () => {
    await aPasskey(lea, "p-1");
    await aPasskey(lea, "p-2");

    expect(await account.deletePasskey(lea, "p-1")).toBe("deleted");
    expect(await ids()).toEqual(["p-2"]);
  });

  it("deletePasskey refuse la dernière et ne supprime rien", async () => {
    await aPasskey(lea, "p-1");

    expect(await account.deletePasskey(lea, "p-1")).toBe("last");
    expect(await ids()).toEqual(["p-1"]);
  });

  it("deletePasskey ne touche pas à celle d’un autre, ni à une inconnue", async () => {
    await aPasskey(lea, "p-1");
    await aPasskey(lea, "p-2");
    await aPasskey(hugo, "p-3");
    await aPasskey(hugo, "p-4");

    expect(await account.deletePasskey(lea, "p-3")).toBe("not_found");
    expect(await account.deletePasskey(lea, "inconnue")).toBe("not_found");
    expect(await ids()).toEqual(["p-1", "p-2", "p-3", "p-4"]);
  });

  it("deux suppressions simultanées des deux dernières en laissent une", async () => {
    await aPasskey(lea, "p-1");
    await aPasskey(lea, "p-2");

    const outcomes = await Promise.all([
      account.deletePasskey(lea, "p-1"),
      account.deletePasskey(lea, "p-2"),
    ]);

    expect(outcomes.sort()).toEqual(["deleted", "last"]);
    expect(await ids()).toHaveLength(1);
  });
});

async function aSession(
  userId: string,
  id: string,
  { updatedAt = T0, expiresAt = new Date(2026, 11, 1), userAgent = "UA" } = {},
) {
  await db.insert(session).values({
    id,
    token: `token-${id}`,
    userId,
    userAgent,
    updatedAt,
    expiresAt,
  });
}

const sessionIds = async () =>
  (await db.select({ id: session.id }).from(session)).map((row) => row.id);

describe("sessions du compte", () => {
  it("sessionsOf donne mes sessions en cours, la plus récente d’abord, sans jeton", async () => {
    await aSession(lea, "s-1", { userAgent: "iPhone" });
    await aSession(lea, "s-2", { updatedAt: T1 });
    await aSession(lea, "s-old", { expiresAt: T1 });
    await aSession(hugo, "s-3");

    expect(await account.sessionsOf(lea, new Date(2026, 9, 3))).toEqual([
      { id: "s-2", userAgent: "UA", updatedAt: T1 },
      { id: "s-1", userAgent: "iPhone", updatedAt: T0 },
    ]);
  });

  it("deleteSession supprime la mienne", async () => {
    await aSession(lea, "s-1");
    await aSession(lea, "s-2");

    expect(await account.deleteSession(lea, "s-1")).toBe(true);
    expect(await sessionIds()).toEqual(["s-2"]);
  });

  it("deleteSession ne touche pas à celle d’un autre, ni à une inconnue", async () => {
    await aSession(hugo, "s-3");

    expect(await account.deleteSession(lea, "s-3")).toBe(false);
    expect(await account.deleteSession(lea, "inconnue")).toBe(false);
    expect(await sessionIds()).toEqual(["s-3"]);
  });
});
