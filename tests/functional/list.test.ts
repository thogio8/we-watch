import { describe, expect, it, vi } from "vitest";
import { markWatched } from "@/features/draw/actions";
import {
  addFromSearch,
  removeFromList,
  searchCatalog,
  unwatch,
} from "@/features/list/actions";
import { decideSwipe } from "@/features/swipe/actions";
import { getGroupList } from "@/server/container";
import { withLeasGroup } from "../helpers/functional";

vi.mock("@/server/session");
vi.mock("next/cache");

const AMELIE = 194;

const mine = withLeasGroup();

const titles = async (status: "to_watch" | "watched") =>
  (await getGroupList().listByStatus(mine.id, status)).map((m) => m.title);

async function statusInSearch(query: string) {
  const outcome = await searchCatalog(mine.id, query);
  if (!outcome.ok) throw new Error("TMDB down");
  return outcome.results.map((r) => [r.title, r.status]);
}

describe("liste et recherche (fonctionnel)", () => {
  it("la recherche ignore accents et casse, et donne le statut de chaque film", async () => {
    await decideSwipe(mine.id, AMELIE, "keep");

    expect(await statusInSearch("AMELIE")).toEqual([
      ["Le Fabuleux Destin d'Amélie Poulain", "to_watch"],
    ]);
    expect(await statusInSearch("chihiro")).toEqual([
      ["Le Voyage de Chihiro", null],
    ]);
  });

  it("le cycle complet : ajouté, vu, remis à voir, retiré, rajouté", async () => {
    await addFromSearch(mine.id, AMELIE);
    expect(await titles("to_watch")).toHaveLength(1);

    await markWatched(mine.id, AMELIE);
    expect(await titles("to_watch")).toEqual([]);
    expect(await titles("watched")).toHaveLength(1);

    await unwatch(mine.id, AMELIE);
    expect(await titles("to_watch")).toHaveLength(1);

    await removeFromList(mine.id, AMELIE);
    expect(await titles("to_watch")).toEqual([]);
    expect(await statusInSearch("amélie")).toEqual([
      ["Le Fabuleux Destin d'Amélie Poulain", "rejected"],
    ]);

    await addFromSearch(mine.id, AMELIE);
    expect(await titles("to_watch")).toHaveLength(1);
  });

  it("un film déjà vu n'est pas « vu » une deuxième fois", async () => {
    await addFromSearch(mine.id, AMELIE);
    await markWatched(mine.id, AMELIE);
    const [first] = await getGroupList().listByStatus(mine.id, "watched");

    await markWatched(mine.id, AMELIE);

    const [again] = await getGroupList().listByStatus(mine.id, "watched");
    expect(again?.watchedAt).toEqual(first?.watchedAt);
  });
});
