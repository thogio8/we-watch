import { describe, expect, it } from "vitest";
import { constantTimeEqual } from "./token";

describe("constantTimeEqual", () => {
  it("accepte deux chaînes identiques", () => {
    expect(constantTimeEqual("popcorn", "popcorn")).toBe(true);
    expect(constantTimeEqual("", "")).toBe(true);
  });

  it.each([
    ["popcorn", "popcorm"],
    ["popcorn", "Popcorn"],
    ["popcorn", "popcorn2"],
    ["popcorn", ""],
  ])("refuse %j comparé à %j", (a, b) => {
    expect(constantTimeEqual(a, b)).toBe(false);
  });
});
