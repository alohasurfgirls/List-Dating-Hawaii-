CREATE TABLE `promo_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`max_uses` integer,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `people` ADD COLUMN `promo_code_id` integer;
--> statement-breakpoint
ALTER TABLE `people` ADD COLUMN `promo_code` text DEFAULT '' NOT NULL;
