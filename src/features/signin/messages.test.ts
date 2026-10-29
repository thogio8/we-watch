import { describe, expect, it } from "vitest";
import {
  CANCELLED_ERROR,
  CLOSED_ERROR,
  errorField,
  NAME_ERROR,
  NO_ACCOUNT_ERROR,
  refusalMessage,
  signinFailure,
  WRONG_CODE_ERROR,
} from "./messages";

describe("signinFailure", () => {
  it("une passkey inconnue du serveur : aucun compte sur cet appareil", () => {
    expect(signinFailure({ code: "PASSKEY_NOT_FOUND" })).toBe(NO_ACCOUNT_ERROR);
  });

  it.each([
    { code: "AUTH_CANCELLED" },
    { code: "ERROR_CEREMONY_ABORTED" },
    {},
    null,
    undefined,
  ])("tout le reste (%o) se lit comme une annulation", (error) => {
    expect(signinFailure(error)).toBe(CANCELLED_ERROR);
  });
});

describe("errorField", () => {
  it.each([
    [NAME_ERROR, "name"],
    [WRONG_CODE_ERROR, "ownerCode"],
    [CLOSED_ERROR, "ownerCode"],
    [CANCELLED_ERROR, null],
    [null, null],
  ] as const)("%s concerne le champ %s", (error, field) => {
    expect(errorField(error)).toBe(field);
  });
});

describe("refusalMessage", () => {
  it("inscriptions fermées : message de fermeture", () => {
    expect(refusalMessage("closed")).toBe(CLOSED_ERROR);
  });

  it("code tapé et refusé : mauvais code", () => {
    expect(refusalMessage("wrong_code")).toBe(WRONG_CODE_ERROR);
  });
});
