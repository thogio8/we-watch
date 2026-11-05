// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { aMovie } from "@tests/helpers/movies";
import { ListScreen } from "./ListScreen";

const names = (n: number) => Array.from({ length: n }, (_, i) => `M${i + 1}`);

const show = (overrides: Parameters<typeof aMovie>[1]) => {
  const noop = vi.fn(() => Promise.resolve());
  render(
    <ListScreen
      toWatch={[aMovie(1, { title: "DUNE", ...overrides })]}
      watched={[]}
      onRemove={noop}
      onUnwatch={noop}
      onFavorite={noop}
    />,
  );
};

const MATCHED = new Date(2026, 10, 5, 21, 0);

describe("liste : formulation d'un match", () => {
  it("à deux, un match est voulu par vous deux", () => {
    show({ groupSize: 2, wantedBy: names(2), matchedAt: MATCHED });

    expect(screen.getByText("voulu par vous deux")).toBeVisible();
  });

  it("plus grand, un match voulu par tous est voulu par tout le groupe", () => {
    show({ groupSize: 4, wantedBy: names(4), matchedAt: MATCHED });

    expect(screen.getByText("voulu par tout le groupe")).toBeVisible();
  });

  it("à dix, un match voulu par 9 se lit « 9 sur 10 »", () => {
    show({ groupSize: 10, wantedBy: names(9), matchedAt: MATCHED });

    expect(screen.getByText("voulu par 9 sur 10")).toBeVisible();
  });

  it("sans match, on garde les prénoms", () => {
    show({ groupSize: 2, wantedBy: ["Léa"] });

    expect(screen.getByText("voulu par Léa")).toBeVisible();
  });
});

describe("liste : le tampon MATCH", () => {
  const stamp = () => screen.queryByText(/MATCH/);

  it("un match « à voir » porte le tampon", () => {
    show({ groupSize: 2, wantedBy: names(2), matchedAt: MATCHED });

    expect(stamp()).toBeVisible();
  });

  it("sans match, pas de tampon", () => {
    show({ groupSize: 2, wantedBy: ["Léa"] });

    expect(stamp()).not.toBeInTheDocument();
  });

  it("un match vu garde son tampon", async () => {
    const noop = vi.fn(() => Promise.resolve());
    render(
      <ListScreen
        toWatch={[]}
        watched={[
          aMovie(1, {
            status: "watched",
            groupSize: 2,
            wantedBy: names(2),
            matchedAt: MATCHED,
          }),
        ]}
        onRemove={noop}
        onUnwatch={noop}
        onFavorite={noop}
      />,
    );
    await userEvent.click(screen.getByRole("tab", { name: /VUS/ }));

    expect(stamp()).toBeVisible();
  });
});
