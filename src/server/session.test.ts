import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertSignedIn, getCurrentUser } from "./session";

const getSession = vi.fn();
const requestHeaders = new Headers({ cookie: "better-auth.session_token=x" });

vi.mock("next/headers", () => ({ headers: async () => requestHeaders }));
vi.mock("./container", () => ({
  getAuth: () => ({ api: { getSession } }),
}));

const SESSION = {
  user: { id: "user-1", name: "Léa", email: "x@passkey.invalid" },
  session: { id: "session-1" },
};

beforeEach(() => {
  getSession.mockReset();
});

describe("getCurrentUser", () => {
  it("relit la session en base à partir des en-têtes, sans le cache du cookie (révocation immédiate) ni écrire de cookie", async () => {
    getSession.mockResolvedValue(SESSION);

    await expect(getCurrentUser()).resolves.toEqual({
      userId: "user-1",
      name: "Léa",
      sessionId: "session-1",
    });
    expect(getSession).toHaveBeenCalledWith({
      headers: requestHeaders,
      query: { disableCookieCache: true, disableRefresh: true },
    });
  });

  it("si getSession lève (base injoignable, session supprimée) : null, journalisé sans détail sensible", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    getSession.mockRejectedValue(new Error("database down"));

    await expect(getCurrentUser()).resolves.toBeNull();
    expect(log).toHaveBeenCalledWith(
      "Session read failed, treated as signed out:",
      "database down",
    );
  });

  it("sans session : null", async () => {
    getSession.mockResolvedValue(null);

    await expect(getCurrentUser()).resolves.toBeNull();
  });
});

describe("assertSignedIn", () => {
  it("connecté : donne l'utilisateur", async () => {
    getSession.mockResolvedValue(SESSION);

    await expect(assertSignedIn()).resolves.toEqual({
      userId: "user-1",
      name: "Léa",
      sessionId: "session-1",
    });
  });

  it("sans session : refuse l'action", async () => {
    getSession.mockResolvedValue(null);

    await expect(assertSignedIn()).rejects.toThrow(
      "Server Action refused: not signed in",
    );
  });

  it("si la session ne peut être lue, l'action est refusée comme sans session", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    getSession.mockRejectedValue(new Error("database down"));

    await expect(assertSignedIn()).rejects.toThrow(
      "Server Action refused: not signed in",
    );
  });
});
