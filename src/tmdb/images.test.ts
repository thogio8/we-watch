import { describe, expect, it } from "vitest";
import { posterUrl } from "./images";

describe("posterUrl", () => {
  it("construit l'URL d'image", () => {
    expect(posterUrl("/a.jpg", "w342")).toBe(
      "https://image.tmdb.org/t/p/w342/a.jpg",
    );
  });
});
