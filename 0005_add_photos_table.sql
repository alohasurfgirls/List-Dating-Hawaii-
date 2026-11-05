CREATE TABLE `photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_type` text NOT NULL,
	`owner_id` integer DEFAULT 1 NOT NULL,
	`blob_key` text NOT NULL,
	`content_type` text DEFAULT 'image/jpeg' NOT NULL,
	`created_at` integer NOT NULL
);
