import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createAccessToken, isValidAccessToken } from "./token";

const CODE = "popcorn";

describe("createAccessToken", () => {
  it("calcule le HMAC-SHA256 hexadécimal du message versionné", async () => {
    const expected = createHmac("sha256", CODE)
      .update("we-watch-access-v1")
      .digest("hex");

    await expect(createAccessToken(CODE)).resolves.toBe(expected);
  });

  it("change quand le code change", async () => {
    const [a, b] = await Promise.all([
      createAccessToken(CODE),
      createAccessToken("popcorn2"),
    ]);
    expect(a).not.toBe(b);
  });
});

describe("isValidAccessToken", () => {
  it("accepte le jeton du code courant", async () => {
    const token = await createAccessToken(CODE);
    await expect(isValidAccessToken(token, CODE)).resolves.toBe(true);
  });

  it("refuse un jeton signé avec un ancien code", async () => {
    const token = await createAccessToken("ancien-code");
    await expect(isValidAccessToken(token, CODE)).resolves.toBe(false);
  });

  it("refuse un jeton altéré de même longueur", async () => {
    const token = await createAccessToken(CODE);
    const tampered = `${token.slice(0, -1)}${token.endsWith("0") ? "1" : "0"}`;
    await expect(isValidAccessToken(tampered, CODE)).resolves.toBe(false);
  });

  it.each([undefined, "", "abc", "x".repeat(65)])(
    "refuse un jeton absent ou mal formé (%s)",
    async (token) => {
      await expect(isValidAccessToken(token, CODE)).resolves.toBe(false);
    },
  );
});
