import { describe, expect, it } from "vitest";
import {
  addedLine,
  FORMER_MEMBER,
  watchedLine,
  wantedLine,
} from "./attribution";
import { formatLongDate, formatShortDate } from "./time";

// Noon UTC stays on the 12th in Paris; OCT_18 is local time, as the short date is.
const OCT_12 = new Date("2026-10-12T10:00:00Z");
const OCT_18 = new Date(2026, 9, 18);

describe("addedLine", () => {
  it("nomme l'auteur et la date au format long", () => {
    expect(
      addedLine({ addedBy: "Léa", legacy: false, decidedAt: OCT_12 }),
    ).toBe("ajouté par Léa le 12 octobre 2026");
  });

  it("omet l'auteur d'une ligne copiée", () => {
    expect(addedLine({ addedBy: null, legacy: true, decidedAt: OCT_12 })).toBe(
      "ajouté le 12 octobre 2026",
    );
  });

  it("parle d'un ancien membre quand le compte est supprimé", () => {
    expect(addedLine({ addedBy: null, legacy: false, decidedAt: OCT_12 })).toBe(
      `ajouté par ${FORMER_MEMBER} le 12 octobre 2026`,
    );
  });
});

describe("wantedLine", () => {
  it("ne dit rien sans souhait", () => {
    expect(wantedLine([])).toBeNull();
  });

  it("liste un, deux ou trois noms", () => {
    expect(wantedLine(["Léa"])).toBe("voulu par Léa");
    expect(wantedLine(["Léa", "Hugo"])).toBe("voulu par Léa et Hugo");
    expect(wantedLine(["Léa", "Hugo", "Sam"])).toBe(
      "voulu par Léa, Hugo et Sam",
    );
  });
});

describe("watchedLine", () => {
  const seen = { watchedAt: OCT_18, watchedBy: null, legacy: false };

  it("ne dit rien tant que le film n'est pas vu", () => {
    expect(
      watchedLine({ ...seen, watchedAt: null }, formatShortDate),
    ).toBeNull();
  });

  it("nomme celui qui a marqué le film", () => {
    expect(watchedLine({ ...seen, watchedBy: "Hugo" }, formatShortDate)).toBe(
      "vu le 18/10 · marqué par Hugo",
    );
  });

  it("omet le marqueur d'une ligne copiée", () => {
    expect(watchedLine({ ...seen, legacy: true }, formatShortDate)).toBe(
      "vu le 18/10",
    );
  });

  it("parle d'un ancien membre quand le compte est supprimé", () => {
    expect(watchedLine(seen, formatShortDate)).toBe(
      `vu le 18/10 · marqué par ${FORMER_MEMBER}`,
    );
  });

  it("accepte le format long de la fiche", () => {
    expect(watchedLine({ ...seen, legacy: true }, formatLongDate)).toBe(
      "vu le 18 octobre 2026",
    );
  });
});
