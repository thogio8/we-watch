import { describe, expect, it } from "vitest";
import { aMovie, CANAL, NETFLIX, PRIME } from "@tests/helpers/movies";
import { toWatchMeta } from "./toWatchMeta";

describe("toWatchMeta", () => {
  it("donne la durée puis les plateformes", () => {
    const movie = aMovie(1, { runtimeMinutes: 125, providers: [PRIME, CANAL] });
    expect(toWatchMeta(movie)).toBe("2h05 · Amazon Prime Video · Canal+");
  });

  it("annonce PAS EN STREAMING sans plateforme", () => {
    const movie = aMovie(1, { runtimeMinutes: 107, providers: [] });
    expect(toWatchMeta(movie)).toBe("1h47 · PAS EN STREAMING");
  });

  it("omet une durée inconnue", () => {
    const movie = aMovie(1, { runtimeMinutes: null, providers: [NETFLIX] });
    expect(toWatchMeta(movie)).toBe("Netflix");
  });

  it("ne répète pas une plateforme proposée deux fois", () => {
    const netflixAds = {
      id: 1796,
      name: "Netflix Standard with Ads",
      logoPath: null,
    };
    const movie = aMovie(1, {
      runtimeMinutes: 90,
      providers: [NETFLIX, netflixAds],
    });
    expect(toWatchMeta(movie)).toBe("1h30 · Netflix");
  });
});
