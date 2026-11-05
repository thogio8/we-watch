import { describe, expect, it } from "vitest";
import { wishBanner } from "./wish-banner";

describe("wishBanner", () => {
  it("ne dit rien quand personne d'autre ne le veut", () => {
    expect(wishBanner([])).toBeNull();
  });

  it("nomme un, deux ou trois membres en majuscules", () => {
    expect(wishBanner(["Becca"])).toBe("BECCA LE VEUT");
    expect(wishBanner(["Léa", "Hugo"])).toBe("LÉA ET HUGO LE VEULENT");
    expect(wishBanner(["Léa", "Hugo", "Sam"])).toBe(
      "LÉA, HUGO ET SAM LE VEULENT",
    );
  });

  it("compte au-delà de trois", () => {
    expect(wishBanner(["a", "b", "c", "d"])).toBe("4 MEMBRES LE VEULENT");
    expect(wishBanner(Array.from({ length: 9 }, () => "x"))).toBe(
      "9 MEMBRES LE VEULENT",
    );
  });

  it("met les accents en majuscules à la française", () => {
    expect(wishBanner(["éloïse"])).toBe("ÉLOÏSE LE VEUT");
  });
});
