import { describe, expect, it } from "vitest";
import { parseServerEnv } from "./env";

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
      DATABASE_URL: "file:local.db",
      ACCESS_CODE: "pop corn ce soir",
    });
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
});
