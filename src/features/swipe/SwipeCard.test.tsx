import { describe, expect, it } from "vitest";
import { decisionFromDrag } from "./SwipeCard";

const WIDTH = 350;

describe("decisionFromDrag", () => {
  it.each([
    [106, 0, "keep"],
    [-106, 0, "reject"],
    [104, 0, null],
    [-104, 0, null],
    [0, 0, null],
  ] as const)(
    "au-delà de 0,3 × la largeur : décalage %d, vitesse %d → %s",
    (offset, velocity, expected) => {
      expect(decisionFromDrag(offset, velocity, WIDTH)).toBe(expected);
    },
  );

  it.each([
    [40, 900, "keep"],
    [-40, -900, "reject"],
    [40, 300, null],
    // A flick against the drag direction is a change of mind, not a swipe.
    [40, -900, null],
    // A flick that barely moved is a tap, not a swipe.
    [5, 900, null],
  ] as const)(
    "un geste vif suffit : décalage %d, vitesse %d → %s",
    (offset, velocity, expected) => {
      expect(decisionFromDrag(offset, velocity, WIDTH)).toBe(expected);
    },
  );
});
