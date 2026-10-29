import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertSignedIn } from "@/server/session";
import { revalidateListPages } from "@/server/revalidate";
import { markWatched } from "./actions";

const apply = vi.fn();

vi.mock("@/server/session");
vi.mock("@/server/container", () => ({
  getMoviesRepository: () => ({ apply }),
}));
vi.mock("@/server/revalidate");

beforeEach(() => {
  vi.mocked(assertSignedIn)
    .mockReset()
    .mockResolvedValue({ userId: "user-1", name: "Léa" });
  apply.mockReset().mockResolvedValue("applied");
  vi.mocked(revalidateListPages).mockReset();
});

describe("markWatched", () => {
  it("passe le film en vu et rafraîchit toutes les pages", async () => {
    await markWatched(129);

    expect(apply).toHaveBeenCalledWith("mark_watched", 129);
    expect(revalidateListPages).toHaveBeenCalledOnce();
  });

  it.each([0, -1, 1.5, Number.NaN, "129" as unknown as number])(
    "refuse un identifiant invalide (%s)",
    async (tmdbId) => {
      await expect(markWatched(tmdbId)).rejects.toThrow("invalid tmdbId");
      expect(apply).not.toHaveBeenCalled();
    },
  );
});

describe("sans session", () => {
  it("markWatched refuse sans rien appliquer", async () => {
    vi.mocked(assertSignedIn).mockRejectedValue(new Error("not signed in"));

    await expect(markWatched(129)).rejects.toThrow("not signed in");
    expect(apply).not.toHaveBeenCalled();
    expect(revalidateListPages).not.toHaveBeenCalled();
  });
});
