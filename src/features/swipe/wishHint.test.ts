import { describe, expect, it } from "vitest";
import { aSnapshot } from "@tests/helpers/movies";
import type { DeckCard } from "./deck";
import { MATCH_HINT, MATCH_KEPT } from "./messages";
import { wishHint } from "./wishHint";

const wanted = (others: string[], matched = false): DeckCard => ({
  ...aSnapshot(1),
  wish: { others, matched },
});

describe("wishHint", () => {
  it("rien sous une carte du thème", () => {
    expect(wishHint(aSnapshot(1), 2)).toBeNull();
  });

  it("propose le match quand seule mon envie manque", () => {
    expect(wishHint(wanted(["Becca"]), 2)).toBe(MATCH_HINT);
    expect(wishHint(wanted(["Léa", "Hugo"]), 3)).toBe(MATCH_HINT);
  });

  it("rien quand d'autres envies manquent encore", () => {
    expect(wishHint(wanted(["Léa"]), 3)).toBeNull();
  });

  it("un match d'avant mon arrivée le reste, quel que soit le compte", () => {
    expect(wishHint(wanted(["Léa"], true), 3)).toBe(MATCH_KEPT);
    expect(wishHint(wanted(["Léa", "Hugo"], true), 3)).toBe(MATCH_KEPT);
  });
});
