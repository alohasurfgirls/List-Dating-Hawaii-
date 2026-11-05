ALTER TABLE `my_profile` ADD COLUMN `pop_off_expires_at` integer;
--> statement-breakpoint
ALTER TABLE `my_profile` ADD COLUMN `pop_off_paid_cents` integer;
--> statement-breakpoint
ALTER TABLE `my_profile` ADD COLUMN `pop_off_plan` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `people` ADD COLUMN `pop_off_expires_at` integer;
--> statement-breakpoint
ALTER TABLE `people` ADD COLUMN `pop_off_paid_cents` integer;
--> statement-breakpoint
ALTER TABLE `people` ADD COLUMN `pop_off_plan` text DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE TABLE `pop_off_payments` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `person_id` integer,
  `person_name` text DEFAULT '' NOT NULL,
  `plan` text DEFAULT '' NOT NULL,
  `price_paid_cents` integer DEFAULT 0 NOT NULL,
  `hours` integer DEFAULT 24 NOT NULL,
  `expires_at` integer,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notifications` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `kind` text DEFAULT 'pop_off_live' NOT NULL,
  `person_id` integer,
  `person_name` text DEFAULT '' NOT NULL,
  `title` text NOT NULL,
  `body` text DEFAULT '' NOT NULL,
  `read` integer DEFAULT 0 NOT NULL,
  `created_at` integer NOT NULL
);
