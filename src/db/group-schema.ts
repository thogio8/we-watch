import { sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { MovieStatus } from "@/domain/movie";
import { user } from "./auth-schema";
import { snapshotColumns } from "./schema";

// Groups (2.0, piece 2). Migration 0006 copied the pre-accounts table `movies`
// into a group of its own; `movies` is no longer written but stays untouched
// for a rollback to 1.3.x until a later version.

const timestamp = (name: string) => integer(name, { mode: "timestamp_ms" });
const now = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

/** TMDB data of a movie, shared by every group and refreshed by the cron. */
export const movieSnapshot = sqliteTable("movie_snapshot", snapshotColumns());

// `group` is an SQL keyword: the table is app_group.
export const group = sqliteTable(
  "app_group",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").default(now).notNull(),
    /** The invite link's secret: created on demand, replaced to revoke it. */
    inviteToken: text("invite_token"),
  },
  (table) => [
    uniqueIndex("app_group_invite_token_unique").on(table.inviteToken),
  ],
);

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
    /** Favourite (2.1.0): set only while « to_watch »; null = not a favourite. */
    favoriteAt: timestamp("favorite_at"),
    favoriteBy: author("favorite_by"),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.tmdbId] }),
    index("group_movie_group_status_idx").on(table.groupId, table.status),
    // Account deletion finds the member's movies to hand to « un ancien membre ».
    index("group_movie_added_by_idx").on(table.addedBy),
    index("group_movie_watched_by_idx").on(table.watchedBy),
    index("group_movie_favorite_by_idx").on(table.favoriteBy),
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
    index("movie_want_user_id_idx").on(table.userId),
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
