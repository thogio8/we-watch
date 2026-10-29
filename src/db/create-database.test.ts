import { describe, expect, it } from "vitest";
import { createDatabase } from "./create-database";

describe("createDatabase", () => {
  it("accepte un jeton d'authentification optionnel", () => {
    expect(createDatabase(":memory:", "token")).toBeDefined();
  });
});
