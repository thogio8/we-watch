import { describe, expect, it } from "vitest";
import { DECKS, DEFAULT_DECK, deckLabel, deckParams, isDeckId } from "./decks";

describe("decks", () => {
  it("le deck par défaut est « les mieux notés »", () => {
    expect(DEFAULT_DECK).toBe("top");
    expect(DECKS[0]).toMatchObject({ id: "top", label: "LES MIEUX NOTÉS" });
    expect(deckLabel("korean")).toBe("CINÉMA CORÉEN");
  });

  it("reconnaît les ids connus, refuse le reste", () => {
    for (const deck of DECKS) expect(isDeckId(deck.id)).toBe(true);
    expect(isDeckId("palme")).toBe(false);
    expect(isDeckId(undefined)).toBe(false);
    expect(isDeckId(["top"])).toBe(false);
  });

  it("chaque deck trie par note avec un plancher de votes", () => {
    for (const deck of DECKS) {
      expect(deckParams(deck.id)).toMatchObject({
        sort_by: "vote_average.desc",
        "vote_count.gte": expect.any(Number),
      });
    }
  });

  it("filtre par durée, genre et langue originale", () => {
    expect(deckParams("short")).toMatchObject({ "with_runtime.lte": 100 });
    expect(deckParams("animation")).toMatchObject({ with_genres: "16" });
    expect(deckParams("french")).toMatchObject({
      with_original_language: "fr",
    });
    expect(deckParams("korean")).toMatchObject({
      with_original_language: "ko",
    });
    expect(deckParams("eighties")).toMatchObject({
      "primary_release_date.gte": "1980-01-01",
      "primary_release_date.lte": "1989-12-31",
    });
  });
});
