-- Pre-accounts leftovers (spec v2 §17), dropped once no deployed code reads
-- them: `movies` (unwritten since 2.0), `legacy` (same as added_via
-- 'legacy'), `watched_legacy` (0 rows at 1 in production on 2026-11-05).
DROP TABLE `movies`;--> statement-breakpoint
ALTER TABLE `group_movie` DROP COLUMN `legacy`;--> statement-breakpoint
ALTER TABLE `group_movie` DROP COLUMN `watched_legacy`;