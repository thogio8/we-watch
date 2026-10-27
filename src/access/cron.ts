import { constantTimeEqual } from "./token";

/**
 * Daily refresh of the movies (spec §11.2), called by Vercel Cron without the
 * access cookie: Vercel sends `Authorization: Bearer <CRON_SECRET>` instead.
 */
export const CRON_PATH = "/api/cron/refresh-movies";

/** No secret configured means the cron route stays closed. */
export function isCronAuthorized(
  authorization: string | null | undefined,
  secret: string | undefined,
): boolean {
  if (secret === undefined || authorization == null) return false;
  return constantTimeEqual(authorization, `Bearer ${secret}`);
}
