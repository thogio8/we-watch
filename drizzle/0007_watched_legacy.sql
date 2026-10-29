-- Groups (2.0, piece 2): « legacy » says the row was copied (no one added
-- it); watched_legacy says it was already watched when copied (no one marked
-- it). Marking it watched later records an author, who stays « un ancien
-- membre » once their account is deleted.
ALTER TABLE `group_movie` ADD `watched_legacy` integer DEFAULT false NOT NULL;
--> statement-breakpoint
-- Movies copied by 0006 as watched, never marked since.
UPDATE `group_movie` SET `watched_legacy` = 1
  WHERE `legacy` = 1 AND `watched_at` IS NOT NULL AND `watched_by` IS NULL;
