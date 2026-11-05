CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`person_id` integer NOT NULL,
	`person_name` text DEFAULT '' NOT NULL,
	`direction` text NOT NULL,
	`body` text NOT NULL,
	`kind` text DEFAULT 'text' NOT NULL,
	`read` integer DEFAULT 0 NOT NULL,
	`date_id` integer,
	`created_at` integer NOT NULL
);
