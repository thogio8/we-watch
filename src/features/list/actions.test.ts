import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertSignedIn } from "@/server/session";
import { revalidateListPages } from "@/server/revalidate";
import { aSnapshot } from "@tests/helpers/movies";
import type { MovieSnapshot } from "@/domain/movie";
import { TmdbError } from "@/tmdb/client";
import {
  addFromSearch,
  removeFromList,
  searchCatalog,
  unwatch,
} from "./actions";

const apply = vi.fn();
const statusesOf = vi.fn();
const searchMovies = vi.fn();
const getMovieSnapshot = vi.fn();
const client = { get: vi.fn() };

vi.mock("@/server/session");
vi.mock("@/server/container", () => ({
  getMoviesRepository: () => ({ apply, statusesOf }),
  getTmdbClient: () => client,
}));
vi.mock("@/tmdb/movies", () => ({
  searchMovies: (...args: unknown[]) => searchMovies(...args),
  getMovieSnapshot: (...args: unknown[]) => getMovieSnapshot(...args),
}));
vi.mock("@/server/revalidate");

const snapshot = (tmdbId: number, title: string): MovieSnapshot =>
  aSnapshot(tmdbId, { title, releaseYear: 1984, runtimeMinutes: 137 });

const DUNE_2021 = snapshot(438631, "Dune");
const DUNE_2 = snapshot(693134, "Dune : Deuxième partie");
const DUNE_1984 = snapshot(841, "Dune");

beforeEach(() => {
  vi.mocked(assertSignedIn)
    .mockReset()
    .mockResolvedValue({ userId: "user-1", name: "Léa" });
  apply.mockReset().mockResolvedValue("applied");
  statusesOf.mockReset().mockResolvedValue(new Map());
  vi.mocked(revalidateListPages).mockReset();
  searchMovies.mockReset().mockResolvedValue([]);
  getMovieSnapshot.mockReset().mockResolvedValue(DUNE_1984);
});

describe.each([
  ["removeFromList", removeFromList, "remove"],
  ["unwatch", unwatch, "unwatch"],
] as const)("%s", (_name, action, movieAction) => {
  it(`applique « ${movieAction} » et ne rafraîchit que /list (R10)`, async () => {
    await action(129);

    expect(apply).toHaveBeenCalledExactlyOnceWith(movieAction, 129);
    expect(revalidateListPages).toHaveBeenCalledOnce();
  });

  it.each([0, -1, 1.5, Number.NaN, "129" as unknown as number])(
    "refuse un identifiant invalide (%s)",
    async (tmdbId) => {
      await expect(action(tmdbId)).rejects.toThrow("invalid tmdbId");
      expect(apply).not.toHaveBeenCalled();
      expect(revalidateListPages).not.toHaveBeenCalled();
    },
  );
});

describe("searchCatalog", () => {
  it("renvoie les films trouvés avec leur statut dans la liste", async () => {
    searchMovies.mockResolvedValue([DUNE_2021, DUNE_2, DUNE_1984]);
    statusesOf.mockResolvedValue(
      new Map([
        [693134, "to_watch"],
        [841, "rejected"],
      ]),
    );

    await expect(searchCatalog("  dune ")).resolves.toEqual({
      ok: true,
      results: [
        { ...DUNE_2021, status: null },
        { ...DUNE_2, status: "to_watch" },
        { ...DUNE_1984, status: "rejected" },
      ],
    });
    expect(searchMovies).toHaveBeenCalledWith(client, "dune");
    expect(statusesOf).toHaveBeenCalledWith([438631, 693134, 841]);
    expect(revalidateListPages).not.toHaveBeenCalled();
  });

  it("requête vide ou d'espaces → aucun appel TMDB", async () => {
    await expect(searchCatalog("   ")).resolves.toEqual({
      ok: true,
      results: [],
    });
    expect(searchMovies).not.toHaveBeenCalled();
  });

  it("une erreur TMDB devient { ok: false }", async () => {
    searchMovies.mockRejectedValue(new TmdbError(503, "TMDB responded 503"));

    await expect(searchCatalog("dune")).resolves.toEqual({ ok: false });
  });

  it("laisse remonter une panne qui ne vient pas de TMDB", async () => {
    searchMovies.mockRejectedValue(new TypeError("bug"));

    await expect(searchCatalog("dune")).rejects.toThrow("bug");
  });

  it("laisse remonter les autres erreurs", async () => {
    statusesOf.mockRejectedValue(new Error("database is locked"));

    await expect(searchCatalog("dune")).rejects.toThrow("database is locked");
  });

  it.each([
    42 as unknown as string,
    null as unknown as string,
    "x".repeat(101),
  ])("refuse une requête invalide (%s)", async (query) => {
    await expect(searchCatalog(query)).rejects.toThrow("invalid query");
    expect(searchMovies).not.toHaveBeenCalled();
  });
});

describe("addFromSearch", () => {
  it("ajoute le film avec un snapshot pris côté serveur et rafraîchit /list", async () => {
    await addFromSearch(841);

    expect(getMovieSnapshot).toHaveBeenCalledWith(client, 841);
    expect(apply).toHaveBeenCalledExactlyOnceWith("search_add", 841, DUNE_1984);
    expect(revalidateListPages).toHaveBeenCalledOnce();
  });

  it.each([0, -1, 1.5, Number.NaN, "841" as unknown as number])(
    "refuse un identifiant invalide (%s)",
    async (tmdbId) => {
      await expect(addFromSearch(tmdbId)).rejects.toThrow("invalid tmdbId");
      expect(getMovieSnapshot).not.toHaveBeenCalled();
      expect(apply).not.toHaveBeenCalled();
    },
  );
});

describe("sans session", () => {
  it.each([
    ["removeFromList", () => removeFromList(841)],
    ["unwatch", () => unwatch(841)],
    ["searchCatalog", () => searchCatalog("dune")],
    ["addFromSearch", () => addFromSearch(841)],
  ] as const)("%s refuse sans rien appliquer", async (_name, call) => {
    vi.mocked(assertSignedIn).mockRejectedValue(new Error("not signed in"));

    await expect(call()).rejects.toThrow("not signed in");
    expect(apply).not.toHaveBeenCalled();
    expect(searchMovies).not.toHaveBeenCalled();
    expect(getMovieSnapshot).not.toHaveBeenCalled();
    expect(statusesOf).not.toHaveBeenCalled();
    expect(revalidateListPages).not.toHaveBeenCalled();
  });
});
