import { describe, expect, it } from "vitest";
import { membersLabel } from "./messages";

describe("membersLabel", () => {
  it.each([
    [1, "1 MEMBRE"],
    [2, "2 MEMBRES"],
    [12, "12 MEMBRES"],
  ])("%i → « %s »", (count, label) => {
    expect(membersLabel(count)).toBe(label);
  });
});
