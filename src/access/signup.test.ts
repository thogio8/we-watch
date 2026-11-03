import { describe, expect, it } from "vitest";
import { signupOffer, signupRight } from "./signup";

const OWNER_CODE = "code-proprietaire-123";

describe("signupRight", () => {
  it("laisse s'inscrire en mode ouvert sans code", () => {
    expect(signupRight({ mode: "open" })).toEqual({ ok: true });
  });

  it("traite un code vide ou d'espaces comme une absence de code", () => {
    expect(
      signupRight({ mode: "open", ownerCode: OWNER_CODE, submittedCode: "" }),
    ).toEqual({ ok: true });
    expect(
      signupRight({ mode: "open", ownerCode: OWNER_CODE, submittedCode: "  " }),
    ).toEqual({ ok: true });
  });

  it("accepte le bon code en mode ouvert", () => {
    expect(
      signupRight({
        mode: "open",
        ownerCode: OWNER_CODE,
        submittedCode: OWNER_CODE,
      }),
    ).toEqual({ ok: true });
  });

  it("ignore les espaces autour du code soumis", () => {
    expect(
      signupRight({
        mode: "invite",
        ownerCode: OWNER_CODE,
        submittedCode: `  ${OWNER_CODE} `,
      }),
    ).toEqual({ ok: true });
  });

  it("ferme l'inscription en mode invitation avec un code d'espaces", () => {
    expect(
      signupRight({
        mode: "invite",
        ownerCode: OWNER_CODE,
        submittedCode: "  ",
      }),
    ).toEqual({ ok: false, reason: "closed" });
  });

  it("refuse un mauvais code en mode ouvert", () => {
    expect(
      signupRight({
        mode: "open",
        ownerCode: OWNER_CODE,
        submittedCode: "autre-code-12345",
      }),
    ).toEqual({ ok: false, reason: "wrong_code" });
  });

  it("refuse un code soumis quand aucun code propriétaire n'est configuré en mode ouvert", () => {
    expect(
      signupRight({ mode: "open", submittedCode: "quelque-chose" }),
    ).toEqual({ ok: false, reason: "wrong_code" });
  });

  it("ferme l'inscription en mode invitation sans code", () => {
    expect(signupRight({ mode: "invite", ownerCode: OWNER_CODE })).toEqual({
      ok: false,
      reason: "closed",
    });
  });

  it("accepte le bon code en mode invitation", () => {
    expect(
      signupRight({
        mode: "invite",
        ownerCode: OWNER_CODE,
        submittedCode: OWNER_CODE,
      }),
    ).toEqual({ ok: true });
  });

  it("refuse un mauvais code en mode invitation", () => {
    expect(
      signupRight({
        mode: "invite",
        ownerCode: OWNER_CODE,
        submittedCode: "autre-code-12345",
      }),
    ).toEqual({ ok: false, reason: "wrong_code" });
  });

  it("refuse un code soumis en mode invitation sans code propriétaire configuré", () => {
    expect(
      signupRight({ mode: "invite", submittedCode: "quelque-chose" }),
    ).toEqual({ ok: false, reason: "wrong_code" });
  });

  const OK = { ok: true };
  const CLOSED = { ok: false, reason: "closed" };
  const WRONG = { ok: false, reason: "wrong_code" };
  const CODES = { bon: OWNER_CODE, mauvais: "autre-code-12345", absent: "" };

  it.each([
    ["open", false, "absent", OK],
    ["open", false, "bon", OK],
    ["open", false, "mauvais", WRONG],
    ["open", true, "absent", OK],
    ["open", true, "bon", OK],
    ["open", true, "mauvais", WRONG],
    ["invite", false, "absent", CLOSED],
    ["invite", false, "bon", OK],
    ["invite", false, "mauvais", WRONG],
    ["invite", true, "absent", OK],
    ["invite", true, "bon", OK],
    ["invite", true, "mauvais", WRONG],
  ] as const)(
    "mode %s, invité : %s, code %s → %j",
    (mode, invited, code, expected) => {
      expect(
        signupRight({
          mode,
          invited,
          ownerCode: OWNER_CODE,
          submittedCode: CODES[code],
        }),
      ).toEqual(expected);
    },
  );
});

describe("signupOffer", () => {
  it("propose le code propriétaire seulement s'il en existe un, sans jamais le donner", () => {
    expect(signupOffer({ SIGNUP: "invite", OWNER_CODE })).toEqual({
      signup: "invite",
      ownerCode: true,
    });
    expect(signupOffer({ SIGNUP: "invite" })).toEqual({
      signup: "invite",
      ownerCode: false,
    });
    expect(signupOffer({ SIGNUP: "open" })).toEqual({
      signup: "open",
      ownerCode: false,
    });
  });
});
