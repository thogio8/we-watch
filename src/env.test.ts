import { describe, expect, it, vi } from "vitest";
import { getServerEnv, parseServerEnv } from "./env";

const AUTH = {
  BETTER_AUTH_SECRET: "0123456789abcdef0123456789abcdef",
  BETTER_AUTH_URL: "http://localhost:3000",
};

const BASE = {
  TMDB_ACCESS_TOKEN: "t",
  DATABASE_URL: "file:local.db",
  ACCESS_CODE: "pop corn ce soir",
  ...AUTH,
};

describe("parseServerEnv", () => {
  it("accepte une config locale sans auth token", () => {
    expect(
      parseServerEnv({
        TMDB_ACCESS_TOKEN: "tok",
        DATABASE_URL: "file:local.db",
        ACCESS_CODE: "pop corn ce soir",
        ...AUTH,
      }),
    ).toEqual({
      TMDB_ACCESS_TOKEN: "tok",
      TMDB_API_URL: "https://api.themoviedb.org/3",
      DATABASE_URL: "file:local.db",
      ACCESS_CODE: "pop corn ce soir",
      ...AUTH,
      SIGNUP: "open",
    });
  });
  it("accepte une autre adresse TMDB (faux TMDB des tests e2e)", () => {
    expect(
      parseServerEnv({
        TMDB_ACCESS_TOKEN: "tok",
        TMDB_API_URL: "http://127.0.0.1:3101/3",
        DATABASE_URL: "file:e2e.db",
        ACCESS_CODE: "pop corn ce soir",
        ...AUTH,
      }).TMDB_API_URL,
    ).toBe("http://127.0.0.1:3101/3");
  });
  it("refuse un token TMDB manquant ou vide", () => {
    expect(() =>
      parseServerEnv({
        TMDB_ACCESS_TOKEN: "",
        DATABASE_URL: "file:local.db",
        ACCESS_CODE: "pop corn ce soir",
        ...AUTH,
      }),
    ).toThrow(/TMDB_ACCESS_TOKEN/);
  });
  it("transforme un DATABASE_AUTH_TOKEN vide en undefined", () => {
    expect(
      parseServerEnv({
        TMDB_ACCESS_TOKEN: "t",
        DATABASE_URL: "libsql://x.turso.io",
        DATABASE_AUTH_TOKEN: "",
        ACCESS_CODE: "pop corn ce soir",
        ...AUTH,
      }).DATABASE_AUTH_TOKEN,
    ).toBeUndefined();
  });
  it("refuse un code d'accès manquant", () => {
    expect(() =>
      parseServerEnv({
        TMDB_ACCESS_TOKEN: "t",
        DATABASE_URL: "file:local.db",
        ...AUTH,
      }),
    ).toThrow(/ACCESS_CODE/);
  });
  it("refuse un code d'accès de moins de 8 caractères", () => {
    expect(() =>
      parseServerEnv({
        TMDB_ACCESS_TOKEN: "t",
        DATABASE_URL: "file:local.db",
        ACCESS_CODE: "popcorn",
        ...AUTH,
      }),
    ).toThrow(/ACCESS_CODE: ACCESS_CODE must be at least 8 characters/);
  });
  it("CRON_SECRET est facultatif, vide = absent", () => {
    const base = {
      TMDB_ACCESS_TOKEN: "t",
      DATABASE_URL: "file:local.db",
      ACCESS_CODE: "pop corn ce soir",
      ...AUTH,
    };
    expect(parseServerEnv({ ...base, CRON_SECRET: "" })).not.toHaveProperty(
      "CRON_SECRET",
    );
    expect(
      parseServerEnv({ ...base, CRON_SECRET: "0123456789abcdef" }).CRON_SECRET,
    ).toBe("0123456789abcdef");
  });
  it("refuse un CRON_SECRET de moins de 16 caractères", () => {
    expect(() =>
      parseServerEnv({
        TMDB_ACCESS_TOKEN: "t",
        DATABASE_URL: "file:local.db",
        ACCESS_CODE: "pop corn ce soir",
        ...AUTH,
        CRON_SECRET: "court",
      }),
    ).toThrow(/CRON_SECRET must be at least 16 characters/);
  });
  it("refuse un BETTER_AUTH_SECRET de moins de 32 caractères", () => {
    expect(() =>
      parseServerEnv({ ...BASE, BETTER_AUTH_SECRET: "trop-court" }),
    ).toThrow(/BETTER_AUTH_SECRET must be at least 32 characters/);
  });
  it("SIGNUP vaut open par défaut", () => {
    expect(parseServerEnv(BASE).SIGNUP).toBe("open");
  });
  it("SIGNUP refuse une autre valeur que open ou invite", () => {
    expect(() => parseServerEnv({ ...BASE, SIGNUP: "closed" })).toThrow(
      /SIGNUP/,
    );
    expect(parseServerEnv({ ...BASE, SIGNUP: "invite" }).SIGNUP).toBe("invite");
  });
  it("OWNER_CODE vide équivaut à absent", () => {
    expect(parseServerEnv({ ...BASE, OWNER_CODE: "" })).not.toHaveProperty(
      "OWNER_CODE",
    );
    expect(
      parseServerEnv({ ...BASE, OWNER_CODE: "0123456789ab" }).OWNER_CODE,
    ).toBe("0123456789ab");
  });
  it("OWNER_CODE est rogné", () => {
    expect(
      parseServerEnv({ ...BASE, OWNER_CODE: "  0123456789ab \n" }).OWNER_CODE,
    ).toBe("0123456789ab");
  });
  it("OWNER_CODE fait d'espaces équivaut à absent", () => {
    expect(parseServerEnv({ ...BASE, OWNER_CODE: "   " })).not.toHaveProperty(
      "OWNER_CODE",
    );
  });
  it("refuse un OWNER_CODE de moins de 12 caractères", () => {
    expect(() => parseServerEnv({ ...BASE, OWNER_CODE: "court" })).toThrow(
      /OWNER_CODE must be at least 12 characters/,
    );
  });
});

describe("getServerEnv", () => {
  it("lit process.env une seule fois", () => {
    vi.stubEnv("TMDB_ACCESS_TOKEN", "tok");
    vi.stubEnv("DATABASE_URL", "file:local.db");
    vi.stubEnv("ACCESS_CODE", "pop corn ce soir");
    vi.stubEnv("BETTER_AUTH_SECRET", AUTH.BETTER_AUTH_SECRET);
    vi.stubEnv("BETTER_AUTH_URL", AUTH.BETTER_AUTH_URL);
    const first = getServerEnv();
    vi.stubEnv("DATABASE_URL", "file:autre.db");

    expect(getServerEnv()).toBe(first);
    expect(first.DATABASE_URL).toBe("file:local.db");
    vi.unstubAllEnvs();
  });
});
