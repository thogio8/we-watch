import { describe, expect, it } from "vitest";
import { measureTear, tearClips } from "./tear";

const points = (clip: string) =>
  clip.replace(/^polygon\(|\)$/g, "").split(", ");

describe("tearClips", () => {
  it("ticket debout : la déchirure suit la perforation horizontale", () => {
    const { intact, torn } = tearClips("horizontal", 290, 540);
    expect(points(torn)[0]).toBe("-15% -60px");
    expect(points(torn)[2]).toBe("115% 286px");
    expect(points(intact)[2]).toBe("115% 600px");
    expect(points(intact)).toHaveLength(points(torn).length);
  });

  it("ticket couché : la déchirure suit la perforation verticale", () => {
    const { intact, torn } = tearClips("vertical", 240, 700);
    expect(points(torn).slice(0, 2)).toEqual(["-60px 115%", "-60px -15%"]);
    // From top to bottom along x ≈ 240.
    expect(points(torn)[2]).toBe("236px -15%");
    expect(points(torn).at(-1)).toBe("245px 115%");
    expect(points(intact)[2]).toBe("760px -15%");
    expect(points(intact)).toHaveLength(10);
  });
});

describe("measureTear", () => {
  const ticket = { width: 400, height: 540, left: 10, top: 100 };

  it("affiche sur toute la largeur → perforation sous l'affiche", () => {
    expect(
      measureTear(ticket, { width: 394, height: 290, left: 13, top: 103 }),
    ).toEqual({ axis: "horizontal", at: 293, extent: 540 });
  });

  it("affiche à gauche → perforation à sa droite", () => {
    expect(
      measureTear(ticket, { width: 200, height: 300, left: 13, top: 103 }),
    ).toEqual({ axis: "vertical", at: 203, extent: 400 });
  });
});
