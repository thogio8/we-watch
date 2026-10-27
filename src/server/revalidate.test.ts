import { revalidatePath } from "next/cache";
import { describe, expect, it, vi } from "vitest";
import { revalidateListPages } from "./revalidate";

vi.mock("next/cache");

describe("revalidateListPages", () => {
  it("rend périmés TIRER, LISTE et les fiches, pas le swipe", () => {
    revalidateListPages();

    expect(vi.mocked(revalidatePath).mock.calls).toEqual([
      ["/"],
      ["/list", "layout"],
    ]);
  });
});
