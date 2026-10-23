import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAccessToken } from "@/access/token";
import { unlock } from "./actions";
import { WRONG_CODE_DELAY_MS } from "./state";

const set = vi.fn();
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT ${url}`);
});

vi.mock("@/env", () => ({
  getServerEnv: () => ({ ACCESS_CODE: "popcorn" }),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ set }) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
}));

/** Lets the real crypto work finish until the action arms its delay. */
async function untilDelayIsArmed(): Promise<void> {
  while (vi.getTimerCount() === 0) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function form(code?: string): FormData {
  const data = new FormData();
  if (code !== undefined) {
    data.set("code", code);
  }
  return data;
}

beforeEach(() => {
  set.mockReset();
  redirect.mockClear();
  // Only setTimeout: Web Crypto and setImmediate keep running for real.
  vi.useFakeTimers({ toFake: ["setTimeout"] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("unlock", () => {
  it("pose le cookie d'accès puis redirige vers l'accueil", async () => {
    await expect(unlock({ error: null }, form("popcorn"))).rejects.toThrow(
      "NEXT_REDIRECT /",
    );

    expect(set).toHaveBeenCalledWith(
      "ww_access",
      await createAccessToken("popcorn"),
      {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/",
        maxAge: 31_536_000,
      },
    );
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("exige https pour le cookie en production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await expect(unlock({ error: null }, form("popcorn"))).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(set).toHaveBeenCalledWith(
      "ww_access",
      expect.any(String),
      expect.objectContaining({ secure: true }),
    );
  });

  it.each([
    ["un mauvais code", form("pop-corn")],
    ["un champ vide", form("")],
    ["un champ absent", form()],
  ])(
    "répond MAUVAIS CODE après un délai fixe pour %s",
    async (_label, data) => {
      let settled = false;
      const pending = unlock({ error: null }, data).finally(() => {
        settled = true;
      });

      await untilDelayIsArmed();
      await vi.advanceTimersByTimeAsync(WRONG_CODE_DELAY_MS - 1);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);

      await expect(pending).resolves.toEqual({ error: "MAUVAIS CODE" });
      expect(set).not.toHaveBeenCalled();
      expect(redirect).not.toHaveBeenCalled();
    },
  );

  it("refuse un fichier à la place du code", async () => {
    const data = new FormData();
    data.set("code", new Blob(["popcorn"]));

    const pending = unlock({ error: null }, data);
    await untilDelayIsArmed();
    await vi.advanceTimersByTimeAsync(WRONG_CODE_DELAY_MS);

    await expect(pending).resolves.toEqual({ error: "MAUVAIS CODE" });
    expect(set).not.toHaveBeenCalled();
  });
});
