import { describe, expect, it } from "vitest";
import { NO_FILTERS } from "@/domain/tonight";
import { filtersSummary, toggle } from "./tonightSummary";

const NETFLIX = { key: "netflix", name: "Netflix" };
const PRIME = { key: "prime", name: "Prime Video" };

describe("toggle", () => {
  it("ajoute un élément absent, retire un élément présent", () => {
    expect(toggle(["a"], "b")).toEqual(["a", "b"]);
    expect(toggle(["a", "b"], "a")).toEqual(["b"]);
  });
});

describe("filtersSummary", () => {
  it("sans filtre : AUCUN FILTRE", () => {
    expect(filtersSummary(NO_FILTERS, [NETFLIX])).toBe("AUCUN FILTRE");
  });

  it("heure de coucher, humeurs puis plateformes, en majuscules", () => {
    const summary = filtersSummary(
      {
        ...NO_FILTERS,
        bedtime: 24 * 60,
        moods: ["laugh"],
        platforms: ["prime"],
      },
      [NETFLIX, PRIME],
    );
    expect(summary).toBe("AVANT MINUIT · RIRE · PRIME VIDEO");
  });

  it("ignore une plateforme absente de la liste", () => {
    const filters = { ...NO_FILTERS, platforms: ["canal"] };
    expect(filtersSummary(filters, [NETFLIX])).toBe("AUCUN FILTRE");
  });
});

describe("filtersSummary matchs", () => {
  it("MATCHS vient en premier", () => {
    expect(
      filtersSummary({ ...NO_FILTERS, pool: "matches", bedtime: 24 * 60 }, []),
    ).toBe("MATCHS · AVANT MINUIT");
  });
});

describe("filtersSummary coups de cœur", () => {
  it("le filtre coups de cœur vient en premier : COUPS DE CŒUR · AVANT MINUIT", () => {
    expect(
      filtersSummary(
        { ...NO_FILTERS, pool: "favorites", bedtime: 24 * 60 },
        [],
      ),
    ).toBe("COUPS DE CŒUR · AVANT MINUIT");
  });
});
