-- Favourites (2.1.0). Additive: older code ignores them. SQLite's ADD COLUMN
-- takes the foreign key inline, so ON DELETE is written by hand (drizzle-kit
-- drops it): an author whose account is deleted becomes NULL.
ALTER TABLE `group_movie` ADD `favorite_at` integer;--> statement-breakpoint
ALTER TABLE `group_movie` ADD `favorite_by` text REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null;--> statement-breakpoint
CREATE INDEX `group_movie_favorite_by_idx` ON `group_movie` (`favorite_by`);
