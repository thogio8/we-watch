// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { aMovie, NETFLIX } from "@tests/helpers/movies";
import type { Movie } from "@/domain/movie";
import { ListScreen } from "./ListScreen";

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
  watchedBy: "Hugo",
});
const LALALAND = movie(313369, "LA LA LAND", {
  status: "watched",
  watchedAt: new Date(2026, 9, 11, 21, 5),
  legacy: true,
  watchedLegacy: true,
});

const PARASITE = movie(496243, "PARASITE", {
  favoriteAt: new Date(2026, 10, 4, 21, 0),
  favoriteBy: "Becca",
});

type Act = (tmdbId: number) => Promise<void>;
type Fav = (tmdbId: number, on: boolean) => Promise<void>;

function renderList({
  toWatch = [CHIHIRO, WHIPLASH],
  watched = [INTERSTELLAR, LALALAND],
  onRemove = vi.fn<Act>(() => Promise.resolve()),
  onUnwatch = vi.fn<Act>(() => Promise.resolve()),
  onFavorite = vi.fn<Fav>(() => Promise.resolve()),
}: {
  toWatch?: Movie[];
  watched?: Movie[];
  onRemove?: Act;
  onUnwatch?: Act;
  onFavorite?: Fav;
} = {}) {
  const user = userEvent.setup();
  render(
    <ListScreen
      toWatch={toWatch}
      watched={watched}
      onRemove={onRemove}
      onUnwatch={onUnwatch}
      onFavorite={onFavorite}
    />,
  );
  return { user, onRemove, onUnwatch, onFavorite };
}

const panel = () => screen.getByRole("tabpanel");

describe("ListScreen", () => {
  it("place la pastille du groupe dans le landmark main", () => {
    render(
      <ListScreen
        toWatch={[]}
        watched={[]}
        onRemove={vi.fn<Act>()}
        onUnwatch={vi.fn<Act>()}
        onFavorite={vi.fn<Fav>()}
        pill={<button type="button">PASTILLE</button>}
      />,
    );

    expect(
      within(screen.getByRole("main")).getByRole("button", {
        name: "PASTILLE",
      }),
    ).toBeVisible();
  });

  it("ne propose plus de se déconnecter (c’est dans le panneau du groupe)", () => {
    renderList();

    expect(
      screen.queryByRole("button", { name: "SE DÉCONNECTER" }),
    ).not.toBeInTheDocument();
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

  it.each([
    ["son auteur", { addedBy: "Léa" }, "ajouté par Léa le 1er octobre 2026"],
    [
      "sans auteur (liste d’avant)",
      { legacy: true },
      "ajouté le 1er octobre 2026",
    ],
    [
      "un compte supprimé",
      {},
      "ajouté par un ancien membre le 1er octobre 2026",
    ],
  ])(
    "ligne à voir sans « voulu » : %s",
    (_label, overrides: Partial<Movie>, line) => {
      renderList({ toWatch: [{ ...CHIHIRO, ...overrides }] });

      const [row] = within(panel()).getAllByRole("listitem");
      expect(row).toHaveTextContent("2h05 · Netflix");
      expect(row).toHaveTextContent(line);
    },
  );

  it("ligne à voir voulue par deux : leurs prénoms, dans l’ordre, sans « ajouté »", () => {
    renderList({
      toWatch: [{ ...CHIHIRO, addedBy: "Léa", wantedBy: ["Léa", "Hugo"] }],
    });

    const [row] = within(panel()).getAllByRole("listitem");
    expect(row).toHaveTextContent("2h05 · Netflix");
    expect(row).toHaveTextContent("voulu par Léa et Hugo");
    expect(row).not.toHaveTextContent("ajouté");
  });

  it("onglet VUS affiche « vu le 18/10 · marqué par Hugo » et ↺ À VOIR appelle onUnwatch", async () => {
    const { user, onUnwatch } = renderList();

    await user.click(screen.getByRole("tab", { name: "VUS · 2" }));

    expect(screen.getByRole("tab", { name: "VUS · 2" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const rows = within(panel()).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("INTERSTELLAR");
    expect(rows[0]).toHaveTextContent("vu le 18/10 · marqué par Hugo");
    expect(rows[1]).toHaveTextContent("vu le 11/10");
    expect(rows[1]).not.toHaveTextContent("marqué");
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
          onFavorite={() => Promise.resolve()}
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

  describe("coups de cœur", () => {
    const heart = (title: string) =>
      screen.getByRole("button", {
        name: new RegExp(`^Coup de cœur\\s: ${title}$`),
      });

    it("sans coup de cœur, la liste de la 2.0 : aucun intertitre", () => {
      renderList();

      expect(screen.queryByText(/COUPS DE CŒUR/)).not.toBeInTheDocument();
      expect(screen.queryByText(/LE RESTE/)).not.toBeInTheDocument();
      expect(within(panel()).getAllByRole("listitem")).toHaveLength(2);
    });

    it("des coups de cœur : intertitres et compte, l’onglet garde À VOIR · total", () => {
      renderList({ toWatch: [PARASITE, CHIHIRO] });

      expect(screen.getByText("♥ COUPS DE CŒUR · 1")).toBeVisible();
      expect(screen.getByText("LE RESTE · 1")).toBeVisible();
      expect(screen.getByRole("tab", { name: "À VOIR · 2" })).toBeVisible();
      expect(
        within(
          screen.getByRole("list", { name: "♥ COUPS DE CŒUR · 1" }),
        ).getByRole("heading"),
      ).toHaveTextContent("PARASITE");
      expect(
        within(screen.getByRole("list", { name: "LE RESTE · 1" })).getByRole(
          "heading",
        ),
      ).toHaveTextContent("LE VOYAGE DE CHIHIRO");
    });

    it("chaque ligne à voir a ♡ / ♥ avant ✕, pressé selon le coup de cœur", () => {
      renderList({ toWatch: [PARASITE, CHIHIRO] });

      expect(heart("PARASITE")).toHaveAttribute("aria-pressed", "true");
      expect(heart("PARASITE")).toHaveTextContent("♥");
      expect(heart("LE VOYAGE DE CHIHIRO")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      expect(heart("LE VOYAGE DE CHIHIRO")).toHaveTextContent("♡");
      for (const row of within(panel()).getAllByRole("listitem")) {
        const [first, second] = within(row).getAllByRole("button");
        expect(first).toHaveAccessibleName(/^Coup de cœur/);
        expect(second).toHaveAccessibleName(/^Retirer/);
      }
    });

    it("taper ♡ marque, taper ♥ démarque", async () => {
      const { user, onFavorite } = renderList({
        toWatch: [PARASITE, CHIHIRO],
      });

      await user.click(heart("PARASITE"));
      await user.click(heart("LE VOYAGE DE CHIHIRO"));

      expect(onFavorite).toHaveBeenNthCalledWith(1, 496243, false);
      expect(onFavorite).toHaveBeenNthCalledWith(2, 129, true);
    });

    it("un double tap n’appelle onFavorite qu’une fois", async () => {
      let finish = () => {};
      const onFavorite = vi.fn<Fav>(
        () => new Promise<void>((resolve) => (finish = resolve)),
      );
      const { user } = renderList({ onFavorite });

      const button = heart("WHIPLASH");
      await user.click(button);
      await user.click(button);

      expect(onFavorite).toHaveBeenCalledOnce();
      expect(button).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Retirer WHIPLASH" }),
      ).toBeDisabled();
      finish();
    });

    it("un échec de ♥ affiche le message et rend la main", async () => {
      const onFavorite = vi.fn<Fav>(() => Promise.reject(new Error("db down")));
      const { user } = renderList({ toWatch: [PARASITE], onFavorite });

      await user.click(heart("PARASITE"));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "PAS RÉUSSI À ENREGISTRER, RÉESSAIE",
      );
      expect(heart("PARASITE")).toBeEnabled();
    });

    it("l’onglet VUS n’a ni ♡ ni intertitre", async () => {
      const { user } = renderList({ toWatch: [PARASITE] });

      await user.click(screen.getByRole("tab", { name: "VUS · 2" }));

      expect(
        within(panel()).queryByRole("button", { name: /^Coup de cœur/ }),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/COUPS DE CŒUR/)).not.toBeInTheDocument();
      expect(screen.queryByText(/LE RESTE/)).not.toBeInTheDocument();
    });
  });
});
