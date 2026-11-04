import { describe, expect, it } from "vitest";
import { favoriteButtonName } from "./favorite";

describe("favoriteButtonName", () => {
  it("nomme le bouton par le titre du film, espace insécable avant les deux-points", () => {
    expect(favoriteButtonName("Parasite")).toBe("Coup de cœur : Parasite");
  });
});
