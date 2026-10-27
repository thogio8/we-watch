// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { aSnapshot, NETFLIX, PRIME } from "@tests/helpers/movies";
import type { MovieSnapshot } from "@/domain/movie";
import { TicketDetails } from "./TicketDetails";

const movie = (overrides: Partial<MovieSnapshot> = {}): MovieSnapshot =>
  aSnapshot(244786, {
    title: "WHIPLASH",
    releaseYear: 2014,
    runtimeMinutes: 107,
    overview: "Un batteur et son professeur.",
    voteAverage: 8.4,
    providers: [NETFLIX],
    genreIds: [18],
    trailerKey: "7d_jQycdQGo",
    ...overrides,
  });

const tags = () => screen.queryByRole("list", { name: "Plateformes" });

describe("TicketDetails", () => {
  it("affiche titre, infos, plateformes, bande-annonce et résumé", () => {
    render(<TicketDetails movie={movie()} platforms="all" />);

    expect(screen.getByRole("heading", { name: "WHIPLASH" })).toBeVisible();
    expect(screen.getByText("2014 · 1h47 · ★8,4")).toBeVisible();
    expect(tags()).toHaveTextContent("Netflix");
    expect(
      screen.getByRole("link", { name: "Bande-annonce de WHIPLASH (YouTube)" }),
    ).toBeVisible();
    expect(screen.getByText("Un batteur et son professeur.")).toBeVisible();
  });

  it("carte de swipe : la seule plateforme est déjà le tampon, pas d'étiquette", () => {
    render(<TicketDetails movie={movie()} platforms="beyond-stamp" />);
    expect(tags()).not.toBeInTheDocument();
  });

  it("carte de swipe : toutes les plateformes dès qu'il y en a plusieurs", () => {
    render(
      <TicketDetails
        movie={movie({ providers: [NETFLIX, PRIME] })}
        platforms="beyond-stamp"
      />,
    );
    expect(tags()).toHaveTextContent("Amazon Prime Video");
  });

  it("sans résumé, pas de paragraphe vide", () => {
    render(<TicketDetails movie={movie({ overview: "" })} platforms="all" />);
    expect(screen.queryByText("Un batteur et son professeur.")).toBeNull();
  });
});
