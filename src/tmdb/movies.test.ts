import { describe, expect, it, vi } from "vitest";
import discover from "../../tests/fixtures/tmdb/discover.json";
import detailsEmpty from "../../tests/fixtures/tmdb/details-empty.json";
import detailsFull from "../../tests/fixtures/tmdb/details-full.json";
import search from "../../tests/fixtures/tmdb/search.json";
import { createTmdbClient } from "./client";
import {
  discoverDeck,
  getMovieSnapshot,
  posterUrl,
  searchMovies,
  toSnapshot,
} from "./movies";
import { tmdbMovieDetailsSchema } from "./schemas";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

function clientWith(fetchImpl: typeof fetch) {
  return createTmdbClient({ accessToken: "tok", fetchImpl });
}

describe("toSnapshot", () => {
  it("mappe un film complet", () => {
    const snap = toSnapshot(tmdbMovieDetailsSchema.parse(detailsFull));
    expect(snap).toEqual({
      tmdbId: 129,
      title: "Le Voyage de Chihiro",
      releaseYear: 2001,
      runtimeMinutes: 125,
      overview: expect.stringContaining("Chihiro"),
      posterPath: "/chihiro.jpg",
      voteAverage: 8.5,
      providers: [
        { id: 8, name: "Netflix", logoPath: "/netflix.jpg" },
        { id: 119, name: "Amazon Prime Video", logoPath: "/prime.jpg" },
      ],
      genreIds: [16, 10751, 14],
      trailerKey: "trailer-fr",
    });
  });

  it("pas de FR → providers [], runtime 0 → null, poster null", () => {
    const snap = toSnapshot(tmdbMovieDetailsSchema.parse(detailsEmpty));
    expect(snap.providers).toEqual([]);
    expect(snap.runtimeMinutes).toBeNull();
    expect(snap.posterPath).toBeNull();
    expect(snap.releaseYear).toBeNull();
    expect(snap.overview).toBe("");
    expect(snap.genreIds).toEqual([]);
    expect(snap.trailerKey).toBeNull();
  });

  it("gère l'absence totale de watch/providers, runtime et FR sans flatrate", () => {
    const base = {
      id: 1,
      title: "T",
      release_date: "2020-01-01",
      vote_average: 5,
    };
    expect(toSnapshot(tmdbMovieDetailsSchema.parse(base))).toMatchObject({
      providers: [],
      runtimeMinutes: null,
      posterPath: null,
      releaseYear: 2020,
    });
    const noFlatrate = {
      ...base,
      "watch/providers": { results: { FR: { link: "x" } } },
    };
    expect(
      toSnapshot(tmdbMovieDetailsSchema.parse(noFlatrate)).providers,
    ).toEqual([]);
  });

  it("release_date absente ou illisible → releaseYear null", () => {
    const base = { id: 1, title: "T", vote_average: 5 };
    expect(
      toSnapshot(tmdbMovieDetailsSchema.parse(base)).releaseYear,
    ).toBeNull();
    expect(
      toSnapshot(
        tmdbMovieDetailsSchema.parse({ ...base, release_date: "abcd" }),
      ).releaseYear,
    ).toBeNull();
  });
});

describe("bande-annonce", () => {
  const base = { id: 1, title: "T", vote_average: 5 };
  const video = (
    key: string,
    overrides: Partial<{
      iso_639_1: string;
      site: string;
      type: string;
      official: boolean;
    }> = {},
  ) => ({
    key,
    iso_639_1: "en",
    site: "YouTube",
    type: "Trailer",
    official: false,
    ...overrides,
  });
  const trailerOf = (results: ReturnType<typeof video>[]) =>
    toSnapshot(tmdbMovieDetailsSchema.parse({ ...base, videos: { results } }))
      .trailerKey;

  it("préfère la VF, puis l'officielle, puis l'ordre TMDB", () => {
    expect(
      trailerOf([
        video("en-off", { official: true }),
        video("fr", { iso_639_1: "fr" }),
      ]),
    ).toBe("fr");
    expect(trailerOf([video("en"), video("en-off", { official: true })])).toBe(
      "en-off",
    );
    expect(trailerOf([video("a"), video("b")])).toBe("a");
  });

  it("ignore ce qui n'est pas une bande-annonce YouTube", () => {
    expect(
      trailerOf([
        video("teaser", { type: "Teaser" }),
        video("vimeo", { site: "Vimeo" }),
      ]),
    ).toBeNull();
  });
});

describe("posterUrl", () => {
  it("construit l'URL d'image", () => {
    expect(posterUrl("/a.jpg", "w342")).toBe(
      "https://image.tmdb.org/t/p/w342/a.jpg",
    );
  });
});

describe("discoverDeck", () => {
  it("envoie les bons paramètres", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(discover));
    const page = await discoverDeck(clientWith(fetchImpl), "top", 3);
    const url = new URL((fetchImpl.mock.calls[0] as [string])[0]);
    expect(url.pathname).toBe("/3/discover/movie");
    expect(url.searchParams.get("sort_by")).toBe("vote_average.desc");
    expect(url.searchParams.get("vote_count.gte")).toBe("1000");
    expect(url.searchParams.get("include_adult")).toBe("false");
    expect(url.searchParams.get("language")).toBe("fr-FR");
    expect(url.searchParams.get("page")).toBe("3");
    expect(page.ids).toEqual([129, 278]);
    const init = fetchImpl.mock.calls[0]![1] as { next?: unknown };
    expect(init.next).toEqual({ revalidate: 3600 });
  });

  it("ajoute les paramètres propres au deck", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(discover));
    await discoverDeck(clientWith(fetchImpl), "nineties", 1);
    const url = new URL((fetchImpl.mock.calls[0] as [string])[0]);
    expect(url.searchParams.get("primary_release_date.gte")).toBe("1990-01-01");
    expect(url.searchParams.get("primary_release_date.lte")).toBe("1999-12-31");
    expect(url.searchParams.get("vote_count.gte")).toBe("500");
    expect(url.searchParams.get("sort_by")).toBe("vote_average.desc");
  });

  it("plafonne totalPages à 500", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(discover));
    expect(
      (await discoverDeck(clientWith(fetchImpl), "top", 1)).totalPages,
    ).toBe(500);
  });

  it("garde totalPages s'il est sous le plafond", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ ...discover, total_pages: 7 }));
    expect(
      (await discoverDeck(clientWith(fetchImpl), "top", 1)).totalPages,
    ).toBe(7);
  });
});

describe("getMovieSnapshot", () => {
  it("demande providers et vidéos FR/EN, et met en cache 24 h", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(detailsFull));
    const snap = await getMovieSnapshot(clientWith(fetchImpl), 129);
    const [rawUrl, init] = fetchImpl.mock.calls[0] as [
      string,
      { next?: unknown },
    ];
    const url = new URL(rawUrl);
    expect(url.pathname).toBe("/3/movie/129");
    expect(url.searchParams.get("append_to_response")).toBe(
      "watch/providers,videos",
    );
    expect(url.searchParams.get("include_video_language")).toBe("fr,en");
    expect(init.next).toEqual({ revalidate: 86400 });
    expect(snap.tmdbId).toBe(129);
  });

  it("fresh contourne le cache", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(detailsFull));
    await getMovieSnapshot(clientWith(fetchImpl), 129, { fresh: true });
    const init = fetchImpl.mock.calls[0]![1] as { cache?: string };
    expect(init.cache).toBe("no-store");
  });
});

describe("searchMovies", () => {
  it("searchMovies('   ') ne fait aucun appel", async () => {
    const fetchImpl = vi.fn();
    expect(await searchMovies(clientWith(fetchImpl), "   ")).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("enrichit au plus 8 résultats dans l'ordre", async () => {
    const fetchImpl = vi.fn((input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname === "/3/search/movie") {
        expect(url.searchParams.get("query")).toBe("ghibli");
        expect(url.searchParams.get("include_adult")).toBe("false");
        return Promise.resolve(jsonResponse(search));
      }
      const id = Number(url.pathname.split("/").pop());
      // Reverse delay so that out-of-order completion would break ordering.
      const delay = (10 - (id % 10)) * 2;
      return new Promise<Response>((resolve) =>
        setTimeout(
          () => resolve(jsonResponse({ ...detailsFull, id, title: `F${id}` })),
          delay,
        ),
      );
    });
    const result = await searchMovies(
      clientWith(fetchImpl as unknown as typeof fetch),
      "  ghibli ",
    );
    expect(result.map((m) => m.tmdbId)).toEqual(
      search.results.slice(0, 8).map((r) => r.id),
    );
    expect(fetchImpl).toHaveBeenCalledTimes(9);
  });
});
