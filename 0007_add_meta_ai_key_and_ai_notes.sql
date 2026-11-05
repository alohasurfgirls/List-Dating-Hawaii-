ALTER TABLE `my_profile` ADD COLUMN `meta_api_key` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `people` ADD COLUMN `match_note` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `people` ADD COLUMN `match_note_source` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `people` ADD COLUMN `match_note_sig` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `dates` ADD COLUMN `plan` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `dates` ADD COLUMN `plan_source` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `dates` ADD COLUMN `plan_sig` text DEFAULT '' NOT NULL;
