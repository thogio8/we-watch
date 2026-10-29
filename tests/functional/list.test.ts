import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { markWatched } from "@/features/draw/actions";
import {
  addFromSearch,
  removeFromList,
  searchCatalog,
  unwatch,
} from "@/features/list/actions";
import { decideSwipe } from "@/features/swipe/actions";
import { getMoviesRepository } from "@/server/container";
import { startServerStack } from "../helpers/functional";

vi.mock("@/server/session");
vi.mock("next/cache");

const AMELIE = 194;

let reset: () => Promise<void>;
beforeAll(async () => ({ reset } = await startServerStack()));
beforeEach(() => reset());

const titles = async (status: "to_watch" | "watched") =>
  (await getMoviesRepository().listByStatus(status)).map((m) => m.title);

async function statusInSearch(query: string) {
  const outcome = await searchCatalog(query);
  if (!outcome.ok) throw new Error("TMDB down");
  return outcome.results.map((r) => [r.title, r.status]);
}

describe("liste et recherche (fonctionnel)", () => {
  it("la recherche ignore accents et casse, et donne le statut de chaque film", async () => {
    await decideSwipe(AMELIE, "keep");

    expect(await statusInSearch("AMELIE")).toEqual([
      ["Le Fabuleux Destin d'Amélie Poulain", "to_watch"],
    ]);
    expect(await statusInSearch("chihiro")).toEqual([
      ["Le Voyage de Chihiro", null],
    ]);
  });

  it("le cycle complet : ajouté, vu, remis à voir, retiré, rajouté", async () => {
    await addFromSearch(AMELIE);
    expect(await titles("to_watch")).toHaveLength(1);

    await markWatched(AMELIE);
    expect(await titles("to_watch")).toEqual([]);
    expect(await titles("watched")).toHaveLength(1);

    await unwatch(AMELIE);
    expect(await titles("to_watch")).toHaveLength(1);

    await removeFromList(AMELIE);
    expect(await titles("to_watch")).toEqual([]);
    expect(await statusInSearch("amélie")).toEqual([
      ["Le Fabuleux Destin d'Amélie Poulain", "rejected"],
    ]);

    await addFromSearch(AMELIE);
    expect(await titles("to_watch")).toHaveLength(1);
  });

  it("un film déjà vu n'est pas « vu » une deuxième fois", async () => {
    await addFromSearch(AMELIE);
    await markWatched(AMELIE);
    const [first] = await getMoviesRepository().listByStatus("watched");

    await markWatched(AMELIE);

    const [again] = await getMoviesRepository().listByStatus("watched");
    expect(again?.watchedAt).toEqual(first?.watchedAt);
  });
});
