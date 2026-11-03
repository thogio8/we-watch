import { sql } from "drizzle-orm";
import type { Database } from "./create-database";
import { rateLimit } from "./rate-limit-schema";

/** A limit: at most `max` attempts per fixed window of `window` seconds. */
export type RateRule = { window: number; max: number };

type RateDecision = { allowed: boolean; retryAfter: number | null };

/** Same shape as Better Auth's BetterAuthRateLimitStorage (customStorage). */
export interface RateLimits {
  /**
   * Counts one attempt against `key`, before anything is checked (a refused
   * or invalid attempt counts too), and says whether it is allowed;
   * `retryAfter`: the seconds left in the window when it is not.
   */
  consume(key: string, rule: RateRule, now?: Date): Promise<RateDecision>;
}

export function createRateLimits(db: Database): RateLimits {
  return {
    async consume(key, rule, now = new Date()) {
      const at = now.getTime();
      const windowMs = rule.window * 1000;
      const expired = sql`${rateLimit.windowStart} + ${windowMs} <= ${at}`;
      // One statement, so concurrent attempts cannot all read a stale count.
      // SQLite evaluates every SET expression on the row as it was before
      // the update: window_start below is still the old one.
      const [row] = await db
        .insert(rateLimit)
        .values({ key, count: 1, windowStart: at })
        .onConflictDoUpdate({
          target: rateLimit.key,
          set: {
            count: sql`CASE WHEN ${expired} THEN 1 ELSE ${rateLimit.count} + 1 END`,
            windowStart: sql`CASE WHEN ${expired} THEN ${at} ELSE ${rateLimit.windowStart} END`,
          },
        })
        .returning({
          count: rateLimit.count,
          windowStart: rateLimit.windowStart,
        });
      const { count, windowStart } = row as {
        count: number;
        windowStart: number;
      };
      return count <= rule.max
        ? { allowed: true, retryAfter: null }
        : {
            allowed: false,
            retryAfter: Math.ceil((windowStart + windowMs - at) / 1000),
          };
    },
  };
}
