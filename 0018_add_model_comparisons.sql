CREATE TABLE `model_comparisons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`person_id` integer NOT NULL,
	`person_name` text DEFAULT '' NOT NULL,
	`date_id` integer,
	`date_idea_text` text DEFAULT '' NOT NULL,
	`spark_model` text DEFAULT 'muse-spark-1.3' NOT NULL,
	`wonder_model` text DEFAULT 'muse-wonder-1.0' NOT NULL,
	`spark_match_note` text DEFAULT '' NOT NULL,
	`wonder_match_note` text DEFAULT '' NOT NULL,
	`spark_match_note_status` text DEFAULT '' NOT NULL,
	`wonder_match_note_status` text DEFAULT '' NOT NULL,
	`spark_date_plan` text DEFAULT '' NOT NULL,
	`wonder_date_plan` text DEFAULT '' NOT NULL,
	`spark_date_plan_status` text DEFAULT '' NOT NULL,
	`wonder_date_plan_status` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
