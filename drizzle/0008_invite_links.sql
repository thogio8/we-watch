-- Invite links (2.0, piece 3): one secret token per group, created on
-- demand and replaced to revoke the link. Additive: older code ignores it.
ALTER TABLE `app_group` ADD `invite_token` text;--> statement-breakpoint
CREATE UNIQUE INDEX `app_group_invite_token_unique` ON `app_group` (`invite_token`);