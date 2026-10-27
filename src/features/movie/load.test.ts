import { beforeEach, describe, expect, it, vi } from "vitest";
import { TmdbError } from "@/tmdb/client";
import { aMovie } from "@tests/helpers/movies";
import { loadMoviePage } from "./load";

const findInList = vi.fn();
const getMovieCredits = vi.fn();
vi.mock("@/server/container", () => ({
  getMoviesRepository: () => ({ findInList }),
  getTmdbClient: () => ({}),
}));
vi.mock("@/tmdb/credits", () => ({
  getMovieCredits: (...args: unknown[]) => getMovieCredits(...args),
}));

const PARASITE = aMovie(496243, { title: "Parasite" });
const CREDITS = { directors: ["Bong Joon-ho"], cast: ["Song Kang-ho"] };

beforeEach(() => {
  findInList.mockReset().mockResolvedValue(PARASITE);
  getMovieCredits.mockReset().mockResolvedValue(CREDITS);
});

describe("loadMoviePage", () => {
  it("le film de la liste et son générique", async () => {
    await expect(loadMoviePage("496243")).resolves.toEqual({
      movie: PARASITE,
      credits: CREDITS,
    });
    expect(findInList).toHaveBeenCalledWith(496243);
  });

  it("TMDB ne répond pas : la fiche s'affiche sans générique", async () => {
    getMovieCredits.mockRejectedValue(new TmdbError(503, "down"));

    await expect(loadMoviePage("496243")).resolves.toEqual({
      movie: PARASITE,
      credits: null,
    });
  });

  it("laisse remonter une panne qui ne vient pas de TMDB", async () => {
    getMovieCredits.mockRejectedValue(new TypeError("bug"));

    await expect(loadMoviePage("496243")).rejects.toThrow("bug");
  });

  it("un film hors de la liste, ou une adresse bidon → introuvable", async () => {
    findInList.mockResolvedValue(null);
    await expect(loadMoviePage("496243")).resolves.toBeNull();

    for (const segment of ["abc", "0", "-3", "1.5", ""]) {
      await expect(loadMoviePage(segment)).resolves.toBeNull();
    }
    expect(findInList).toHaveBeenCalledTimes(1);
  });
});
