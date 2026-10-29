-- 2.2: the pre-accounts list becomes the group « NOUS DEUX » (id and name:
-- LEGACY_GROUP_ID / LEGACY_GROUP_NAME in src/domain/group.ts). Additive: the
-- table movies is only read, kept for a rollback to 1.3.x. A database without
-- movies (new instance, tests) gets no group.
INSERT INTO `movie_snapshot` (`tmdb_id`, `title`, `release_year`, `runtime_minutes`, `overview`, `poster_path`, `vote_average`, `providers`, `genre_ids`, `trailer_key`)
  SELECT `tmdb_id`, `title`, `release_year`, `runtime_minutes`, `overview`, `poster_path`, `vote_average`, `providers`, `genre_ids`, `trailer_key` FROM `movies`;
--> statement-breakpoint
INSERT INTO `app_group` (`id`, `name`, `created_at`)
  SELECT 'nous-deux', 'NOUS DEUX', cast(unixepoch('subsecond') * 1000 as integer) WHERE EXISTS (SELECT 1 FROM `movies`);
--> statement-breakpoint
-- No author was ever recorded: legacy rows, added_by and watched_by NULL. A
-- rejected movie (« BOF » or removed, indistinguishable) is set aside for
-- the group.
INSERT INTO `group_movie` (`group_id`, `tmdb_id`, `status`, `decided_at`, `watched_at`, `added_by`, `watched_by`, `added_via`, `legacy`)
  SELECT 'nous-deux', `tmdb_id`, `status`, `decided_at`, `watched_at`, NULL, NULL, 'legacy', 1 FROM `movies`;
