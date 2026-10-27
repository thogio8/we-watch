import { describe, expect, it, vi } from "vitest";
import type { MovieSnapshot } from "@/domain/movie";
import { refreshMovies } from "./refresh-movies";

const snapshot = (tmdbId: number): MovieSnapshot => ({
  tmdbId,
  title: `Film ${tmdbId}`,
  releaseYear: 2000,
  runtimeMinutes: 100,
  overview: "",
  posterPath: null,
  voteAverage: 7,
  providers: [],
  genreIds: [18],
  trailerKey: null,
});

describe("refreshMovies", () => {
  it("rafraîchit chaque film et fait le compte", async () => {
    const save = vi.fn<(snapshot: MovieSnapshot) => Promise<string>>(() =>
      Promise.resolve("applied"),
    );
    const report = await refreshMovies({
      ids: () => Promise.resolve([1, 2, 3]),
      snapshot: (id) => Promise.resolve(snapshot(id)),
      save,
    });

    expect(report).toEqual({ total: 3, refreshed: 3, failed: [] });
    expect(save.mock.calls.map(([s]) => (s as MovieSnapshot).tmdbId)).toEqual([
      1, 2, 3,
    ]);
  });

  it("un échec TMDB ou base n'arrête pas les autres", async () => {
    const report = await refreshMovies({
      ids: () => Promise.resolve([1, 2, 3, 4]),
      snapshot: (id) =>
        id === 4
          ? Promise.reject(new Error("404"))
          : Promise.resolve(snapshot(id)),
      save: (s) =>
        s.tmdbId === 2
          ? Promise.reject(new Error("locked"))
          : Promise.resolve("applied"),
    });

    expect(report).toEqual({ total: 4, refreshed: 2, failed: [2, 4] });
  });

  it("jamais plus de `concurrency` appels TMDB en même temps", async () => {
    let running = 0;
    let peak = 0;
    const report = await refreshMovies(
      {
        ids: () => Promise.resolve(Array.from({ length: 10 }, (_, i) => i + 1)),
        snapshot: async (id) => {
          running += 1;
          peak = Math.max(peak, running);
          await new Promise((resolve) => setTimeout(resolve, 2));
          running -= 1;
          return snapshot(id);
        },
        save: () => Promise.resolve("applied"),
      },
      3,
    );

    expect(peak).toBe(3);
    expect(report.refreshed).toBe(10);
  });

  it("liste vide : rien à faire", async () => {
    const snap = vi.fn();
    expect(
      await refreshMovies({
        ids: () => Promise.resolve([]),
        snapshot: snap,
        save: vi.fn(),
      }),
    ).toEqual({ total: 0, refreshed: 0, failed: [] });
    expect(snap).not.toHaveBeenCalled();
  });
});
