import { beforeEach, describe, expect, it, vi } from "vitest";
import { markWatched } from "./actions";

const apply = vi.fn();
const revalidatePath = vi.fn();

const assertUnlocked = vi.fn();
vi.mock("@/access/assert-unlocked", () => ({
  assertUnlocked: () => assertUnlocked(),
}));
vi.mock("@/server/container", () => ({
  getMoviesRepository: () => ({ apply }),
}));
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

beforeEach(() => {
  assertUnlocked.mockReset().mockResolvedValue(undefined);
  apply.mockReset().mockResolvedValue("applied");
  revalidatePath.mockReset();
});

describe("markWatched", () => {
  it("passe le film en vu et rafraîchit toutes les pages", async () => {
    await markWatched(129);

    expect(apply).toHaveBeenCalledWith("mark_watched", 129);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
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
    assertUnlocked.mockRejectedValue(new Error("device is locked"));

    await expect(markWatched(129)).rejects.toThrow("device is locked");
    expect(apply).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
