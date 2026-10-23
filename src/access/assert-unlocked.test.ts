import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertUnlocked } from "./assert-unlocked";
import { createAccessToken } from "./token";

const cookie = vi.hoisted(() => ({ value: undefined as string | undefined }));
const get = vi.fn((name: string) =>
  cookie.value === undefined ? undefined : { name, value: cookie.value },
);

vi.mock("@/env", () => ({
  getServerEnv: () => ({ ACCESS_CODE: "popcorn" }),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get }) }));

beforeEach(() => {
  cookie.value = undefined;
  get.mockClear();
});

describe("assertUnlocked", () => {
  it("laisse passer un appareil déverrouillé", async () => {
    cookie.value = await createAccessToken("popcorn");

    await expect(assertUnlocked()).resolves.toBeUndefined();
    expect(get).toHaveBeenCalledWith("ww_access");
  });

  it("refuse sans cookie", async () => {
    await expect(assertUnlocked()).rejects.toThrow("locked");
  });

  it("refuse un cookie invalide ou signé avec un ancien code", async () => {
    cookie.value = await createAccessToken("ancien-code");
    await expect(assertUnlocked()).rejects.toThrow("locked");

    cookie.value = "n-importe-quoi";
    await expect(assertUnlocked()).rejects.toThrow("locked");
  });
});
