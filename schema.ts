// Drizzle schema for List Dating.
//
// my_profile is a single-row table (id = 1) holding the user's own profile,
// their contact preference, whether they are discoverable, and their own
// Hype state. people holds everyone else: `source` distinguishes people the
// user added by hand ("added") from strangers who joined through the
// Discover join flow ("joined"). list_items IS The List — one unified
// store (merged 2026-11-01): kind "must" / "nice" / "dealbreaker" are the
// scored List, and kind "gift" entries are wishlist entries on the same
// List, carrying gift details (person_id/person_name = whose wishlist,
// occasion, price_note, link, gift_status idea/planned/given). The old
// `gifts` table is deprecated: migration 0012 copied every gift row into
// list_items as a gift entry; the table is kept only as a pre-merge
// backup and is no longer read or written. getState derives the client
// `gifts` shape from the gift-kind list_items, so there is one List to
// enter, edit and match against — never two;
// person_checks stores the user's explicit per-person verdicts on list
// items (overriding the quality-tag fuzzy match). reports keeps a record
// of every report filed. promo_codes holds shareable member invite codes;
// a person who joins through Discover with one records both the code id
// and a text snapshot of the code on their row. photos holds uploaded
// photos for the user's own profile and for members: the image bytes live
// in ctx.blobs under blob_key, this table only stores the key + metadata.
// my_profile.meta_api_key holds the user's Meta AI (Meta Model API) key, saved
// from the Profile tab; it is never sent to the client — getState only
// reports whether one is set. people.match_note / dates.plan cache the
// generated match note / date plan for that row, with a source ("meta-ai"
// when written by Meta AI, "list" when written from the List data as the
// fallback) and a signature of the inputs, so a note is only regenerated
// when the List data behind it actually changes.
// messages holds the small in-app messenger: one thread per person, short
// notes whose job is coordinating the meetup (confirming a date from the
// List, saying "on my way" / "I'm here"). Chat gate (Deal-only
// rule, 2026-11-04, Erin's direction, derived on read in
// scorePerson — no column; supersedes the 2026-11-03 gate): a
// thread exists / is messageable ONLY once a Deal exists with
// that person — the Deal button was hit on their match card
// (match_decision "accepted") or they have an accepted date.
// Deal alone opens Chat, even before Plan the date is pushed
// and before a date is scheduled. A Match or a Potential with
// no Deal has no chat at all, in any mode. Contact preferences
// only narrow an already-eligible thread, never create one,
// and non-qualifying threads do not appear in Chat; their
// messages are never deleted. The Chat tab carries no
// disclaimer — the rule is stated in Help only.
// Showcase labels (2026-11-04, Erin's direction): the three
// Showcase members' stored names carry the word "Showcase"
// before them — "Showcase Alex", "Showcase Koa" (the member
// formerly named Kai, renamed to Koa on 2026-11-03) and
// "Showcase Leilani" — on their people rows and every
// person_name snapshot, applied by the idempotent
// applyShowcaseLabels pass in actions.ts (same sweep pattern
// as the core-member renames, signatures refreshed). Erin
// herself is real and never labelled. Server lookups for the
// three go through isShowcaseMember, which accepts the bare
// or labelled name.
// Out of the Blue (2026-11-03, Erin's direction): a person at
// 0% SPECIFIC covers — not a Match, not a Potential — can still
// surface in Matches as a 2% out-of-the-blue surprise, marked
// with a tiny wave. It is derived on read in scorePerson (no
// column, no stored score): the 2% is NOT a cover and never
// changes match %, Match or Potential — specific covers stay
// specific (Yoga is only covered by Yoga). It is not based on
// Match or Potential but on quantum circumstance — a built-in
// element of surprise. Pushing it records a normal Deal
// (people.match_decision "accepted") and creates one normal
// dates row from an uncovered Want (createOutOfBlueDeal), whose
// plan then runs through generateDatePlan with the saved Meta
// AI key, exactly like a normal Plan the Date.
// direction is from the user's
// point of view: "out" = the user sent it, "in" = the member sent it.
// kind "quick" marks the one-tap meetup helpers. read tracks unread
// incoming messages for the tab badge; date_id optionally ties a message
// to the date it is coordinating.
// Hype — a paid, timed session on the O'ahu map: $2.99 per 30
// minutes, up to 4 hours max (HYPE_PLANS in actions.ts). Paying
// sets hype_expires_at (started now + the chosen minutes),
// hype_paid_cents and hype_plan, and records a row in
// hype_payments. Liveness is derived on read: hype_on AND (no
// expiry recorded — a legacy pre-paid listing — OR expiry in
// the future). New activations always carry an expiry. Hype pins
// the actual spot/area the person is around during that
// session — never live GPS tracking.
//
// Pop Off was REMOVED completely on 2026-11-02 at Erin's
// direction: its UI, actions, listings, applications,
// notifications and payments are gone, migration 0024 purged
// its payment/application/notification rows and dropped those
// tables, and the pop_off_* columns on my_profile / people are
// cleared and no longer read or written (kept only so the
// existing tables need no rebuild).
//
// Provide list (two-sided matching, added 2026-11-01): alongside the
// Need list (list_items — what the user wants / needs), every person
// can list what they can PROVIDE: a category (PROVIDE_CATEGORIES in
// actions.ts, e.g. "Car & Mechanical"), a specific title ("Windshield
// wipers — buy & fit"), an optional max spend in cents (the most they
// will cover for it), and a note. Rows live in `provides` with
// owner_type "profile" (owner_id 1 = the user) or "person" (owner_id
// = people.id). Matching is derived on read, never stored: a member's
// provides are matched against the user's Need list items, and the
// user's provides are matched against that member's wishlist entries
// (their gift-kind list_items) — so a Need on one side can meet cover
// on the other, budget included.
//
// Safety check-in (timed, added 2026-11-01): a Safety Signal-style
// timed check-in tied to a CONFIRMED (accepted) date. The user picks
// a length, the check-in runs quietly, and it ends automatically
// when its time runs out — its live state is derived on read from
// ends_at, never stored, exactly like Hype liveness. The date is
// told it is on: starting one posts a notice into that member's Chat
// thread (and ending early posts an "all good" note), so it is
// transparent by design, never secret tracking. There is NO live GPS
// tracking — no location is stored or shared, only the timer. The
// user can end it early (ended_at set). Rows live in
// safety_checkins, one per start, tied to the date and member.
//
// Wishlist unlock is KILLED UNTIL LATER (Erin's direction,
// 2026-11-02 — NO payments in the app, the same treatment as
// Hype): wishlist entries are gift-kind rows on The List —
// entries tied to a person are that person's wishlist, general
// entries are the general wishlist — and EVERY entry is visible:
// getState never locks one, there is no unlock panel, price or
// checkout language anywhere, and the unlock / pricing actions
// refuse while it is paused. The wishlist_unlocks table, the
// wishlist_all_unlocked flag and the price columns on my_profile
// stay in the schema untouched so the paywall can return later
// exactly as it was.

import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const ts = (name: string) =>
  integer(name, { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

export const myProfile = sqliteTable("my_profile", {
  id: integer("id").primaryKey(),
  name: text("name").notNull().default(""),
  age: integer("age"),
  bio: text("bio").notNull().default(""),
  // Free-text location the user types herself (e.g. "North Shore",
  // "Hawaii") — searchable/filterable by island area in Discover.
  location: text("location").notNull().default(""),
  // Free-text times this person is available (e.g. "Weekday evenings,
  // Saturday afternoons") — shown on the profile so a date can be made
  // for a day AND a time inside it.
  availableTimes: text("available_times").notNull().default(""),
  // Usually around (added 2026-11-04): the user's own usual spot,
  // picked from the same spot list as every member's `spot` on
  // people — editable in Edit profile and shown on the finished
  // Profile preview in the same place and style as "Usually
  // around" shows on a member's Open Profile. "" = no regular spot.
  spot: text("spot").notNull().default(""),
  // "I am" (added 2026-11-02, heterosexual-by-default matching):
  // "man" / "woman", or "" when not set yet. sameSex is the pride
  // "Same sex" toggle, OFF by default: OFF = heterosexual mode
  // (Matches / Potential show only the opposite sex), ON = same-sex
  // mode (Matches / Potential show only the same sex). The mode is
  // per-profile; filtering is derived on read in the client from
  // these two fields plus each member's gender — never stored per
  // match. A member with no gender set does not pass the filter
  // while the user's own gender is set; with no user gender set,
  // no gender filtering applies.
  gender: text("gender", { enum: ["man", "woman", ""] })
    .notNull()
    .default(""),
  sameSex: integer("same_sex", { mode: "boolean" }).notNull().default(false),
  qualities: text("qualities").notNull().default("[]"),
  lookingFor: text("looking_for").notNull().default(""),
  discoverable: integer("discoverable", { mode: "boolean" })
    .notNull()
    .default(false),
  contactPref: text("contact_pref", {
    enum: ["everyone", "matches_only", "hype_spot", "nobody"],
  })
    .notNull()
    .default("matches_only"),
  hypeOn: integer("hype_on", { mode: "boolean" }).notNull().default(false),
  hypeSpot: text("hype_spot").notNull().default(""),
  hypeMode: text("hype_mode").notNull().default(""),
  hypeNote: text("hype_note").notNull().default(""),
  hypeExpiresAt: integer("hype_expires_at", { mode: "timestamp_ms" }),
  hypePaidCents: integer("hype_paid_cents"),
  hypePlan: text("hype_plan").notNull().default(""),
  popOffOn: integer("pop_off_on", { mode: "boolean" }).notNull().default(false),
  popOffBudgetCents: integer("pop_off_budget_cents"),
  popOffCategory: text("pop_off_category").notNull().default(""),
  popOffSpot: text("pop_off_spot").notNull().default(""),
  popOffNote: text("pop_off_note").notNull().default(""),
  popOffExpiresAt: integer("pop_off_expires_at", { mode: "timestamp_ms" }),
  popOffPaidCents: integer("pop_off_paid_cents"),
  popOffPlan: text("pop_off_plan").notNull().default(""),
  metaApiKey: text("meta_api_key").notNull().default(""),
  // Three-state connection signal (added 2026-11-01 repair): "none" =
  // no key saved, "saved_unverified" = a key is stored but Meta has
  // not accepted it (yet), "accepted" = the last test/generation call
  // on the shared Meta Model API channel succeeded, "rejected" = Meta
  // answered 401/403 for the stored key. metaAiConnected alone used
  // to mean only "a key is stored", which misled the user into
  // thinking live calls were running.
  metaKeyStatus: text("meta_key_status", {
    enum: ["none", "saved_unverified", "accepted", "rejected"],
  })
    .notNull()
    .default("none"),
  metaKeyStatusMessage: text("meta_key_status_message").notNull().default(""),
  metaKeyCheckedAt: integer("meta_key_checked_at", { mode: "timestamp_ms" }),
  wishlistPriceCents: integer("wishlist_price_cents").notNull().default(499),
  // All-profiles unlock: $13.88 (raised from $9.99 on 2026-11-02;
  // migration 0019 moves a profile still on the old $9.99 default).
  wishlistBundlePriceCents: integer("wishlist_bundle_price_cents")
    .notNull()
    .default(1388),
  wishlistAllUnlocked: integer("wishlist_all_unlocked", { mode: "boolean" })
    .notNull()
    .default(false),
  updatedAt: ts("updated_at"),
});

// Caps (enforced in actions.ts, no column change; FLATTENED
// 2026-11-03 at Erin's confirmed direction, superseding the
// 2026-11-02 split caps): The List is flat Wants, 3 max TOTAL —
// the stored must / nice kinds are both Wants now and count
// together in one pool, with no Must-haves / Nice-to-haves
// sections and no weighting. Match % is the simple List
// calculation: Wants covered by the other person's Provides
// (title / category covers) ÷ total Wants; dealbreakers never
// count (background warning only, when one clashes) and Desires
// (gift entries) never count and never change the score —
// Desires are separate: three max per wishlist. Provides: three
// max per person, capped INDEPENDENTLY of Wants (each side is
// max 3 on its own, enforced in addProvide / addListItem). The
// caps only gate adding — existing rows over a cap are left
// untouched for the user to trim.
export const listItems = sqliteTable("list_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kind: text("kind", {
    enum: ["must", "nice", "dealbreaker", "gift"],
  }).notNull(),
  text: text("text").notNull(),
  // Category (added 2026-11-02 at Erin's direction): every
  // Want/Need entry carries the SAME category as a Provide — one
  // shared list (PROVIDE_CATEGORIES in actions.ts), picked from
  // the identical "Pick a category…" dropdown that sits FIRST in
  // the Want/Need editor, which itself sits ABOVE the Provide
  // editor in Join, Add someone, Edit member and Profile Edit.
  // "" = no category picked (every row written before this
  // column existed). The category is a label: since the
  // 2026-11-03 Who-covers-what fix, sharing a broad category
  // alone is NOT a cover — a cover needs a real title/keyword
  // link between the Provide and the Want (see
  // provideCoversText in actions.ts).
  category: text("category").notNull().default(""),
  // Gift-entry details — only meaningful when kind = "gift".
  // person_id null = the general wishlist; otherwise that member's
  // wishlist. gift_status is the wishlist entry's standing.
  // Member Wants (2026-11-04): person_id ALSO ties a scored
  // (must / nice) row to a member — that row is THAT member's
  // own Want, in the same store and kinds as the user's own
  // Wants (hers carry person_id null). A member's Wants are
  // never their Desires / Gifts: gift rows tied to a member are
  // that member's Desires, a separate store that never counts
  // toward a match %. Every Erin-side derivation scopes scored
  // rows to person_id null, so a member's Wants can never leak
  // into the user's List, scoring, notes or plans. A member's
  // own dealbreaker rows (kind "dealbreaker", person_id =
  // member) are likewise theirs alone: getState exposes them
  // on the person shape as `dealbreakers`, apart from their
  // Wants, so every Open Profile shows a Dealbreakers section
  // in the same place as the user's own profile template
  // (2026-11-04 consistency pass; display only — no data
  // changes). The three
  // Showcase members' Wants are Erin's directed known lists
  // (Alex: Learn to surf, Yoga, Play guitar or chess; Koa: Car
  // detail, Massage, Pool partner; Leilani: Victoria's Secret
  // shopping up to $100, Snorkeling, Go to a Rave), restored
  // additively by the fillShowcaseMemberWants pass in
  // actions.ts so Open Profile's "What they want" is not empty.
  personId: integer("person_id"),
  personName: text("person_name").notNull().default(""),
  occasion: text("occasion").notNull().default(""),
  priceNote: text("price_note").notNull().default(""),
  link: text("link").notNull().default(""),
  giftStatus: text("gift_status", {
    enum: ["idea", "planned", "given"],
  }),
  createdAt: ts("created_at"),
});

export const people = sqliteTable("people", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  source: text("source", { enum: ["added", "joined"] }).notNull(),
  name: text("name").notNull(),
  age: integer("age"),
  bio: text("bio").notNull().default(""),
  // Free-text location typed by/for this person (e.g. "North Shore").
  location: text("location").notNull().default(""),
  // Free-text times this person is available (e.g. "Saturday
  // mornings, weekday evenings after 5") — shown on their card and
  // in the date planner so a date gets a day and a time.
  availableTimes: text("available_times").notNull().default(""),
  // This member's stated "I am": "man" / "woman", or "" when not
  // set. Stated only — never inferred from a name. Their own
  // sameSex toggle is stored with their profile for completeness;
  // the user's Matches / Potential filter keys off the USER's
  // gender + sameSex mode against this gender.
  gender: text("gender", { enum: ["man", "woman", ""] })
    .notNull()
    .default(""),
  sameSex: integer("same_sex", { mode: "boolean" }).notNull().default(false),
  qualities: text("qualities").notNull().default("[]"),
  spot: text("spot").notNull().default(""),
  contactPref: text("contact_pref", {
    enum: ["everyone", "matches_only", "hype_spot", "nobody"],
  })
    .notNull()
    .default("matches_only"),
  hypeOn: integer("hype_on", { mode: "boolean" }).notNull().default(false),
  hypeSpot: text("hype_spot").notNull().default(""),
  hypeMode: text("hype_mode").notNull().default(""),
  hypeNote: text("hype_note").notNull().default(""),
  hypeExpiresAt: integer("hype_expires_at", { mode: "timestamp_ms" }),
  hypePaidCents: integer("hype_paid_cents"),
  hypePlan: text("hype_plan").notNull().default(""),
  popOffOn: integer("pop_off_on", { mode: "boolean" }).notNull().default(false),
  popOffBudgetCents: integer("pop_off_budget_cents"),
  popOffCategory: text("pop_off_category").notNull().default(""),
  popOffSpot: text("pop_off_spot").notNull().default(""),
  popOffNote: text("pop_off_note").notNull().default(""),
  popOffExpiresAt: integer("pop_off_expires_at", { mode: "timestamp_ms" }),
  popOffPaidCents: integer("pop_off_paid_cents"),
  popOffPlan: text("pop_off_plan").notNull().default(""),
  blocked: integer("blocked", { mode: "boolean" }).notNull().default(false),
  // The user's own decision on this match (added 2026-11-02): a
  // match is NOT instantly chosen. "none" = not decided yet (they
  // show in Matches / Potential as normal), "accepted" = the user
  // accepted the match (they stay in Matches, marked accepted),
  // "declined" = the user declined / removed them from Matches —
  // they no longer match with the user's profile and drop out of
  // Matches / Potential entirely, but the person is NOT deleted
  // and NOT blocked: setting the decision back to "none" restores
  // them. A decision never creates or deletes a date or any
  // messages; accepting (a Deal) DOES open Chat eligibility for
  // that person (Deal-only Chat rule, 2026-11-04 — see the
  // messages comment above), without creating any message.
  matchDecision: text("match_decision", {
    enum: ["none", "accepted", "declined"],
  })
    .notNull()
    .default("none"),
  promoCodeId: integer("promo_code_id"),
  promoCode: text("promo_code").notNull().default(""),
  matchNote: text("match_note").notNull().default(""),
  matchNoteSource: text("match_note_source").notNull().default(""),
  matchNoteSig: text("match_note_sig").notNull().default(""),
  createdAt: ts("created_at"),
});

export const promoCodes = sqliteTable("promo_codes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull(),
  label: text("label").notNull().default(""),
  maxUses: integer("max_uses"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: ts("created_at"),
});

export const personChecks = sqliteTable("person_checks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personId: integer("person_id").notNull(),
  listItemId: integer("list_item_id").notNull(),
  present: integer("present", { mode: "boolean" }).notNull(),
});

// DEPRECATED (2026-11-01 merge): the old standalone gifts table.
// Migration 0012 copied every row into list_items as kind="gift";
// nothing reads or writes this table any more. Kept in the schema
// only so the historical table definition stays documented.
export const gifts = sqliteTable("gifts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  personId: integer("person_id"),
  personName: text("person_name").notNull().default(""),
  occasion: text("occasion").notNull().default(""),
  priceNote: text("price_note").notNull().default(""),
  link: text("link").notNull().default(""),
  status: text("status", { enum: ["idea", "planned", "given"] })
    .notNull()
    .default("idea"),
  createdAt: ts("created_at"),
});

export const dates = sqliteTable("dates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personId: integer("person_id").notNull(),
  personName: text("person_name").notNull().default(""),
  direction: text("direction", { enum: ["out", "in"] }).notNull(),
  listItemId: integer("list_item_id"),
  ideaText: text("idea_text").notNull(),
  // The day AND time the meetup happens (an instant; rendered
  // viewer-local). Null = day/time not set yet — the planner asks
  // for both when a date is made.
  meetAt: integer("meet_at", { mode: "timestamp_ms" }),
  spot: text("spot").notNull().default(""),
  note: text("note").notNull().default(""),
  status: text("status", { enum: ["proposed", "accepted", "declined"] })
    .notNull()
    .default("proposed"),
  // Date completed (added 2026-11-02): when the user taps
  // "✓ Mark date completed" on an accepted date, this instant is
  // recorded and the date shows "Completed". The date's status
  // stays "accepted" — completion is a step ON TOP of an accepted
  // date, not a new status, so contact, Chat and safety check-ins
  // (which all key off an accepted date) keep working exactly as
  // before. Null = not completed yet. Marking not completed clears
  // it back to null (undo). No voice check, camera check, proof
  // photo or location is involved — it is a simple tap + timestamp,
  // and completing / undoing posts a short note into that member's
  // Chat thread (see setDateCompleted in actions.ts).
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  plan: text("plan").notNull().default(""),
  planSource: text("plan_source").notNull().default(""),
  planSig: text("plan_sig").notNull().default(""),
  // Generated date-plan image (added 2026-11-02): when Meta AI
  // writes a date plan, the app also tries Muse Image
  // (muse-image-1.0, on the same saved key, server-side only) for
  // a small island-style picture of the plan's main spot. The image
  // bytes live in ctx.blobs under this key; plan_image_sig is the
  // plan signature the image was made for, so a cached plan reuses
  // its cached image and a fresh plan can make a fresh one. Empty
  // = no image (the image call is optional and never gates the
  // plan text — a failed or unavailable image model leaves the
  // plan exactly as it was).
  planImageBlobKey: text("plan_image_blob_key").notNull().default(""),
  planImageSig: text("plan_image_sig").notNull().default(""),
  // Actual-photo-first (2026-11-03): plan_image_source says what
  // the plan's picture IS — "actual" (a real photograph of the
  // plan's real location / stores, from the app's checked photo
  // registry in actions.ts: Ala Moana Center, Lululemon and
  // Sephora in Honolulu), "generated" (a Muse Image picture,
  // used ONLY when no actual photo exists for that spot), or ""
  // (no picture). plan_photo_keys is a comma-separated list of
  // actual-photo registry keys when the source is "actual"; the
  // client maps each key to its bundled real photograph and
  // labels it "Actual photo". A generated picture is labelled
  // "Generated image" in the UI, never presented as a photo of
  // the real place. Repair on read (2026-11-03, Koa's date): a
  // surviving plan whose verified spot has actual photos but
  // whose row still carries a legacy generated picture (written
  // before the registry existed) is switched to the actual keys
  // by the purge pass in actions.ts — picture fields only, the
  // plan text / status / cover are never touched. The verified
  // registry also carries mall-directory detail (Lululemon at
  // Ala Moana Center: Level 2, near Ewa Wing, between Uniqlo
  // and Coach, phone (808) 818-8817), which plans and the date
  // card's directory box show.
  planImageSource: text("plan_image_source").notNull().default(""),
  planPhotoKeys: text("plan_photo_keys").notNull().default(""),
  createdAt: ts("created_at"),
});

export const photos = sqliteTable("photos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerType: text("owner_type", { enum: ["profile", "person"] }).notNull(),
  ownerId: integer("owner_id").notNull().default(1),
  blobKey: text("blob_key").notNull(),
  contentType: text("content_type").notNull().default("image/jpeg"),
  // Display order within one owner's photos (added 2026-11-04):
  // photos render in sort_order, then id order — the FIRST photo
  // in that order is the profile picture. Rows written before
  // this column existed all carry 0 and keep their id order until
  // the user reorders them (reorderPhotos writes 0, 1, 2, …).
  // Reordering only rewrites this number: no photo is ever
  // deleted, replaced or re-uploaded to change the order.
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: ts("created_at"),
});

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personId: integer("person_id").notNull(),
  personName: text("person_name").notNull().default(""),
  direction: text("direction", { enum: ["out", "in"] }).notNull(),
  body: text("body").notNull(),
  kind: text("kind", { enum: ["text", "quick"] }).notNull().default("text"),
  read: integer("read", { mode: "boolean" }).notNull().default(false),
  dateId: integer("date_id"),
  createdAt: ts("created_at"),
});

// Hype payments (added 2026-11-02 with the merged map): one row
// per paid Hype activation or extension — plan snapshot, price
// paid in cents ($2.99 per 30 minutes), minutes bought, and the
// resulting expiry. Display/record only.
//
// Stale purge (2026-11-02, Erin's direction — see
// purgeStaleNotesAndExpiredHype in actions.ts): stored match
// notes (people.match_note), date plans (dates.plan) and Spark vs
// Wonder comparisons (model_comparisons) whose signature, named
// score or text no longer matches the person's current live
// score / List / Provide state — or that predate the current List
// or a now-covering Provide — are deleted, never regenerated in
// bulk; fresh writing happens only on demand (Generate / Re-run).
// Hype is KILLED UNTIL LATER (Erin's direction, same build,
// superseding the expired-only sweep): the same purge deletes
// EVERY hype_payments row and clears every Hype listing on
// my_profile and people (on/off, spot, mode, note, paid window),
// live or expired, and setHype / joinDiscover / updatePerson can
// no longer switch a listing on. The columns and table stay in
// the schema so Hype can return later exactly as it was.
export const hypePayments = sqliteTable("hype_payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // null person_id = the user's own Hype (my_profile)
  personId: integer("person_id"),
  personName: text("person_name").notNull().default(""),
  plan: text("plan").notNull().default(""),
  pricePaidCents: integer("price_paid_cents").notNull().default(0),
  minutes: integer("minutes").notNull().default(30),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  createdAt: ts("created_at"),
});

export const wishlistUnlocks = sqliteTable("wishlist_unlocks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // null person_id = the general wishlist (gifts not tied to a person)
  personId: integer("person_id"),
  personName: text("person_name").notNull().default(""),
  pricePaidCents: integer("price_paid_cents").notNull().default(0),
  createdAt: ts("created_at"),
});

export const provides = sqliteTable("provides", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerType: text("owner_type", { enum: ["profile", "person"] }).notNull(),
  // owner_id 1 = the user's own profile; otherwise a people.id
  ownerId: integer("owner_id").notNull().default(1),
  category: text("category").notNull().default(""),
  title: text("title").notNull(),
  maxSpendCents: integer("max_spend_cents"),
  note: text("note").notNull().default(""),
  createdAt: ts("created_at"),
});

export const safetyCheckins = sqliteTable("safety_checkins", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dateId: integer("date_id").notNull(),
  personId: integer("person_id").notNull(),
  personName: text("person_name").notNull().default(""),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  startedAt: integer("started_at", { mode: "timestamp_ms" }),
  endsAt: integer("ends_at", { mode: "timestamp_ms" }),
  // Set only when the user ends the check-in early; null + ends_at in
  // the past means it finished on its own.
  endedAt: integer("ended_at", { mode: "timestamp_ms" }),
  createdAt: ts("created_at"),
});

export const reports = sqliteTable("reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personId: integer("person_id").notNull(),
  personName: text("person_name").notNull().default(""),
  reason: text("reason").notNull(),
  note: text("note").notNull().default(""),
  createdAt: ts("created_at"),
});

// Spark vs Wonder comparison (added 2026-11-02): for the SAME test
// person, the SAME match-note prompt and the SAME date-plan prompt
// are run twice — once with Spark (muse-spark-1.3, the app's
// default) and once with Wonder (muse-wonder-1.0) — using the
// user's saved Meta AI key server-side only, exactly as normal
// generation does. Both versions are stored here, one row per
// person, so Erin can read them side by side in Profile → Meta AI
// without re-spending calls. Spark stays the default for the
// app's real notes/plans (people.match_note / dates.plan are NOT
// written by a comparison run); Wonder is comparison-only.
// Status fields say how each text was produced: "meta-ai" when
// that model wrote it, "list" when the List-based fallback wrote
// it (no key, or that model's call did not produce usable text).
export const modelComparisons = sqliteTable("model_comparisons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personId: integer("person_id").notNull(),
  personName: text("person_name").notNull().default(""),
  dateId: integer("date_id"),
  dateIdeaText: text("date_idea_text").notNull().default(""),
  sparkModel: text("spark_model").notNull().default("muse-spark-1.3"),
  wonderModel: text("wonder_model").notNull().default("muse-wonder-1.0"),
  sparkMatchNote: text("spark_match_note").notNull().default(""),
  wonderMatchNote: text("wonder_match_note").notNull().default(""),
  sparkMatchNoteStatus: text("spark_match_note_status").notNull().default(""),
  wonderMatchNoteStatus: text("wonder_match_note_status").notNull().default(""),
  sparkDatePlan: text("spark_date_plan").notNull().default(""),
  wonderDatePlan: text("wonder_date_plan").notNull().default(""),
  sparkDatePlanStatus: text("spark_date_plan_status").notNull().default(""),
  wonderDatePlanStatus: text("wonder_date_plan_status").notNull().default(""),
  createdAt: ts("created_at"),
  updatedAt: ts("updated_at"),
});
