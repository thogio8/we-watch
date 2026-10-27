// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Movie } from "@/domain/movie";
import type { MovieCredits } from "@/tmdb/credits";
import { aMovie, PRIME } from "@tests/helpers/movies";
import { MovieNotFound, MovieScreen } from "./MovieScreen";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const PARASITE = aMovie(496243, {
  title: "Parasite",
  releaseYear: 2019,
  runtimeMinutes: 132,
  overview: "Toute la famille de Ki-taek est au chômage. ".repeat(12).trim(),
  genreIds: [35, 53, 18],
  providers: [PRIME],
  trailerKey: "isOGD_7hNIY",
  decidedAt: new Date("2026-10-03T18:00:00Z"),
});
const CREDITS: MovieCredits = {
  directors: ["Bong Joon-ho"],
  cast: ["Song Kang-ho", "Lee Sun-kyun"],
};

function renderMovie(
  movie: Movie = PARASITE,
  credits: MovieCredits | null = CREDITS,
) {
  const actions = {
    onWatched: vi.fn(() => Promise.resolve()),
    onUnwatch: vi.fn(() => Promise.resolve()),
    onRemove: vi.fn(() => Promise.resolve()),
  };
  render(<MovieScreen movie={movie} credits={credits} actions={actions} />);
  return { user: userEvent.setup(), ...actions };
}

const fact = (label: string) =>
  screen.getByText(label, { selector: "dt" }).nextElementSibling;

describe("fiche d'un film", () => {
  it("montre le ticket, le résumé complet et le détail du film", () => {
    renderMovie();

    expect(screen.getByRole("heading", { name: "Parasite" })).toBeVisible();
    expect(screen.getByText(PARASITE.overview)).toBeVisible();
    expect(screen.getByText("Amazon Prime Video")).toBeVisible();
    expect(fact("GENRES")).toHaveTextContent("Comédie · Thriller · Drame");
    expect(fact("RÉALISATION")).toHaveTextContent("Bong Joon-ho");
    expect(fact("AVEC")).toHaveTextContent("Song Kang-ho, Lee Sun-kyun");
    expect(fact("CHEZ NOUS")).toHaveTextContent("Ajouté le 3 octobre 2026");
    expect(screen.getByRole("link", { name: "← LA LISTE" })).toHaveAttribute(
      "href",
      "/list",
    );
  });

  it("un film vu raconte aussi quand on l'a vu", () => {
    renderMovie({
      ...PARASITE,
      status: "watched",
      watchedAt: new Date("2026-10-27T20:00:00Z"),
    });

    expect(fact("CHEZ NOUS")).toHaveTextContent(
      "Ajouté le 3 octobre 2026 · Vu le 27 octobre 2026",
    );
  });

  it("sans générique TMDB, la fiche s'affiche quand même", () => {
    renderMovie(PARASITE, null);

    expect(screen.queryByText("RÉALISATION")).toBeNull();
    expect(screen.queryByText("AVEC")).toBeNull();
    expect(fact("GENRES")).toHaveTextContent("Comédie");
  });

  it("à voir : ON L’A VU marque le film vu puis revient à la liste", async () => {
    const { user, onWatched } = renderMovie();

    await user.click(screen.getByRole("button", { name: "ON L’A VU" }));

    expect(onWatched).toHaveBeenCalledWith(496243);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/list"));
  });

  it("à voir : RETIRER", async () => {
    const { user, onRemove } = renderMovie();

    await user.click(screen.getByRole("button", { name: "RETIRER" }));

    expect(onRemove).toHaveBeenCalledWith(496243);
  });

  it("vu : seulement ↺ À REVOIR", async () => {
    const { user, onUnwatch } = renderMovie({ ...PARASITE, status: "watched" });

    expect(screen.queryByRole("button", { name: "ON L’A VU" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "↺ À REVOIR" }));

    expect(onUnwatch).toHaveBeenCalledWith(496243);
  });

  it("un échec le dit et laisse réessayer", async () => {
    const { user, onWatched } = renderMovie();
    onWatched.mockRejectedValueOnce(new Error("offline"));
    push.mockClear();

    await user.click(screen.getByRole("button", { name: "ON L’A VU" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "PAS RÉUSSI, RÉESSAIE",
    );
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "ON L’A VU" })).toBeEnabled();
  });

  it("un film hors de la liste : introuvable, avec le chemin du retour", () => {
    render(<MovieNotFound />);

    expect(
      screen.getByRole("heading", { name: "FILM INTROUVABLE" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "← LA LISTE" })).toBeVisible();
  });
});
