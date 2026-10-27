ALTER TABLE `movies` ADD `genre_ids` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `movies` ADD `trailer_key` text;