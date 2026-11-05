DROP TABLE IF EXISTS entries;
--> statement-breakpoint
CREATE TABLE my_profile (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  age INTEGER,
  bio TEXT NOT NULL DEFAULT '',
  qualities TEXT NOT NULL DEFAULT '[]',
  looking_for TEXT NOT NULL DEFAULT '',
  discoverable INTEGER NOT NULL DEFAULT 0,
  contact_pref TEXT NOT NULL DEFAULT 'matches_only',
  hype_on INTEGER NOT NULL DEFAULT 0,
  hype_spot TEXT NOT NULL DEFAULT '',
  hype_mode TEXT NOT NULL DEFAULT '',
  hype_note TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE list_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE people (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  name TEXT NOT NULL,
  age INTEGER,
  bio TEXT NOT NULL DEFAULT '',
  qualities TEXT NOT NULL DEFAULT '[]',
  spot TEXT NOT NULL DEFAULT '',
  contact_pref TEXT NOT NULL DEFAULT 'matches_only',
  hype_on INTEGER NOT NULL DEFAULT 0,
  hype_spot TEXT NOT NULL DEFAULT '',
  hype_mode TEXT NOT NULL DEFAULT '',
  hype_note TEXT NOT NULL DEFAULT '',
  blocked INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE person_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL,
  list_item_id INTEGER NOT NULL,
  present INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE gifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  person_id INTEGER,
  person_name TEXT NOT NULL DEFAULT '',
  occasion TEXT NOT NULL DEFAULT '',
  price_note TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'idea',
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL,
  person_name TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
