import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertMember } from "@/server/groups";
import { revalidateListPages } from "@/server/revalidate";
import { aSnapshot } from "@tests/helpers/movies";
import { expectRefusedFirst } from "@tests/helpers/refused";
import type { MovieSnapshot } from "@/domain/movie";
import { TmdbError } from "@/tmdb/client";
import {
  addFromSearch,
  removeFromList,
  searchCatalog,
  setFavorite,
  unwatch,
} from "./actions";

const apply = vi.fn();
const set = vi.fn();
const statusesOf = vi.fn();
const searchMovies = vi.fn();
const getMovieSnapshot = vi.fn();
const client = { get: vi.fn() };

vi.mock("@/server/groups");
vi.mock("@/server/container", () => ({
  getGroupList: () => ({ apply, statusesOf }),
  getFavorites: () => ({ set }),
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
const GROUP = "groupe-1";

beforeEach(() => {
  vi.mocked(assertMember).mockClear();
  apply.mockReset().mockResolvedValue("applied");
  set.mockReset().mockResolvedValue("applied");
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
    await action(GROUP, 129);

    expect(assertMember).toHaveBeenCalledWith(GROUP);
    expect(apply).toHaveBeenCalledExactlyOnceWith({
      groupId: GROUP,
      userId: "user-1",
      action: movieAction,
      tmdbId: 129,
    });
    expect(revalidateListPages).toHaveBeenCalledOnce();
  });

  it.each([0, -1, 1.5, Number.NaN, "129" as unknown as number])(
    "refuse un identifiant invalide (%s)",
    async (tmdbId) => {
      await expect(action(GROUP, tmdbId)).rejects.toThrow("invalid tmdbId");
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

    await expect(searchCatalog(GROUP, "  dune ")).resolves.toEqual({
      ok: true,
      results: [
        { ...DUNE_2021, status: null },
        { ...DUNE_2, status: "to_watch" },
        { ...DUNE_1984, status: "rejected" },
      ],
    });
    expect(searchMovies).toHaveBeenCalledWith(client, "dune");
    expect(statusesOf).toHaveBeenCalledWith(GROUP, [438631, 693134, 841]);
    expect(revalidateListPages).not.toHaveBeenCalled();
  });

  it("requête vide ou d'espaces → aucun appel TMDB", async () => {
    await expect(searchCatalog(GROUP, "   ")).resolves.toEqual({
      ok: true,
      results: [],
    });
    expect(searchMovies).not.toHaveBeenCalled();
  });

  it("une erreur TMDB devient { ok: false }", async () => {
    searchMovies.mockRejectedValue(new TmdbError(503, "TMDB responded 503"));

    await expect(searchCatalog(GROUP, "dune")).resolves.toEqual({ ok: false });
  });

  it("laisse remonter une panne qui ne vient pas de TMDB", async () => {
    searchMovies.mockRejectedValue(new TypeError("bug"));

    await expect(searchCatalog(GROUP, "dune")).rejects.toThrow("bug");
  });

  it("laisse remonter les autres erreurs", async () => {
    statusesOf.mockRejectedValue(new Error("database is locked"));

    await expect(searchCatalog(GROUP, "dune")).rejects.toThrow(
      "database is locked",
    );
  });

  it.each([
    42 as unknown as string,
    null as unknown as string,
    "x".repeat(101),
  ])("refuse une requête invalide (%s)", async (query) => {
    await expect(searchCatalog(GROUP, query)).rejects.toThrow("invalid query");
    expect(searchMovies).not.toHaveBeenCalled();
  });
});

describe("addFromSearch", () => {
  it("ajoute le film avec un snapshot pris côté serveur et rafraîchit /list", async () => {
    await addFromSearch(GROUP, 841);

    expect(assertMember).toHaveBeenCalledWith(GROUP);
    expect(getMovieSnapshot).toHaveBeenCalledWith(client, 841);
    expect(apply).toHaveBeenCalledExactlyOnceWith({
      groupId: GROUP,
      userId: "user-1",
      action: "search_add",
      tmdbId: 841,
      snapshot: DUNE_1984,
    });
    expect(revalidateListPages).toHaveBeenCalledOnce();
  });

  it.each([0, -1, 1.5, Number.NaN, "841" as unknown as number])(
    "refuse un identifiant invalide (%s)",
    async (tmdbId) => {
      await expect(addFromSearch(GROUP, tmdbId)).rejects.toThrow(
        "invalid tmdbId",
      );
      expect(getMovieSnapshot).not.toHaveBeenCalled();
      expect(apply).not.toHaveBeenCalled();
    },
  );
});

describe("setFavorite", () => {
  it("pose l’état voulu, pour moi, puis rafraîchit TIRER et LISTE", async () => {
    await expect(setFavorite(GROUP, 129, true)).resolves.toBe("applied");

    expect(assertMember).toHaveBeenCalledWith(GROUP);
    expect(set).toHaveBeenCalledExactlyOnceWith({
      groupId: GROUP,
      userId: "user-1",
      tmdbId: 129,
      on: true,
    });
    expect(revalidateListPages).toHaveBeenCalledOnce();
  });

  it("renvoie « noop » tel quel, sans exception", async () => {
    set.mockResolvedValue("noop");

    await expect(setFavorite(GROUP, 129, false)).resolves.toBe("noop");
  });

  it.each([
    [0, true],
    [129, "true"],
    [129, 1],
    [129, null],
    [129, undefined],
  ])("refuse tmdbId %s et on %s sans rien écrire", async (tmdbId, on) => {
    await expect(setFavorite(GROUP, tmdbId, on as boolean)).rejects.toThrow(
      "invalid",
    );
    expect(set).not.toHaveBeenCalled();
    expect(revalidateListPages).not.toHaveBeenCalled();
  });
});

describe("hors du groupe, ou sans session", () => {
  it.each([
    ["removeFromList", () => removeFromList("groupe-b", 0)],
    ["unwatch", () => unwatch("groupe-b", 0)],
    ["searchCatalog", () => searchCatalog("groupe-b", 42 as unknown as string)],
    ["addFromSearch", () => addFromSearch("groupe-b", 0)],
    [
      "setFavorite",
      () => setFavorite("groupe-b", 0, "true" as unknown as boolean),
    ],
  ] as const)(
    "%s refuse avant toute validation, sans rien faire",
    (_name, call) =>
      expectRefusedFirst(call, [
        apply,
        set,
        searchMovies,
        getMovieSnapshot,
        statusesOf,
        vi.mocked(revalidateListPages),
      ]),
  );
});
