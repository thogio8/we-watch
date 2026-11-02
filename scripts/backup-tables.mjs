// The tables a backup holds (scripts/backup-db.mjs) and a restore writes
// back (scripts/restore-db.mjs), in the order a restore inserts them:
// every row's foreign keys point to tables listed before it.

/**
 * What a restore needs, in restore order, with the columns read (`*`: all).
 * Never saved: `session`, `verification` (live credentials, worthless after
 * a restore: everyone signs in again with a passkey), `signup_ticket_use`
 * and `rate_limit` (minutes-long bookkeeping). `account` is read without
 * its secrets (access_token, refresh_token, id_token, password): they never
 * leave the database. `passkey` holds public keys only.
 */
export const TABLES = {
  user: "*",
  passkey: "*",
  account: [
    "id",
    "account_id",
    "provider_id",
    "user_id",
    "access_token_expires_at",
    "refresh_token_expires_at",
    "scope",
    "created_at",
    "updated_at",
  ],
  movie_snapshot: "*",
  app_group: "*",
  membership: "*",
  group_movie: "*",
  movie_want: "*",
  movie_rejection: "*",
  movies: "*",
};
