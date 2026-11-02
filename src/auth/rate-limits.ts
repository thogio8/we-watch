import type { BetterAuthOptions } from "better-auth";
import type { RateLimits, RateRule } from "@/db/rate-limit";
import { authPathOf, isAuthPath } from "./auth-paths";

const TEN_MINUTES = 10 * 60;

/** Attempt limits of the passkey ceremonies, per IP and path. */
export const AUTH_RATE_RULES = {
  "/passkey/generate-authenticate-options": { window: TEN_MINUTES, max: 30 },
  "/passkey/verify-authentication": { window: TEN_MINUTES, max: 20 },
  "/passkey/generate-register-options": { window: TEN_MINUTES, max: 10 },
  "/passkey/verify-registration": { window: TEN_MINUTES, max: 10 },
} satisfies Record<string, RateRule>;

/**
 * Better Auth's limits, on in every environment (tests included), counted
 * in our table. Better Auth counts before any plugin runs, under the key
 * `ip|path`: the last rule ("/**", matched only when no passkey rule is)
 * keeps unknown or unused paths out of the table.
 */
export function authRateLimit(storage: RateLimits) {
  return {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      ...AUTH_RATE_RULES,
      "/**": (request: Request, current: RateRule) =>
        isAuthPath(authPathOf(request.url)) ? current : (false as const),
    },
    customStorage: storage,
  } satisfies BetterAuthOptions["rateLimit"];
}
