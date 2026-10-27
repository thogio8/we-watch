// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Movie } from "@/domain/movie";
import { DrawScreen } from "./DrawScreen";
import { DrawSessionProvider } from "./DrawSessionProvider";

function movie(tmdbId: number, title: string, overrides: Partial<Movie> = {}) {
  return {
    tmdbId,
    title,
    releaseYear: 2001,
    runtimeMinutes: 125,
    overview: `Résumé de ${title}.`,
    posterPath: null,
    voteAverage: 8.54,
    providers: [{ id: 8, name: "Netflix", logoPath: null }],
    genreIds: [],
    trailerKey: null,
    status: "to_watch",
    decidedAt: new Date(2026, 9, 1),
    watchedAt: null,
    ...overrides,
  } satisfies Movie;
}

const CHIHIRO = movie(129, "LE VOYAGE DE CHIHIRO");
const WHIPLASH = movie(244786, "WHIPLASH", { runtimeMinutes: 107 });

interface Props {
  toWatch: Movie[];
  watched?: number;
  onWatched?: (tmdbId: number) => Promise<void>;
}

function screenFor({ toWatch, watched = 0, onWatched }: Props): ReactNode {
  return (
    <DrawScreen
      toWatch={toWatch}
      counts={{ toWatch: toWatch.length, watched }}
      onWatched={onWatched ?? (() => Promise.resolve())}
    />
  );
}

function renderDraw(props: Props) {
  const user = userEvent.setup();
  const view = render(
    <DrawSessionProvider>{screenFor(props)}</DrawSessionProvider>,
  );
  const rerender = (next: Props) =>
    view.rerender(<DrawSessionProvider>{screenFor(next)}</DrawSessionProvider>);
  return { user, rerender };
}

const drawButton = () => screen.getByRole("button", { name: "TIRER UN FILM" });

beforeEach(() => {
  // Only the clock is frozen: user-event and motion keep real timers.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 23, 21, 7));
  vi.spyOn(Math, "random").mockReturnValue(0);
  // Reduced motion: animations resolve immediately.
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
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("DrawScreen", () => {
  it("l'accueil affiche les compteurs et l'heure courante", () => {
    renderDraw({ toWatch: [CHIHIRO, WHIPLASH], watched: 1 });

    expect(
      screen.getByRole("heading", { name: "CE SOIR ON REGARDE" }),
    ).toBeVisible();
    expect(screen.getByText("2 films à regarder · 1 vu")).toBeVisible();
    expect(screen.getByText("Il est 21H07")).toBeVisible();
    expect(drawButton()).toBeEnabled();
  });

  it("TIRER UN FILM affiche le ticket avec l'heure de fin", async () => {
    const { user } = renderDraw({ toWatch: [CHIHIRO] });

    await user.click(drawButton());

    expect(await screen.findByText("FINI À 23H12")).toBeVisible();
    const ticket = screen.getByRole("article");
    expect(
      within(ticket).getByRole("heading", { name: "LE VOYAGE DE CHIHIRO" }),
    ).toBeVisible();
    expect(within(ticket).getByText("2001 · 2h05 · ★8,5")).toBeVisible();
    expect(within(ticket).getByText("Netflix")).toBeVisible();
    expect(
      within(ticket).getByText("Résumé de LE VOYAGE DE CHIHIRO."),
    ).toBeVisible();
    expect(screen.queryByText(/PAS CE SOIR/)).not.toBeInTheDocument();
  });

  it("RETIRER empile et tire un autre film", async () => {
    const { user } = renderDraw({ toWatch: [CHIHIRO, WHIPLASH] });
    await user.click(drawButton());
    await screen.findByRole("heading", { name: "LE VOYAGE DE CHIHIRO" });

    await user.click(screen.getByRole("button", { name: "RETIRER" }));

    expect(
      await screen.findByRole("heading", { name: "WHIPLASH" }),
    ).toBeVisible();
    expect(screen.getByText(/^PAS CE SOIR\s: 1$/)).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "LE VOYAGE DE CHIHIRO" }),
    ).not.toBeInTheDocument();
  });

  it("tout retirer → VOUS ÊTES DIFFICILES CE SOIR, ON REMET TOUT relance", async () => {
    const { user } = renderDraw({ toWatch: [CHIHIRO] });
    await user.click(drawButton());
    await user.click(await screen.findByRole("button", { name: "RETIRER" }));

    expect(
      await screen.findByRole("heading", {
        name: "VOUS ÊTES DIFFICILES CE SOIR",
      }),
    ).toBeVisible();
    expect(
      screen.getByText("Le seul film de la liste est passé à la trappe"),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "ALLER SWIPER" })).toHaveAttribute(
      "href",
      "/swipe",
    );

    await user.click(screen.getByRole("button", { name: "ON REMET TOUT" }));

    expect(
      await screen.findByRole("heading", { name: "LE VOYAGE DE CHIHIRO" }),
    ).toBeVisible();
    expect(screen.queryByText(/PAS CE SOIR/)).not.toBeInTheDocument();
  });

  it("liste vide → seulement ALLER SWIPER", async () => {
    const { user } = renderDraw({ toWatch: [] });
    expect(screen.getByText("0 film à regarder · 0 vu")).toBeVisible();

    await user.click(drawButton());

    expect(
      await screen.findByRole("heading", { name: "RIEN À TIRER CE SOIR" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "ALLER SWIPER" })).toHaveAttribute(
      "href",
      "/swipe",
    );
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it.each([null, 0])("durée %s → DURÉE INCONNUE", async (runtimeMinutes) => {
    const { user } = renderDraw({
      toWatch: [movie(1, "SANS DURÉE", { runtimeMinutes, releaseYear: null })],
    });

    await user.click(drawButton());

    expect(await screen.findByText("DURÉE INCONNUE")).toBeVisible();
    expect(screen.queryByText(/FINI À/)).not.toBeInTheDocument();
    expect(screen.getByText("★8,5")).toBeVisible();
  });

  it("ON LE REGARDE appelle onWatched une seule fois et revient à l'accueil", async () => {
    let finish = () => {};
    const onWatched = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { user } = renderDraw({ toWatch: [CHIHIRO, WHIPLASH], onWatched });
    await user.click(drawButton());
    await user.click(await screen.findByRole("button", { name: "RETIRER" }));
    await screen.findByRole("heading", { name: "WHIPLASH" });
    const watch = screen.getByRole("button", { name: "ON LE REGARDE" });

    await user.click(watch);
    await user.click(watch);

    expect(watch).toBeDisabled();
    expect(onWatched).toHaveBeenCalledTimes(1);
    expect(onWatched).toHaveBeenCalledWith(WHIPLASH.tmdbId);

    finish();

    expect(
      await screen.findByRole("button", { name: "TIRER UN FILM" }),
    ).toBeVisible();
    // The evening is settled: the « not tonight » pile is emptied.
    await user.click(drawButton());
    expect(
      await screen.findByRole("heading", { name: "LE VOYAGE DE CHIHIRO" }),
    ).toBeVisible();
    expect(screen.queryByText(/PAS CE SOIR/)).not.toBeInTheDocument();
  });

  it("film retiré depuis la liste → retour à l'accueil, pile conservée", async () => {
    const { user, rerender } = renderDraw({ toWatch: [CHIHIRO, WHIPLASH] });
    await user.click(drawButton());
    await user.click(await screen.findByRole("button", { name: "RETIRER" }));
    await screen.findByRole("heading", { name: "WHIPLASH" });

    rerender({ toWatch: [CHIHIRO] });

    expect(
      await screen.findByRole("button", { name: "TIRER UN FILM" }),
    ).toBeVisible();
    await user.click(drawButton());
    expect(
      await screen.findByRole("heading", {
        name: "VOUS ÊTES DIFFICILES CE SOIR",
      }),
    ).toBeVisible();
  });

  it("pile épuisée puis film ajouté → tirable sans vider la pile", async () => {
    const { user, rerender } = renderDraw({ toWatch: [CHIHIRO] });
    await user.click(drawButton());
    await user.click(await screen.findByRole("button", { name: "RETIRER" }));
    await screen.findByRole("heading", {
      name: "VOUS ÊTES DIFFICILES CE SOIR",
    });

    rerender({ toWatch: [WHIPLASH, CHIHIRO] });
    await user.click(
      await screen.findByRole("button", { name: "TIRER UN FILM" }),
    );

    expect(
      await screen.findByRole("heading", { name: "WHIPLASH" }),
    ).toBeVisible();
    expect(screen.getByText(/^PAS CE SOIR\s: 1$/)).toBeVisible();
  });

  it("pile épuisée puis liste vidée → écran liste vide", async () => {
    const { user, rerender } = renderDraw({ toWatch: [CHIHIRO] });
    await user.click(drawButton());
    await user.click(await screen.findByRole("button", { name: "RETIRER" }));
    await screen.findByRole("heading", {
      name: "VOUS ÊTES DIFFICILES CE SOIR",
    });

    rerender({ toWatch: [] });

    expect(
      await screen.findByRole("heading", { name: "RIEN À TIRER CE SOIR" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "ON REMET TOUT" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ALLER SWIPER" })).toBeVisible();
    // The pile is kept: a film added later is drawable, the old ones are not.
    rerender({ toWatch: [WHIPLASH, CHIHIRO] });
    await user.click(
      await screen.findByRole("button", { name: "TIRER UN FILM" }),
    );
    expect(
      await screen.findByRole("heading", { name: "WHIPLASH" }),
    ).toBeVisible();
  });
});
