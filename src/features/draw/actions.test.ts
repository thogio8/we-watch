import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertUnlocked } from "@/access/assert-unlocked";
import { revalidateListPages } from "@/server/revalidate";
import { markWatched } from "./actions";

const apply = vi.fn();

vi.mock("@/access/assert-unlocked");
vi.mock("@/server/container", () => ({
  getMoviesRepository: () => ({ apply }),
}));
vi.mock("@/server/revalidate");

beforeEach(() => {
  vi.mocked(assertUnlocked).mockReset().mockResolvedValue(undefined);
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

describe("appareil verrouillé", () => {
  it("markWatched refuse sans rien appliquer", async () => {
    vi.mocked(assertUnlocked).mockRejectedValue(new Error("device is locked"));

    await expect(markWatched(129)).rejects.toThrow("device is locked");
    expect(apply).not.toHaveBeenCalled();
    expect(revalidateListPages).not.toHaveBeenCalled();
  });
});
