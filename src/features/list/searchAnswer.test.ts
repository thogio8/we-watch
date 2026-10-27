import { describe, expect, it } from "vitest";
import { aSnapshot } from "@tests/helpers/movies";
import type { SearchResult } from "./actions";
import {
  type Answer,
  canAdd,
  CRASHED,
  isStale,
  markAdded,
} from "./searchAnswer";

const aResult = (tmdbId: number, status: SearchResult["status"] = null) => ({
  ...aSnapshot(tmdbId),
  status,
});

const answer = (...results: SearchResult[]): Answer => ({
  query: "dune",
  outcome: { ok: true, results },
});

describe("canAdd", () => {
  it("propose d’ajouter un film inconnu ou rejeté", () => {
    expect(canAdd(null)).toBe(true);
    expect(canAdd("rejected")).toBe(true);
  });

  it("ne propose pas d’ajouter un film déjà à voir ou vu", () => {
    expect(canAdd("to_watch")).toBe(false);
    expect(canAdd("watched")).toBe(false);
  });
});

describe("isStale", () => {
  it("rien n’est périmé tant qu’aucune réponse n’est arrivée", () => {
    expect(isStale(null, "dune")).toBe(false);
  });

  it("une réponse à la requête du champ est à jour", () => {
    expect(isStale(answer(), "dune")).toBe(false);
  });

  it("une réponse à une ancienne requête est périmée", () => {
    expect(isStale(answer(), "dune 2")).toBe(true);
  });
});

describe("markAdded", () => {
  it("passe le film ajouté à voir, sans toucher aux autres", () => {
    const marked = markAdded(answer(aResult(1), aResult(2, "rejected")), 2);
    expect(marked).toEqual(answer(aResult(1), aResult(2, "to_watch")));
  });

  it("laisse une recherche en échec ou absente telle quelle", () => {
    const failed: Answer = { query: "dune", outcome: CRASHED };
    expect(markAdded(failed, 1)).toBe(failed);
    expect(markAdded(null, 1)).toBeNull();
  });
});
