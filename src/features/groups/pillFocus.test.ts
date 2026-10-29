// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import type { CreateGroupResult } from "./actions";
import { takePillFocus, withPillFocus } from "./pillFocus";

const created = (): Promise<CreateGroupResult> =>
  Promise.resolve({ ok: true, groupId: "g-1" });

describe("withPillFocus", () => {
  it("une création réussie demande le focus une seule fois", async () => {
    await withPillFocus(created)(new FormData());

    expect(takePillFocus()).toBe(true);
    expect(takePillFocus()).toBe(false);
  });

  it("une création refusée ou en panne ne demande rien", async () => {
    await withPillFocus(() =>
      Promise.resolve({ ok: false, error: "UN NOM DE 1 À 30 CARACTÈRES" }),
    )(new FormData());
    await expect(
      withPillFocus(() => Promise.reject(new Error("panne")))(new FormData()),
    ).rejects.toThrow("panne");

    expect(takePillFocus()).toBe(false);
  });

  it("sans sessionStorage (navigation privée), rien ne casse", async () => {
    const denied = () => {
      throw new Error("SecurityError");
    };
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(denied);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(denied);

    await expect(withPillFocus(created)(new FormData())).resolves.toEqual({
      ok: true,
      groupId: "g-1",
    });
    expect(takePillFocus()).toBe(false);
  });
});
