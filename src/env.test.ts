import { describe, expect, it } from "vitest";
import { parseServerEnv } from "./env";

describe("parseServerEnv", () => {
  it("accepte une config locale sans auth token", () => {
    expect(
      parseServerEnv({
        TMDB_ACCESS_TOKEN: "tok",
        DATABASE_URL: "file:local.db",
      }),
    ).toEqual({ TMDB_ACCESS_TOKEN: "tok", DATABASE_URL: "file:local.db" });
  });
  it("refuse un token TMDB manquant ou vide", () => {
    expect(() =>
      parseServerEnv({ TMDB_ACCESS_TOKEN: "", DATABASE_URL: "file:local.db" }),
    ).toThrow(/TMDB_ACCESS_TOKEN/);
  });
  it("transforme un DATABASE_AUTH_TOKEN vide en undefined", () => {
    expect(
      parseServerEnv({
        TMDB_ACCESS_TOKEN: "t",
        DATABASE_URL: "libsql://x.turso.io",
        DATABASE_AUTH_TOKEN: "",
      }).DATABASE_AUTH_TOKEN,
    ).toBeUndefined();
  });
});
