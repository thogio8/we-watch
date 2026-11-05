// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { aMovie } from "@tests/helpers/movies";
import type { Movie } from "@/domain/movie";
import { ListScreen } from "./ListScreen";

const names = (n: number) => Array.from({ length: n }, (_, i) => `M${i + 1}`);

type Overrides = Parameters<typeof aMovie>[1];

const show = (overrides: Overrides, tab: "toWatch" | "watched" = "toWatch") => {
  const noop = vi.fn(() => Promise.resolve());
  const movie: Movie = aMovie(1, {
    title: "DUNE",
    ...(tab === "watched" ? { status: "watched" } : {}),
    ...overrides,
  });
  render(
    <ListScreen
      toWatch={tab === "toWatch" ? [movie] : []}
      watched={tab === "watched" ? [movie] : []}
      onRemove={noop}
      onUnwatch={noop}
      onFavorite={noop}
    />,
  );
};

const MATCHED = new Date(2026, 10, 5, 21, 0);
const stamp = () => screen.queryByText(/MATCH/);
const openWatched = () =>
  userEvent.click(screen.getByRole("tab", { name: /VUS/ }));

describe("liste : formulation d'un match", () => {
  it("à deux, un match est voulu par vous deux", () => {
    show({ groupSize: 2, wantedBy: names(2), matchedAt: MATCHED });

    expect(screen.getByText("voulu par vous deux")).toBeVisible();
  });

  it("plus grand, un match voulu par tous est voulu par tout le groupe", () => {
    show({ groupSize: 4, wantedBy: names(4), matchedAt: MATCHED });

    expect(screen.getByText("voulu par tout le groupe")).toBeVisible();
  });

  it("à dix, un match voulu par 9 se lit « 9 sur 10 », à côté du tampon", () => {
    show({ groupSize: 10, wantedBy: names(9), matchedAt: MATCHED });

    const row = within(screen.getByRole("listitem"));
    expect(row.getByText("voulu par 9 sur 10")).toBeVisible();
    expect(row.getByText(/MATCH/)).toBeVisible();
  });

  it("sans match, on garde les prénoms", () => {
    show({ groupSize: 2, wantedBy: ["Léa"] });

    expect(screen.getByText("voulu par Léa")).toBeVisible();
  });
});

describe("liste : le tampon MATCH", () => {
  it("un match « à voir » porte le tampon", () => {
    show({ groupSize: 2, wantedBy: names(2), matchedAt: MATCHED });

    expect(stamp()).toBeVisible();
  });

  it("sans match, pas de tampon", () => {
    show({ groupSize: 2, wantedBy: ["Léa"] });

    expect(stamp()).not.toBeInTheDocument();
  });

  it("un match vu garde son tampon", async () => {
    show({ groupSize: 2, wantedBy: names(2), matchedAt: MATCHED }, "watched");
    await openWatched();

    expect(stamp()).toBeVisible();
  });

  it("un film vu sans match n’a pas de tampon", async () => {
    show({ groupSize: 2, wantedBy: ["Léa"] }, "watched");
    await openWatched();

    expect(stamp()).not.toBeInTheDocument();
  });

  it("un coup de cœur et match montre le ♥ et le tampon", () => {
    show({
      groupSize: 2,
      wantedBy: names(2),
      matchedAt: MATCHED,
      favoriteAt: MATCHED,
      favoriteBy: "M1",
    });

    expect(
      screen.getByRole("button", { name: /Coup de cœur/, pressed: true }),
    ).toBeVisible();
    expect(stamp()).toBeVisible();
  });
});
