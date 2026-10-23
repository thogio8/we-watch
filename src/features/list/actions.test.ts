import { beforeEach, describe, expect, it, vi } from "vitest";
import { removeFromList, unwatch } from "./actions";

const apply = vi.fn();
const revalidatePath = vi.fn();

vi.mock("@/server/container", () => ({
  getMoviesRepository: () => ({ apply }),
}));
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

beforeEach(() => {
  apply.mockReset().mockResolvedValue("applied");
  revalidatePath.mockReset();
});

describe.each([
  ["removeFromList", removeFromList, "remove"],
  ["unwatch", unwatch, "unwatch"],
] as const)("%s", (_name, action, movieAction) => {
  it(`applique « ${movieAction} » et ne rafraîchit que /list (R10)`, async () => {
    await action(129);

    expect(apply).toHaveBeenCalledExactlyOnceWith(movieAction, 129);
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith("/list");
  });

  it.each([0, -1, 1.5, Number.NaN, "129" as unknown as number])(
    "refuse un identifiant invalide (%s)",
    async (tmdbId) => {
      await expect(action(tmdbId)).rejects.toThrow("invalid tmdbId");
      expect(apply).not.toHaveBeenCalled();
      expect(revalidatePath).not.toHaveBeenCalled();
    },
  );
});
