import { beforeEach, describe, expect, it } from "vitest";
import { aDatabase, aGroup, aUser } from "@tests/helpers/groups";
import { passkey, session, signupTicketUse, verification } from "./auth-schema";
import type { Database } from "./create-database";
import { group, membership } from "./group-schema";
import { createHousekeeping } from "./housekeeping";
import { rateLimit } from "./rate-limit-schema";

const NOW = new Date("2026-11-02T03:00:00.000Z");
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const at = (ms: number) => new Date(NOW.getTime() + ms);

let db: Database;
let userId: string;
beforeEach(async () => {
  db = await aDatabase();
  userId = await aUser(db, "Léa");
});

const ids = async (
  table: typeof verification | typeof session | typeof signupTicketUse,
) => (await db.select({ id: table.id }).from(table)).map(({ id }) => id);

async function seed() {
  await db.insert(verification).values([
    { id: "v-kept", identifier: "i", value: "x", expiresAt: at(1) },
    { id: "v-gone", identifier: "i", value: "x", expiresAt: at(-1) },
  ]);
  await db.insert(session).values([
    { id: "s-kept", token: "t1", expiresAt: at(1), updatedAt: NOW, userId },
    { id: "s-gone", token: "t2", expiresAt: at(-1), updatedAt: NOW, userId },
  ]);
  await db.insert(signupTicketUse).values([
    { id: "t-kept", usedAt: at(-15 * MINUTE + 1) },
    { id: "t-gone", usedAt: at(-15 * MINUTE - 1) },
  ]);
  await db.insert(rateLimit).values([
    { key: "r-kept", count: 3, windowStart: at(-24 * HOUR + 1).getTime() },
    { key: "r-gone", count: 3, windowStart: at(-24 * HOUR - 1).getTime() },
  ]);
}

describe("createHousekeeping().purge", () => {
  it("supprime chaque ligne juste après son seuil, garde celle juste avant", async () => {
    await seed();

    const purged = await createHousekeeping(db).purge(NOW);

    expect(purged).toEqual({
      verifications: 1,
      signupTickets: 1,
      sessions: 1,
      rateLimits: 1,
    });
    expect(await ids(verification)).toEqual(["v-kept"]);
    expect(await ids(session)).toEqual(["s-kept"]);
    expect(await ids(signupTicketUse)).toEqual(["t-kept"]);
    expect(
      (await db.select({ key: rateLimit.key }).from(rateLimit)).map(
        ({ key }) => key,
      ),
    ).toEqual(["r-kept"]);
  });

  it("ne touche à rien d'autre : compte, passkey, groupe restent", async () => {
    await seed();
    const groupId = await aGroup(db, "NOUS DEUX", [userId]);
    await db.insert(passkey).values({
      id: "p-1",
      publicKey: "pk",
      userId,
      credentialID: "c-1",
      counter: 0,
      deviceType: "singleDevice",
      backedUp: false,
    });

    await createHousekeeping(db).purge(NOW);

    expect(await db.select({ id: passkey.id }).from(passkey)).toEqual([
      { id: "p-1" },
    ]);
    expect(await db.select({ id: group.id }).from(group)).toEqual([
      { id: groupId },
    ]);
    expect(await db.select().from(membership)).toHaveLength(1);
  });

  it("rien d'expiré : rien n'est supprimé", async () => {
    expect(await createHousekeeping(db).purge(NOW)).toEqual({
      verifications: 0,
      signupTickets: 0,
      sessions: 0,
      rateLimits: 0,
    });
  });

  it("sans date, purge à l'heure courante", async () => {
    await db.insert(verification).values({
      id: "v-old",
      identifier: "i",
      value: "x",
      expiresAt: new Date(Date.now() - MINUTE),
    });

    expect(await createHousekeeping(db).purge()).toMatchObject({
      verifications: 1,
    });
  });
});
