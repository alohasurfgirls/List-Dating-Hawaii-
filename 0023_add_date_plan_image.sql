ALTER TABLE `dates` ADD COLUMN `plan_image_blob_key` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `dates` ADD COLUMN `plan_image_sig` text DEFAULT '' NOT NULL;
