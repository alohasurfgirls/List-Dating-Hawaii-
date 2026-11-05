CREATE TABLE `safety_checkins` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date_id` integer NOT NULL,
	`person_id` integer NOT NULL,
	`person_name` text DEFAULT '' NOT NULL,
	`duration_minutes` integer DEFAULT 60 NOT NULL,
	`started_at` integer,
	`ends_at` integer,
	`ended_at` integer,
	`created_at` integer NOT NULL
);
