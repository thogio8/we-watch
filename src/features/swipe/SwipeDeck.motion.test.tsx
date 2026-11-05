// @vitest-environment jsdom
// Own file: motion reads `prefers-reduced-motion` once per module, and these
// tests need the real fly-out (SwipeDeck.test.tsx runs reduced motion).
import { readFileSync } from "node:fs";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { aSnapshot } from "@tests/helpers/movies";
import { stubMatchMedia } from "@tests/helpers/dom";
import type { MovieSnapshot } from "@/domain/movie";
import type { SwipeOutcome } from "@/domain/transitions";
import type { SwipeDecision } from "./actions";
import { SwipeDeck } from "./SwipeDeck";

const card = (tmdbId: number, title: string): MovieSnapshot =>
  aSnapshot(tmdbId, { title });

const APPLIED: SwipeOutcome = { result: "applied", matched: false };
const WHIPLASH = card(244786, "WHIPLASH");
const CHIHIRO = card(129, "LE VOYAGE DE CHIHIRO");

beforeEach(() => {
  stubMatchMedia({ reducedMotion: false });
});

function renderTwoCards(
  decide: (tmdbId: number, decision: SwipeDecision) => Promise<SwipeOutcome>,
  first: MovieSnapshot = WHIPLASH,
) {
  const user = userEvent.setup();
  render(
    <SwipeDeck
      initial={{
        ok: true,
        batch: { cards: [first, CHIHIRO], nextPage: null },
      }}
      deck="top"
      decide={decide}
      undo={() => Promise.resolve("applied")}
      loadMore={() => Promise.resolve({ ok: false })}
      groupSize={2}
    />,
  );
  return user;
}

describe("SwipeDeck (animations actives)", () => {
  it("un double tap pendant l'envol ne décide qu'une carte", async () => {
    const decide = vi.fn(() => Promise.resolve(APPLIED));
    const user = renderTwoCards(decide);

    await user.dblClick(screen.getByRole("button", { name: "ON LE VEUT ♥" }));

    expect(decide).toHaveBeenCalledExactlyOnceWith(244786, "keep");
  });

  it("un échec pendant l'envol de l'avant-dernière carte rend la main aux boutons", async () => {
    // The save fails while the card is still flying out (~350 ms): it comes
    // back, and with two cards no other exit is left to release the buttons.
    const decide = vi
      .fn<(tmdbId: number, decision: SwipeDecision) => Promise<SwipeOutcome>>()
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("offline")), 100),
          ),
      )
      .mockResolvedValue(APPLIED);
    const user = renderTwoCards(decide);
    const keep = () => screen.getByRole("button", { name: "ON LE VEUT ♥" });
    const deck = () => screen.getByRole("region", { name: "Film à trier" });

    await user.click(keep());
    expect(deck()).toHaveAttribute("aria-busy", "true");
    await screen.findByRole("alert");
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
        "WHIPLASH",
      ),
    );
    await waitFor(() => expect(deck()).not.toHaveAttribute("aria-busy"), {
      timeout: 1500,
    });
    await user.click(keep());

    expect(decide).toHaveBeenCalledTimes(2);
    expect(decide).toHaveBeenLastCalledWith(244786, "keep");
  });
});

describe("SwipeDeck : le moment du match en mouvement", () => {
  it("s'ouvre pendant l'envol de la carte, CONTINUER au focus", async () => {
    const wanted = { ...WHIPLASH, wish: { others: ["Becca"], matched: false } };
    const user = renderTwoCards(
      () => Promise.resolve({ result: "applied", matched: true }),
      wanted,
    );

    await user.click(screen.getByRole("button", { name: "ON LE VEUT ♥" }));

    const dialog = await screen.findByRole("dialog", {
      name: "C’EST UN MATCH",
    });
    expect(screen.getByRole("button", { name: "CONTINUER ▸" })).toHaveFocus();
    expect(dialog).toBeVisible();
  });

  it("mouvement réduit : le tampon s'imprime sans rebond", () => {
    // jsdom applies no stylesheet: the rule itself is the contract.
    const css = readFileSync(
      "src/features/swipe/MatchMoment.module.css",
      "utf8",
    );
    const reduced = css.slice(
      css.indexOf("@media (prefers-reduced-motion: reduce)"),
    );

    expect(css).toMatch(/\.stamp \{[^}]*animation: thump /);
    expect(reduced).toMatch(/^@media[^{]*\{\s*\.stamp \{\s*animation: none;/);
  });
});
