import { describe, expect, it } from "vitest";
import { leaveQuestion, memberSince, removeQuestion } from "./messages";

describe("textes de l’écran membres", () => {
  it("« depuis le 23/10 »", () => {
    expect(memberSince(new Date(2026, 9, 23, 21, 30))).toBe("depuis le 23/10");
  });

  it("retirer : le prénom en majuscules, « ? » insécable", () => {
    expect(removeQuestion("Léa")).toBe("RETIRER LÉA DU GROUPE\u00A0?");
  });

  it("quitter : le nom du groupe entre guillemets", () => {
    expect(leaveQuestion("LA COLOC")).toBe(
      "QUITTER «\u00A0LA COLOC\u00A0»\u00A0?",
    );
  });
});
