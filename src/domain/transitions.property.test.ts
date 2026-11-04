import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { MovieStatus } from "./movie";
import { nextStatus, type MovieAction } from "./transitions";

const STATUSES: readonly MovieStatus[] = ["to_watch", "watched", "rejected"];
const action = fc.constantFrom<MovieAction>(
  "search_add",
  "remove",
  "mark_watched",
  "unwatch",
);

describe("nextStatus (propriétés)", () => {
  it("toute suite d'actions laisse un statut valide (un refus laisse le statut tel quel)", () =>
    fc.assert(
      fc.property(
        fc.option(fc.constantFrom(...STATUSES), { nil: null }),
        fc.array(action, { maxLength: 30 }),
        (start, actions) => {
          let status = start;
          for (const a of actions) {
            const next = nextStatus(status, a);
            if (next !== null) status = next;
            if (status !== null) expect(STATUSES).toContain(status);
          }
        },
      ),
    ));

  it("un film jamais enregistré ne peut qu'être ajouté", () =>
    fc.assert(
      fc.property(action, (a) => {
        expect(nextStatus(null, a)).toBe(
          a === "search_add" ? "to_watch" : null,
        );
      }),
    ));
});
