CREATE TABLE `movies` (
	`tmdb_id` integer PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`release_year` integer,
	`runtime_minutes` integer,
	`overview` text NOT NULL,
	`poster_path` text,
	`vote_average` real NOT NULL,
	`providers` text DEFAULT '[]' NOT NULL,
	`status` text NOT NULL,
	`decided_at` integer NOT NULL,
	`watched_at` integer
);
--> statement-breakpoint
CREATE INDEX `movies_status_idx` ON `movies` (`status`);