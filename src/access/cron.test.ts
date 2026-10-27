import { describe, expect, it } from "vitest";
import { isCronAuthorized } from "./cron";

const SECRET = "un-secret-de-cron-assez-long";

describe("isCronAuthorized", () => {
  it("accepte le bon jeton Bearer", () => {
    expect(isCronAuthorized(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it.each([
    [null, SECRET],
    [undefined, SECRET],
    ["", SECRET],
    [SECRET, SECRET],
    [`Bearer ${SECRET}x`, SECRET],
    [`bearer ${SECRET}`, SECRET],
    ["Bearer undefined", undefined],
  ])("refuse %s", (header, secret) => {
    expect(isCronAuthorized(header, secret)).toBe(false);
  });
});
