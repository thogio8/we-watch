import "server-only";
import { getIP } from "better-auth/api";
import { headers } from "next/headers";
import { ACTION_LIMITS, type ActionLimit } from "@/domain/rate-limit";
import { getAuth, getRateLimits } from "./container";

/** Better Auth's own key when no client IP can be trusted: one shared bucket. */
const NO_TRUSTED_IP = "no-trusted-ip";

/**
 * The client IP of the current request, read as Better Auth reads it (same
 * headers, same normalisation), so both count the same person alike.
 */
export async function clientIp(): Promise<string> {
  return getIP(await headers(), getAuth().options) ?? NO_TRUSTED_IP;
}

/**
 * Counts one attempt of `name` by `subject` (an IP or a user id) and says
 * whether it is allowed. Called after the session check, before any
 * validation: an invalid attempt counts too.
 */
export async function withinLimit(
  name: ActionLimit,
  subject: string,
): Promise<boolean> {
  const { allowed } = await getRateLimits().consume(
    `${name}:${subject}`,
    ACTION_LIMITS[name],
  );
  return allowed;
}
