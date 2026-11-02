import { describe, expect, it, vi } from "vitest";
import { listMyPasskeys, listMySessions } from "./load";

const passkeysOf = vi.fn();
const sessionsOf = vi.fn();

vi.mock("@/server/container", () => ({
  getAccount: () => ({ passkeysOf, sessionsOf }),
}));

const T0 = new Date(2026, 9, 1);

describe("listMyPasskeys", () => {
  it("donne mes passkeys ; sans nom, « CLÉ D’ACCÈS »", async () => {
    passkeysOf.mockResolvedValue([
      { id: "p-1", name: "iPhone · Safari", createdAt: T0 },
      { id: "p-2", name: null, createdAt: null },
    ]);

    await expect(listMyPasskeys("user-1")).resolves.toEqual([
      { id: "p-1", name: "iPhone · Safari", createdAt: T0 },
      { id: "p-2", name: "CLÉ D’ACCÈS", createdAt: null },
    ]);
    expect(passkeysOf).toHaveBeenCalledWith("user-1");
  });
});

describe("listMySessions", () => {
  it("donne mes appareils, nommés d’après leur navigateur, sans jeton ; « CET APPAREIL » pour le mien", async () => {
    const iphone =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
    sessionsOf.mockResolvedValue([
      { id: "session-1", userAgent: iphone, updatedAt: T0 },
      { id: "session-2", userAgent: null, updatedAt: T0 },
    ]);

    await expect(listMySessions("user-1", "session-1")).resolves.toEqual([
      {
        id: "session-1",
        device: "iPhone · Safari",
        lastActiveAt: T0,
        current: true,
      },
      {
        id: "session-2",
        device: "APPAREIL INCONNU",
        lastActiveAt: T0,
        current: false,
      },
    ]);
    expect(sessionsOf).toHaveBeenCalledWith("user-1");
  });
});
