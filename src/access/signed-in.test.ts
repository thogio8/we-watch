import { describe, expect, it, vi } from "vitest";
import { readSignedIn } from "./signed-in";

describe("readSignedIn", () => {
  it("une session donne « connecté »", async () => {
    await expect(
      readSignedIn(async () => ({ user: { id: "user-1" } })),
    ).resolves.toBe(true);
  });

  it("sans session (absente, expirée ou forgée) : pas connecté", async () => {
    await expect(readSignedIn(async () => null)).resolves.toBe(false);
  });

  it("si la lecture échoue (base injoignable), on reste fermé, sans exception ni détail sensible", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      readSignedIn(async () => {
        throw new Error("database down");
      }),
    ).resolves.toBe(false);
    expect(log).toHaveBeenCalledWith(
      "Session check failed, treated as signed out:",
      "database down",
    );
  });

  it("une valeur levée qui n'est pas une erreur n'est pas journalisée telle quelle", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      readSignedIn(() => Promise.reject("better-auth.session_token=secret")),
    ).resolves.toBe(false);
    expect(log).toHaveBeenCalledWith(
      "Session check failed, treated as signed out:",
      "unknown error",
    );
  });
});
