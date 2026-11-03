import { beforeEach, describe, expect, it, vi } from "vitest";
import { signedOutRefusal } from "@/access/refusals";
import {
  assertRecentlySignedIn,
  assertSignedIn,
  getCurrentUser,
} from "./session";

const getSession = vi.fn();
const requestHeaders = new Headers({ cookie: "better-auth.session_token=x" });

vi.mock("next/headers", () => ({ headers: async () => requestHeaders }));
vi.mock("./container", () => ({
  getAuth: () => ({ api: { getSession } }),
}));

const SESSION = {
  user: { id: "user-1", name: "Léa", email: "x@passkey.invalid" },
  session: { id: "session-1", createdAt: new Date("2026-11-03T19:55:00Z") },
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

  it("sans session : refuse l'action, d'un refus que le client reconnaît (digest)", async () => {
    getSession.mockResolvedValue(null);

    await expect(assertSignedIn()).rejects.toThrow(
      "Server Action refused: not signed in",
    );
    await expect(assertSignedIn()).rejects.toHaveProperty(
      "digest",
      signedOutRefusal().digest,
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

describe("assertRecentlySignedIn", () => {
  it("une session ouverte il y a moins de 10 minutes (lue en base) : récente", async () => {
    getSession.mockResolvedValue(SESSION);

    await expect(
      assertRecentlySignedIn(new Date("2026-11-03T20:04:59Z")),
    ).resolves.toEqual({
      userId: "user-1",
      name: "Léa",
      sessionId: "session-1",
      recent: true,
    });
    expect(getSession).toHaveBeenCalledWith({
      headers: requestHeaders,
      query: { disableCookieCache: true, disableRefresh: true },
    });
  });

  it("ouverte il y a 10 minutes ou plus : pas récente", async () => {
    getSession.mockResolvedValue(SESSION);

    await expect(
      assertRecentlySignedIn(new Date("2026-11-03T20:05:00Z")),
    ).resolves.toMatchObject({ userId: "user-1", recent: false });
  });

  it("sans session : refuse l'action comme assertSignedIn", async () => {
    getSession.mockResolvedValue(null);

    await expect(assertRecentlySignedIn()).rejects.toHaveProperty(
      "digest",
      signedOutRefusal().digest,
    );
  });
});
