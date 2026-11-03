import { beforeEach, describe, expect, it, vi } from "vitest";
import { decideSwipe } from "@/features/swipe/actions";
import { loadMoviePage } from "@/features/movie/load";
import { setTmdbDown } from "../fake-tmdb/handler";
import { withLeasGroup } from "../helpers/functional";

vi.mock("@/server/session");
vi.mock("next/cache");

const PARASITE = 496243;

const mine = withLeasGroup();
beforeEach(() => setTmdbDown(false));

describe("fiche d'un film (fonctionnel)", () => {
  it("un film gardé : sa fiche, avec réalisation et têtes d'affiche", async () => {
    await decideSwipe(mine.id, PARASITE, "keep");

    const page = await loadMoviePage(mine.id, String(PARASITE));

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
    await decideSwipe(mine.id, PARASITE, "keep");
    setTmdbDown(true);

    const page = await loadMoviePage(mine.id, String(PARASITE));

    expect(page).toMatchObject({ movie: { title: "Parasite" }, credits: null });
  });

  it("un film que j’ai trouvé BOF n'a pas de fiche", async () => {
    await decideSwipe(mine.id, PARASITE, "reject");

    await expect(loadMoviePage(mine.id, String(PARASITE))).resolves.toBeNull();
  });
});
