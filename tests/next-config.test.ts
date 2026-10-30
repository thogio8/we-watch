import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

describe("next.config", () => {
  it("une page d’invitation n’envoie jamais son adresse (le jeton) en Referer", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];

    expect(rules).toContainEqual({
      source: "/invitation/:token*",
      headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
    });
  });
});
