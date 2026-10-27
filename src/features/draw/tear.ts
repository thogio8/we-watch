/**
 * Clip paths of the torn ticket (« RETIRER »): the poster part is kept, the
 * stub is ripped off along the perforation. Standing ticket: the perforation
 * is horizontal, `at` px from the top; lying ticket (wide screens): vertical,
 * `at` px from the left. Both clips share their points so motion can tween.
 */

/** Positions along the tear (%) and how deep the rip wanders (px). */
const TEAR_POINTS = [
  [115, -4],
  [85, 6],
  [70, -6],
  [55, 8],
  [40, -4],
  [25, 7],
  [10, -5],
  [-15, 5],
] as const;

/** Past the ticket's far edge: room for the offset shadow and the glow. */
const SHADOW_ROOM = 60;

export type TearAxis = "horizontal" | "vertical";

function clip(axis: TearAxis, line: (offset: number) => number): string {
  if (axis === "horizontal") {
    const tear = TEAR_POINTS.map(([pos, off]) => `${pos}% ${line(off)}px`);
    return `polygon(-15% -60px, 115% -60px, ${tear.join(", ")})`;
  }
  const tear = TEAR_POINTS.map(([pos, off]) => `${line(off)}px ${100 - pos}%`);
  return `polygon(-60px 115%, -60px -15%, ${tear.join(", ")})`;
}

/**
 * `extent`: the ticket's height (standing) or width (lying). The intact clip
 * sits just past it, so the tear visibly sweeps across the stub.
 */
export function tearClips(
  axis: TearAxis,
  at: number,
  extent: number,
): { intact: string; torn: string } {
  return {
    intact: clip(axis, () => extent + SHADOW_ROOM),
    torn: clip(axis, (offset) => at + offset),
  };
}

/**
 * Where the perforation of a rendered ticket is: under the poster when the
 * poster spans the ticket's width, else on its right.
 */
export function measureTear(
  ticket: { width: number; height: number; left: number; top: number },
  poster: { width: number; height: number; left: number; top: number },
): { axis: TearAxis; at: number; extent: number } {
  return poster.width >= ticket.width * 0.9
    ? {
        axis: "horizontal",
        at: poster.top - ticket.top + poster.height,
        extent: ticket.height,
      }
    : {
        axis: "vertical",
        at: poster.left - ticket.left + poster.width,
        extent: ticket.width,
      };
}
