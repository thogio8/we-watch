CREATE TABLE `app_group` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `group_movie` (
	`group_id` text NOT NULL,
	`tmdb_id` integer NOT NULL,
	`status` text NOT NULL,
	`decided_at` integer NOT NULL,
	`watched_at` integer,
	`added_by` text,
	`watched_by` text,
	`added_via` text NOT NULL,
	`legacy` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`group_id`, `tmdb_id`),
	FOREIGN KEY (`group_id`) REFERENCES `app_group`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tmdb_id`) REFERENCES `movie_snapshot`(`tmdb_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`added_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`watched_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `group_movie_group_status_idx` ON `group_movie` (`group_id`,`status`);--> statement-breakpoint
CREATE TABLE `membership` (
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`joined_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`last_used_at` integer,
	PRIMARY KEY(`group_id`, `user_id`),
	FOREIGN KEY (`group_id`) REFERENCES `app_group`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `membership_user_id_idx` ON `membership` (`user_id`);--> statement-breakpoint
CREATE TABLE `movie_rejection` (
	`user_id` text NOT NULL,
	`tmdb_id` integer NOT NULL,
	`rejected_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `tmdb_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `movie_snapshot` (
	`tmdb_id` integer PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`release_year` integer,
	`runtime_minutes` integer,
	`overview` text NOT NULL,
	`poster_path` text,
	`vote_average` real NOT NULL,
	`providers` text DEFAULT '[]' NOT NULL,
	`genre_ids` text DEFAULT '[]' NOT NULL,
	`trailer_key` text
);
--> statement-breakpoint
CREATE TABLE `movie_want` (
	`group_id` text NOT NULL,
	`tmdb_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`wanted_at` integer NOT NULL,
	PRIMARY KEY(`group_id`, `tmdb_id`, `user_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`,`tmdb_id`) REFERENCES `group_movie`(`group_id`,`tmdb_id`) ON UPDATE no action ON DELETE cascade
);
