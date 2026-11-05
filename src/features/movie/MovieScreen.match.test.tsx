// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { aMovie } from "@tests/helpers/movies";
import { MovieScreen } from "./MovieScreen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const show = (overrides: Parameters<typeof aMovie>[1]) => {
  const noop = () => Promise.resolve();
  render(
    <MovieScreen
      movie={aMovie(1, overrides)}
      credits={null}
      actions={{
        onWatched: noop,
        onUnwatch: noop,
        onRemove: noop,
        onFavorite: noop,
      }}
    />,
  );
};

describe("fiche d'un film : le match", () => {
  it("un match montre la date du match du groupe", () => {
    show({
      wantedBy: ["Léa", "Hugo"],
      matchedAt: new Date(2026, 10, 5, 21, 0),
    });

    expect(
      screen.getByText("match du groupe le 5 novembre 2026"),
    ).toBeVisible();
    expect(screen.getByText("voulu par vous deux")).toBeVisible();
  });

  it("sans match, aucune ligne de match", () => {
    show({ wantedBy: ["Léa"] });

    expect(screen.queryByText(/match du groupe/)).not.toBeInTheDocument();
  });
});
