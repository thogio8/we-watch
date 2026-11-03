import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Attempt counters (2.0, piece 6): one fixed window per key, written by
// src/db/rate-limit.ts only. Not a Better Auth model: Better Auth reaches it
// through rateLimit.customStorage.
export const rateLimit = sqliteTable("rate_limit", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  /** When the current window started, in milliseconds since the epoch. */
  windowStart: integer("window_start").notNull(),
});
