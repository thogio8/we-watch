-- Catch-up after a return to 1.3.x (2.0 rolled back, then re-cut over):
-- brings into « NOUS DEUX » what 1.3.x wrote in `movies` meanwhile, the way
-- 0006 + 0007 copied the list. Idempotent. Shipped, if ever needed, as a
-- drizzle migration with the re-cutover push: NEVER run by hand on prod.
-- Does nothing without the group « NOUS DEUX » (LEGACY_GROUP_ID). Its
-- created_at is the cutover (0006): a movie watched on 1.3.x since then is
-- a change of the return; watched before, it was already copied.
-- Not caught up (runbook): a movie of the group set aside (« BOF » or
-- removed) or unmarked on 1.3.x during the return, and the 1.3.x changes to
-- a movie someone marked watched on 2.0.
--
-- 1. The snapshots of the movies the group lacks (existing ones untouched).
INSERT INTO `movie_snapshot` (`tmdb_id`, `title`, `release_year`, `runtime_minutes`, `overview`, `poster_path`, `vote_average`, `providers`, `genre_ids`, `trailer_key`)
  SELECT `tmdb_id`, `title`, `release_year`, `runtime_minutes`, `overview`, `poster_path`, `vote_average`, `providers`, `genre_ids`, `trailer_key` FROM `movies`
  WHERE EXISTS (SELECT 1 FROM `app_group` WHERE `id` = 'nous-deux')
  ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- 2. Movies added during the return: copied (legacy), no author, watched
-- ones marked « vu avant les comptes ». A movie already in the group keeps
-- its row.
INSERT INTO `group_movie` (`group_id`, `tmdb_id`, `status`, `decided_at`, `watched_at`, `added_by`, `watched_by`, `added_via`, `legacy`, `watched_legacy`)
  SELECT 'nous-deux', `tmdb_id`, `status`, `decided_at`, `watched_at`, NULL, NULL, 'legacy', 1, `watched_at` IS NOT NULL FROM `movies`
  WHERE EXISTS (SELECT 1 FROM `app_group` WHERE `id` = 'nous-deux')
  ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- 3. Movies of the group watched on 1.3.x during the return, that no one
-- marked or unmarked watched on 2.0 (watched_by and watched_at NULL).
UPDATE `group_movie` SET `status` = `m`.`status`, `watched_at` = `m`.`watched_at`, `watched_legacy` = 1
  FROM `movies` AS `m`, `app_group` AS `g`
  WHERE `g`.`id` = 'nous-deux' AND `group_movie`.`group_id` = `g`.`id`
    AND `m`.`tmdb_id` = `group_movie`.`tmdb_id`
    AND `m`.`status` = 'watched' AND `m`.`watched_at` > `g`.`created_at`
    AND `group_movie`.`watched_by` IS NULL AND `group_movie`.`watched_at` IS NULL;
