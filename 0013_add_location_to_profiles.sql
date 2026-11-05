ALTER TABLE `my_profile` ADD COLUMN `location` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `people` ADD COLUMN `location` text DEFAULT '' NOT NULL;
