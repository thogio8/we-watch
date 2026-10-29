import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { beforeEach, describe, expect, it } from "vitest";
import { createDatabase, type Database } from "./create-database";
import {
  account,
  passkey,
  session,
  signupTicketUse,
  user,
} from "./auth-schema";

let db: Database;

const aUser = { id: "u1", name: "Lou", email: "u1@passkey.invalid" };
const aPasskey = {
  id: "p1",
  userId: "u1",
  publicKey: "k",
  credentialID: "c",
  counter: 0,
  deviceType: "singleDevice",
  backedUp: false,
};

beforeEach(async () => {
  db = createDatabase("file::memory:");
  await migrate(db, { migrationsFolder: "drizzle" });
  await db.insert(user).values(aUser);
});

describe("tables des comptes", () => {
  it("remplit les valeurs par défaut d'un utilisateur", async () => {
    const [row] = await db.select().from(user).where(eq(user.id, "u1"));

    expect(row?.emailVerified).toBe(false);
    expect(row?.createdAt).toBeInstanceOf(Date);
    expect(row?.updatedAt).toBeInstanceOf(Date);
  });

  it("rafraîchit updatedAt à chaque modification", async () => {
    await db.update(user).set({ updatedAt: new Date(0) });
    await db.update(user).set({ name: "Max" });
    const [row] = await db.select().from(user);

    expect(row?.updatedAt.getTime()).toBeGreaterThan(0);
  });

  it("refuse deux utilisateurs avec le même email", async () => {
    await expect(
      db.insert(user).values({ ...aUser, id: "u2" }),
    ).rejects.toThrow();
  });

  it("refuse d'enregistrer deux fois le même identifiant de passkey", async () => {
    await db.insert(user).values({ ...aUser, id: "u2", email: "u2@x.invalid" });
    await db.insert(passkey).values(aPasskey);

    await expect(
      db.insert(passkey).values({ ...aPasskey, id: "p2", userId: "u2" }),
    ).rejects.toThrow();
  });

  it("refuse de consommer deux fois le même ticket d'inscription", async () => {
    const use = { id: "jti-1", usedAt: new Date() };
    await db.insert(signupTicketUse).values(use);

    await expect(db.insert(signupTicketUse).values(use)).rejects.toThrow();
  });

  it("supprime sessions, comptes et passkeys avec l'utilisateur", async () => {
    await db.insert(session).values({
      id: "s1",
      userId: "u1",
      token: "t",
      expiresAt: new Date(),
    });
    await db
      .insert(account)
      .values({ id: "a1", userId: "u1", accountId: "u1", providerId: "x" });
    await db.insert(passkey).values(aPasskey);
    await db.update(session).set({ ipAddress: "::1" });
    await db.update(account).set({ scope: "s" });

    await db.delete(user).where(eq(user.id, "u1"));

    expect(await db.select().from(session)).toEqual([]);
    expect(await db.select().from(account)).toEqual([]);
    expect(await db.select().from(passkey)).toEqual([]);
  });

  it.each([
    ["session", session],
    ["account", account],
    ["passkey", passkey],
  ])("rattache %s à user en cascade", (_name, table) => {
    const [key] = getTableConfig(table).foreignKeys;

    expect(key?.reference().foreignTable).toBe(user);
    expect(key?.onDelete).toBe("cascade");
  });
});
