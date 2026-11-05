-- Matches (2.2.0). Additive: older code ignores them. SQLite's ADD COLUMN
-- takes the foreign key inline, so ON DELETE is written by hand (drizzle-kit
-- drops it): a member whose account is deleted becomes NULL.
ALTER TABLE `group_movie` ADD `matched_at` integer;--> statement-breakpoint
ALTER TABLE `group_movie` ADD `matched_by` text REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null;
