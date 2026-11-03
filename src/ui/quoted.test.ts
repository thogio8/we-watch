import { describe, expect, it } from "vitest";
import { quoted } from "./quoted";

describe("quoted", () => {
  it("met un nom entre guillemets, avec des espaces insécables", () => {
    expect(quoted("LA COLOC")).toBe("« LA COLOC »");
  });
});
