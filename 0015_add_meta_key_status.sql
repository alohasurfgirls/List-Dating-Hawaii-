ALTER TABLE `my_profile` ADD COLUMN `meta_key_status` text DEFAULT 'none' NOT NULL;
--> statement-breakpoint
ALTER TABLE `my_profile` ADD COLUMN `meta_key_status_message` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `my_profile` ADD COLUMN `meta_key_checked_at` integer;
--> statement-breakpoint
UPDATE `my_profile` SET `meta_key_status` = 'saved_unverified' WHERE `meta_api_key` <> '';
