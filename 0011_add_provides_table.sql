CREATE TABLE `provides` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `owner_type` text NOT NULL,
  `owner_id` integer DEFAULT 1 NOT NULL,
  `category` text DEFAULT '' NOT NULL,
  `title` text NOT NULL,
  `max_spend_cents` integer,
  `note` text DEFAULT '' NOT NULL,
  `created_at` integer NOT NULL
);
