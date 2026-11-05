ALTER TABLE `my_profile` ADD COLUMN `wishlist_price_cents` integer DEFAULT 499 NOT NULL;
--> statement-breakpoint
ALTER TABLE `my_profile` ADD COLUMN `wishlist_bundle_price_cents` integer DEFAULT 999 NOT NULL;
--> statement-breakpoint
ALTER TABLE `my_profile` ADD COLUMN `wishlist_all_unlocked` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE `wishlist_unlocks` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `person_id` integer,
  `person_name` text DEFAULT '' NOT NULL,
  `price_paid_cents` integer DEFAULT 0 NOT NULL,
  `created_at` integer NOT NULL
);
