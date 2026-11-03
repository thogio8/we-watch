import { describe, expect, it } from "vitest";
import {
  ACTION_LIMITS,
  isTooManyAttempts,
  TOO_MANY_ATTEMPTS,
} from "./rate-limit";

describe("TOO_MANY_ATTEMPTS", () => {
  it("le texte d’un refus pour trop d’essais", () => {
    expect(TOO_MANY_ATTEMPTS).toBe("TROP D’ESSAIS. RÉESSAIE DANS UN MOMENT.");
  });
});

describe("isTooManyAttempts", () => {
  it("une erreur 429 : trop d’essais", () => {
    expect(isTooManyAttempts({ status: 429, code: "X" })).toBe(true);
  });

  it.each([{ status: 400 }, { code: "TOO_MANY" }, {}, null, undefined])(
    "%o : non",
    (error) => {
      expect(isTooManyAttempts(error)).toBe(false);
    },
  );
});

describe("ACTION_LIMITS", () => {
  it("les limites des actions serveur : fenêtre (secondes) et maximum, sans seau global du code propriétaire", () => {
    expect(ACTION_LIMITS).toEqual({
      signup: { window: 600, max: 10 },
      "owner-code": { window: 900, max: 5 },
      "create-group": { window: 3600, max: 10 },
      "join-group": { window: 3600, max: 20 },
      "rename-me": { window: 3600, max: 20 },
      "delete-passkey": { window: 3600, max: 10 },
      "delete-account": { window: 3600, max: 5 },
    });
  });
});
