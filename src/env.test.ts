import { describe, expect, it, vi } from "vitest";
import { getServerEnv, parseServerEnv } from "./env";

describe("parseServerEnv", () => {
  it("accepte une config locale sans auth token", () => {
    expect(
      parseServerEnv({
        TMDB_ACCESS_TOKEN: "tok",
        DATABASE_URL: "file:local.db",
        ACCESS_CODE: "pop corn ce soir",
      }),
    ).toEqual({
      TMDB_ACCESS_TOKEN: "tok",
      TMDB_API_URL: "https://api.themoviedb.org/3",
      DATABASE_URL: "file:local.db",
      ACCESS_CODE: "pop corn ce soir",
    });
  });
  it("accepte une autre adresse TMDB (faux TMDB des tests e2e)", () => {
    expect(
      parseServerEnv({
        TMDB_ACCESS_TOKEN: "tok",
        TMDB_API_URL: "http://127.0.0.1:3101/3",
        DATABASE_URL: "file:e2e.db",
        ACCESS_CODE: "pop corn ce soir",
      }).TMDB_API_URL,
    ).toBe("http://127.0.0.1:3101/3");
  });
  it("refuse un token TMDB manquant ou vide", () => {
    expect(() =>
      parseServerEnv({
        TMDB_ACCESS_TOKEN: "",
        DATABASE_URL: "file:local.db",
        ACCESS_CODE: "pop corn ce soir",
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
      }).DATABASE_AUTH_TOKEN,
    ).toBeUndefined();
  });
  it("refuse un code d'accès manquant", () => {
    expect(() =>
      parseServerEnv({ TMDB_ACCESS_TOKEN: "t", DATABASE_URL: "file:local.db" }),
    ).toThrow(/ACCESS_CODE/);
  });
  it("refuse un code d'accès de moins de 8 caractères", () => {
    expect(() =>
      parseServerEnv({
        TMDB_ACCESS_TOKEN: "t",
        DATABASE_URL: "file:local.db",
        ACCESS_CODE: "popcorn",
      }),
    ).toThrow(/ACCESS_CODE: ACCESS_CODE must be at least 8 characters/);
  });
  it("CRON_SECRET est facultatif, vide = absent", () => {
    const base = {
      TMDB_ACCESS_TOKEN: "t",
      DATABASE_URL: "file:local.db",
      ACCESS_CODE: "pop corn ce soir",
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
        CRON_SECRET: "court",
      }),
    ).toThrow(/CRON_SECRET must be at least 16 characters/);
  });
});

describe("getServerEnv", () => {
  it("lit process.env une seule fois", () => {
    vi.stubEnv("TMDB_ACCESS_TOKEN", "tok");
    vi.stubEnv("DATABASE_URL", "file:local.db");
    vi.stubEnv("ACCESS_CODE", "pop corn ce soir");
    const first = getServerEnv();
    vi.stubEnv("DATABASE_URL", "file:autre.db");

    expect(getServerEnv()).toBe(first);
    expect(first.DATABASE_URL).toBe("file:local.db");
    vi.unstubAllEnvs();
  });
});
