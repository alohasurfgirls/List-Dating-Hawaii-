ALTER TABLE `my_profile` ADD COLUMN `hype_expires_at` integer;
--> statement-breakpoint
ALTER TABLE `my_profile` ADD COLUMN `hype_paid_cents` integer;
--> statement-breakpoint
ALTER TABLE `my_profile` ADD COLUMN `hype_plan` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `people` ADD COLUMN `hype_expires_at` integer;
--> statement-breakpoint
ALTER TABLE `people` ADD COLUMN `hype_paid_cents` integer;
--> statement-breakpoint
ALTER TABLE `people` ADD COLUMN `hype_plan` text DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE TABLE `hype_payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`person_id` integer,
	`person_name` text DEFAULT '' NOT NULL,
	`plan` text DEFAULT '' NOT NULL,
	`price_paid_cents` integer DEFAULT 0 NOT NULL,
	`minutes` integer DEFAULT 30 NOT NULL,
	`expires_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
UPDATE `my_profile` SET `wishlist_bundle_price_cents` = 1388 WHERE `wishlist_bundle_price_cents` = 999;
