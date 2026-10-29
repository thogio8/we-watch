import { describe, expect, it } from "vitest";
import { generateId } from "./ids";

describe("generateId", () => {
  it("une appartenance n'a pas d'id : sa clé est le groupe et le membre", () => {
    expect(generateId({ model: "membership" })).toBe(false);
  });

  it("les autres modèles gardent l'id par défaut de Better Auth", () => {
    const id = generateId({ model: "user" });

    expect(id).toMatch(/^[a-zA-Z0-9]{32}$/);
    expect(generateId({ model: "user" })).not.toBe(id);
  });

  it("une taille demandée est respectée", () => {
    expect(generateId({ model: "verification", size: 12 })).toMatch(
      /^[a-zA-Z0-9]{12}$/,
    );
  });

  it("une taille nulle donne la taille par défaut, comme Better Auth", () => {
    expect(generateId({ model: "session", size: 0 })).toMatch(
      /^[a-zA-Z0-9]{32}$/,
    );
  });
});
