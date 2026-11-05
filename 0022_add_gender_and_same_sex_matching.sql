ALTER TABLE `my_profile` ADD COLUMN `gender` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `my_profile` ADD COLUMN `same_sex` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `people` ADD COLUMN `gender` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `people` ADD COLUMN `same_sex` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `my_profile` SET `gender` = 'woman' WHERE `id` = 1;
--> statement-breakpoint
UPDATE `people` SET `gender` = 'woman' WHERE `name` IN ('Test — Maya Match', 'Test — Leila List');
--> statement-breakpoint
UPDATE `people` SET `gender` = 'man' WHERE `name` IN ('Test — Kai Cover', 'Test — Dan Dealbreaker');
