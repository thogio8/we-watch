// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { aMovie, NETFLIX } from "@tests/helpers/movies";
import type { Movie } from "@/domain/movie";
import { ListScreen } from "./ListScreen";

vi.mock("@/features/signin/authClient", () => ({ authClient: {} }));

const movie = (tmdbId: number, title: string, overrides: Partial<Movie> = {}) =>
  aMovie(tmdbId, {
    title,
    releaseYear: 2001,
    runtimeMinutes: 125,
    voteAverage: 8.5,
    providers: [NETFLIX],
    ...overrides,
  });

const CHIHIRO = movie(129, "LE VOYAGE DE CHIHIRO");
const WHIPLASH = movie(244786, "WHIPLASH", {
  runtimeMinutes: 107,
  providers: [
    { id: 119, name: "Amazon Prime Video", logoPath: null },
    { id: 381, name: "Canal+", logoPath: null },
  ],
});
const DUNE_1984 = movie(841, "DUNE", { runtimeMinutes: null, providers: [] });
const INTERSTELLAR = movie(157336, "INTERSTELLAR", {
  status: "watched",
  watchedAt: new Date(2026, 9, 18, 22, 40),
});
const LALALAND = movie(313369, "LA LA LAND", {
  status: "watched",
  watchedAt: new Date(2026, 9, 11, 21, 5),
});

type Act = (tmdbId: number) => Promise<void>;

function renderList({
  toWatch = [CHIHIRO, WHIPLASH],
  watched = [INTERSTELLAR, LALALAND],
  onRemove = vi.fn<Act>(() => Promise.resolve()),
  onUnwatch = vi.fn<Act>(() => Promise.resolve()),
}: {
  toWatch?: Movie[];
  watched?: Movie[];
  onRemove?: Act;
  onUnwatch?: Act;
} = {}) {
  const user = userEvent.setup();
  render(
    <ListScreen
      toWatch={toWatch}
      watched={watched}
      onRemove={onRemove}
      onUnwatch={onUnwatch}
    />,
  );
  return { user, onRemove, onUnwatch };
}

const panel = () => screen.getByRole("tabpanel");

describe("ListScreen", () => {
  it("propose de se déconnecter", () => {
    renderList();

    expect(
      screen.getByRole("button", { name: "SE DÉCONNECTER" }),
    ).toBeVisible();
  });

  it("affiche les compteurs des deux onglets", () => {
    renderList();

    expect(
      screen.getByRole("heading", { level: 1, name: "NOTRE LISTE" }),
    ).toBeVisible();
    expect(screen.getByRole("tab", { name: "À VOIR · 2" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "VUS · 2" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("lignes à voir : titre, durée et plateformes", () => {
    renderList({ toWatch: [CHIHIRO, WHIPLASH, DUNE_1984] });

    const rows = within(panel()).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByRole("heading")).toHaveTextContent(
      "LE VOYAGE DE CHIHIRO",
    );
    expect(rows[0]).toHaveTextContent("2h05 · Netflix");
    expect(rows[1]).toHaveTextContent("1h47 · Amazon Prime Video · Canal+");
    // Unknown runtime is skipped; no platform reads « PAS EN STREAMING ».
    expect(rows[2]).toHaveTextContent(/^DUNEPAS EN STREAMING/);
  });

  it("✕ appelle onRemove avec le bon id", async () => {
    const { user, onRemove } = renderList();

    await user.click(screen.getByRole("button", { name: "Retirer WHIPLASH" }));

    expect(onRemove).toHaveBeenCalledExactlyOnceWith(244786);
  });

  it("onglet VUS affiche « Vu le 18/10 » et ↺ À VOIR appelle onUnwatch", async () => {
    const { user, onUnwatch } = renderList();

    await user.click(screen.getByRole("tab", { name: "VUS · 2" }));

    expect(screen.getByRole("tab", { name: "VUS · 2" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const rows = within(panel()).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("INTERSTELLAR");
    expect(rows[0]).toHaveTextContent("Vu le 18/10");
    expect(rows[1]).toHaveTextContent("Vu le 11/10");
    expect(
      within(panel()).queryByRole("button", { name: /^Retirer/ }),
    ).not.toBeInTheDocument();

    const back = screen.getByRole("button", {
      name: "Remettre INTERSTELLAR à voir",
    });
    expect(back).toHaveTextContent("↺ À VOIR");
    await user.click(back);

    expect(onUnwatch).toHaveBeenCalledExactlyOnceWith(157336);
  });

  it("les flèches passent d'un onglet à l'autre", async () => {
    const { user } = renderList();

    screen.getByRole("tab", { name: "À VOIR · 2" }).focus();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("tab", { name: "VUS · 2" })).toHaveFocus();
    expect(panel()).toHaveTextContent("INTERSTELLAR");

    await user.keyboard("{ArrowLeft}");

    expect(screen.getByRole("tab", { name: "À VOIR · 2" })).toHaveFocus();
    expect(panel()).toHaveTextContent("WHIPLASH");
  });

  it("un double tap pendant l'enregistrement n'appelle onRemove qu'une fois", async () => {
    let finish = () => {};
    const onRemove = vi.fn<Act>(
      () => new Promise<void>((resolve) => (finish = resolve)),
    );
    const { user } = renderList({ onRemove });

    const remove = screen.getByRole("button", { name: "Retirer WHIPLASH" });
    await user.click(remove);
    await user.click(remove);

    expect(onRemove).toHaveBeenCalledOnce();
    expect(remove).toBeDisabled();
    finish();
  });

  it("un échec affiche un message et rend la main", async () => {
    const onRemove = vi.fn<Act>(() => Promise.reject(new Error("db down")));
    const { user } = renderList({ onRemove });

    await user.click(screen.getByRole("button", { name: "Retirer WHIPLASH" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "PAS RÉUSSI À ENREGISTRER, RÉESSAIE",
    );
    expect(
      screen.getByRole("button", { name: "Retirer WHIPLASH" }),
    ).toBeEnabled();
  });

  it("listes vides : un message dans chaque onglet", async () => {
    const { user } = renderList({ toWatch: [], watched: [] });

    expect(screen.getByRole("tab", { name: "À VOIR · 0" })).toBeVisible();
    expect(panel()).toHaveTextContent("RIEN À VOIR POUR L’INSTANT");
    expect(within(panel()).queryByRole("list")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "VUS · 0" }));

    expect(panel()).toHaveTextContent("AUCUN FILM VU POUR L’INSTANT");
  });

  it("avec la recherche : le champ est au-dessus des onglets, les résultats remplacent la liste", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      render(
        <ListScreen
          toWatch={[CHIHIRO]}
          watched={[]}
          onRemove={() => Promise.resolve()}
          onUnwatch={() => Promise.resolve()}
          search={{
            search: () => Promise.resolve({ ok: true, results: [] }),
            add: () => Promise.resolve(),
          }}
        />,
      );

      const searchbox = screen.getByRole("searchbox", {
        name: "Ajouter un film",
      });
      expect(
        searchbox.compareDocumentPosition(screen.getByRole("tablist")),
      ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

      fireEvent.change(searchbox, { target: { value: "dune" } });

      expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
      expect(screen.getByText("ON CHERCHE…")).toBeVisible();
      expect(screen.getByRole("contentinfo")).toBeVisible();

      fireEvent.change(searchbox, { target: { value: "" } });

      expect(screen.getByRole("tab", { name: "À VOIR · 1" })).toBeVisible();
    } finally {
      vi.useRealTimers();
    }
  });

  it("affiche les attributions TMDB et JustWatch", () => {
    renderList();

    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveTextContent(
      "This product uses the TMDB API but is not endorsed or certified by TMDB.",
    );
    expect(within(footer).getByRole("link", { name: /TMDB/ })).toHaveAttribute(
      "href",
      "https://www.themoviedb.org/",
    );
    expect(footer).toHaveTextContent("Disponibilités : JustWatch");
    expect(
      within(footer).getByRole("link", { name: "JustWatch" }),
    ).toHaveAttribute("href", "https://www.justwatch.com/fr");
  });

  it("une plateforme par marque, pas une par offre", () => {
    const ads = { id: 1796, name: "Netflix Standard with Ads", logoPath: null };
    renderList({
      toWatch: [
        movie(1, "AVEC PUB", {
          providers: [{ id: 8, name: "Netflix", logoPath: null }, ads],
        }),
      ],
    });
    expect(within(panel()).getByText("2h05 · Netflix")).toBeVisible();
  });
});
