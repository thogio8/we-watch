import { lt } from "drizzle-orm";
import { session, signupTicketUse, verification } from "./auth-schema";
import type { Database } from "./create-database";
import { rateLimit } from "./rate-limit-schema";

/** A used signup ticket lives 10 minutes: its jti is useless after that. */
const SIGNUP_TICKET_KEPT_MS = 15 * 60 * 1000;
/** The longest attempt window is one hour: a day-old one is long over. */
const RATE_LIMIT_KEPT_MS = 24 * 60 * 60 * 1000;

/** How many rows each purge deleted. */
type Purged = {
  verifications: number;
  signupTickets: number;
  sessions: number;
  rateLimits: number;
};

export interface Housekeeping {
  /**
   * Deletes the rows nobody will read again: expired verifications and
   * sessions, signup tickets used more than 15 minutes ago, attempt windows
   * started more than 24 hours ago. Nothing else: no row here is a parent.
   */
  purge(now?: Date): Promise<Purged>;
}

export function createHousekeeping(db: Database): Housekeeping {
  return {
    async purge(now = new Date()) {
      const at = now.getTime();
      const deleted = await db.batch([
        db.delete(verification).where(lt(verification.expiresAt, now)),
        db
          .delete(signupTicketUse)
          .where(
            lt(signupTicketUse.usedAt, new Date(at - SIGNUP_TICKET_KEPT_MS)),
          ),
        db.delete(session).where(lt(session.expiresAt, now)),
        db
          .delete(rateLimit)
          .where(lt(rateLimit.windowStart, at - RATE_LIMIT_KEPT_MS)),
      ]);
      const [verifications, signupTickets, sessions, rateLimits] = deleted.map(
        ({ rowsAffected }) => rowsAffected,
      ) as [number, number, number, number];
      return { verifications, signupTickets, sessions, rateLimits };
    },
  };
}
