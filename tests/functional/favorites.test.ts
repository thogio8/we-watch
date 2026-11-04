import { describe, expect, it, vi } from "vitest";
import { createDatabase } from "@/db/create-database";
import { createFavorites } from "@/db/favorites";
import { membership } from "@/db/group-schema";
import { markWatched } from "@/features/draw/actions";
import {
  addFromSearch,
  removeFromList,
  setFavorite,
  unwatch,
} from "@/features/list/actions";
import { getGroupList } from "@/server/container";
import { withLeasGroup } from "../helpers/functional";
import { aUser } from "../helpers/groups";
import { allRows } from "../helpers/rows";

vi.mock("@/server/session");
vi.mock("next/cache");

const AMELIE = 194;
const CHIHIRO = 129;

const mine = withLeasGroup();

const toWatch = () => getGroupList().listByStatus(mine.id, "to_watch");
const favoritesCount = async () =>
  (await getGroupList().counts(mine.id)).favorites;
const aliveDb = () => createDatabase(process.env.DATABASE_URL ?? "");

describe("coups de cœur (fonctionnel)", () => {
  it("marquer depuis la liste : le film passe en tête, coup de cœur de Léa", async () => {
    await addFromSearch(mine.id, AMELIE);
    await addFromSearch(mine.id, CHIHIRO);

    expect(await setFavorite(mine.id, AMELIE, true)).toBe("applied");

    const [first] = await getGroupList().listByStatus(mine.id, "to_watch");
    expect(first).toMatchObject({ tmdbId: AMELIE, favoriteBy: "Léa" });
    expect(await favoritesCount()).toBe(1);
  });

  it("re-marquer : noop, la date ne bouge pas ; démarquer puis démarquer encore", async () => {
    await addFromSearch(mine.id, AMELIE);
    await setFavorite(mine.id, AMELIE, true);
    const [before] = await toWatch();

    expect(await setFavorite(mine.id, AMELIE, true)).toBe("noop");
    expect((await toWatch())[0]?.favoriteAt).toEqual(before?.favoriteAt);

    expect(await setFavorite(mine.id, AMELIE, false)).toBe("applied");
    expect(await setFavorite(mine.id, AMELIE, false)).toBe("noop");
    expect(await favoritesCount()).toBe(0);
    expect((await toWatch())[0]).toMatchObject({ favoriteAt: null });
  });

  it("deux appareils : le premier auteur et sa date restent", async () => {
    const db = aliveDb();
    const hugo = await aUser(db, "Hugo");
    await db.insert(membership).values({ groupId: mine.id, userId: hugo });
    await addFromSearch(mine.id, AMELIE);
    await setFavorite(mine.id, AMELIE, true);
    const [before] = await toWatch();

    const result = await createFavorites(db).set({
      groupId: mine.id,
      userId: hugo,
      tmdbId: AMELIE,
      on: true,
    });

    expect(result).toBe("noop");
    expect((await toWatch())[0]).toMatchObject({
      favoriteBy: "Léa",
      favoriteAt: before?.favoriteAt,
    });
  });

  it("chaque transition qui quitte « à voir » efface le coup de cœur", async () => {
    await addFromSearch(mine.id, AMELIE);
    await setFavorite(mine.id, AMELIE, true);
    await markWatched(mine.id, AMELIE);
    await unwatch(mine.id, AMELIE);
    expect((await toWatch())[0]).toMatchObject({ favoriteAt: null });
    expect(await favoritesCount()).toBe(0);

    await setFavorite(mine.id, AMELIE, true);
    await removeFromList(mine.id, AMELIE);
    await addFromSearch(mine.id, AMELIE);
    expect((await toWatch())[0]).toMatchObject({ favoriteAt: null });
    expect(await favoritesCount()).toBe(0);
  });

  it("un film vu, retiré ou absent : noop, rien n’est écrit", async () => {
    const db = aliveDb();
    await addFromSearch(mine.id, AMELIE);
    await markWatched(mine.id, AMELIE);
    await addFromSearch(mine.id, CHIHIRO);
    await removeFromList(mine.id, CHIHIRO);
    const before = await allRows(db);

    for (const tmdbId of [AMELIE, CHIHIRO, 999999]) {
      expect(await setFavorite(mine.id, tmdbId, true)).toBe("noop");
    }

    expect(await allRows(db)).toEqual(before);
  });

  it.each(["true", 1, 0, null, undefined])(
    "un « on » forgé (%s) est refusé, rien n’est écrit",
    async (on) => {
      const db = aliveDb();
      await addFromSearch(mine.id, AMELIE);
      const before = await allRows(db);

      await expect(
        setFavorite(mine.id, AMELIE, on as unknown as boolean),
      ).rejects.toThrow("setFavorite: invalid on");

      expect(await allRows(db)).toEqual(before);
    },
  );

  it("un double tap sur ♡ : un seul coup de cœur", async () => {
    await addFromSearch(mine.id, AMELIE);

    const results = await Promise.all([
      setFavorite(mine.id, AMELIE, true),
      setFavorite(mine.id, AMELIE, true),
    ]);

    expect(results.sort()).toEqual(["applied", "noop"]);
    expect(await favoritesCount()).toBe(1);
  });
});
