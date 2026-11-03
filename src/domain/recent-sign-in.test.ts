import { describe, expect, it } from "vitest";
import {
  isRecentSignIn,
  isStaleSession,
  RECENT_SIGN_IN_SECONDS,
} from "./recent-sign-in";

const NOW = new Date("2026-11-03T20:00:00Z");
const ago = (seconds: number) => new Date(NOW.getTime() - seconds * 1000);

describe("isRecentSignIn", () => {
  it("une session ouverte il y a moins de 10 minutes est récente", () => {
    expect(RECENT_SIGN_IN_SECONDS).toBe(600);
    expect(isRecentSignIn(NOW, NOW)).toBe(true);
    expect(isRecentSignIn(ago(599), NOW)).toBe(true);
  });

  it("à 10 minutes pile, ou 59 jours, elle ne l’est plus", () => {
    expect(isRecentSignIn(ago(600), NOW)).toBe(false);
    expect(isRecentSignIn(ago(59 * 24 * 3600), NOW)).toBe(false);
  });
});

describe("isStaleSession", () => {
  it("une erreur 403 « SESSION_NOT_FRESH » : session trop ancienne", () => {
    expect(isStaleSession({ status: 403, code: "SESSION_NOT_FRESH" })).toBe(
      true,
    );
  });

  it.each([
    { status: 403, code: "FORBIDDEN" },
    { status: 400, code: "SESSION_NOT_FRESH" },
    { code: "SESSION_NOT_FRESH" },
    {},
    null,
    undefined,
  ])("%o : non", (error) => {
    expect(isStaleSession(error)).toBe(false);
  });
});
