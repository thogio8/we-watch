// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MovieStatus } from "@/domain/movie";
import type { SearchOutcome, SearchResult } from "./actions";
import { SearchPanel } from "./SearchPanel";

function result(
  tmdbId: number,
  title: string,
  releaseYear: number,
  status: MovieStatus | null,
  overrides: Partial<SearchResult> = {},
): SearchResult {
  return {
    tmdbId,
    title,
    releaseYear,
    runtimeMinutes: 155,
    overview: "",
    posterPath: null,
    voteAverage: 7.8,
    providers: [{ id: 8, name: "Netflix", logoPath: null }],
    status,
    ...overrides,
  };
}

const DUNE_2021 = result(438631, "DUNE", 2021, null);
const DUNE_2 = result(693134, "DUNE : DEUXIÈME PARTIE", 2024, "to_watch");
const DUNE_1984 = result(841, "DUNE", 1984, "rejected", {
  runtimeMinutes: 137,
  voteAverage: 6.3,
  providers: [],
});
const DUNE_2000 = result(876, "DUNE", 2000, "watched");

type Search = (query: string) => Promise<SearchOutcome>;
type Add = (tmdbId: number) => Promise<void>;

const found = (...results: SearchResult[]): SearchOutcome => ({
  ok: true,
  results,
});

function renderPanel({
  search = vi.fn<Search>(() => Promise.resolve(found())),
  add = vi.fn<Add>(() => Promise.resolve()),
}: { search?: Search; add?: Add } = {}) {
  render(
    <SearchPanel search={search} add={add}>
      <p>LA LISTE</p>
    </SearchPanel>,
  );
  return { search, add };
}

const field = () => screen.getByRole("searchbox", { name: "Ajouter un film" });

// fireEvent rather than user-event: user-event's async wrapper waits on a
// setTimeout that only Jest's fake timers (not Vitest's) get advanced.
const typeQuery = (value: string) =>
  fireEvent.change(field(), { target: { value } });

/** Lets the 300 ms debounce elapse, then the search promise settle. */
const settle = (ms = 300) => act(() => vi.advanceTimersByTimeAsync(ms));

/** The row of a result, found by its meta line (titles repeat: three DUNE). */
const rowOf = (year: number) =>
  screen.getByText(new RegExp(`^${year} ·`)).closest("li")!;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("SearchPanel", () => {
  it("n'appelle search qu'après 300 ms de pause", async () => {
    const { search } = renderPanel({
      search: vi.fn<Search>(() => Promise.resolve(found(DUNE_2021))),
    });

    // Keystrokes 200 ms apart: no pause long enough to search.
    for (const value of ["d", "du", "dun", "dune"]) {
      typeQuery(value);
      await settle(200);
    }
    await settle(99);
    expect(search).not.toHaveBeenCalled();
    // The results replace the list at once, waiting for the first answer.
    expect(screen.queryByText("LA LISTE")).not.toBeInTheDocument();
    expect(screen.getByText("ON CHERCHE…")).toBeVisible();

    await settle(1);

    expect(search).toHaveBeenCalledExactlyOnceWith("dune");
    expect(screen.queryByText("LA LISTE")).not.toBeInTheDocument();
    expect(screen.getByText("Résultats TMDB")).toBeVisible();
    expect(rowOf(2021)).toHaveTextContent("DUNE2021 · 2h35 · ★7,8Netflix");
  });

  it("requête d'espaces → pas d'appel, la liste reste affichée", async () => {
    const { search } = renderPanel();

    typeQuery("   ");
    await settle(1000);

    expect(search).not.toHaveBeenCalled();
    expect(screen.getByText("LA LISTE")).toBeVisible();
  });

  it("ignore une réponse arrivée après une nouvelle saisie", async () => {
    let answerDun: (outcome: SearchOutcome) => void = () => {};
    const search = vi.fn<Search>((query) =>
      query === "dun"
        ? new Promise((resolve) => (answerDun = resolve))
        : Promise.resolve(found(DUNE_1984)),
    );
    renderPanel({ search });

    typeQuery("dun");
    await settle();
    typeQuery("dune");
    // « dun » answers late, while « dune » is still being debounced.
    await act(async () => answerDun(found(DUNE_2021)));

    expect(screen.queryByText(/^2021 ·/)).not.toBeInTheDocument();

    await settle();

    expect(search).toHaveBeenLastCalledWith("dune");
    expect(rowOf(1984)).toBeVisible();
    expect(screen.queryByText(/^2021 ·/)).not.toBeInTheDocument();
  });

  it("✕ dans le champ vide la requête et réaffiche la liste", async () => {
    renderPanel({
      search: vi.fn<Search>(() => Promise.resolve(found(DUNE_2021))),
    });

    typeQuery("dune");
    await settle();
    fireEvent.click(
      screen.getByRole("button", { name: "Effacer la recherche" }),
    );

    expect(field()).toHaveValue("");
    expect(field()).toHaveFocus();
    expect(screen.getByText("LA LISTE")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Effacer la recherche" }),
    ).not.toBeInTheDocument();
  });

  it("une nouvelle recherche ne repart pas des anciens résultats", async () => {
    renderPanel({
      search: vi.fn<Search>(() => Promise.resolve(found(DUNE_2021))),
    });

    typeQuery("dune");
    await settle();
    fireEvent.click(
      screen.getByRole("button", { name: "Effacer la recherche" }),
    );
    typeQuery("alien");

    expect(screen.getByText("ON CHERCHE…")).toBeVisible();
    expect(screen.queryByText(/^2021 ·/)).not.toBeInTheDocument();
  });

  it("+ AJOUTER visible pour null et rejected, ✓ À VOIR / ✓ VU sinon", async () => {
    renderPanel({
      search: vi.fn<Search>(() =>
        Promise.resolve(found(DUNE_2021, DUNE_2, DUNE_1984, DUNE_2000)),
      ),
    });

    typeQuery("dune");
    await settle();

    expect(
      within(rowOf(2021)).getByRole("button", { name: "Ajouter DUNE" }),
    ).toHaveTextContent("+ AJOUTER");
    expect(within(rowOf(1984)).getByRole("button")).toHaveTextContent(
      "+ AJOUTER",
    );
    expect(rowOf(1984)).toHaveTextContent("PAS EN STREAMING");
    expect(within(rowOf(2024)).queryByRole("button")).not.toBeInTheDocument();
    expect(rowOf(2024)).toHaveTextContent("✓ À VOIR");
    expect(within(rowOf(2000)).queryByRole("button")).not.toBeInTheDocument();
    expect(rowOf(2000)).toHaveTextContent("✓ VU");
  });

  it("après ajout, la ligne affiche ✓ À VOIR", async () => {
    let finish = () => {};
    const add = vi.fn<Add>(() => new Promise((resolve) => (finish = resolve)));
    renderPanel({
      search: vi.fn<Search>(() => Promise.resolve(found(DUNE_1984))),
      add,
    });

    typeQuery("dune");
    await settle();
    const button = within(rowOf(1984)).getByRole("button", {
      name: "Ajouter DUNE",
    });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(add).toHaveBeenCalledExactlyOnceWith(841);
    expect(button).toBeDisabled();

    await act(async () => finish());

    expect(within(rowOf(1984)).queryByRole("button")).not.toBeInTheDocument();
    expect(rowOf(1984)).toHaveTextContent("✓ À VOIR");
  });

  it("un ajout qui échoue rend le bouton et prévient", async () => {
    renderPanel({
      search: vi.fn<Search>(() => Promise.resolve(found(DUNE_1984))),
      add: vi.fn<Add>(() => Promise.reject(new Error("TMDB down"))),
    });

    typeQuery("dune");
    await settle();
    fireEvent.click(within(rowOf(1984)).getByRole("button"));
    await settle(0);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "PAS RÉUSSI À AJOUTER, RÉESSAIE",
    );
    expect(within(rowOf(1984)).getByRole("button")).toBeEnabled();
  });

  it("échec TMDB → message dans la DA", async () => {
    renderPanel({
      search: vi.fn<Search>(() => Promise.resolve({ ok: false })),
    });

    typeQuery("dune");
    await settle();

    // Announced: the answer arrives while the focus stays in the field.
    expect(screen.getByRole("status")).toHaveTextContent(
      "TMDB NE RÉPOND PAS, RÉESSAIE",
    );
  });

  it("une recherche rejetée est traitée comme un échec TMDB", async () => {
    renderPanel({
      search: vi.fn<Search>(() => Promise.reject(new Error("offline"))),
    });

    typeQuery("dune");
    await settle();

    expect(screen.getByText("TMDB NE RÉPOND PAS, RÉESSAIE")).toBeVisible();
  });

  it("aucun résultat → « RIEN TROUVÉ POUR « … » »", async () => {
    renderPanel();

    typeQuery(" zzzz ");
    await settle();

    expect(screen.getByText("RIEN TROUVÉ POUR « zzzz »")).toBeVisible();
  });
});
