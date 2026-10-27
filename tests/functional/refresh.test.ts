import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/cron/refresh-movies/route";
import { getMoviesRepository } from "@/server/container";
import { aSnapshot } from "../helpers/movies";
import { CRON_SECRET, startServerStack } from "../helpers/functional";

const PARASITE = 496243;

let reset: () => Promise<void>;
beforeAll(async () => ({ reset } = await startServerStack()));
beforeEach(() => reset());

const cron = (authorization?: string) =>
  GET(
    new Request("https://we-watch.test/api/cron/refresh-movies", {
      headers: authorization ? { authorization } : {},
    }),
  );

describe("rafraîchissement quotidien (fonctionnel)", () => {
  it("remet à jour les fiches de la liste depuis TMDB", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    // Saved long ago: no genres, no trailer, an old title.
    await getMoviesRepository().apply(
      "search_add",
      PARASITE,
      aSnapshot(PARASITE, { title: "Gisaengchung" }),
    );

    const response = await cron(`Bearer ${CRON_SECRET}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      total: 1,
      refreshed: 1,
      failed: [],
    });
    const [movie] = await getMoviesRepository().listByStatus("to_watch");
    expect(movie).toMatchObject({
      title: "Parasite",
      genreIds: [35, 53, 18],
      status: "to_watch",
    });
  });

  it("refuse un appel sans le secret du cron", async () => {
    expect((await cron()).status).toBe(401);
    expect((await cron("Bearer mauvais-secret")).status).toBe(401);
  });
});
