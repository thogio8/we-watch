import { describe, expect, it } from "vitest";
import { cx } from "./cx";

describe("cx", () => {
  it("garde les classes présentes, dans l'ordre, et ignore les autres", () => {
    expect(cx("a", false, undefined, "b", null, "", "c")).toBe("a b c");
  });
});
