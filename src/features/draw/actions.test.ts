import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertMember } from "@/server/groups";
import { revalidateListPages } from "@/server/revalidate";
import { expectRefusedFirst } from "@tests/helpers/refused";
import { markWatched } from "./actions";

const apply = vi.fn();

vi.mock("@/server/groups");
vi.mock("@/server/container", () => ({
  getGroupList: () => ({ apply }),
}));
vi.mock("@/server/revalidate");

beforeEach(() => {
  vi.mocked(assertMember).mockClear();
  apply.mockReset().mockResolvedValue("applied");
  vi.mocked(revalidateListPages).mockReset();
});

describe("markWatched", () => {
  it("passe le film en vu dans le groupe, au nom de Léa, et rafraîchit les pages", async () => {
    await markWatched("groupe-1", 129);

    expect(assertMember).toHaveBeenCalledWith("groupe-1");
    expect(apply).toHaveBeenCalledWith({
      groupId: "groupe-1",
      userId: "user-1",
      action: "mark_watched",
      tmdbId: 129,
    });
    expect(revalidateListPages).toHaveBeenCalledOnce();
  });

  it.each([0, -1, 1.5, Number.NaN, "129" as unknown as number])(
    "refuse un identifiant invalide (%s)",
    async (tmdbId) => {
      await expect(markWatched("groupe-1", tmdbId)).rejects.toThrow(
        "invalid tmdbId",
      );
      expect(apply).not.toHaveBeenCalled();
    },
  );

  it("hors du groupe (ou sans session) : refuse avant toute validation, sans rien appliquer", async () => {
    await expectRefusedFirst(
      () => markWatched("groupe-b", 0),
      [apply, vi.mocked(revalidateListPages)],
    );
  });
});
