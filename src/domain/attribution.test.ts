import { describe, expect, it } from "vitest";
import {
  addedLine,
  favoriteLine,
  FORMER_MEMBER,
  watchedLine,
  wantedLine,
} from "./attribution";
import { isFavorite } from "./movie";
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
  const seen = { watchedAt: OCT_18, watchedBy: null };

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

  it("parle d'un ancien membre quand le compte est supprimé", () => {
    expect(watchedLine(seen, formatShortDate)).toBe(
      `vu le 18/10 · marqué par ${FORMER_MEMBER}`,
    );
  });

  it("accepte le format long de la fiche", () => {
    expect(watchedLine({ ...seen, watchedBy: "Hugo" }, formatLongDate)).toBe(
      "vu le 18 octobre 2026 · marqué par Hugo",
    );
  });
});

describe("favoriteLine", () => {
  const NOV_4 = new Date("2026-11-04T10:00:00Z");

  it("ne dit rien si le film n’est pas coup de cœur", () => {
    expect(favoriteLine({ favoriteAt: null, favoriteBy: null })).toBeNull();
  });

  it("nomme qui l’a mis en coup de cœur, et quand", () => {
    expect(favoriteLine({ favoriteAt: NOV_4, favoriteBy: "Becca" })).toBe(
      "coup de cœur de Becca le 4 novembre 2026",
    );
  });

  it("parle d’un ancien membre quand le compte est supprimé", () => {
    expect(favoriteLine({ favoriteAt: NOV_4, favoriteBy: null })).toBe(
      "coup de cœur d’un ancien membre le 4 novembre 2026",
    );
  });

  it.each([
    ["Inès", "d’Inès"],
    ["émilie", "d’émilie"],
    ["Émile", "d’Émile"],
    ["Île", "d’Île"],
    ["Œdipe", "d’Œdipe"],
    ["Æsa", "d’Æsa"],
    ["E\u0301mile", "d’E\u0301mile"],
    ["Ugo", "d’Ugo"],
  ])("élide devant une voyelle : %s", (name, of) => {
    expect(favoriteLine({ favoriteAt: NOV_4, favoriteBy: name })).toBe(
      `coup de cœur ${of} le 4 novembre 2026`,
    );
  });

  it.each(["Hugo", "Yasmine", "🎬 Léa", "2Pac"])(
    "n’élide pas devant %s",
    (name) => {
      expect(favoriteLine({ favoriteAt: NOV_4, favoriteBy: name })).toBe(
        `coup de cœur de ${name} le 4 novembre 2026`,
      );
    },
  );

  it("isFavorite suit favoriteAt", () => {
    expect(isFavorite({ favoriteAt: NOV_4 })).toBe(true);
    expect(isFavorite({ favoriteAt: null })).toBe(false);
  });
});
