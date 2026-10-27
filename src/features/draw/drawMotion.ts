import type { Variants } from "motion/react";
import { TICKET_POSTER_ATTR } from "@/ui/Ticket";
import { measureTear, tearClips } from "./tear";

/**
 * How the current view leaves the screen: torn into the pile along the
 * ticket's perforation (measured on RETIRER), or a plain fade.
 */
export type Exit =
  { kind: "tear"; clips: { intact: string; torn: string } } | { kind: "fade" };

export const FADE: Exit = { kind: "fade" };

const STILL: Variants = { hidden: {}, shown: {}, exit: {} };

/** The perforation of the ticket on screen, read when it is torn. */
export function tearOf(wrapper: HTMLElement | null): {
  intact: string;
  torn: string;
} {
  const poster = wrapper?.querySelector(`[${TICKET_POSTER_ATTR}]`);
  if (!wrapper || !poster) return tearClips("horizontal", 290, 540);
  const { axis, at, extent } = measureTear(
    wrapper.getBoundingClientRect(),
    poster.getBoundingClientRect(),
  );
  return tearClips(axis, at, extent);
}

export function viewVariants(reduce: boolean): Variants {
  if (reduce) return STILL;
  return {
    hidden: { opacity: 0 },
    shown: { opacity: 1, transition: { duration: 0.2 } },
    // A torn ticket needs the screen to stay put while it falls onto the pile.
    exit: (exit: Exit) =>
      exit.kind === "tear"
        ? {}
        : { opacity: 0, transition: { duration: 0.15 } },
  };
}

export function ticketVariants(reduce: boolean): Variants {
  if (reduce) return STILL;
  return {
    // Slides out of the ticket machine.
    hidden: { y: -60, rotate: -3, opacity: 0 },
    shown: {
      y: 0,
      rotate: 0,
      opacity: 1,
      transition: { type: "spring", stiffness: 260, damping: 22 },
    },
    // « RETIRER »: torn along the perforation, then dropped onto the pile.
    exit: (exit: Exit) => {
      if (exit.kind !== "tear") {
        return { opacity: 0, transition: { duration: 0.15 } };
      }
      const { intact, torn } = exit.clips;
      return {
        clipPath: [intact, torn, torn],
        rotate: [0, -4, -14],
        y: [0, 6, 220],
        scale: [1, 1, 0.2],
        opacity: [1, 1, 0],
        transition: { duration: 0.6, times: [0, 0.35, 1], ease: "easeIn" },
      };
    },
  };
}

export function stampVariants(reduce: boolean): Variants {
  if (reduce) return STILL;
  return {
    // Falls onto the ticket with a slight spin.
    hidden: { opacity: 0, scale: 2.4, rotate: 16 },
    shown: {
      opacity: 1,
      scale: 1,
      rotate: 0,
      transition: { delay: 0.35, type: "spring", stiffness: 520, damping: 20 },
    },
  };
}
