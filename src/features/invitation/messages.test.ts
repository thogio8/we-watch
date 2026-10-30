import { describe, expect, it } from "vitest";
import { INVITE_INVALID } from "@/features/groups/messages";
import { INVALID_TITLE, memberTitle } from "./messages";

describe("textes de l’invitation", () => {
  it("le titre d’un lien invalide se lit comme le message d’erreur", () => {
    expect(INVALID_TITLE.join(" ")).toBe(INVITE_INVALID);
  });

  it("déjà membre : le groupe est nommé entre guillemets", () => {
    expect(memberTitle("LA COLOC")).toEqual([
      "TU ES DÉJÀ",
      "DANS « LA COLOC »",
    ]);
  });
});
