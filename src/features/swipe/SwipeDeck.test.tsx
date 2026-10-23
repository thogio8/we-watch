// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MovieSnapshot } from "@/domain/movie";
import type { LoadMoreResult, SwipeDecision } from "./actions";
import type { DeckBatch } from "./deck";
import { SwipeDeck } from "./SwipeDeck";

function snapshot(
  tmdbId: number,
  title: string,
  overrides: Partial<MovieSnapshot> = {},
): MovieSnapshot {
  return {
    tmdbId,
    title,
    releaseYear: 2014,
    runtimeMinutes: 107,
    overview: `Résumé de ${title}.`,
    posterPath: null,
    voteAverage: 8.38,
    providers: [{ id: 119, name: "Amazon Prime Video", logoPath: null }],
    ...overrides,
  };
}

const WHIPLASH = snapshot(244786, "WHIPLASH");
const CHIHIRO = snapshot(129, "LE VOYAGE DE CHIHIRO", { providers: [] });
const PARASITE = snapshot(496243, "PARASITE");
const AMELIE = snapshot(194, "LE FABULEUX DESTIN D'AMÉLIE POULAIN");

const ok = (cards: MovieSnapshot[], nextPage: number | null) =>
  ({ ok: true, batch: { cards, nextPage } satisfies DeckBatch }) as const;

type Decide = (tmdbId: number, decision: SwipeDecision) => Promise<void>;
type LoadMore = (page: number) => Promise<LoadMoreResult>;

function renderDeck(
  initial: LoadMoreResult,
  {
    decide = vi.fn<Decide>(() => Promise.resolve()),
    loadMore = vi.fn<LoadMore>(() => Promise.resolve(ok([], null))),
  }: { decide?: Decide; loadMore?: LoadMore } = {},
) {
  const user = userEvent.setup();
  render(<SwipeDeck initial={initial} decide={decide} loadMore={loadMore} />);
  return { user, decide, loadMore };
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
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) satisfies MediaQueryList,
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("SwipeDeck", () => {
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

    await waitFor(() => expect(loadMore).toHaveBeenCalledExactlyOnceWith(2));
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
    expect(loadMore.mock.calls).toEqual([[2], [7]]);
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
      .mockResolvedValue(undefined);
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

    expect(loadMore).toHaveBeenCalledExactlyOnceWith(1);
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
