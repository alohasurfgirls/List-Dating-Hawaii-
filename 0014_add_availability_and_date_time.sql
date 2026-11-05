ALTER TABLE `my_profile` ADD COLUMN `available_times` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `people` ADD COLUMN `available_times` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `dates` ADD COLUMN `meet_at` integer;
