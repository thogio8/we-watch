import { describe, expect, it, vi } from "vitest";
import { createTmdbClient } from "./client";
import { getMovieCredits, toCredits } from "./credits";

const TMDB = "https://api.themoviedb.org/3";

const credits = {
  cast: [
    { name: "Choi Woo-shik", order: 2 },
    { name: "Song Kang-ho", order: 0 },
    { name: "Lee Sun-kyun", order: 1 },
    { name: "Park So-dam", order: 3 },
    { name: "Cho Yeo-jeong", order: 4 },
  ],
  crew: [
    { name: "Bong Joon-ho", job: "Director" },
    { name: "Hong Kyung-pyo", job: "Director of Photography" },
  ],
};

describe("crédits TMDB", () => {
  it("garde la réalisation et les quatre têtes d'affiche, dans l'ordre", () =>
    expect(toCredits(credits)).toEqual({
      directors: ["Bong Joon-ho"],
      cast: ["Song Kang-ho", "Lee Sun-kyun", "Choi Woo-shik", "Park So-dam"],
    }));

  it("sans crédits connus, deux listes vides", () =>
    expect(toCredits({ cast: [], crew: [] })).toEqual({
      directors: [],
      cast: [],
    }));

  it("interroge /movie/<id>/credits avec un cache de 24 h", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json(credits));
    const client = createTmdbClient({
      accessToken: "t",
      baseUrl: TMDB,
      fetchImpl,
    });

    await expect(getMovieCredits(client, 496243)).resolves.toMatchObject({
      directors: ["Bong Joon-ho"],
    });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toContain(`${TMDB}/movie/496243/credits?`);
    expect(init).toMatchObject({ next: { revalidate: 86400 } });
  });
});
