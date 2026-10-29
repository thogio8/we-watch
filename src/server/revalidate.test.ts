import { revalidatePath } from "next/cache";
import { describe, expect, it, vi } from "vitest";
import { revalidateGroupPages } from "./revalidate";

vi.mock("next/cache");

describe("revalidateGroupPages", () => {
  it("rend périmés TIRER, LISTE et ses fiches, et SWIPER", () => {
    revalidateGroupPages();

    expect(vi.mocked(revalidatePath).mock.calls).toEqual([
      ["/"],
      ["/list", "layout"],
      ["/swipe"],
    ]);
  });
});
