ALTER TABLE `my_profile` ADD COLUMN `pop_off_on` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `my_profile` ADD COLUMN `pop_off_budget_cents` integer;
--> statement-breakpoint
ALTER TABLE `my_profile` ADD COLUMN `pop_off_category` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `my_profile` ADD COLUMN `pop_off_spot` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `my_profile` ADD COLUMN `pop_off_note` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `people` ADD COLUMN `pop_off_on` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `people` ADD COLUMN `pop_off_budget_cents` integer;
--> statement-breakpoint
ALTER TABLE `people` ADD COLUMN `pop_off_category` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `people` ADD COLUMN `pop_off_spot` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `people` ADD COLUMN `pop_off_note` text DEFAULT '' NOT NULL;
