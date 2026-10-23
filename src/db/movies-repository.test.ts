import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import type { MovieSnapshot } from "@/domain/movie";
import { createDatabase, type Database } from "./create-database";
import {
  createMoviesRepository,
  type MoviesRepository,
} from "./movies-repository";

function snapshot(
  id: number,
  overrides: Partial<MovieSnapshot> = {},
): MovieSnapshot {
  return {
    tmdbId: id,
    title: `Film ${id}`,
    releaseYear: 2000 + id,
    runtimeMinutes: 100,
    overview: "Résumé",
    posterPath: `/p${id}.jpg`,
    voteAverage: 7.5,
    providers: [],
    ...overrides,
  };
}

let db: Database;
let repo: MoviesRepository;

beforeEach(async () => {
  db = createDatabase(":memory:");
  await migrate(db, { migrationsFolder: "drizzle" });
  repo = createMoviesRepository(db);
});

const ids = (movies: { tmdbId: number }[]) => movies.map((m) => m.tmdbId);

describe("moviesRepository", () => {
  it("swipe_keep insère en to_watch", async () => {
    expect(await repo.apply("swipe_keep", 1, snapshot(1))).toBe("applied");
    const [movie] = await repo.listByStatus("to_watch");
    expect(movie).toMatchObject({
      ...snapshot(1),
      status: "to_watch",
      watchedAt: null,
    });
    expect(movie?.decidedAt).toBeInstanceOf(Date);
  });

  it("la première décision de swipe l'emporte", async () => {
    await repo.apply("swipe_keep", 1, snapshot(1));
    expect(await repo.apply("swipe_reject", 1, snapshot(1))).toBe("noop");
    expect(ids(await repo.listByStatus("to_watch"))).toEqual([1]);
  });

  it("mark_watched date le visionnage, unwatch l'efface", async () => {
    const t0 = new Date("2026-01-01T10:00:00Z");
    const t1 = new Date("2026-01-02T10:00:00Z");
    const t2 = new Date("2026-01-03T10:00:00Z");
    await repo.apply("swipe_keep", 1, snapshot(1), t0);
    expect(await repo.apply("mark_watched", 1, undefined, t1)).toBe("applied");
    const [watched] = await repo.listByStatus("watched");
    expect(watched).toMatchObject({ status: "watched", watchedAt: t1 });
    expect(watched?.decidedAt).toEqual(t0);

    expect(await repo.apply("unwatch", 1, undefined, t2)).toBe("applied");
    const [back] = await repo.listByStatus("to_watch");
    expect(back).toMatchObject({
      status: "to_watch",
      watchedAt: null,
      decidedAt: t0,
    });
  });

  it("remove passe en rejected et sort des listes", async () => {
    await repo.apply("swipe_keep", 1, snapshot(1));
    expect(await repo.apply("remove", 1)).toBe("applied");
    expect(await repo.listByStatus("to_watch")).toEqual([]);
    expect(await repo.listByStatus("watched")).toEqual([]);
    expect((await repo.statusesOf([1])).get(1)).toBe("rejected");
  });

  it("search_add ré-ajoute un film refusé avec snapshot rafraîchi", async () => {
    const t0 = new Date("2026-01-01T10:00:00Z");
    const t1 = new Date("2026-02-01T10:00:00Z");
    await repo.apply("swipe_reject", 1, snapshot(1), t0);
    expect(
      await repo.apply(
        "search_add",
        1,
        snapshot(1, { title: "Nouveau titre" }),
        t1,
      ),
    ).toBe("applied");
    const [movie] = await repo.listByStatus("to_watch");
    expect(movie).toMatchObject({
      title: "Nouveau titre",
      status: "to_watch",
      decidedAt: t1,
    });
  });

  it("apply sur film absent sans snapshot lève une erreur", async () => {
    await expect(repo.apply("swipe_keep", 1)).rejects.toThrow(
      "snapshot required",
    );
  });

  it("search_add sur film refusé sans snapshot garde l'ancien snapshot", async () => {
    await repo.apply("swipe_reject", 1, snapshot(1));
    expect(await repo.apply("search_add", 1)).toBe("applied");
    expect((await repo.listByStatus("to_watch"))[0]?.title).toBe("Film 1");
  });

  it("tri : to_watch par decidedAt desc, watched par watchedAt desc", async () => {
    const day = (d: number) => new Date(Date.UTC(2026, 0, d));
    await repo.apply("swipe_keep", 1, snapshot(1), day(1));
    await repo.apply("swipe_keep", 2, snapshot(2), day(2));
    await repo.apply("swipe_keep", 3, snapshot(3), day(3));
    expect(ids(await repo.listByStatus("to_watch"))).toEqual([3, 2, 1]);

    await repo.apply("mark_watched", 1, undefined, day(10));
    await repo.apply("mark_watched", 3, undefined, day(5));
    expect(ids(await repo.listByStatus("watched"))).toEqual([1, 3]);
  });

  it("providers JSON aller-retour, liste vide comprise", async () => {
    const providers = [{ id: 8, name: "Netflix", logoPath: "/n.jpg" }];
    await repo.apply("swipe_keep", 1, snapshot(1, { providers }));
    await repo.apply("swipe_keep", 2, snapshot(2));
    const byId = new Map(
      (await repo.listByStatus("to_watch")).map((m) => [m.tmdbId, m]),
    );
    expect(byId.get(1)?.providers).toEqual(providers);
    expect(byId.get(2)?.providers).toEqual([]);
  });

  it("counts et decidedIds couvrent tous les statuts", async () => {
    expect(await repo.counts()).toEqual({ toWatch: 0, watched: 0 });
    await repo.apply("swipe_keep", 1, snapshot(1));
    await repo.apply("swipe_keep", 2, snapshot(2));
    await repo.apply("swipe_reject", 3, snapshot(3));
    await repo.apply("mark_watched", 2);
    expect(await repo.counts()).toEqual({ toWatch: 1, watched: 1 });
    expect(await repo.decidedIds()).toEqual(new Set([1, 2, 3]));
  });

  it("statusesOf ignore les ids inconnus et accepte une liste vide", async () => {
    await repo.apply("swipe_keep", 1, snapshot(1));
    const statuses = await repo.statusesOf([1, 99]);
    expect([...statuses]).toEqual([[1, "to_watch"]]);
    expect((await repo.statusesOf([])).size).toBe(0);
  });
});

describe("createDatabase", () => {
  it("accepte un jeton d'authentification optionnel", () => {
    expect(createDatabase(":memory:", "token")).toBeDefined();
  });
});
