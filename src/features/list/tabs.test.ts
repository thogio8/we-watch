import { describe, expect, it } from "vitest";
import { otherTab } from "./tabs";

describe("otherTab", () => {
  it("passe de À VOIR à VUS", () => {
    expect(otherTab("toWatch")).toBe("watched");
  });

  it("revient de VUS à À VOIR", () => {
    expect(otherTab("watched")).toBe("toWatch");
  });
});
