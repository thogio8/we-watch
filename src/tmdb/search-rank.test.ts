import { describe, expect, it } from "vitest";
import { pickSearchResults } from "./search-rank";

const hit = (id: number, voteCount = 0) => ({ id, voteCount });
const obscure = (count: number, from = 1) =>
  Array.from({ length: count }, (_, i) => hit(from + i, i % 3));

describe("pickSearchResults", () => {
  it("remonte un film très connu que TMDB classe loin (WALL·E au rang 37 pour « Wall-E »)", () => {
    const hits = [...obscure(36), hit(10681, 21131), ...obscure(3, 100)];

    expect(pickSearchResults(hits)[0]).toBe(10681);
  });

  it("garde les 4 premiers de TMDB, même sans aucun vote (une sortie récente)", () => {
    const hits = [
      ...obscure(4, 1).map((h) => ({ ...h, voteCount: 0 })),
      ...Array.from({ length: 10 }, (_, i) => hit(50 + i, 1000 + i)),
    ];

    expect(pickSearchResults(hits)).toEqual(
      expect.arrayContaining([1, 2, 3, 4]),
    );
  });

  it("complète avec les plus votés et affiche le tout par votes", () => {
    const hits = [
      hit(1, 5),
      hit(2, 0),
      hit(3, 50),
      hit(4, 1),
      hit(5, 2),
      hit(6, 900),
      hit(7, 3),
      hit(8, 400),
      hit(9, 4),
      hit(10, 1),
    ];

    expect(pickSearchResults(hits)).toEqual([6, 8, 3, 1, 9, 7, 4, 2]);
  });

  it("à égalité de votes, garde l’ordre de TMDB", () => {
    expect(pickSearchResults([hit(3), hit(1), hit(2)])).toEqual([3, 1, 2]);
  });

  it("au plus 8 films, sans doublon d’une page à l’autre", () => {
    const hits = [...obscure(20), ...obscure(20, 15)];

    const picked = pickSearchResults(hits);

    expect(picked).toHaveLength(8);
    expect(new Set(picked).size).toBe(8);
  });

  it("rend tout quand TMDB en trouve moins de 8", () => {
    expect(pickSearchResults([hit(1, 1), hit(2, 2)])).toEqual([2, 1]);
    expect(pickSearchResults([])).toEqual([]);
  });
});
