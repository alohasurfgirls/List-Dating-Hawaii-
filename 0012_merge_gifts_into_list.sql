ALTER TABLE `list_items` ADD COLUMN `person_id` integer;
--> statement-breakpoint
ALTER TABLE `list_items` ADD COLUMN `person_name` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `list_items` ADD COLUMN `occasion` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `list_items` ADD COLUMN `price_note` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `list_items` ADD COLUMN `link` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `list_items` ADD COLUMN `gift_status` text;
--> statement-breakpoint
INSERT INTO `list_items` (`kind`, `text`, `person_id`, `person_name`, `occasion`, `price_note`, `link`, `gift_status`, `created_at`) SELECT 'gift', `title`, `person_id`, `person_name`, `occasion`, `price_note`, `link`, `status`, `created_at` FROM `gifts` ORDER BY `id`;
