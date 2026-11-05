CREATE TABLE `dates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`person_id` integer NOT NULL,
	`person_name` text DEFAULT '' NOT NULL,
	`direction` text NOT NULL,
	`list_item_id` integer,
	`idea_text` text NOT NULL,
	`spot` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'proposed' NOT NULL,
	`created_at` integer NOT NULL
);
