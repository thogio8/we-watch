// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { aSnapshot, PRIME } from "@tests/helpers/movies";
import { stubMatchMedia } from "@tests/helpers/dom";
import type { ApplyResult, SwipeOutcome } from "@/domain/transitions";
import type { MovieSnapshot } from "@/domain/movie";
import type { DeckId } from "@/tmdb/decks";
import type { LoadMoreResult, SwipeDecision } from "./actions";
import type { DeckBatch } from "./deck";
import {
  CONTINUE,
  MATCH_HINT,
  MATCH_KEPT,
  MATCH_TEXT,
  MATCH_TITLE,
  SEE_LIST,
} from "./messages";
import { SwipeDeck } from "./SwipeDeck";

const snapshot = (
  tmdbId: number,
  title: string,
  overrides: Partial<MovieSnapshot> = {},
) =>
  aSnapshot(tmdbId, {
    title,
    releaseYear: 2014,
    runtimeMinutes: 107,
    overview: `Résumé de ${title}.`,
    voteAverage: 8.38,
    providers: [PRIME],
    ...overrides,
  });

const WHIPLASH = snapshot(244786, "WHIPLASH");
const CHIHIRO = snapshot(129, "LE VOYAGE DE CHIHIRO", { providers: [] });
const PARASITE = snapshot(496243, "PARASITE");
const AMELIE = snapshot(194, "LE FABULEUX DESTIN D'AMÉLIE POULAIN");

const ok = (cards: MovieSnapshot[], nextPage: number | null) =>
  ({ ok: true, batch: { cards, nextPage } satisfies DeckBatch }) as const;

type Decide = (
  tmdbId: number,
  decision: SwipeDecision,
) => Promise<SwipeOutcome>;
type Undo = (tmdbId: number, decision: SwipeDecision) => Promise<ApplyResult>;
const outcome = (result: ApplyResult): SwipeOutcome => ({
  result,
  matched: false,
});
type LoadMore = (deck: DeckId, page: number) => Promise<LoadMoreResult>;

function renderDeck(
  initial: LoadMoreResult,
  {
    deck = "top",
    decide = vi.fn<Decide>(() => Promise.resolve(outcome("applied"))),
    undo = vi.fn<Undo>(() => Promise.resolve("applied")),
    loadMore = vi.fn<LoadMore>(() => Promise.resolve(ok([], null))),
    groupSize = 2,
  }: {
    deck?: DeckId;
    decide?: Decide;
    undo?: Undo;
    loadMore?: LoadMore;
    groupSize?: number;
  } = {},
) {
  const user = userEvent.setup();
  render(
    <SwipeDeck
      deck={deck}
      initial={initial}
      decide={decide}
      undo={undo}
      loadMore={loadMore}
      groupSize={groupSize}
    />,
  );
  return { user, decide, undo, loadMore };
}

const currentTitle = () => screen.getByRole("heading", { level: 2 });

/** Taps a deck button, then waits until the leaving card is gone. */
async function tap(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("button", { name }));
  await waitFor(() => {
    const deck = screen.queryByRole("region", { name: "Film à trier" });
    expect(deck?.getAttribute("aria-busy") ?? null).toBeNull();
  });
}

beforeEach(() => {
  // Reduced motion: no fly-out, cards swap immediately.
  stubMatchMedia({ reducedMotion: true });
});

describe("SwipeDeck", () => {
  it("place la pastille du groupe dans le landmark main, avant le thème", () => {
    render(
      <SwipeDeck
        deck="top"
        initial={ok([WHIPLASH], null)}
        decide={vi.fn<Decide>()}
        undo={vi.fn<Undo>()}
        loadMore={vi.fn<LoadMore>()}
        groupSize={2}
        pill={<button type="button">PASTILLE</button>}
      />,
    );

    const main = within(screen.getByRole("main"));
    expect(main.getByRole("button", { name: "PASTILLE" })).toBeVisible();
    expect(main.getByRole("heading", { level: 1 })).toBeVisible();
  });

  it("affiche le ticket de la première carte comme la maquette", () => {
    renderDeck(ok([WHIPLASH, CHIHIRO, PARASITE], 2));

    expect(
      screen.getByRole("heading", { level: 1, name: "LES MIEUX NOTÉS" }),
    ).toBeVisible();
    // Only the top ticket is exposed; the one behind it is hidden.
    const ticket = within(screen.getByRole("article"));
    expect(ticket.getByRole("heading", { name: "WHIPLASH" })).toBeVisible();
    expect(ticket.getByText("2014 · 1h47 · ★8,4")).toBeVisible();
    expect(ticket.getByText("Résumé de WHIPLASH.")).toBeVisible();
    // Platform stamp on the poster: the first FR platform.
    expect(ticket.getByText("Amazon Prime Video")).toBeVisible();
    expect(screen.getByRole("button", { name: "✕ BOF" })).toBeVisible();
    expect(screen.getByRole("button", { name: "ON LE VEUT ♥" })).toBeVisible();
  });

  it("un film sans plateforme porte le tampon « PAS EN STREAMING »", () => {
    renderDeck(ok([CHIHIRO], null));

    expect(screen.getByText("PAS EN STREAMING")).toBeVisible();
  });

  it("ON LE VEUT appelle decide(id, 'keep') et passe à la carte suivante", async () => {
    const { user, decide } = renderDeck(ok([WHIPLASH, CHIHIRO, PARASITE], 2));

    await tap(user, "ON LE VEUT ♥");

    expect(decide).toHaveBeenCalledExactlyOnceWith(244786, "keep");
    expect(currentTitle()).toHaveTextContent("LE VOYAGE DE CHIHIRO");
  });

  it("BOF appelle decide(id, 'reject')", async () => {
    const { user, decide } = renderDeck(ok([WHIPLASH, CHIHIRO, PARASITE], 2));

    await tap(user, "✕ BOF");

    expect(decide).toHaveBeenCalledExactlyOnceWith(244786, "reject");
    expect(currentTitle()).toHaveTextContent("LE VOYAGE DE CHIHIRO");
  });

  it("un double tap ne décide qu'une carte", async () => {
    const { user, decide } = renderDeck(ok([WHIPLASH, CHIHIRO, PARASITE], 2));

    await user.dblClick(screen.getByRole("button", { name: "ON LE VEUT ♥" }));

    expect(decide).toHaveBeenCalledExactlyOnceWith(244786, "keep");
  });

  it("précharge la page suivante sous 3 cartes et ignore les doublons", async () => {
    const loadMore = vi.fn<LoadMore>(() =>
      // CHIHIRO is still queued, WHIPLASH was just decided: both are dropped.
      Promise.resolve(ok([CHIHIRO, WHIPLASH, AMELIE], 3)),
    );
    const { user } = renderDeck(ok([WHIPLASH, CHIHIRO, PARASITE], 2), {
      loadMore,
    });
    expect(loadMore).not.toHaveBeenCalled();

    await tap(user, "ON LE VEUT ♥");

    await waitFor(() =>
      expect(loadMore).toHaveBeenCalledExactlyOnceWith("top", 2),
    );
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      seen.push(currentTitle().textContent);
      await tap(user, "✕ BOF");
    }
    expect(seen).toEqual([
      "LE VOYAGE DE CHIHIRO",
      "PARASITE",
      "LE FABULEUX DESTIN D'AMÉLIE POULAIN",
    ]);
  });

  it("un lot vide avec une page suivante relance le chargement au lieu de finir", async () => {
    const loadMore = vi
      .fn<LoadMore>()
      .mockResolvedValueOnce(ok([], 7))
      .mockResolvedValueOnce(ok([PARASITE], null));
    renderDeck(ok([], 2), { loadMore });

    expect(screen.getByText("ON CHERCHE DES FILMS…")).toBeVisible();
    expect(screen.queryByText(/VOUS AVEZ TOUT VU/)).not.toBeInTheDocument();

    expect(await screen.findByRole("heading", { level: 2 })).toHaveTextContent(
      "PARASITE",
    );
    expect(loadMore.mock.calls).toEqual([
      ["top", 2],
      ["top", 7],
    ]);
  });

  it("les boutons répondent encore quand les cartes arrivent après une attente", async () => {
    let deliver: (result: LoadMoreResult) => void = () => {};
    const loadMore = vi.fn<LoadMore>(
      () => new Promise((resolve) => (deliver = resolve)),
    );
    const { user, decide } = renderDeck(ok([WHIPLASH], 2), { loadMore });

    await tap(user, "✕ BOF");
    expect(screen.getByText("ON CHERCHE DES FILMS…")).toBeVisible();
    deliver(ok([CHIHIRO], null));
    await screen.findByRole("heading", { name: "LE VOYAGE DE CHIHIRO" });
    await tap(user, "ON LE VEUT ♥");

    expect(decide).toHaveBeenLastCalledWith(129, "keep");
  });

  it("decide en échec → la carte revient et un message s'affiche", async () => {
    const decide = vi
      .fn<Decide>()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue(outcome("applied"));
    const { user } = renderDeck(ok([WHIPLASH, CHIHIRO, PARASITE], null), {
      decide,
    });

    await tap(user, "ON LE VEUT ♥");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "PAS RÉUSSI À ENREGISTRER, RÉESSAIE",
    );
    await waitFor(() => expect(currentTitle()).toHaveTextContent("WHIPLASH"));

    await tap(user, "ON LE VEUT ♥");

    expect(decide).toHaveBeenLastCalledWith(244786, "keep");
    expect(currentTitle()).toHaveTextContent("LE VOYAGE DE CHIHIRO");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("plus de cartes ni de page → écran de fin", async () => {
    const { user, loadMore } = renderDeck(ok([WHIPLASH], null));

    await tap(user, "✕ BOF");

    expect(
      screen.getByRole("heading", { name: "VOUS AVEZ TOUT VU (OU PRESQUE)" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "ALLER TIRER" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(loadMore).not.toHaveBeenCalled();
  });

  it("initial { ok: false } → écran d'erreur avec RÉESSAYER", async () => {
    const loadMore = vi.fn<LoadMore>(() =>
      Promise.resolve(ok([WHIPLASH], null)),
    );
    const { user } = renderDeck({ ok: false }, { loadMore });

    expect(
      screen.getByRole("heading", { name: "TMDB NE RÉPOND PAS" }),
    ).toBeVisible();
    expect(loadMore).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "RÉESSAYER" }));

    expect(loadMore).toHaveBeenCalledExactlyOnceWith("top", 1);
    expect(
      await screen.findByRole("heading", { name: "WHIPLASH" }),
    ).toBeVisible();
  });

  it("un chargement rejeté sans carte restante → écran d'erreur", async () => {
    const loadMore = vi.fn<LoadMore>(() => Promise.reject(new Error("down")));
    renderDeck(ok([], 2), { loadMore });

    expect(
      await screen.findByRole("heading", { name: "TMDB NE RÉPOND PAS" }),
    ).toBeVisible();
  });
});

describe("SwipeDeck : thèmes", () => {
  it("une puce par thème, le thème courant en titre et marqué", () => {
    renderDeck(ok([WHIPLASH], null), { deck: "animation" });

    expect(
      screen.getByRole("heading", { level: 1, name: "ANIMATION" }),
    ).toBeVisible();
    const themes = within(screen.getByRole("navigation", { name: "Thèmes" }));
    expect(themes.getAllByRole("link")).toHaveLength(7);
    expect(themes.getByRole("link", { name: "ANIMATION" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      themes.getByRole("link", { name: "LES MIEUX NOTÉS" }),
    ).toHaveAttribute("href", "/swipe");
    expect(themes.getByRole("link", { name: "ANNÉES 90" })).toHaveAttribute(
      "href",
      "/swipe?deck=nineties",
    );
  });

  it("charge la suite dans le thème courant", async () => {
    const loadMore = vi.fn<LoadMore>(() => Promise.resolve(ok([], null)));
    renderDeck(ok([WHIPLASH], 2), { deck: "korean", loadMore });

    await waitFor(() =>
      expect(loadMore).toHaveBeenCalledExactlyOnceWith("korean", 2),
    );
  });

  it("l'écran de fin garde les thèmes pour en changer", async () => {
    const { user } = renderDeck(ok([WHIPLASH], null), { deck: "korean" });

    await tap(user, "✕ BOF");

    expect(
      screen.getByRole("heading", { name: "VOUS AVEZ TOUT VU (OU PRESQUE)" }),
    ).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Thèmes" })).toBeVisible();
  });
});

describe("SwipeDeck : bande-annonce", () => {
  it("le ticket propose la bande-annonce quand TMDB en a une", () => {
    renderDeck(ok([{ ...WHIPLASH, trailerKey: "7d_jQycdQGo" }], null));

    expect(
      within(screen.getByRole("article")).getByRole("link", {
        name: "Bande-annonce de WHIPLASH (YouTube)",
      }),
    ).toHaveAttribute("href", "https://www.youtube.com/watch?v=7d_jQycdQGo");
  });
});

describe("SwipeDeck : annuler le dernier swipe", () => {
  const undoButton = () => screen.getByRole("button", { name: "↺ ANNULER" });

  it("propose d'annuler et remet la carte en tête", async () => {
    const { user, undo } = renderDeck(ok([WHIPLASH, CHIHIRO, PARASITE], null));

    await tap(user, "ON LE VEUT ♥");
    expect(screen.getByRole("status")).toHaveTextContent("♥ WHIPLASH");

    await user.click(undoButton());

    expect(currentTitle()).toHaveTextContent("WHIPLASH");
    await waitFor(() =>
      expect(undo).toHaveBeenCalledExactlyOnceWith(244786, "keep"),
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("n'offre que le dernier swipe", async () => {
    const { user, undo } = renderDeck(ok([WHIPLASH, CHIHIRO, PARASITE], null));

    await tap(user, "ON LE VEUT ♥");
    await tap(user, "✕ BOF");
    expect(screen.getByRole("status")).toHaveTextContent(
      "✕ LE VOYAGE DE CHIHIRO",
    );
    await user.click(undoButton());

    await waitFor(() =>
      expect(undo).toHaveBeenCalledExactlyOnceWith(129, "reject"),
    );
    expect(currentTitle()).toHaveTextContent("LE VOYAGE DE CHIHIRO");
  });

  it("attend la fin de l'enregistrement avant d'annuler", async () => {
    let saved: (result: SwipeOutcome) => void = () => {};
    const decide = vi.fn<Decide>(
      () => new Promise((resolve) => (saved = resolve)),
    );
    const { user, undo } = renderDeck(ok([WHIPLASH, CHIHIRO], null), {
      decide,
    });

    await tap(user, "ON LE VEUT ♥");
    await user.click(undoButton());
    expect(undo).not.toHaveBeenCalled();

    saved(outcome("applied"));
    await waitFor(() => expect(undo).toHaveBeenCalledOnce());
  });

  it("un swipe déjà décidé ailleurs ne s'efface pas", async () => {
    const decide = vi.fn<Decide>(() => Promise.resolve(outcome("noop")));
    const { user, undo } = renderDeck(ok([WHIPLASH, CHIHIRO], null), {
      decide,
    });

    await tap(user, "ON LE VEUT ♥");
    await user.click(undoButton());

    expect(currentTitle()).toHaveTextContent("WHIPLASH");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(undo).not.toHaveBeenCalled();
  });

  it("une nouvelle décision attend l'annulation", async () => {
    let undone: (result: ApplyResult) => void = () => {};
    const undo = vi.fn<Undo>(
      () => new Promise((resolve) => (undone = resolve)),
    );
    const { user, decide } = renderDeck(ok([WHIPLASH, CHIHIRO], null), {
      undo,
    });

    await tap(user, "ON LE VEUT ♥");
    await user.click(undoButton());
    await waitFor(() => expect(undo).toHaveBeenCalledOnce());
    await tap(user, "✕ BOF");
    expect(decide).toHaveBeenCalledOnce();

    undone("applied");
    await waitFor(() =>
      expect(decide).toHaveBeenLastCalledWith(244786, "reject"),
    );
  });

  it("une annulation en échec le dit et la carte repart", async () => {
    const undo = vi.fn<Undo>(() => Promise.reject(new Error("offline")));
    const { user } = renderDeck(ok([WHIPLASH, CHIHIRO], null), { undo });

    await tap(user, "ON LE VEUT ♥");
    await user.click(undoButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "PAS RÉUSSI À ANNULER",
    );
    // Still saved as kept: the next card is back on top.
    await waitFor(() =>
      expect(currentTitle()).toHaveTextContent("LE VOYAGE DE CHIHIRO"),
    );
  });

  it("un vieil échec d'enregistrement ne ressuscite pas une carte re-décidée", async () => {
    let failFirst: (error: Error) => void = () => {};
    const decide = vi
      .fn<Decide>()
      .mockImplementationOnce(
        () => new Promise((_, reject) => (failFirst = reject)),
      )
      .mockResolvedValue(outcome("applied"));
    const { user } = renderDeck(ok([WHIPLASH, CHIHIRO], null), { decide });

    await tap(user, "ON LE VEUT ♥");
    await user.click(undoButton());
    await tap(user, "✕ BOF");
    failFirst(new Error("offline"));

    await waitFor(() =>
      expect(decide).toHaveBeenLastCalledWith(244786, "reject"),
    );
    expect(currentTitle()).toHaveTextContent("LE VOYAGE DE CHIHIRO");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("un enregistrement en échec retire l'offre d'annuler", async () => {
    const decide = vi.fn<Decide>(() => Promise.reject(new Error("offline")));
    const { user } = renderDeck(ok([WHIPLASH, CHIHIRO], null), { decide });

    await tap(user, "ON LE VEUT ♥");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "PAS RÉUSSI À ENREGISTRER, RÉESSAIE",
    );
    expect(
      screen.queryByRole("button", { name: "↺ ANNULER" }),
    ).not.toBeInTheDocument();
  });
});

/** The line under the card, exactly: getByText would fold no-break spaces. */
const line = () =>
  screen.queryByText(/(C’EST UN MATCH|IL LE RESTE)\.$/)?.textContent ?? null;

describe("SwipeDeck : un film que le groupe veut", () => {
  const wanted = (others: string[], matched = false) => ({
    ...AMELIE,
    wish: { others, matched },
  });
  const ticket = () => within(screen.getByRole("article"));
  /** Exact text: getByText would fold no-break spaces. */
  const banner = () =>
    ticket().queryByText(/LE VEU(T|LENT)$/)?.textContent ?? null;

  it("porte le bandeau de Becca et la ligne du match quand seule mon envie manque", () => {
    renderDeck(ok([wanted(["Becca"]), WHIPLASH], null), { groupSize: 2 });

    expect(banner()).toBe("♥ BECCA LE VEUT");
    expect(line()).toBe(MATCH_HINT);
    expect(ticket().queryByText(/MATCH/)).not.toBeInTheDocument();
  });

  it("à trois, voulu par un seul autre membre : le bandeau, sans la ligne", () => {
    renderDeck(ok([wanted(["Léa"])], null), { groupSize: 3 });

    expect(banner()).toBe("♥ LÉA LE VEUT");
    expect(line()).toBeNull();
  });

  it("au-delà de trois prénoms, le bandeau compte les membres", () => {
    const others = ["Léa", "Hugo", "Sam", "Becca"];
    renderDeck(ok([wanted(others)], null), { groupSize: 5 });

    expect(banner()).toBe("♥ 4 MEMBRES LE VEULENT");
    expect(line()).toBe(MATCH_HINT);
  });

  it("un match d'avant mon arrivée : le petit tampon et sa ligne", () => {
    renderDeck(ok([wanted(["Léa", "Hugo"], true)], null), { groupSize: 4 });

    expect(banner()).toBe("♥ LÉA ET HUGO LE VEULENT");
    expect(ticket().getByText(/MATCH$/)).toHaveTextContent("♥♥ MATCH");
    expect(line()).toBe(MATCH_KEPT);
  });

  it("une carte du thème n'a ni bandeau ni ligne", () => {
    renderDeck(ok([WHIPLASH], null));

    expect(banner()).toBeNull();
    expect(line()).toBeNull();
  });

  it("la ligne suit la carte du dessus", async () => {
    const { user } = renderDeck(ok([wanted(["Becca"]), WHIPLASH], null));

    await tap(user, "✕ BOF");

    expect(currentTitle()).toHaveTextContent("WHIPLASH");
    expect(line()).toBeNull();
  });
});

describe("SwipeDeck : le moment du match", () => {
  const LAST_WISH = { ...AMELIE, wish: { others: ["Becca"], matched: false } };
  const MATCHED: SwipeOutcome = { result: "applied", matched: true };
  const moment = () => screen.queryByRole("dialog", { name: "C’EST UN MATCH" });
  const deckRegion = () => screen.getByRole("region", { name: "Film à trier" });

  /** Keeps the last wished card; the server answers `answer`. */
  async function keepLastWish(answer: SwipeOutcome, more = [WHIPLASH]) {
    const decide = vi.fn<Decide>(() => Promise.resolve(answer));
    const rendered = renderDeck(ok([LAST_WISH, ...more], null), { decide });
    await tap(rendered.user, "ON LE VEUT ♥");
    await waitFor(() => expect(decide).toHaveBeenCalledOnce());
    return rendered;
  }

  it("s'ouvre quand le serveur dit que mon swipe a fait le match", async () => {
    await keepLastWish(MATCHED);

    const dialog = await screen.findByRole("dialog", {
      name: "C’EST UN MATCH",
    });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription(`${MATCH_TITLE} ${MATCH_TEXT}`);
    const inside = within(dialog);
    expect(inside.getByText(MATCH_TITLE)).toBeVisible();
    expect(inside.getByRole("link", { name: SEE_LIST })).toHaveAttribute(
      "href",
      "/list",
    );
    expect(inside.getByRole("button", { name: CONTINUE })).toHaveFocus();
  });

  it("ne s'ouvre pas sur une prédiction : le serveur dit qu'il n'y a pas de match", async () => {
    await keepLastWish({ result: "applied", matched: false });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(moment()).not.toBeInTheDocument();
  });

  it("CONTINUER le ferme et rend le focus à la pile", async () => {
    const { user } = await keepLastWish(MATCHED);
    await screen.findByRole("dialog");

    await user.click(screen.getByRole("button", { name: CONTINUE }));

    expect(moment()).not.toBeInTheDocument();
    expect(deckRegion()).toHaveFocus();
    expect(currentTitle()).toHaveTextContent("WHIPLASH");
  });

  it("Échap le ferme", async () => {
    const { user } = await keepLastWish(MATCHED);
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");

    expect(moment()).not.toBeInTheDocument();
    expect(deckRegion()).toHaveFocus();
  });

  it("la pile reste inerte derrière le moment, puis répond de nouveau", async () => {
    const { user, decide } = await keepLastWish(MATCHED);
    await screen.findByRole("dialog");
    const keep = () => screen.getByRole("button", { name: "ON LE VEUT ♥" });

    expect(deckRegion()).toHaveAttribute("inert");
    expect(keep().closest("[inert]")).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "✕ BOF" }).closest("[inert]"),
    ).not.toBeNull();

    await user.click(screen.getByRole("button", { name: CONTINUE }));

    expect(deckRegion()).not.toHaveAttribute("inert");
    expect(keep().closest("[inert]")).toBeNull();
    await tap(user, "ON LE VEUT ♥");
    expect(decide).toHaveBeenLastCalledWith(244786, "keep");
  });

  it("Échap hors du moment ne le ferme pas", async () => {
    const { user } = await keepLastWish(MATCHED);
    await screen.findByRole("dialog");

    screen.getByRole("button", { name: "↺ ANNULER" }).focus();
    await user.keyboard("{Escape}");

    expect(moment()).toBeInTheDocument();
  });

  it("après la dernière carte, le focus revient à la page", async () => {
    const { user } = await keepLastWish(MATCHED, []);
    await screen.findByRole("dialog");

    await user.click(screen.getByRole("button", { name: CONTINUE }));

    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("ANNULER le ferme et défait le match côté serveur", async () => {
    const { user, undo } = await keepLastWish(MATCHED);
    await screen.findByRole("dialog");

    await user.click(screen.getByRole("button", { name: "↺ ANNULER" }));

    expect(moment()).not.toBeInTheDocument();
    await waitFor(() =>
      expect(undo).toHaveBeenCalledExactlyOnceWith(194, "keep"),
    );
    expect(currentTitle()).toHaveTextContent(AMELIE.title);
    expect(line()).toBe(MATCH_HINT);
    expect(deckRegion()).toHaveFocus();
  });

  it("ANNULER reste proposé tant que le moment est ouvert, puis 5 s encore", async () => {
    // Only the dismiss timers: motion's frame loop keeps the real clock.
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout"],
      shouldAdvanceTime: true,
    });
    try {
      const { user } = await keepLastWish(MATCHED);
      await screen.findByRole("dialog");

      act(() => vi.advanceTimersByTime(60_000));
      expect(screen.getByRole("button", { name: "↺ ANNULER" })).toBeVisible();

      await user.click(screen.getByRole("button", { name: CONTINUE }));
      act(() => vi.advanceTimersByTime(4_000));
      expect(screen.getByRole("button", { name: "↺ ANNULER" })).toBeVisible();
      act(() => vi.advanceTimersByTime(1_000));
      expect(
        screen.queryByRole("button", { name: "↺ ANNULER" }),
      ).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("une réponse « match » arrivée après une nouvelle décision sur la même carte n'ouvre rien", async () => {
    let answer: (outcome: SwipeOutcome) => void = () => {};
    const decide = vi
      .fn<Decide>()
      .mockImplementationOnce(
        () => new Promise((resolve) => (answer = resolve)),
      )
      .mockResolvedValue({ result: "applied", matched: false });
    const { user } = renderDeck(ok([LAST_WISH, WHIPLASH], null), { decide });

    await tap(user, "ON LE VEUT ♥");
    await user.click(screen.getByRole("button", { name: "↺ ANNULER" }));
    await tap(user, "✕ BOF");
    answer(MATCHED);

    await waitFor(() => expect(decide).toHaveBeenLastCalledWith(194, "reject"));
    expect(moment()).not.toBeInTheDocument();
  });
});
