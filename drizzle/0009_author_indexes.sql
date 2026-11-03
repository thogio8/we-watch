-- Account deletion (2.0, piece 5) looks up a member's « voulu » and the
-- movies they added or marked watched. Additive: older code ignores them.
CREATE INDEX `group_movie_added_by_idx` ON `group_movie` (`added_by`);--> statement-breakpoint
CREATE INDEX `group_movie_watched_by_idx` ON `group_movie` (`watched_by`);--> statement-breakpoint
CREATE INDEX `movie_want_user_id_idx` ON `movie_want` (`user_id`);