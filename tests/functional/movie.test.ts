import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { decideSwipe } from "@/features/swipe/actions";
import { loadMoviePage } from "@/features/movie/load";
import { setTmdbDown } from "../fake-tmdb/handler";
import { startServerStack } from "../helpers/functional";

vi.mock("@/server/session");
vi.mock("next/cache");

const PARASITE = 496243;

let reset: () => Promise<void>;
beforeAll(async () => ({ reset } = await startServerStack()));
beforeEach(async () => {
  await reset();
  setTmdbDown(false);
});

describe("fiche d'un film (fonctionnel)", () => {
  it("un film gardé : sa fiche, avec réalisation et têtes d'affiche", async () => {
    await decideSwipe(PARASITE, "keep");

    const page = await loadMoviePage(String(PARASITE));

    expect(page?.movie).toMatchObject({
      title: "Parasite",
      status: "to_watch",
    });
    expect(page?.credits).toEqual({
      directors: ["Bong Joon-ho"],
      cast: ["Song Kang-ho", "Lee Sun-kyun", "Cho Yeo-jeong", "Choi Woo-shik"],
    });
  });

  it("TMDB en panne : la fiche vient de la base, sans générique", async () => {
    await decideSwipe(PARASITE, "keep");
    setTmdbDown(true);

    const page = await loadMoviePage(String(PARASITE));

    expect(page).toMatchObject({ movie: { title: "Parasite" }, credits: null });
  });

  it("un film refusé n'a pas de fiche", async () => {
    await decideSwipe(PARASITE, "reject");

    await expect(loadMoviePage(String(PARASITE))).resolves.toBeNull();
  });
});
