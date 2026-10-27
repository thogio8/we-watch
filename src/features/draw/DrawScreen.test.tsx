// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { aMovie, NETFLIX } from "@tests/helpers/movies";
import { stubMatchMedia } from "@tests/helpers/dom";
import type { Movie } from "@/domain/movie";
import { DrawScreen } from "./DrawScreen";
import { DrawSessionProvider } from "./DrawSessionProvider";

const movie = (tmdbId: number, title: string, overrides: Partial<Movie> = {}) =>
  aMovie(tmdbId, {
    title,
    releaseYear: 2001,
    runtimeMinutes: 125,
    overview: `Résumé de ${title}.`,
    voteAverage: 8.54,
    providers: [NETFLIX],
    ...overrides,
  });

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

/** Draws the only movie, then sets it aside: the pile is empty. */
async function exhaustPile(user: ReturnType<typeof userEvent.setup>) {
  await user.click(drawButton());
  await user.click(await screen.findByRole("button", { name: "RETIRER" }));
  await screen.findByRole("heading", { name: "VOUS ÊTES DIFFICILES CE SOIR" });
}

beforeEach(() => {
  // Only the clock is frozen: user-event and motion keep real timers.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 23, 21, 7));
  vi.spyOn(Math, "random").mockReturnValue(0);
  // Reduced motion: animations resolve immediately.
  stubMatchMedia({ reducedMotion: true });
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
    await exhaustPile(user);

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
    await exhaustPile(user);

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

describe("DrawScreen : filtres « ce soir »", () => {
  const PRIME = { id: 119, name: "Amazon Prime Video", logoPath: null };
  // 21:07 + 125 min = 23:12; 21:07 + 107 min = 22:54; 21:07 + 95 = 22:42.
  const chihiro = movie(129, "LE VOYAGE DE CHIHIRO", { genreIds: [16, 14] });
  const whiplash = movie(244786, "WHIPLASH", {
    runtimeMinutes: 107,
    genreIds: [18],
  });
  const parasite = movie(496243, "PARASITE", {
    runtimeMinutes: 95,
    genreIds: [35, 53, 18],
    providers: [PRIME],
  });
  const list = [chihiro, whiplash, parasite];

  const chip = (group: string, name: string) =>
    within(screen.getByRole("group", { name: group })).getByRole("button", {
      name,
    });
  const openPanel = (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole("button", { name: /^LA SOIRÉE/ }));
  const drawAmong = (n: number) =>
    screen.getByRole("button", { name: `TIRER PARMI ${n}` });

  it("le panneau, replié, résume les filtres et garde le bouton en vue", async () => {
    const { user } = renderDraw({ toWatch: list });

    const header = screen.getByRole("button", { name: /^LA SOIRÉE/ });
    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(header).toHaveTextContent("AUCUN FILTRE");
    expect(screen.queryByRole("group")).not.toBeInTheDocument();

    await user.click(header);
    await user.click(chip("FINI AVANT", "MINUIT"));
    await user.click(chip("ON A ENVIE DE…", "RIRE"));
    await user.click(chip("DISPO CHEZ NOUS", "Netflix"));
    await user.click(header);

    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(header).toHaveTextContent("AVANT MINUIT · RIRE · NETFLIX");
  });

  it("le panneau propose heure, humeur et plateformes de la liste", async () => {
    const { user } = renderDraw({ toWatch: list });
    await openPanel(user);

    expect(chip("FINI AVANT", "PEU IMPORTE")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(chip("ON A ENVIE DE…", "RIRE")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    const platforms = within(
      screen.getByRole("group", { name: "DISPO CHEZ NOUS" }),
    );
    expect(platforms.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "TOUT",
      "Netflix",
      "Amazon Prime Video",
    ]);
    expect(drawButton()).toBeEnabled();
  });

  it("FINI AVANT 23H ne tire que ce qui finit à temps", async () => {
    const { user } = renderDraw({ toWatch: list });
    await openPanel(user);

    await user.click(chip("FINI AVANT", "23H"));
    expect(chip("FINI AVANT", "23H")).toHaveAttribute("aria-pressed", "true");
    await user.click(drawAmong(2));

    expect(
      await screen.findByRole("heading", { name: "WHIPLASH" }),
    ).toBeVisible();
  });

  it("les humeurs s'additionnent", async () => {
    const { user } = renderDraw({ toWatch: list });
    await openPanel(user);

    await user.click(chip("ON A ENVIE DE…", "RIRE"));
    expect(drawAmong(1)).toBeVisible();
    await user.click(chip("ON A ENVIE DE…", "S’ÉVADER"));
    expect(drawAmong(2)).toBeVisible();
    await user.click(chip("ON A ENVIE DE…", "RIRE"));
    expect(drawAmong(1)).toBeVisible();
  });

  it("une plateforme choisie, puis TOUT pour revenir", async () => {
    const { user } = renderDraw({ toWatch: list });
    await openPanel(user);

    await user.click(chip("DISPO CHEZ NOUS", "Amazon Prime Video"));
    expect(chip("DISPO CHEZ NOUS", "TOUT")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await user.click(drawAmong(1));
    expect(
      await screen.findByRole("heading", { name: "PARASITE" }),
    ).toBeVisible();
  });

  it("TOUT efface le choix des plateformes", async () => {
    const { user } = renderDraw({ toWatch: list });
    await openPanel(user);

    await user.click(chip("DISPO CHEZ NOUS", "Netflix"));
    expect(drawAmong(2)).toBeVisible();
    await user.click(chip("DISPO CHEZ NOUS", "TOUT"));

    expect(drawButton()).toBeVisible();
  });

  it("aucun film ne colle → ENLEVER LES FILTRES", async () => {
    const { user } = renderDraw({ toWatch: list });
    await openPanel(user);

    await user.click(chip("FINI AVANT", "22H30"));

    expect(screen.getByText("AUCUN FILM NE COLLE")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /^TIRER/ }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "ENLEVER LES FILTRES" }),
    );
    expect(drawButton()).toBeVisible();
  });

  it("la pile épuisée ne compte que les films qui collent", async () => {
    const { user } = renderDraw({ toWatch: list });
    await openPanel(user);
    await user.click(chip("ON A ENVIE DE…", "RIRE"));
    await user.click(drawAmong(1));
    await user.click(await screen.findByRole("button", { name: "RETIRER" }));

    expect(
      await screen.findByRole("heading", {
        name: "VOUS ÊTES DIFFICILES CE SOIR",
      }),
    ).toBeVisible();
    expect(
      screen.getByText("Le seul film qui collait est passé à la trappe"),
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "ENLEVER LES FILTRES" }),
    );

    expect(
      await screen.findByRole("button", { name: "TIRER UN FILM" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /^LA SOIRÉE/ }),
    ).toHaveTextContent("AUCUN FILTRE");
  });

  it("plusieurs films qui collaient, tous retirés", async () => {
    const { user } = renderDraw({ toWatch: list });
    await openPanel(user);
    await user.click(chip("FINI AVANT", "23H"));
    await user.click(drawAmong(2));
    await user.click(await screen.findByRole("button", { name: "RETIRER" }));
    await user.click(await screen.findByRole("button", { name: "RETIRER" }));

    expect(
      await screen.findByText(
        "Les 2 films qui collaient sont passés à la trappe",
      ),
    ).toBeVisible();
  });

  it("l'heure de coucher et les plateformes sont mémorisées, pas l'humeur", async () => {
    const { user } = renderDraw({ toWatch: list });
    await openPanel(user);
    await user.click(chip("FINI AVANT", "23H30"));
    await user.click(chip("DISPO CHEZ NOUS", "Netflix"));
    await user.click(chip("ON A ENVIE DE…", "RIRE"));

    expect(JSON.parse(localStorage.getItem("ww-tonight-v1") ?? "")).toEqual({
      bedtime: 23 * 60 + 30,
      platforms: ["netflix"],
    });
  });

  it("relit les filtres mémorisés sur l'appareil", async () => {
    localStorage.setItem(
      "ww-tonight-v1",
      JSON.stringify({
        bedtime: 23 * 60,
        platforms: ["amazon prime video", "inconnue"],
      }),
    );
    const { user } = renderDraw({ toWatch: list });

    expect(
      screen.getByRole("button", { name: /^LA SOIRÉE/ }),
    ).toHaveTextContent("AVANT 23H · AMAZON PRIME VIDEO");
    await openPanel(user);
    expect(chip("FINI AVANT", "23H")).toHaveAttribute("aria-pressed", "true");
    // Prime only, and only what ends by 23:00. The unknown platform is ignored.
    expect(drawAmong(1)).toBeVisible();
  });

  it("un localStorage indisponible n'empêche pas de filtrer", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const { user } = renderDraw({ toWatch: list });
    await openPanel(user);

    await user.click(chip("FINI AVANT", "23H"));

    expect(drawAmong(2)).toBeVisible();
  });

  it("pas de panneau quand la liste est vide", () => {
    renderDraw({ toWatch: [] });

    expect(
      screen.queryByRole("region", { name: "La soirée" }),
    ).not.toBeInTheDocument();
  });

  it("le ticket tiré propose la bande-annonce", async () => {
    const { user } = renderDraw({
      toWatch: [{ ...whiplash, trailerKey: "7d_jQycdQGo" }],
    });

    await user.click(drawButton());

    expect(
      await screen.findByRole("link", {
        name: "Bande-annonce de WHIPLASH (YouTube)",
      }),
    ).toBeVisible();
  });
});
