import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/cron/refresh-movies/route";
import type { Database } from "@/db/create-database";
import { getGroupList } from "@/server/container";
import { aSnapshot } from "../helpers/movies";
import { CRON_SECRET, startServerStack } from "../helpers/functional";
import { aGroup, aUser } from "../helpers/groups";

const PARASITE = 496243;

let db: Database;
let reset: () => Promise<void>;
beforeAll(async () => ({ db, reset } = await startServerStack()));
beforeEach(() => reset());

const cron = (authorization?: string) =>
  GET(
    new Request("https://we-watch.test/api/cron/refresh-movies", {
      headers: authorization ? { authorization } : {},
    }),
  );

describe("rafraîchissement quotidien (fonctionnel)", () => {
  it("remet à jour les fiches des listes de groupe depuis TMDB", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const groupId = await aGroup(db, "NOUS DEUX", ["user-1"]);
    // Saved long ago: no genres, no trailer, an old title.
    await getGroupList().apply({
      groupId,
      userId: "user-1",
      action: "search_add",
      tmdbId: PARASITE,
      snapshot: aSnapshot(PARASITE, { title: "Gisaengchung" }),
    });

    const response = await cron(`Bearer ${CRON_SECRET}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      total: 1,
      refreshed: 1,
      failed: [],
    });
    const [movie] = await getGroupList().listByStatus(groupId, "to_watch");
    expect(movie).toMatchObject({
      title: "Parasite",
      genreIds: [35, 53, 18],
      status: "to_watch",
    });
  });

  it("deux groupes, un film commun : rafraîchi une seule fois", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const hugo = await aUser(db, "Hugo");
    const ours = await aGroup(db, "NOUS DEUX", ["user-1"]);
    const his = await aGroup(db, "CHEZ HUGO", [hugo]);
    for (const [groupId, userId] of [
      [ours, "user-1"],
      [his, hugo],
    ] as const) {
      await getGroupList().apply({
        groupId,
        userId,
        action: "search_add",
        tmdbId: PARASITE,
        snapshot: aSnapshot(PARASITE, { title: "Gisaengchung" }),
      });
    }

    const response = await cron(`Bearer ${CRON_SECRET}`);

    // One TMDB fetch and one save for the shared snapshot, not one per group.
    expect(await response.json()).toEqual({
      total: 1,
      refreshed: 1,
      failed: [],
    });
    for (const groupId of [ours, his]) {
      const [movie] = await getGroupList().listByStatus(groupId, "to_watch");
      expect(movie?.title).toBe("Parasite");
    }
  });

  it("refuse un appel sans le secret du cron", async () => {
    expect((await cron()).status).toBe(401);
    expect((await cron("Bearer mauvais-secret")).status).toBe(401);
  });
});
