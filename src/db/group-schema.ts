import { sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import type { MovieStatus } from "@/domain/movie";
import { user } from "./auth-schema";
import { snapshotColumns } from "./schema";

// Groups (2.2). The pre-accounts table `movies` stays untouched for a
// rollback to 1.3.x: migration 0006 copies it into the legacy group.

const timestamp = (name: string) => integer(name, { mode: "timestamp_ms" });
const now = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

/** TMDB data of a movie, shared by every group and refreshed by the cron. */
export const movieSnapshot = sqliteTable("movie_snapshot", snapshotColumns());

// `group` is an SQL keyword: the table is app_group.
export const group = sqliteTable("app_group", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").default(now).notNull(),
});

const groupId = () =>
  text("group_id")
    .notNull()
    .references(() => group.id, { onDelete: "cascade" });

const member = () =>
  text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });

// An author whose account is deleted becomes « un ancien membre ».
const author = (name: string) =>
  text(name).references(() => user.id, { onDelete: "set null" });

export const membership = sqliteTable(
  "membership",
  {
    groupId: groupId(),
    userId: member(),
    joinedAt: timestamp("joined_at").default(now).notNull(),
    lastUsedAt: timestamp("last_used_at"),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.userId] }),
    index("membership_user_id_idx").on(table.userId),
  ],
);

/** A group's list: to watch, watched, or set aside for the group. */
export const groupMovie = sqliteTable(
  "group_movie",
  {
    groupId: groupId(),
    tmdbId: integer("tmdb_id")
      .notNull()
      .references(() => movieSnapshot.tmdbId),
    status: text("status", { enum: ["to_watch", "watched", "rejected"] })
      .$type<MovieStatus>()
      .notNull(),
    decidedAt: timestamp("decided_at").notNull(),
    watchedAt: timestamp("watched_at"),
    addedBy: author("added_by"),
    watchedBy: author("watched_by"),
    addedVia: text("added_via", {
      enum: ["swipe", "search", "legacy"],
    }).notNull(),
    /** Copied from the pre-accounts list: authors were never recorded. */
    legacy: integer("legacy", { mode: "boolean" }).default(false).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.tmdbId] }),
    index("group_movie_group_status_idx").on(table.groupId, table.status),
  ],
);

/** « ON LE VEUT » of a member, on a movie of the group's list. */
export const movieWant = sqliteTable(
  "movie_want",
  {
    groupId: text("group_id").notNull(),
    tmdbId: integer("tmdb_id").notNull(),
    userId: member(),
    wantedAt: timestamp("wanted_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.tmdbId, table.userId] }),
    foreignKey({
      columns: [table.groupId, table.tmdbId],
      foreignColumns: [groupMovie.groupId, groupMovie.tmdbId],
    }).onDelete("cascade"),
  ],
);

/** « ✕ BOF »: for the member alone, in all their groups. */
export const movieRejection = sqliteTable(
  "movie_rejection",
  {
    userId: member(),
    tmdbId: integer("tmdb_id").notNull(),
    rejectedAt: timestamp("rejected_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.tmdbId] })],
);
