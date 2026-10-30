import { describe, expect, it } from "vitest";
import {
  activeOn,
  addPasskeyFailure,
  alreadyRevoked,
  addedOn,
  deleteField,
  removePasskeyQuestion,
  renamedTo,
  revokeQuestion,
} from "./messages";

describe("textes de « MON COMPTE »", () => {
  it("le prénom changé s’annonce en majuscules", () => {
    expect(renamedTo("Léa")).toBe("C’EST NOTÉ\u00A0: TU T’APPELLES LÉA");
  });

  it("« ajoutée le 28 octobre 2026 », à l’heure de Paris", () => {
    expect(addedOn(new Date("2026-10-27T23:30:00Z"))).toBe(
      "ajoutée le 28 octobre 2026",
    );
  });

  it("« actif le 1er novembre 2026 »", () => {
    expect(activeOn(new Date("2026-11-01T12:00:00Z"))).toBe(
      "actif le 1er novembre 2026",
    );
  });

  it("supprimer une clé : son nom en majuscules entre guillemets", () => {
    expect(removePasskeyQuestion("iPhone · Safari")).toBe(
      "SUPPRIMER LA CLÉ «\u00A0IPHONE · SAFARI\u00A0»\u00A0?",
    );
  });

  it("déconnecter un appareil : son nom en majuscules entre guillemets", () => {
    expect(revokeQuestion("Mac · Chrome")).toBe(
      "DÉCONNECTER «\u00A0MAC · CHROME\u00A0»\u00A0?",
    );
  });

  it("supprimer le compte : mon prénom tel quel, casse comprise", () => {
    expect(deleteField("Léa")).toBe("TAPE «\u00A0Léa\u00A0» POUR CONFIRMER");
  });

  it("un appareil déjà déconnecté : son nom en majuscules", () => {
    expect(alreadyRevoked("Mac · Chrome")).toBe(
      "MAC · CHROME ÉTAIT DÉJÀ DÉCONNECTÉ",
    );
  });

  it("ajouter une clé : l’appareil qui en a déjà une, sinon une validation annulée", () => {
    expect(
      addPasskeyFailure({ code: "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED" }),
    ).toBe("CET APPAREIL A DÉJÀ UNE CLÉ D’ACCÈS");
    expect(addPasskeyFailure({ code: "ERROR_CEREMONY_ABORTED" })).toBe(
      "VALIDATION ANNULÉE, RÉESSAIE",
    );
    expect(addPasskeyFailure(null)).toBe("VALIDATION ANNULÉE, RÉESSAIE");
  });
});
