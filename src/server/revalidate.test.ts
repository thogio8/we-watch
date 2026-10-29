import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidateGroupPages, revalidateListPages } from "./revalidate";

vi.mock("next/cache");

beforeEach(() => {
  vi.mocked(revalidatePath).mockReset();
});

describe("revalidateListPages", () => {
  it("rend périmés TIRER, LISTE et les fiches, pas le swipe", () => {
    revalidateListPages();

    expect(vi.mocked(revalidatePath).mock.calls).toEqual([
      ["/"],
      ["/list", "layout"],
    ]);
  });
});

describe("revalidateGroupPages", () => {
  it("un autre groupe affiché : TIRER, LISTE, les fiches et SWIPER", () => {
    revalidateGroupPages();

    expect(vi.mocked(revalidatePath).mock.calls).toEqual([
      ["/"],
      ["/list", "layout"],
      ["/swipe"],
    ]);
  });
});
