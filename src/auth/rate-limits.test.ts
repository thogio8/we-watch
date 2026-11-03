import { describe, expect, it } from "vitest";
import { AUTH_RATE_RULES, authRateLimit } from "./rate-limits";

const TEN_MINUTES = 10 * 60;
const storage = { consume: async () => ({ allowed: true, retryAfter: null }) };

describe("AUTH_RATE_RULES", () => {
  it("limite chaque étape des cérémonies passkey par IP sur 10 minutes", () => {
    expect(AUTH_RATE_RULES).toEqual({
      "/passkey/generate-authenticate-options": {
        window: TEN_MINUTES,
        max: 30,
      },
      "/passkey/verify-authentication": { window: TEN_MINUTES, max: 20 },
      "/passkey/generate-register-options": { window: TEN_MINUTES, max: 10 },
      "/passkey/verify-registration": { window: TEN_MINUTES, max: 10 },
    });
  });
});

describe("authRateLimit", () => {
  const options = authRateLimit(storage);
  const rest = options.customRules["/**"];
  const request = (path: string) =>
    new Request(`http://localhost:3000/api/auth${path}`);
  const current = { window: 60, max: 100 };

  it("toujours active, 100 requêtes par minute par défaut, dans notre stockage", () => {
    expect(options).toMatchObject({
      enabled: true,
      window: 60,
      max: 100,
      customStorage: storage,
    });
  });

  it("les règles passkey passent avant la règle « /** », qui vient en dernier", () => {
    expect(Object.keys(options.customRules)).toEqual([
      ...Object.keys(AUTH_RATE_RULES),
      "/**",
    ]);
  });

  it("un chemin ouvert garde la règle courante", () => {
    expect(rest(request("/sign-out"), current)).toBe(current);
  });

  it("un chemin fermé ou inconnu n'est pas compté", () => {
    expect(rest(request("/get-session"), current)).toBe(false);
    expect(rest(request("/x1"), current)).toBe(false);
  });
});
