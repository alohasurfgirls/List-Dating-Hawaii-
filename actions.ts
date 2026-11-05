// Actions for List Dating — "Whatever is on the List".
//
// Everything is user-entered and stored in this artifact's own database.
// The app starts empty: no seed people or list items (wishlist entries
// live on the List as kind "gift"). Strangers
// enter the Discover pool only through the joinDiscover action (the
// in-app Join flow) or when the user adds someone by hand.

import { defineAction, z, type ActionsModule, type Ctx } from "@hatch/space-sdk";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import * as schema from "./schema";
import KOA_SAMPLE_PHOTO_OUTDOOR_B64 from "./koa-sample-outdoor.b64.txt" with { type: "text" };
import KOA_SAMPLE_PHOTO_RESTAURANT_B64 from "./koa-sample-restaurant.b64.txt" with { type: "text" };
import KOA_SAMPLE_PHOTO_INDOOR_B64 from "./koa-sample-indoor.b64.txt" with { type: "text" };
import ALEX_SAMPLE_PHOTO_BLUE_B64 from "./alex-sample-blue.b64.txt" with { type: "text" };
import ALEX_SAMPLE_PHOTO_GREEN_B64 from "./alex-sample-green.b64.txt" with { type: "text" };
import ALEX_SAMPLE_PHOTO_BEACH_B64 from "./alex-sample-beach.b64.txt" with { type: "text" };
import LEILANI_SAMPLE_PHOTO_MOUNTAIN_BLONDE_B64 from "./leilani-sample-mountain-blonde.b64.txt" with { type: "text" };
import LEILANI_SAMPLE_PHOTO_BLACK_DRESS_BLONDE_B64 from "./leilani-sample-black-dress-blonde.b64.txt" with { type: "text" };
import LEILANI_SAMPLE_PHOTO_YOGA_BLONDE_V2_B64 from "./leilani-sample-yoga-blonde-v2.b64.txt" with { type: "text" };

// ---------- shared shapes ----------

const contactPref = z.enum(["everyone", "matches_only", "hype_spot", "nobody"]);
// Stated gender for the "I am" choice: "man" / "woman", or "" when
// not set. Never inferred from a name anywhere in this file.
const genderField = z.enum(["man", "woman", ""]);
const listKind = z.enum(["must", "nice", "dealbreaker", "gift"]);
const giftStatus = z.enum(["idea", "planned", "given"]);
// Membership age range (2026-11-02, Erin): List Dating is for
// members 18 to 99 inclusive (Erin's correction the same day:
// there is no upper limit at 69 — it is 99). Ages under 18 or
// over 99 are rejected here on the server (and mirrored in the
// client's parseAge / form messages). Null stays allowed where
// the owner records a person by hand — an unknown age is honest,
// and the 21+ spot gate treats unknown as not 21. Inside the
// range, the 21+ gate still applies to bars, night clubs and
// exotic venues (21–99 for those spots, 18–99 for the general app).
const ageField = z
  .number()
  .int()
  .min(18, "Age must be 18 or older — List Dating is for members 18 to 99")
  .max(99, "Age must be 99 or younger — List Dating is for members 18 to 99")
  .nullable();

const photoShape = z.object({
  id: z.number(),
  url: z.string(),
  contentType: z.string(),
});

const provideShape = z.object({
  id: z.number(),
  ownerType: z.enum(["profile", "person"]),
  ownerId: z.number(),
  category: z.string(),
  title: z.string(),
  maxSpendCents: z.number().nullable(),
  note: z.string(),
  createdAt: z.string(),
});

// One Need the other side covers: which Need, which Provide covers
// it, and the most that Provide will spend on it.
const needCoverShape = z.object({
  listItemId: z.number(),
  needText: z.string(),
  provideId: z.number(),
  provideTitle: z.string(),
  category: z.string(),
  maxSpendCents: z.number().nullable(),
  budgetFit: z.boolean().nullable(),
});

// One wishlist need of a member that the user's own Provide covers.
const wishlistCoverShape = z.object({
  giftId: z.number(),
  giftTitle: z.string(),
  provideId: z.number(),
  provideTitle: z.string(),
  category: z.string(),
  maxSpendCents: z.number().nullable(),
  budgetFit: z.boolean().nullable(),
});

// One of a member's OWN Wants (2026-11-04, Erin's direction):
// a scored List item (kind must / nice) tied to THAT member
// (list_items.person_id = the member) — the same store and
// kinds as the user's own Wants (hers carry person_id null).
// A member's Wants are NOT their Desires / Gifts: Desires are
// the kind "gift" rows, a separate store that never counts
// toward a match %. Open Profile reads this list for its
// "What they want" part, never the gift rows.
const memberWantShape = z.object({
  id: z.number(),
  text: z.string(),
  category: z.string(),
  occasion: z.string(),
  priceNote: z.string(),
});

const profileShape = z.object({
  name: z.string(),
  age: z.number().nullable(),
  bio: z.string(),
  location: z.string(),
  availableTimes: z.string(),
  spot: z.string(),
  gender: genderField,
  sameSex: z.boolean(),
  qualities: z.array(z.string()),
  lookingFor: z.string(),
  discoverable: z.boolean(),
  provides: z.array(provideShape),
  contactPref,
  hypeOn: z.boolean(),
  hypeSpot: z.string(),
  hypeMode: z.string(),
  hypeNote: z.string(),
  hypeExpiresAt: z.string().nullable(),
  hypePaidCents: z.number().nullable(),
  hypePlan: z.string(),
  metaAiConnected: z.boolean(),
  metaAiStatus: z.enum(["none", "saved_unverified", "accepted", "rejected"]),
  metaAiStatusMessage: z.string(),
  metaAiCheckedAt: z.string().nullable(),
  photos: z.array(photoShape),
});

const listItemShape = z.object({
  id: z.number(),
  kind: listKind,
  text: z.string(),
  category: z.string(),
  personId: z.number().nullable(),
  personName: z.string(),
  occasion: z.string(),
  priceNote: z.string(),
  link: z.string(),
  giftStatus: giftStatus.nullable(),
});

const personShape = z.object({
  id: z.number(),
  source: z.enum(["added", "joined"]),
  name: z.string(),
  age: z.number().nullable(),
  bio: z.string(),
  location: z.string(),
  availableTimes: z.string(),
  gender: genderField,
  sameSex: z.boolean(),
  qualities: z.array(z.string()),
  spot: z.string(),
  contactPref,
  hypeOn: z.boolean(),
  hypeSpot: z.string(),
  hypeMode: z.string(),
  hypeNote: z.string(),
  hypeExpiresAt: z.string().nullable(),
  hypePaidCents: z.number().nullable(),
  hypePlan: z.string(),
  blocked: z.boolean(),
  matchDecision: z.enum(["none", "accepted", "declined"]),
  promoCode: z.string(),
  matchNote: z.string(),
  matchNoteSource: z.enum(["meta-ai", "list", "none"]),
  photos: z.array(photoShape),
  unreadCount: z.number(),
  lastMessagePreview: z.string(),
  lastMessageAt: z.string().nullable(),
  createdAt: z.string(),
  matchPercent: z.number().nullable(),
  mustMet: z.number(),
  mustTotal: z.number(),
  niceMet: z.number(),
  niceTotal: z.number(),
  dealbreakersHit: z.array(z.string()),
  sameSpot: z.boolean(),
  canContact: z.boolean(),
  // Chat gate (Deal-only rule, 2026-11-04): true only when a
  // Deal exists with this person — the Deal button was hit on
  // their match card (matchDecision "accepted") or they have an
  // accepted date. A Match or a Potential with no Deal is never
  // chat-eligible, in any mode. Contact preferences (canContact)
  // can only narrow an already-eligible thread, never create
  // one. Non-eligible threads simply do not exist in Chat;
  // their messages are never deleted.
  chatEligible: z.boolean(),
  // Short plain-words reason this person has no Chat right now
  // (no Deal yet, or declined) — "" when the thread is eligible
  // (or the person is blocked; blocked members live in Safety).
  // The Chat tab shows no disclaimer (Erin, 2026-11-04): the
  // rule itself lives in Help only; this string is kept for the
  // server error messages and any surface that needs the reason.
  chatHiddenReason: z.string(),
  checks: z.array(
    z.object({ listItemId: z.number(), present: z.boolean() }),
  ),
  provides: z.array(provideShape),
  // This member's OWN Wants only (scored List items tied to
  // them) — never their Desires / Gifts (kind "gift" rows),
  // which stay a separate store and are read from `gifts`.
  wants: z.array(memberWantShape),
  // This member's OWN dealbreakers (kind "dealbreaker" List
  // items tied to them), kept apart from their Wants so every
  // Open Profile can show a Dealbreakers section in the same
  // place as the user's own profile template (Erin, 2026-11-04
  // consistency pass). NOT dealbreakersHit — that is the USER's
  // dealbreakers this member happens to trigger. Background
  // only: never scored, never a cover.
  dealbreakers: z.array(memberWantShape),
  needCovers: z.array(needCoverShape),
  coverCount: z.number(),
  coverBudgetCents: z.number(),
  coveredByMe: z.array(wishlistCoverShape),
  coveredByMeCount: z.number(),
  // Out of the Blue (2026-11-03, Erin's direction): a person with
  // 0% SPECIFIC covers — no Provide covers a Want either way, so
  // they are NOT a Match and NOT a Potential — can still surface
  // in Matches as a 2% out-of-the-blue surprise. The 2% is NOT a
  // cover and NEVER changes matchPercent / Match / Potential:
  // specific covers stay specific (Yoga is only covered by Yoga).
  // outOfBlue is true only for a mode-passing, non-blocked,
  // non-declined person at 0% specific with at least one Want on
  // either side to build a surprise date from. outOfBlueCategory
  // names a shared broad category (or a shared category cluster,
  // e.g. wellness) when one exists — context for the surprise,
  // never a cover — and is "" when the two sides touch entirely
  // different areas, which is itself the out-of-the-blue case.
  outOfBlue: z.boolean(),
  outOfBlueCategory: z.string(),
});

const giftShape = z.object({
  id: z.number(),
  title: z.string(),
  category: z.string(),
  personId: z.number().nullable(),
  personName: z.string(),
  occasion: z.string(),
  priceNote: z.string(),
  link: z.string(),
  status: giftStatus,
  locked: z.boolean(),
  createdAt: z.string(),
});

const hypePlanEnum = z.enum([
  "h30",
  "h60",
  "h90",
  "h120",
  "h150",
  "h180",
  "h210",
  "h240",
]);

const hypePaymentShape = z.object({
  id: z.number(),
  personId: z.number().nullable(),
  personName: z.string(),
  plan: z.string(),
  pricePaidCents: z.number(),
  minutes: z.number(),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
});

const wishlistUnlockShape = z.object({
  id: z.number(),
  personId: z.number().nullable(),
  personName: z.string(),
  pricePaidCents: z.number(),
  createdAt: z.string(),
});

const wishlistShape = z.object({
  freePreviewCount: z.number(),
  // The orphaned unlock prices ($4.99 single / $13.88 bundle)
  // are NOT part of the state any more (bug-check fix,
  // 2026-11-03): the paywall is killed until later, nothing in
  // the app displays a price, and leaving the stored columns in
  // the payload only risked them surfacing somewhere. The price
  // columns themselves stay in my_profile untouched so the
  // paywall can return later exactly as it was — they are simply
  // never sent to the client now.
  allUnlocked: z.boolean(),
  unlocks: z.array(wishlistUnlockShape),
  totalLocked: z.number(),
});

const dateStatus = z.enum(["proposed", "accepted", "declined"]);
const dateDirection = z.enum(["out", "in"]);

const dateShape = z.object({
  id: z.number(),
  personId: z.number(),
  personName: z.string(),
  direction: dateDirection,
  listItemId: z.number().nullable(),
  ideaText: z.string(),
  meetAt: z.string().nullable(),
  spot: z.string(),
  note: z.string(),
  status: dateStatus,
  // ISO instant the date was marked completed, or null when it
  // has not been (or an undo cleared it). Status stays "accepted"
  // for a completed date — see the dates table comment.
  completedAt: z.string().nullable(),
  plan: z.string(),
  planSource: z.enum(["meta-ai", "list", "none"]),
  // URL of the generated date-plan image (Muse Image, when it
  // produced one for this plan), or null — the plan text always
  // shows with or without it.
  planImageUrl: z.string().nullable(),
  // What the plan's picture is: "actual" = a real photograph of
  // the plan's real location / stores (see planPhotoKeys),
  // "generated" = a Muse Image picture (fallback only, when no
  // actual photo exists for the spot), "none" = no picture.
  planImageSource: z.enum(["actual", "generated", "none"]),
  // Registry keys of the actual photographs for this plan (the
  // client maps each key to its bundled real photo). Empty
  // unless planImageSource is "actual".
  planPhotoKeys: z.array(z.string()),
  createdAt: z.string(),
});

const promoCodeShape = z.object({
  id: z.number(),
  code: z.string(),
  label: z.string(),
  maxUses: z.number().nullable(),
  uses: z.number(),
  active: z.boolean(),
  createdAt: z.string(),
});

const messageDirection = z.enum(["out", "in"]);

const messageShape = z.object({
  id: z.number(),
  personId: z.number(),
  personName: z.string(),
  direction: messageDirection,
  body: z.string(),
  kind: z.enum(["text", "quick"]),
  read: z.boolean(),
  dateId: z.number().nullable(),
  createdAt: z.string(),
});

const safetyCheckinShape = z.object({
  id: z.number(),
  dateId: z.number(),
  personId: z.number(),
  personName: z.string(),
  ideaText: z.string(),
  durationMinutes: z.number(),
  startedAt: z.string(),
  endsAt: z.string(),
  endedAt: z.string().nullable(),
  status: z.enum(["active", "ended_early", "finished"]),
  createdAt: z.string(),
});

const reportShape = z.object({
  id: z.number(),
  personId: z.number(),
  personName: z.string(),
  reason: z.string(),
  note: z.string(),
  createdAt: z.string(),
});

// One Spark vs Wonder comparison row for one person: the same
// match-note prompt and the same date-plan prompt, run on both
// models, stored side by side. Status per text: "meta-ai" = that
// model wrote it, "list" = List fallback, "" = not run yet.
const modelComparisonShape = z.object({
  id: z.number(),
  personId: z.number(),
  personName: z.string(),
  dateId: z.number().nullable(),
  dateIdeaText: z.string(),
  sparkModel: z.string(),
  wonderModel: z.string(),
  sparkMatchNote: z.string(),
  wonderMatchNote: z.string(),
  sparkMatchNoteStatus: z.string(),
  wonderMatchNoteStatus: z.string(),
  sparkDatePlan: z.string(),
  wonderDatePlan: z.string(),
  sparkDatePlanStatus: z.string(),
  wonderDatePlanStatus: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const okResponse = z.object({ ok: z.literal(true) });
type Ok = z.infer<typeof okResponse>;

const stateResponse = z.object({
  profile: profileShape,
  provides: z.array(provideShape),
  listItems: z.array(listItemShape),
  people: z.array(personShape),
  gifts: z.array(giftShape),
  wishlist: wishlistShape,
  dates: z.array(dateShape),
  safetyCheckins: z.array(safetyCheckinShape),
  messages: z.array(messageShape),
  reports: z.array(reportShape),
  promoCodes: z.array(promoCodeShape),
  hypePayments: z.array(hypePaymentShape),
  modelComparisons: z.array(modelComparisonShape),
});
type State = z.infer<typeof stateResponse>;

// ---------- helpers ----------

function parseQualities(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((q): q is string => typeof q === "string");
    }
  } catch {
    // fall through to empty
  }
  return [];
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function fuzzyMatch(itemText: string, qualities: string[]): boolean {
  const item = norm(itemText);
  if (!item) return false;
  return qualities.some((q) => {
    const qual = norm(q);
    return qual !== "" && (qual === item || qual.includes(item) || item.includes(qual));
  });
}

// ---------- Content filter: no vulgar or sexual wording ----------
//
// List Dating is for meeting up to do something real from the List —
// it is NOT a hookup app. Every user-written field (List items,
// wishlist entries, Provide entries, profiles, Hype notes,
// date notes, promo labels, report notes, and Chat messages in both
// directions) is checked here, server-side, before anything is
// stored, so no client can bypass it. The client mirrors the same
// lists for instant feedback; this server check is authoritative.
//
// Matching rules, tuned to err against false positives (a word that
// is merely similar must still save — a never-save outcome is worse
// than a missed catch):
// - Whole-token matches only, never substrings: "Essex", "sextant",
//   "Middlesex", "cocktail", "peacock", "class" and "Scunthorpe"
//   are different tokens from the banned words inside them, so they
//   always pass.
// - Case, surrounding punctuation and leetspeak are normalised
//   first ("S3X", "D1CK", "p3nis" are caught).
// - Simple obfuscations are caught too: repeated letters ("sexx",
//   "diiick"), separators inside a word ("s.e.x", "d-i-c-k",
//   "s_e_x") and spaced-out letters ("s e x", "o r a l s e x").
// - Texting abbreviations for hookups and sexual content are
//   blocked the same way (BANNED_ABBREVS below): whole tokens only,
//   case-insensitive, with the same dotted ("d.t.f"), spaced
//   ("d t f", "b j") and leetspeak ("d7f") catches. Deliberately
//   left OUT as too ambiguous to block: fs (for sale), asl
//   (American Sign Language), dt (downtown), bb (baby / bareback),
//   69 (a plain number), ltr / gf / bf (ordinary dating words).
// - The sexting-abbreviation lists Erin screenshotted (2026-11-01)
//   were sorted the same way: the sexual / hookup entries were
//   added (IWS, CU46, 53X, GNOC, NIFOC, …), and the innocent ones
//   on those same lists were deliberately left OUT — the numeric
//   codes 143, 182, 459, 1337, 420 and a plain standalone 8, and
//   the parents-around / alert codes cd9, kpc, mos, p911, pal,
//   paw, pir, pos, morf, sorg, wycm, nmu, ru/18. Digit-bearing
//   abbreviations (cu46, k4y, 1174, 53x) are also matched against
//   the raw, undecoded tokens, because the leetspeak pass above
//   rewrites digits before matching ("cu46" decodes to "cua6").
//   Slash pairs from the lists (if/ib, ilf/md) are stored
//   joined ("ifib", "ilfmd") so the separator and spaced
//   catches find them without ever blocking the plain word "if".
// - One exception to case-insensitive matching: "jo" (jerk off,
//   also typed j/o) is NOT in BANNED_ABBREVS, because "Jo" is an
//   ordinary person's name and must save normally — "Jo is my
//   friend" passes everywhere, Chat included. Only the slang
//   forms block, via the case-aware containsJoSlang check below:
//   every bare spelling that reads as "jo" EXCEPT the plain
//   name forms "Jo" and "jo" — all-caps "JO", mixed-case "jO",
//   leetspeak in any case ("J0", "j0"), repeated letters
//   ("JOO"), and separated / obfuscated spellings in any case
//   (J/O, J.O., j-o, "j o").
// - "cum" is a banned standalone word (whole token, like the
//   others — "cucumber" and "cumulative" are different tokens
//   and pass), and ejaculation phrases built on "blow" are in
//   BANNED_PHRASES ("blow your load", "blow a load", plus the
//   related load / wad / nut phrases). Two neighbours stay
//   allowed on purpose: "come" is a different, ordinary word
//   ("come find me" is one of the Chat helpers), and "blow" on
//   its own is ordinary too — "blow dry" for hair must save;
//   "blow" only blocks inside those phrases.
// - One allowlisted phrase is scrubbed before checking: the store
//   name "Dick's Sporting Goods" is a shop, not vulgarity.
//
// Drug-use blocking (added 2026-11-03 at Erin's direction, the
// same treatment as the no-hookups filter): drug words, drug-use
// abbreviations and drug phrases (DRUG_WORDS / DRUG_ABBREVS /
// DRUG_PHRASES below) are checked by the SAME matching machinery
// (whole tokens, leetspeak / separator / spaced / squeeze
// catches) in every place the filter runs — Lists, Provides,
// profiles, Chat and everywhere else assertCleanWording applies.
// The filter is TYPE-SPECIFIC: a value that trips the hookup /
// vulgar sets throws BANNED_WORDING_MESSAGE, a value that trips
// only the drug sets throws DRUG_WORDING_MESSAGE, and clean
// values pass untouched. A value already blocked as hookup /
// vulgar keeps that message (PNP / "party and play" stay hookup
// entries), so drug wording is the message only when the drug
// sets are what tripped. Deliberate tuning, same err-against-
// false-positives rule as above: "420" — left allowed by the
// sexting-list sort as a non-sexual code — is NOW a blocked drug
// abbreviation under this direction; ambiguous everyday words
// stay allowed on their own and block only inside drug phrases:
// "pot" (a cooking pot / pot luck — "smoke pot", "pot brownie"
// block), "coke" (the drink — "cocaine" itself blocks), "crack"
// (a cracked windshield — "crack cocaine", "smoke crack"
// block), "joint" (a body joint — "smoke a joint" blocks),
// "acid" and "spice" (ordinary words), and "molly" (a person's
// name, like Jo — MDMA blocks by its own name). The pharmacy
// phrase "drug store" is scrubbed before checking, like Dick's
// Sporting Goods above, so naming a shop is never drug wording.
// Hawai'i drug slang (added 2026-11-03 at Erin's direction):
// "batu" (crystal meth) and "shabu" (meth) are DRUG_WORDS, and
// "pakalolo" (marijuana, Hawaiian) is a DRUG_WORD too, so their
// leetspeak / dotted / spaced / stretched forms block through
// the same machinery (the leet map also decodes "8" as "b", so
// "84tu" / "847u" are caught). Hawai'i cannabis names that are
// a place name plus a strain word — "maui wowie" / "maui waui",
// "kona gold", "puna bud" — are DRUG_PHRASES only: Maui, Kona
// and Puna on their own are places (and coffee) and always
// pass. "ice" gets the same careful treatment: in Hawai'i it
// names crystal meth, but it is an everyday word too, so it is
// NOT a drug word on its own — "ice cream", "ice water",
// "shave ice", "iced tea" and every other clean use passes,
// and only drug-context phrases block ("smoke ice", "buy ice",
// "sell ice", "ice pipe", "ice dealer"). One food scrub joins
// the allowlist: "shabu shabu" (the hot-pot dish, also typed
// "shabu-shabu") is scrubbed before checking, so naming the
// dish is never drug wording, while a standalone "shabu"
// still blocks as meth slang.
// The app's own catalog wording stays clean under this list by
// design: Hype modes, spot names (including the adults-only pole
// dancing collection), Provide categories and the
// one-tap Chat helpers ("On my way", "I'm here", "Confirm the
// meetup", …) contain none of these words.

export const BANNED_WORDING_MESSAGE =
  "That wording isn't allowed here — List Dating is for meeting up to do something real from the List, not for hookups. Please reword it without sexual or vulgar language.";

// The drug-type counterpart: shown ONLY when drug wording (and
// no hookup / vulgar wording) is what tripped the filter.
export const DRUG_WORDING_MESSAGE =
  "That wording isn't allowed here — List Dating isn't for drug use. Please reword it without any drug references.";

const BANNED_WORDS = new Set([
  // Sexual anatomy and acts
  "dick", "dicks", "dickhead", "dickheads", "cock", "cocks",
  "cocksucker", "penis", "penises", "vagina", "vaginas", "vaginal",
  "pussy", "pussies", "cunt", "cunts", "clit", "clits", "clitoris",
  "scrotum", "testicle", "testicles", "ballsack", "dildo", "dildos",
  "vibrator", "vibrators", "boner", "boners", "erection",
  "erections", "semen", "fingering", "rimming", "deepthroat",
  "creampie", "cum", "cums", "cumming", "cumshot", "cumshots",
  "jizz",
  // Sex and hookup language
  "sex", "sexes", "sexual", "sexually", "sexy", "sexier",
  "sexiest", "sext", "sexts", "sexting", "oralsex", "xrated",
  "hookup", "hookups", "blowjob", "blowjobs", "handjob", "handjobs",
  "masturbate", "masturbating", "masturbation", "ejaculate",
  "ejaculation", "orgasm", "orgasms", "erotic", "erotica", "porn",
  "porno", "pornography", "pornographic", "hardcore", "horny",
  "nude", "nudes", "naked", "threesome", "threesomes", "orgy",
  "orgies", "gangbang", "milf", "milfs", "dilf", "kinky", "seduce",
  "seducing", "seductive", "prostitute", "prostitutes",
  "prostitution",
  // Vulgar profanity
  "fuck", "fucks", "fucked", "fucking", "fucker", "fuckers",
  "motherfucker", "motherfuckers", "shit", "shits", "shitty",
  "bitch", "bitches", "ass", "asses", "asshole", "assholes",
  "whore", "whores", "slut", "sluts", "slutty", "bastard",
  "bastards",
]);

// Texting / personals abbreviations for hookups and sexual
// content — the shorthand people actually type. Matched as whole
// abbreviations only (see the rules above), never as substrings,
// so clean words and ordinary shorthand still save.
const BANNED_ABBREVS = new Set([
  // Hookup-seeking shorthand
  "dtf", // down to fuck
  "fwb", // friends with benefits
  "nsa", // no strings attached
  "ons", // one-night stand
  "pnp", // party and play
  "iwsn", // I want sex now
  // Sexual acts and paid-encounter shorthand
  "bj", "bbbj", "cbj", "hj", "rj", "dp",
  "cim", "cob", "cof", "msog", "gfe", "pse",
  "bdsm",
  // Group-sex configuration shorthand
  "mfm", "mmf", "ffm", "fmf",
  // Sexual content / profanity shorthand and evasive spellings
  "xxx", "pron", "fck", "fuk",
  // From the sexting-abbreviation lists Erin screenshotted
  // (2026-11-01) — only the sexual / hookup entries; the innocent
  // codes on those lists stay allowed (see the rules above).
  "iws", // I want sex
  "cu46", // see you for sex (4-6 sounds like "for sex")
  "53x", // sex, leetspeak (also caught decoded, as "sex")
  "gnoc", // get naked on camera
  "nifoc", // naked in front of computer
  "ipn", // I'm posting naked
  "s2r", // send to receive (nudes)
  "gypo", // get your pants off
  "gnrn", // get naked right now
  "ruh", // are you horny?
  "tdtm", // talk dirty to me
  "fmh", // fuck me harder
  "dum", // do you masturbate?
  // "jo" (jerk off, also typed j/o) is deliberately NOT in this
  // set: "Jo" is an ordinary name. Its slang forms are blocked
  // by the case-aware containsJoSlang check below instead.
  "dusl", // do you scream loud?
  "fb", // fuck buddy
  "fmltwia", // fuck me like the whore I am
  "fol", // fond of leather
  "iaym", // I am your master
  "ifib", // if/ib — in the front or in the back
  "iit", // is it tight?
  "ilfmd", // ilf/md — I love female/male dominance
  "imezru", // I am easy, are you?
  "kfy", "k4y", // kiss for you
  "lmirl", // let's meet in real life
  "moos", // member of the opposite sex (mos itself stays allowed)
  "q2c", // quick to cum
  "1174", // nude club
]);

const BANNED_PHRASES = [
  "oral sex", "anal sex", "group sex", "casual sex", "phone sex",
  "sex toy", "sex toys", "sex chat", "sex tape", "sex tapes",
  "blow job", "blow jobs", "hand job", "hand jobs",
  // Ejaculation phrases built on "blow" / "shoot" / "bust" —
  // "blow" itself is NOT a banned word (see the rules above);
  // it only blocks inside these phrases.
  "blow your load", "blow a load", "blow my load", "blow his load",
  "blow her load", "blow their load", "blow our load",
  "blow the load", "blow load", "blow loads",
  "blowing your load", "blowing a load", "blowing my load",
  "blowing his load", "blowing their load", "blowing load",
  "blew your load", "blew a load", "blew his load",
  "shoot your load", "shoot a load", "shoot my load",
  "shoot his load", "shoot her load", "shoot their load",
  "shoot load", "shoot loads", "shooting your load",
  "shooting a load", "shooting his load",
  "blow your wad", "blow a wad", "blow my wad", "blow his wad",
  "shoot your wad", "shoot a wad", "shoot his wad",
  "bust a nut", "bust your nut", "bust his nut", "bust her nut",
  "busting a nut", "busting your nut", "busting his nut",
  "hook up", "hook ups", "hooking up",
  "dick pic", "dick pics", "nude pic", "nude pics", "nude photo",
  "nude photos", "one night stand", "friends with benefits",
  "booty call", "hard on", "sugar daddy", "sugar baby",
  "no strings attached", "party and play", "netflix and chill",
  "casual encounter", "casual encounters",
];

// Drug-use words — whole tokens only, like the hookup sets.
// Ambiguous everyday neighbours (pot, coke, crack, joint, acid,
// spice, molly) are deliberately NOT here; they block only
// inside DRUG_PHRASES below (see the filter rules above).
const DRUG_WORDS = new Set([
  // General drug language
  "drug", "drugs", "narcotic", "narcotics", "dope",
  // Cannabis
  "weed", "marijuana", "cannabis", "ganja", "hashish", "kush",
  "reefer", "maryjane", "bong", "bongs", "blunt", "blunts",
  "spliff", "spliffs", "doobie", "doobies", "edibles",
  "stoner", "stoners", "stoned", "hotbox", "hotboxing",
  "shroom", "shrooms",
  // Hawai'i cannabis slang: pakalolo is the Hawaiian word for
  // marijuana; "mauiwowie" is the joined spelling of the
  // "maui wowie" phrase below.
  "pakalolo", "mauiwowie",
  // Cocaine, opioids and prescription misuse
  "cocaine", "heroin", "morphine", "fentanyl", "opium",
  "oxycodone", "oxycontin", "hydrocodone", "codeine",
  "tramadol", "percocet", "vicodin", "xanax", "valium",
  "klonopin", "adderall", "ritalin", "methadone",
  // Stimulants, hallucinogens and others
  "meth", "methamphetamine", "amphetamine", "amphetamines",
  "ecstasy", "ketamine", "mescaline", "peyote", "ayahuasca",
  "psilocybin",
  // Hawai'i meth slang: "batu" is the local name for crystal
  // meth in Hawai'i, and "shabu" is meth slang used in
  // Hawai'i too (the dish "shabu shabu" is scrubbed before
  // checking — see scrubWording — so it always passes).
  "batu", "shabu",
]);

// Drug-use abbreviations / codes — whole tokens only, matched
// against decoded AND raw tokens like the hookup abbreviations,
// so dotted ("t.h.c"), spaced ("4 2 0") and leetspeak forms are
// caught the same way.
const DRUG_ABBREVS = new Set([
  "thc", // cannabis active compound
  "cbd", // cannabis-derived oil / products
  "mdma", // ecstasy
  "lsd", // acid
  "pcp", // angel dust
  "ghb", // liquid ecstasy / date-rape drug
  "dmt", // hallucinogen
  "xtc", // ecstasy shorthand
  "k2", // synthetic cannabis ("spice" the drug; the cooking word stays allowed)
  "oxy", // oxycodone shorthand
  "420", // cannabis code — allowed by the sexting-list sort as
  // non-sexual, blocked since 2026-11-03 as a drug code
]);

const DRUG_PHRASES = [
  "mary jane", "hash oil", "special k",
  "smoke weed", "smoking weed", "smoke pot", "smoking pot",
  "smoke marijuana", "smoking marijuana",
  "smoke cannabis", "smoking cannabis",
  "smoke crack", "smoking crack", "crack cocaine",
  "crystal meth", "magic mushroom", "magic mushrooms",
  "smoke a blunt", "smoking a blunt", "roll a blunt",
  "smoke a joint", "smoking a joint",
  "smoke dope", "smoking dope",
  "get high", "getting high", "get stoned", "getting stoned",
  "shoot up", "shooting up",
  "snort cocaine", "snorting cocaine",
  "buy drugs", "sell drugs", "selling drugs",
  "buy weed", "sell weed", "selling weed",
  "drug dealer", "drug dealers",
  "pot brownie", "pot brownies", "weed edibles",
  // Hawai'i cannabis strain names — phrases only, so the
  // place names inside them (Maui, Kona, Puna) pass on their
  // own, coffee included.
  "maui wowie", "maui waui", "kona gold", "puna bud",
  // "ice" in drug context only (in Hawai'i, ice is crystal
  // meth): the word on its own is everyday — "ice cream",
  // "ice water", "shave ice" — and always passes; only these
  // drug-context phrases block.
  "smoke ice", "smoking ice", "buy ice", "sell ice",
  "selling ice", "ice pipe", "ice dealer",
];

const LEET_MAP: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  // "8" decodes as "b" so Hawai'i meth slang typed in
  // leetspeak — "84tu", "847u" for "batu" — is caught like
  // every other leet form. No clean token or innocent code
  // decodes to a banned word through this ("808" → "bob",
  // "182" → "ib2", a standalone "8" → "b"), so clean wording
  // still passes.
  "8": "b",
  "@": "a",
  $: "s",
};

function squeezeWord(w: string): string {
  return w.replace(/(.)\1+/g, "$1");
}

const BANNED_SQUEEZED = new Set(
  [...BANNED_WORDS].map((w) => squeezeWord(w)),
);

// A few abbreviations stay OUT of the repeated-letter squeeze:
// their squeezed forms collide with clean tokens ("moos" squeezes
// to "mos" and would block "moss"; "fol" would block "fool";
// "iit" squeezes to the generic "it"; "1174" squeezes to "174"
// and would block innocent numbers like 1774). Their plain,
// dotted, spaced and raw forms are still caught below.
const ABBREVS_NO_SQUEEZE = new Set(["moos", "fol", "iit", "1174"]);

const BANNED_ABBREVS_SQUEEZED = new Set(
  [...BANNED_ABBREVS]
    .filter((w) => !ABBREVS_NO_SQUEEZE.has(w))
    .map((w) => squeezeWord(w)),
);

// Drug sets get the same repeated-letter squeeze treatment; no
// drug abbreviation's squeezed form collides with a clean token
// ("420" / "k2" have no repeated characters to squeeze), so no
// exclusions are needed here.
const DRUG_SQUEEZED = new Set(
  [...DRUG_WORDS].map((w) => squeezeWord(w)),
);

const DRUG_ABBREVS_SQUEEZED = new Set(
  [...DRUG_ABBREVS].map((w) => squeezeWord(w)),
);

function wordingTokens(text: string): string[] {
  const decoded = text
    .toLowerCase()
    .split("")
    .map((c) => LEET_MAP[c] ?? c)
    .join("");
  return decoded.split(/[^a-z0-9]+/).filter(Boolean);
}

// The same tokenisation WITHOUT the leetspeak decode. Digit-
// bearing abbreviations (cu46, k4y, 1174, 53x) only exist in this
// raw form — decoding would rewrite their digits into letters —
// so abbreviation matching also runs over these tokens.
function rawWordingTokens(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

// The one case-aware filter entry: "jo" (jerk off, also typed
// j/o). Every other abbreviation matches case-insensitively, but
// "Jo" is an ordinary person's name, so the plain name forms —
// "Jo", and a lowercase "jo" in running text — always pass
// ("Jo is my friend" saves). Every other bare spelling that
// reads as "jo" blocks:
// - all-caps "JO" and mixed-case "jO";
// - leetspeak in any case ("J0", "j0") and repeated-letter
//   spellings ("JOO");
// - separated spellings in any case ("J/O", "J.O.", "j-o",
//   "j_o") — a separator INSIDE the word, which is how the
//   slang is typed and never how the name is written, so
//   trailing punctuation ("Jo, …") never trips this;
// - spaced-out letters ("j o"), matched by exact equality like
//   every other abbreviation's spaced form.
function containsJoSlang(raw: string): boolean {
  // Bare tokens in their original form: the exact plain name
  // forms "Jo" and "jo" pass; any other token that decodes
  // (leetspeak included) to "jo" — or squeezes to it — blocks.
  for (const w of raw.split(/[^A-Za-z0-9]+/).filter(Boolean)) {
    if (w === "Jo" || w === "jo") continue;
    const decoded = w
      .toLowerCase()
      .split("")
      .map((c) => LEET_MAP[c] ?? c)
      .join("");
    if (decoded === "jo" || squeezeWord(decoded) === "jo") return true;
  }
  // Separated spellings inside one written word ("J/O", "j.o").
  for (const chunk of raw.split(/\s+/)) {
    if (!chunk) continue;
    const core = chunk
      .replace(/^[^A-Za-z0-9]+/, "")
      .replace(/[^A-Za-z0-9]+$/, "");
    if (!/[^A-Za-z0-9]/.test(core)) continue;
    const stripped = wordingTokens(core).join("");
    if (stripped === "jo" || squeezeWord(stripped) === "jo") return true;
    const rawStripped = core.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (rawStripped === "jo" || squeezeWord(rawStripped) === "jo") {
      return true;
    }
  }
  // Spaced-out letters ("j o") — exact-equality run check, the
  // same rule the other abbreviations use.
  const tokens = wordingTokens(raw);
  let run = "";
  const runs: string[] = [];
  for (const t of tokens) {
    if (t.length === 1) {
      run += t;
    } else {
      if (run) runs.push(run);
      run = "";
    }
  }
  if (run) runs.push(run);
  return runs.includes("jo");
}

// Allowlisted phrases scrubbed before any check runs: a
// sporting-goods store is a shop, not vulgarity, a "drug
// store" is a pharmacy, not drug use, and "shabu shabu" is
// the hot-pot dish, not meth slang.
function scrubWording(raw: string): string {
  return raw
    .replace(/dick'?s\s+sporting\s+goods/gi, " sporting goods ")
    .replace(/\bdrug\s+stores?\b/gi, " pharmacy ")
    .replace(/\bshabu[-\s]+shabu\b/gi, " hot pot ");
}

// The shared matching machinery, run once per wording type with
// that type's sets: whole-token matches (plus the repeated-letter
// squeeze), raw-token matches for digit-bearing abbreviations,
// phrase matches (plain and squeezed), separator obfuscation
// inside one written word, and spaced-out letter runs. The
// hookup sets and the drug sets go through exactly the same
// steps — only the lists, and so the message, differ.
function matchesWordingSets(
  scrubbed: string,
  words: ReadonlySet<string>,
  abbrevs: ReadonlySet<string>,
  phrases: readonly string[],
  wordsSqueezed: ReadonlySet<string>,
  abbrevsSqueezed: ReadonlySet<string>,
): boolean {
  const tokens = wordingTokens(scrubbed);
  if (tokens.length === 0) return false;
  // 1) Whole-token matches (plus a repeated-letter squeeze, so
  //    "sexx" / "diiick" are caught while plain tokens like "bob"
  //    or "essex" — whose squeeze is themselves — are never hit by
  //    the squeeze path).
  for (const t of tokens) {
    if (words.has(t)) return true;
    if (abbrevs.has(t)) return true;
    const sq = squeezeWord(t);
    if (sq !== t && wordsSqueezed.has(sq)) return true;
    if (sq !== t && abbrevsSqueezed.has(sq)) return true;
  }
  // 1b) The same whole-token check over the RAW (undecoded)
  //     tokens, for the digit-bearing abbreviations ("cu46",
  //     "k4y", "1174", "420") that leetspeak decoding rewrites.
  const rawTokens = rawWordingTokens(scrubbed);
  for (const t of rawTokens) {
    if (abbrevs.has(t)) return true;
  }
  // 2) Phrases over the token stream ("oral sex", "blow job",
  //    "hook up", "smoke weed") — word-boundary padded, so
  //    "Essex" can never read as "sex".
  const padded = ` ${tokens.join(" ")} `;
  // The same phrase check over the repeated-letter-squeezed
  // token stream, so "bloww your loaad" cannot slip a phrase
  // past by stretching its letters. Squeezing whole tokens can
  // only turn a clean stream into one of these specific phrases
  // if the words themselves were already those words stretched.
  const squeezedPadded = ` ${tokens.map((t) => squeezeWord(t)).join(" ")} `;
  for (const p of phrases) {
    if (padded.includes(` ${p} `)) return true;
    if (squeezedPadded.includes(` ${p} `)) return true;
  }
  // 3) Separator obfuscation inside one written word:
  //    "s.e.x", "d-i-c-k", "s_e_x" — and for abbreviations the
  //    two-letter forms too: "d.t.f", "b.j", "b-b-b-j", "t.h.c".
  for (const rawToken of scrubbed.split(/\s+/)) {
    if (!rawToken || !/[^a-zA-Z0-9]/.test(rawToken)) continue;
    const stripped = wordingTokens(rawToken).join("");
    if (stripped.length >= 3 && words.has(stripped)) return true;
    if (stripped.length >= 2 && abbrevs.has(stripped)) return true;
    // The raw join too, so dotted digit abbreviations survive:
    // "c.u.46", "k-4-y", "1.1.7.4", "i.f/i.b", "4.2.0".
    const rawStripped = rawToken.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (rawStripped.length >= 2 && abbrevs.has(rawStripped)) {
      return true;
    }
  }
  // 4) Spaced-out letters: "s e x", "o r a l s e x", "w e e d",
  //    or a whole sentence typed letter by letter.
  let run = "";
  const runs: string[] = [];
  for (const t of tokens) {
    if (t.length === 1) {
      run += t;
    } else {
      if (run) runs.push(run);
      run = "";
    }
  }
  if (run) runs.push(run);
  // Raw spaced-out runs too: "1 1 7 4", "c u 4 6" and "4 2 0"
  // only spell a banned abbreviation before leetspeak decoding
  // rewrites the digits. Exact equality only, same as the
  // decoded runs.
  let rawRun = "";
  const rawRuns: string[] = [];
  for (const t of rawTokens) {
    if (t.length === 1) {
      rawRun += t;
    } else {
      if (rawRun) rawRuns.push(rawRun);
      rawRun = "";
    }
  }
  if (rawRun) rawRuns.push(rawRun);
  for (const r of rawRuns) {
    if (r.length >= 2 && abbrevs.has(r)) return true;
  }
  const compactPhrases = phrases.map((p) => p.replace(/ /g, ""));
  for (const r of runs) {
    // A spaced-out run that is exactly an abbreviation ("d t f",
    // "b j") is that abbreviation typed letter by letter. Exact
    // equality only — a longer spelled-out sequence is never hit,
    // so spelling an ordinary word out can never trip this.
    if (r.length >= 2 && abbrevs.has(r)) return true;
    if (r.length < 3) continue;
    if (words.has(r) || compactPhrases.includes(r)) return true;
    for (const w of words) {
      if (w.length >= 4 && r.includes(w)) return true;
    }
    for (const cp of compactPhrases) {
      if (cp.length >= 5 && r.includes(cp)) return true;
    }
  }
  return false;
}

// True when the value trips the hookup / vulgar sets (including
// the JO slang forms).
export function containsHookupWording(raw: string): boolean {
  if (!raw || !raw.trim()) return false;
  const scrubbed = scrubWording(raw);
  // The JO slang forms ("JO", "jO", "j0", "J/O", "J.O.",
  // "j o") — checked case-aware on the original text,
  // because the plain name forms "Jo" / "jo" must always
  // pass (see containsJoSlang).
  if (containsJoSlang(scrubbed)) return true;
  return matchesWordingSets(
    scrubbed,
    BANNED_WORDS,
    BANNED_ABBREVS,
    BANNED_PHRASES,
    BANNED_SQUEEZED,
    BANNED_ABBREVS_SQUEEZED,
  );
}

// True when the value trips the drug sets.
export function containsDrugWording(raw: string): boolean {
  if (!raw || !raw.trim()) return false;
  return matchesWordingSets(
    scrubWording(raw),
    DRUG_WORDS,
    DRUG_ABBREVS,
    DRUG_PHRASES,
    DRUG_SQUEEZED,
    DRUG_ABBREVS_SQUEEZED,
  );
}

// True when the value trips EITHER wording type — kept as the
// boolean guard for the stored-wording cleanup and the Meta AI
// note / plan guards, which only need "is it clean?".
export function containsBannedWording(raw: string): boolean {
  return containsHookupWording(raw) || containsDrugWording(raw);
}

// The type-specific friendly message for a value, or null when
// the value is clean. Hookup / vulgar wins when a value trips
// both types, so every value blocked before the drug sets
// existed keeps the exact message it always showed.
export function bannedWordingMessage(raw: string): string | null {
  if (containsHookupWording(raw)) return BANNED_WORDING_MESSAGE;
  if (containsDrugWording(raw)) return DRUG_WORDING_MESSAGE;
  return null;
}

// Throw the friendly filter error if any value (or any string in
// any array value) trips the filter — the message matches the
// TYPE of wording that tripped it (drug wording gets the drug
// message, hookup / vulgar wording gets the hookup message).
// Empty / missing values pass.
export function assertCleanWording(
  ...values: (string | readonly string[] | null | undefined)[]
): void {
  for (const v of values) {
    if (typeof v === "string") {
      const msg = bannedWordingMessage(v);
      if (msg) throw new Error(msg);
    } else if (Array.isArray(v)) {
      for (const s of v) {
        if (typeof s !== "string") continue;
        const msg = bannedWordingMessage(s);
        if (msg) throw new Error(msg);
      }
    }
  }
}

// One-time guarded cleanup of wording stored BEFORE the filter
// existed: the live profile (and any member) must not keep
// displaying a Hype note or bio that trips the filter. Runs on the first getState of a server process; it only
// writes when it actually finds a violating field, clearing just
// that field — rows, names, spots, pricing and every clean field
// are untouched, and once cleaned the scan finds nothing to do.
let storedWordingCleanupDone = false;
async function cleanStoredWordingOnce(ctx: Ctx): Promise<void> {
  if (storedWordingCleanupDone) return;
  storedWordingCleanupDone = true;
  try {
    const db = ctx.db<typeof schema>();
    const profile = await loadProfile(ctx);
    const profilePatch: { hypeNote?: string; bio?: string } = {};
    if (containsBannedWording(profile.hypeNote)) profilePatch.hypeNote = "";
    if (containsBannedWording(profile.bio)) profilePatch.bio = "";
    if (Object.keys(profilePatch).length > 0) {
      await db
        .update(schema.myProfile)
        .set(profilePatch)
        .where(eq(schema.myProfile.id, 1));
    }
    const personRows = await db.select().from(schema.people);
    for (const p of personRows) {
      const patch: { hypeNote?: string; bio?: string } = {};
      if (containsBannedWording(p.hypeNote)) patch.hypeNote = "";
      if (containsBannedWording(p.bio)) patch.bio = "";
      if (Object.keys(patch).length > 0) {
        await db
          .update(schema.people)
          .set(patch)
          .where(eq(schema.people.id, p.id));
      }
    }
    const dateRows = await db.select().from(schema.dates);
    for (const d of dateRows) {
      if (containsBannedWording(d.note)) {
        await db
          .update(schema.dates)
          .set({ note: "" })
          .where(eq(schema.dates.id, d.id));
      }
    }
  } catch {
    // Best effort only — a cleanup failure must never block reads.
  }
}

// ---------- Provide list: two-sided matching ----------
//
// The Need list says what someone wants. The Provide list says what
// someone can cover: a category, the specific thing, and the most
// they will spend on it. A Provide covers a Need when its title or
// category fuzzy-matches the Need text (same rule as qualities vs
// List items), or when the Need mentions one of the category's
// keywords — so "Windshield wipers" is covered by a "Car &
// Mechanical" provide even when its title says something broader.

export const PROVIDE_CATEGORIES = [
  "Home & Handy",
  "Car & Mechanical",
  "Food & Cooking",
  "Beauty & Grooming",
  "Health & Wellness",
  "Tech & Phone Help",
  "Home Cleaning & Organizing",
  "Rides & Errands",
  "Money & Treats",
  "Company & Conversation",
  "Creative & Photos",
  "Fitness & Outdoors",
  "Entertainment",
  "Movies",
  "Business & Consultation",
  "Travel & Trips",
  "Other",
] as const;

const PROVIDE_CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Home & Handy": ["home", "house", "repair", "fix", "plumbing", "leak", "door", "furniture", "assemble", "paint", "yard", "garden", "handyman", "shelf", "curtain"],
  "Car & Mechanical": ["car", "auto", "mechanic", "mechanical", "windshield", "wiper", "tire", "tyre", "oil change", "brake", "engine", "battery", "vehicle", "truck", "moped", "scooter"],
  "Food & Cooking": ["food", "cook", "meal", "dinner", "lunch", "breakfast", "groceries", "grocery", "baking", "bake", "recipe", "diet", "dietary", "restaurant", "coffee"],
  "Beauty & Grooming": ["beauty", "hair", "makeup", "nails", "grooming", "salon", "barber", "facial", "massage", "lashes", "brows", "manicure", "pedicure"],
  "Health & Wellness": ["health", "wellness", "doctor", "dental", "dentist", "therapy", "medicine", "pharmacy", "clinic", "checkup", "vitamins"],
  "Tech & Phone Help": ["tech", "phone", "computer", "laptop", "wifi", "internet", "software", "screen", "iphone", "android", "tablet", "printer", "tv"],
  "Home Cleaning & Organizing": ["clean", "cleaning", "organize", "organizing", "laundry", "declutter", "storage", "closet", "move", "moving", "packing"],
  "Rides & Errands": ["ride", "rides", "drive", "driver", "errand", "errands", "pickup", "pick up", "drop off", "airport", "transport"],
  "Money & Treats": ["money", "cash", "treat", "treats", "gift", "present", "flowers", "pay", "cover the cost", "bill", "rent", "spoil"],
  "Company & Conversation": ["company", "conversation", "talk", "listen", "companion", "friend", "lonely", "chat", "hour together", "walk and talk"],
  "Creative & Photos": ["photo", "photos", "photography", "picture", "pictures", "video", "creative", "art", "design", "draw", "paint a portrait", "tinder photos"],
  "Fitness & Outdoors": ["fitness", "workout", "train", "training", "gym", "yoga", "run", "running", "hike", "hiking", "surf", "swim", "outdoors", "exercise"],
  Entertainment: ["entertainment", "concert", "show", "event", "live music", "festival", "comedy", "theatre", "theater", "performance", "rave", "karaoke", "open mic", "night out", "tickets", "dance", "dancing"],
  Movies: ["movie", "movies", "cinema", "film", "films", "movie night", "watch a movie", "movie theater", "movie theatre"],
  "Business & Consultation": ["business", "marketing", "consultation", "consulting", "consult", "strategy", "strategies", "brand", "branding", "advertising", "promotion", "promote", "sales", "business plan", "marketing plan", "marketing plans", "social media"],
  "Travel & Trips": ["travel", "trip", "trips", "vacation", "holiday", "getaway", "island hop", "island hopping", "bali", "flight", "flights", "airfare", "hotel", "hotels", "cruise", "road trip", "tour", "tours", "traveling", "travelling", "staycation", "interisland", "excursion", "itinerary"],
  Other: [],
};

type ProvideLike = { category: string; title: string };

type WantLike = { category: string; text: string };

// Whether a Provide covers a Want/Need entry. Tightened
// 2026-11-03 (Erin's Profile fix): sharing a broad category is
// NOT a cover on its own — "Health & Wellness" holds both Yoga
// and Nursing help, and "Fitness & Outdoors" holds both Yoga
// and Snorkeling, yet neither pair covers the other — and a
// category keyword found INSIDE a longer word is not a match
// either ("art" inside "partner" made Business marketing plans
// "cover" a Pool partner swim). A cover now needs a real link
// between the Provide's TITLE and the Want, per
// provideCoversText below. The Want's category no longer decides
// anything here; it stays on the entry as a label.
function provideCoversWant(provide: ProvideLike, want: WantLike): boolean {
  return provideCoversText(provide, want.text);
}

// Whole word / whole phrase check: the keyword must appear in
// the text as its own token(s), never as a substring inside a
// longer word ("art" in "partner", "car" in "scar" never count).
function keywordAsWord(textNorm: string, keyword: string): boolean {
  const k = norm(keyword);
  if (!k) return false;
  return ` ${textNorm} `.includes(` ${k} `);
}

function provideCoversText(provide: ProvideLike, needText: string): boolean {
  const need = norm(needText);
  if (!need) return false;
  const titleNorm = norm(provide.title);
  if (!titleNorm) return false;
  // 1) Direct title match: the Provide title names the Need (or
  // the Need names the whole Provide title) — "Lululemon
  // shopping" covers "Lululemon", "Surfing lesson" covers
  // "Surfing lesson — learn to surf".
  if (fuzzyMatch(needText, [provide.title])) return true;
  // 2) Whole-token overlap: a shared meaningful word, compared
  // token by token so a word inside another word never counts
  // (Need "new wipers fitted" / title "Windshield wipers — buy
  // & fit" still covers on "wipers").
  const stop = new Set(["need", "want", "with", "help", "some", "that", "this", "please", "really"]);
  const needTokens = need.split(/[^a-z0-9]+/).filter((t) => t.length >= 4 && !stop.has(t));
  const titleTokens = new Set(titleNorm.split(/[^a-z0-9]+/).filter(Boolean));
  if (needTokens.some((t) => titleTokens.has(t))) return true;
  // 3) Category bridge, narrowed: the Need must name a keyword
  // of the Provide's category AS A WHOLE WORD, and the Provide
  // TITLE must itself name a keyword of that same category as a
  // whole word — so a broad "Car repairs" title (keyword "car")
  // can cover a "Windshield wipers" Need (keyword "windshield"),
  // while a title naming no category keyword at all (Snorkeling
  // for Yoga, Nursing help for Yoga, Business marketing plans
  // for a Pool partner swim) never covers on category alone.
  const keywords = PROVIDE_CATEGORY_KEYWORDS[provide.category] ?? [];
  if (keywords.length === 0) return false;
  const needHasKeyword = keywords.some((k) => keywordAsWord(need, k));
  if (!needHasKeyword) return false;
  return keywords.some((k) => keywordAsWord(titleNorm, k));
}

// A wishlist gift's price note is free text ("about $40", "$25 at
// Target"); pull the first dollar amount out of it, if there is one.
function priceNoteToCents(priceNote: string): number | null {
  const m = priceNote.replace(/,/g, "").match(/(\d+(?:\.\d{1,2})?)/);
  if (!m || m[1] === undefined) return null;
  const n = Number.parseFloat(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

// Whether the Provide's max spend covers the Need's known price:
// true = fits, false = the price is above the max, null = either
// side has no number to compare.
function budgetFit(maxSpendCents: number | null, priceCents: number | null): boolean | null {
  if (maxSpendCents === null || priceCents === null) return null;
  return priceCents <= maxSpendCents;
}

function normalizeCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const CODE_WORDS = ["SECRET", "VELVET", "GOLDEN", "MIDNIGHT", "VAULT", "KEY", "PRESENT", "QUEST"];

function generateCode(existing: Set<string>): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    const word = CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)] ?? "SECRET";
    const num = 1000 + Math.floor(Math.random() * 9000);
    const candidate = `${word}-${num}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `SECRET-${Date.now() % 100000}`;
}

const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function base64ToBytes(b64: string): Uint8Array {
  const withFrom = Uint8Array as unknown as { fromBase64?: (s: string) => Uint8Array };
  if (typeof withFrom.fromBase64 === "function") return withFrom.fromBase64(b64);
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function extFor(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

type ListRow = typeof schema.listItems.$inferSelect;
type PersonRow = typeof schema.people.$inferSelect;
type CheckRow = typeof schema.personChecks.$inferSelect;
type ProfileRow = typeof schema.myProfile.$inferSelect;
type ProvideRow = typeof schema.provides.$inferSelect;
type SafetyCheckinRow = typeof schema.safetyCheckins.$inferSelect;

// Safety check-in lengths the user can pick, in minutes. A check-in
// is tied to a confirmed (accepted) date, runs quietly for the
// chosen length, then ends automatically — its live state is
// derived on read from ends_at, like Hype liveness, so an
// expired check-in switches itself off with no cleanup job.
const SAFETY_CHECKIN_DURATIONS = [30, 60, 120, 180, 240] as const;

function safetyDurationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  const hours = minutes / 60;
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

// Derived standing of a check-in: ended early by the user, finished
// on its own when its time ran out, or still running.
function safetyCheckinStatus(
  row: SafetyCheckinRow,
): "active" | "ended_early" | "finished" {
  if (row.endedAt) return "ended_early";
  if (row.endsAt && row.endsAt.getTime() <= Date.now()) return "finished";
  return "active";
}

function safetyCheckinLive(row: SafetyCheckinRow): boolean {
  return safetyCheckinStatus(row) === "active";
}
type GiftRow = typeof schema.listItems.$inferSelect;

// How many items on each wishlist are free to see before the paywall.
const FREE_WISHLIST_PREVIEW = 3;

// Hype — a paid, timed session on the O'ahu map: $2.99 per 30
// minutes, up to 4 hours max. It pins the actual spot/area the
// person is around during that session — never live GPS tracking.
// Prices are recorded/displayed only; no real card is charged in
// this app — the recorded payment is the step checkout will own
// at launch. Hype is killed until later (2026-11-02): no action
// currently reads these plans, but they stay — exported with the
// plan-id type — so the paid flow returns exactly as it was.
export const HYPE_PLANS = {
  h30: { label: "30 min", minutes: 30, priceCents: 299 },
  h60: { label: "1 hour", minutes: 60, priceCents: 598 },
  h90: { label: "1½ hours", minutes: 90, priceCents: 897 },
  h120: { label: "2 hours", minutes: 120, priceCents: 1196 },
  h150: { label: "2½ hours", minutes: 150, priceCents: 1495 },
  h180: { label: "3 hours", minutes: 180, priceCents: 1794 },
  h210: { label: "3½ hours", minutes: 210, priceCents: 2093 },
  h240: { label: "4 hours", minutes: 240, priceCents: 2392 },
} as const;
export type HypePlanId = keyof typeof HYPE_PLANS;


// Display times are Hawaii times (2026-11-02 fix pass). The
// server clock runs on UTC, so a plain toLocaleString() bakes
// UTC wall-clock text into stored Chat-note
// bodies — a time expiring 2026-11-03T09:56:12Z read "until
// 11/3/2026, 9:56:12 AM" when Hawaii reads Nov 2, 11:56 PM.
// Stored instants are correct and never change; only the text
// written for people is formatted, in Pacific/Honolulu, with
// the HST label attached so the zone is plain.
const HAWAII_TZ = "Pacific/Honolulu";


function hawaiiWeekdayTime(d: Date): string {
  return d.toLocaleString("en-US", {
    timeZone: HAWAII_TZ,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function hawaiiLongDateTime(d: Date): string {
  return d.toLocaleString("en-US", {
    timeZone: HAWAII_TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

// A Hype is live when switched on and its paid time has not run
// out. Derived on read — an expired listing falls off the map by
// itself. A null expiry is a legacy pre-paid listing (Hype was
// unpaid before 2026-11-02): it stays live until it is saved
// again, so no existing listing is wiped by the paid change.
function hypeLive(row: {
  hypeOn: boolean;
  hypeExpiresAt: Date | null;
}): boolean {
  return (
    row.hypeOn &&
    (row.hypeExpiresAt === null || row.hypeExpiresAt.getTime() > Date.now())
  );
}

const defaultProfile: ProfileRow = {
  id: 1,
  name: "",
  age: null,
  bio: "",
  location: "",
  availableTimes: "",
  spot: "",
  gender: "",
  sameSex: false,
  qualities: "[]",
  lookingFor: "",
  discoverable: false,
  contactPref: "matches_only",
  hypeOn: false,
  hypeSpot: "",
  hypeMode: "",
  hypeNote: "",
  hypeExpiresAt: null,
  hypePaidCents: null,
  hypePlan: "",
  popOffOn: false,
  popOffBudgetCents: null,
  popOffCategory: "",
  popOffSpot: "",
  popOffNote: "",
  popOffExpiresAt: null,
  popOffPaidCents: null,
  popOffPlan: "",
  metaApiKey: "",
  metaKeyStatus: "none",
  metaKeyStatusMessage: "",
  metaKeyCheckedAt: null,
  wishlistPriceCents: 499,
  wishlistBundlePriceCents: 1388,
  wishlistAllUnlocked: false,
  updatedAt: new Date(0),
};

async function loadProfile(ctx: Ctx): Promise<ProfileRow> {
  const db = ctx.db<typeof schema>();
  const rows = await db
    .select()
    .from(schema.myProfile)
    .where(eq(schema.myProfile.id, 1));
  return rows[0] ?? defaultProfile;
}

function canContact(
  myPref: ProfileRow["contactPref"],
  myHypeOn: boolean,
  myHypeSpot: string,
  person: {
    contactPref: PersonRow["contactPref"];
    hypeOn: boolean;
    hypeSpot: string;
    spot: string;
  },
  matchPercent: number | null,
  sameSpot: boolean,
): boolean {
  const mineOk =
    myPref === "everyone" ||
    (myPref === "matches_only" && matchPercent !== null && matchPercent >= 50) ||
    (myPref === "hype_spot" && myHypeOn && sameSpot);
  const theirsOk =
    person.contactPref === "everyone" ||
    (person.contactPref === "matches_only" &&
      matchPercent !== null &&
      matchPercent >= 50) ||
    (person.contactPref === "hype_spot" &&
      person.hypeOn &&
      myHypeOn &&
      myHypeSpot.trim() !== "" &&
      (person.hypeSpot === myHypeSpot || person.spot === myHypeSpot));
  return mineOk && theirsOk;
}

// Chat gate helper (Deal-only rule, 2026-11-04, Erin's
// direction, superseding the 2026-11-03 Match / Potential gate):
// a person belongs in Chat only once a Deal exists with them —
// the Deal button was hit on their match card (matchDecision
// "accepted") or they have an accepted date. A Match or a
// Potential with no Deal has NO chat at all: no thread, no
// "Say hello", nothing. Deal alone opens Chat — the date does
// not have to be planned or scheduled yet. Contact preferences
// are NOT part of this gate: they only narrow an already-
// eligible thread (see canContact).
function genderPassesModeServer(
  personGender: string,
  myGender: string,
  sameSex: boolean,
): boolean {
  if (!myGender) return true;
  if (!personGender) return false;
  return sameSex ? personGender === myGender : personGender !== myGender;
}

// The full Chat gate (Deal-only rule, 2026-11-04, Erin's
// direction, superseding the 2026-11-03 gate): eligibility plus
// a short plain-words reason a thread is not open. The rule,
// stated once and used everywhere: Chat exists ONLY once a
// Deal exists — the Deal button was hit on the match card
// (matchDecision "accepted"), or the person has an accepted
// date. Deal alone opens Chat, even before Plan the date is
// pushed and before any date is scheduled. A Match or a
// Potential with no Deal has no chat at all — being a Match or
// a Potential never opens Chat by itself, in any mode. A
// declined person has no chat (declining a Deal holder ends
// the Deal, so the chat closes with it; nothing is deleted —
// messages, dates and plans stay saved, and making a Deal
// again reopens the chat).
function chatGateFor(args: {
  blocked: boolean;
  matchDecision: string;
  hasAcceptedDate: boolean;
}): { eligible: boolean; hiddenReason: string } {
  if (args.blocked) return { eligible: false, hiddenReason: "" };
  if (args.matchDecision === "declined") {
    return {
      eligible: false,
      hiddenReason:
        "No chat — you declined this match. Nothing was deleted: bring them back from Matches and hit Deal, and a chat opens.",
    };
  }
  if (args.matchDecision === "accepted" || args.hasAcceptedDate) {
    return { eligible: true, hiddenReason: "" };
  }
  return {
    eligible: false,
    hiddenReason:
      "No chat yet — chats only open once you hit Deal. A Match or a Potential on its own has no chat. Nothing is deleted.",
  };
}

type MsgStats = { unread: number; lastBody: string; lastAt: string | null };

// ---------- Out of the Blue: category context (never a cover) ----------
//
// Broad-category context for the Out of the Blue surprise ONLY.
// A shared category — or a shared cluster of neighbouring
// categories — is named as context ("you both touch …"), but it
// NEVER creates a cover, NEVER changes the match % and NEVER
// makes anyone a Match or a Potential. Covers stay specific:
// Yoga is only covered by a Yoga Provide (see provideCoversText).
const OUT_OF_BLUE_CLUSTERS: { label: string; categories: string[] }[] = [
  {
    label: "wellness & outdoors",
    categories: ["Health & Wellness", "Fitness & Outdoors", "Beauty & Grooming"],
  },
  {
    label: "home & food",
    categories: ["Home & Handy", "Home Cleaning & Organizing", "Food & Cooking"],
  },
  {
    label: "going out",
    categories: ["Entertainment", "Movies", "Creative & Photos", "Company & Conversation"],
  },
  {
    label: "practical help",
    categories: ["Car & Mechanical", "Tech & Phone Help", "Rides & Errands", "Money & Treats", "Business & Consultation"],
  },
  {
    label: "travel & getaways",
    categories: ["Travel & Trips", "Rides & Errands", "Fitness & Outdoors", "Entertainment"],
  },
];

function derivedCategoriesForText(text: string): string[] {
  const t = norm(text);
  if (!t) return [];
  const found: string[] = [];
  for (const [category, keywords] of Object.entries(PROVIDE_CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => keywordAsWord(t, k))) found.push(category);
  }
  return found;
}

function categoriesOf(args: {
  stored: string;
  text: string;
}): Set<string> {
  const set = new Set<string>();
  if (args.stored.trim()) set.add(args.stored.trim());
  for (const c of derivedCategoriesForText(args.text)) set.add(c);
  return set;
}

function outOfBlueContext(
  items: ListRow[],
  personProvides: ProvideRow[],
  personGifts: GiftRow[],
): string {
  const mine = new Set<string>();
  for (const i of items) {
    if (i.kind === "dealbreaker" || i.kind === "gift") continue;
    for (const c of categoriesOf({ stored: i.category, text: i.text })) mine.add(c);
  }
  const theirs = new Set<string>();
  for (const pv of personProvides) {
    for (const c of categoriesOf({ stored: pv.category, text: pv.title })) theirs.add(c);
  }
  for (const g of personGifts) {
    if (g.giftStatus === "given") continue;
    for (const c of categoriesOf({ stored: g.category, text: g.text })) theirs.add(c);
  }
  for (const c of mine) {
    if (theirs.has(c)) return c;
  }
  for (const cluster of OUT_OF_BLUE_CLUSTERS) {
    const mineIn = cluster.categories.some((c) => mine.has(c));
    const theirsIn = cluster.categories.some((c) => theirs.has(c));
    if (mineIn && theirsIn) return cluster.label;
  }
  return "";
}

function provideToShape(p: ProvideRow): z.infer<typeof provideShape> {
  return {
    id: p.id,
    ownerType: p.ownerType,
    ownerId: p.ownerId,
    category: p.category,
    title: p.title,
    maxSpendCents: p.maxSpendCents,
    note: p.note,
    createdAt: p.createdAt.toISOString(),
  };
}

function scorePerson(
  person: PersonRow,
  items: ListRow[],
  checks: CheckRow[],
  profile: ProfileRow,
  hasAcceptedDate = false,
  photos: z.infer<typeof photoShape>[] = [],
  msgStats: MsgStats = { unread: 0, lastBody: "", lastAt: null },
  personProvides: ProvideRow[] = [],
  myProvides: ProvideRow[] = [],
  personGifts: GiftRow[] = [],
  personWants: ListRow[] = [],
): z.infer<typeof personShape> {
  const qualities = parseQualities(person.qualities);
  const checkMap = new Map<number, boolean>();
  for (const c of checks) {
    if (c.personId === person.id) checkMap.set(c.listItemId, c.present);
  }
  const present = (item: ListRow): boolean => {
    const explicit = checkMap.get(item.id);
    if (explicit !== undefined) return explicit;
    return fuzzyMatch(item.text, qualities);
  };

  let mustMet = 0;
  let mustTotal = 0;
  let niceMet = 0;
  let niceTotal = 0;
  const dealbreakersHit: string[] = [];
  for (const item of items) {
    if (item.kind === "must") {
      mustTotal += 1;
      if (present(item)) mustMet += 1;
    } else if (item.kind === "nice") {
      niceTotal += 1;
      if (present(item)) niceMet += 1;
    } else if (item.kind === "dealbreaker" && present(item)) {
      dealbreakersHit.push(item.text);
    }
    // kind "gift" entries are wishlist entries on the same List —
    // they are never scored and never dealbreakers.
  }
  const profileHypeLive = hypeLive(profile);
  const personHypeLive = hypeLive(person);
  const sameSpot =
    profileHypeLive &&
    personHypeLive &&
    profile.hypeSpot.trim() !== "" &&
    (person.hypeSpot === profile.hypeSpot || person.spot === profile.hypeSpot);

  // Two-sided Provide matching, derived on read:
  // - needCovers: this member's Provides matched against MY Need
  //   list (must + nice items; dealbreakers are never Needs to cover).
  // - coveredByMe: MY Provides matched against this member's
  //   wishlist (their gifts) — the Needs they have on record.
  const needCovers: z.infer<typeof needCoverShape>[] = [];
  const coveringProvideIds = new Set<number>();
  for (const item of items) {
    if (item.kind === "dealbreaker" || item.kind === "gift") continue;
    const cover = personProvides.find((pv) => provideCoversWant(pv, item));
    if (cover) {
      coveringProvideIds.add(cover.id);
      needCovers.push({
        listItemId: item.id,
        needText: item.text,
        provideId: cover.id,
        provideTitle: cover.title,
        category: cover.category,
        maxSpendCents: cover.maxSpendCents,
        budgetFit: null,
      });
    }
  }
  const coverBudgetCents = personProvides
    .filter((pv) => coveringProvideIds.has(pv.id))
    .reduce((sum, pv) => sum + (pv.maxSpendCents ?? 0), 0);
  // Simple List calculation (2026-11-03, Erin's confirmed model,
  // two-sided correction same day): The List is flat Wants — the
  // old must / nice kinds both count as Wants, one each, with NO
  // must-double weighting and NO trait-only percentage. Matching
  // runs BOTH ways and either direction is a match: (a) this
  // member's Provides cover MY Wants — needCovers ÷ my Wants —
  // and (b) MY Provides cover THIS member's Wants — coveredByMe
  // ÷ their Wants (their wishlist entries). The match % is the
  // HIGHER of the two directions. So Koa covering Lululemon
  // (1 of my 3 Wants) is 33%, and Erin covering Alex's surf want
  // (his 1 Want) is 100% his way. Dealbreakers never count, and
  // my Desires (gift entries on my own List) never count and
  // never change the score. Match is 50%+ in either direction;
  // Potential is under 50% both ways but at least one cover
  // either way (decided client-side from this percent +
  // coverCount / coveredByMeCount).
  const wantTotal = mustTotal + niceTotal;
  const coveredByMe: z.infer<typeof wishlistCoverShape>[] = [];
  for (const g of personGifts) {
    if (g.giftStatus === "given") continue;
    const cover = myProvides.find((pv) => provideCoversWant(pv, g));
    if (cover) {
      coveredByMe.push({
        giftId: g.id,
        giftTitle: g.text,
        provideId: cover.id,
        provideTitle: cover.title,
        category: cover.category,
        maxSpendCents: cover.maxSpendCents,
        budgetFit: budgetFit(cover.maxSpendCents, priceNoteToCents(g.priceNote)),
      });
    }
  }
  // Two-sided percentage: ONE single measure — the higher
  // direction wins. The directions are never added together, no
  // List item is ever counted twice (each Want can be covered at
  // most once per direction), and nothing is weighted. A
  // direction with no Wants on its side is not scored (null),
  // never 0%.
  const theirWantTotal = personGifts.filter(
    (g) => g.giftStatus !== "given",
  ).length;
  const percentMine =
    wantTotal === 0
      ? null
      : Math.round((needCovers.length / wantTotal) * 100);
  const percentTheirs =
    theirWantTotal === 0
      ? null
      : Math.round((coveredByMe.length / theirWantTotal) * 100);
  const matchPercent =
    percentMine === null
      ? percentTheirs
      : percentTheirs === null
        ? percentMine
        : Math.max(percentMine, percentTheirs);
  const chatGate = chatGateFor({
    blocked: person.blocked,
    matchDecision: person.matchDecision,
    hasAcceptedDate,
  });

  // Out of the Blue eligibility (see the personShape comment):
  // 0% specific only — no cover either way and no percentage —
  // mode-passing, not blocked, not declined, with at least one
  // Want on either side a surprise date could be built from.
  // This NEVER feeds back into matchPercent, needCovers or
  // coveredByMe: the 2% lives only in these two fields.
  const hasSurpriseIdeaSource =
    wantTotal > 0 ||
    personGifts.some((g) => g.giftStatus !== "given");
  const outOfBlue =
    !person.blocked &&
    person.matchDecision !== "declined" &&
    genderPassesModeServer(person.gender, profile.gender, profile.sameSex) &&
    needCovers.length === 0 &&
    coveredByMe.length === 0 &&
    (matchPercent === 0 || matchPercent === null) &&
    hasSurpriseIdeaSource;
  const outOfBlueCategory = outOfBlue
    ? outOfBlueContext(items, personProvides, personGifts)
    : "";

  return {
    id: person.id,
    source: person.source,
    name: person.name,
    age: person.age,
    bio: person.bio,
    location: person.location,
    availableTimes: person.availableTimes,
    gender: person.gender,
    sameSex: person.sameSex,
    qualities,
    spot: person.spot,
    contactPref: person.contactPref,
    hypeOn: personHypeLive,
    hypeSpot: person.hypeSpot,
    hypeMode: person.hypeMode,
    hypeNote: person.hypeNote,
    hypeExpiresAt:
      personHypeLive && person.hypeExpiresAt
        ? person.hypeExpiresAt.toISOString()
        : null,
    hypePaidCents: person.hypePaidCents,
    hypePlan: person.hypePlan,
    blocked: person.blocked,
    matchDecision: person.matchDecision,
    promoCode: person.promoCode,
    matchNote: person.matchNote,
    matchNoteSource:
      person.matchNoteSource === "meta-ai"
        ? "meta-ai"
        : person.matchNote
          ? "list"
          : "none",
    photos,
    unreadCount: msgStats.unread,
    lastMessagePreview: msgStats.lastBody,
    lastMessageAt: msgStats.lastAt,
    createdAt: person.createdAt.toISOString(),
    matchPercent,
    mustMet,
    mustTotal,
    niceMet,
    niceTotal,
    dealbreakersHit,
    sameSpot,
    // A Deal establishes contact right away, exactly like an
    // accepted date — hitting Deal on the match card opens Chat
    // at once, before any date is planned or scheduled, so the
    // Deal itself (not just the date after it) makes this person
    // contactable regardless of either contact preference.
    // NOTE: outside a Deal / accepted date, canContact stays the
    // contact-preference rule on its own — proposeDate and the
    // date planner gate on it exactly as before. Chat applies
    // the chatEligible gate ON TOP of it, so a contact
    // preference can narrow an eligible Chat thread but can
    // never create one for someone outside the gate.
    canContact:
      hasAcceptedDate ||
      person.matchDecision === "accepted" ||
      canContact(
        profile.contactPref,
        profileHypeLive,
        profile.hypeSpot,
        { ...person, hypeOn: personHypeLive },
        matchPercent,
        sameSpot,
      ),
    chatEligible: chatGate.eligible,
    chatHiddenReason: chatGate.hiddenReason,
    checks: checks
      .filter((c) => c.personId === person.id)
      .map((c) => ({ listItemId: c.listItemId, present: c.present })),
    provides: personProvides.map(provideToShape),
    wants: personWants
      .filter((i) => i.kind !== "dealbreaker")
      .map((i) => ({
        id: i.id,
        text: i.text,
        category: i.category,
        occasion: i.occasion,
        priceNote: i.priceNote,
      })),
    dealbreakers: personWants
      .filter((i) => i.kind === "dealbreaker")
      .map((i) => ({
        id: i.id,
        text: i.text,
        category: i.category,
        occasion: i.occasion,
        priceNote: i.priceNote,
      })),
    needCovers,
    coverCount: needCovers.length,
    coverBudgetCents,
    coveredByMe,
    coveredByMeCount: coveredByMe.length,
    outOfBlue,
    outOfBlueCategory,
  };
}

async function loadState(ctx: Ctx): Promise<State> {
  const db = ctx.db<typeof schema>();
  const profile = await loadProfile(ctx);
  const [allItems, personRows, checkRows, dateRows, reportRows, promoRows, photoRows, messageRows, unlockRows, hypePaymentRows, provideRows, safetyCheckinRows, modelComparisonRows] =
    await Promise.all([
      db.select().from(schema.listItems).orderBy(asc(schema.listItems.id)),
      db.select().from(schema.people).orderBy(asc(schema.people.id)),
      db.select().from(schema.personChecks),
      db.select().from(schema.dates).orderBy(asc(schema.dates.id)),
      db.select().from(schema.reports).orderBy(asc(schema.reports.id)),
      db.select().from(schema.promoCodes).orderBy(asc(schema.promoCodes.id)),
      db.select().from(schema.photos).orderBy(asc(schema.photos.sortOrder), asc(schema.photos.id)),
      db.select().from(schema.messages).orderBy(asc(schema.messages.id)),
      db.select().from(schema.wishlistUnlocks).orderBy(asc(schema.wishlistUnlocks.id)),
      db.select().from(schema.hypePayments).orderBy(asc(schema.hypePayments.id)),
      db.select().from(schema.provides).orderBy(asc(schema.provides.id)),
      db.select().from(schema.safetyCheckins).orderBy(asc(schema.safetyCheckins.id)),
      db.select().from(schema.modelComparisons).orderBy(asc(schema.modelComparisons.id)),
    ]);
  // The unified List: scored items vs wishlist (gift) entries, both
  // from the one list_items store. Scored items split by owner:
  // personId null = the USER's own Wants / dealbreakers (the only
  // rows that score against members); personId = a member = THAT
  // member's own Wants, exposed on their person shape as `wants`
  // and never part of the user's List or scoring. Gift rows are
  // Desires / Gifts — a separate store from Wants (2026-11-04).
  const items = allItems.filter(
    (i) => i.kind !== "gift" && (i.personId ?? null) === null,
  );
  const giftRows = allItems.filter((i) => i.kind === "gift");
  const wantsByPerson = new Map<number, ListRow[]>();
  for (const i of allItems) {
    if (i.kind === "gift" || i.personId === null || i.personId === undefined)
      continue;
    const arr = wantsByPerson.get(i.personId) ?? [];
    arr.push(i);
    wantsByPerson.set(i.personId, arr);
  }
  const myProvides = provideRows.filter(
    (pv) => pv.ownerType === "profile",
  );
  const providesByPerson = new Map<number, ProvideRow[]>();
  for (const pv of provideRows) {
    if (pv.ownerType !== "person") continue;
    const arr = providesByPerson.get(pv.ownerId) ?? [];
    arr.push(pv);
    providesByPerson.set(pv.ownerId, arr);
  }
  // Wishlist unlock paywall is KILLED UNTIL LATER (Erin's
  // direction, 2026-11-02 — NO payments in the app, like Hype):
  // nothing is ever locked or sealed; every wishlist entry is
  // visible. The wishlist_unlocks table, the unlock rows and the
  // price columns stay in the schema untouched so the paywall
  // can return later exactly as it was — getState simply never
  // locks an entry now, and the unlock / pricing actions below
  // refuse while it is paused.
  void unlockRows;
  const giftLocked = new Map<number, boolean>();
  for (const g of giftRows) {
    giftLocked.set(g.id, false);
  }
  const msgStatsByPerson = new Map<number, MsgStats>();
  for (const m of messageRows) {
    const cur = msgStatsByPerson.get(m.personId) ?? {
      unread: 0,
      lastBody: "",
      lastAt: null,
    };
    if (m.direction === "in" && !m.read) cur.unread += 1;
    cur.lastBody = m.body;
    cur.lastAt = m.createdAt.toISOString();
    msgStatsByPerson.set(m.personId, cur);
  }
  const photosByOwner = new Map<string, z.infer<typeof photoShape>[]>();
  for (const ph of photoRows) {
    const url = await ctx.blobs.getUrl(ph.blobKey);
    const key = `${ph.ownerType}:${ph.ownerId}`;
    const arr = photosByOwner.get(key) ?? [];
    arr.push({ id: ph.id, url, contentType: ph.contentType });
    photosByOwner.set(key, arr);
  }
  const profilePhotos = photosByOwner.get("profile:1") ?? [];
  // Generated date-plan images: resolve each date's stored blob
  // key to a URL the client can render, exactly like photos. A
  // date with no image key gets null — its plan shows on its own.
  const planImageUrls = new Map<number, string>();
  for (const d of dateRows) {
    if (d.planImageBlobKey) {
      try {
        planImageUrls.set(d.id, await ctx.blobs.getUrl(d.planImageBlobKey));
      } catch {
        // A missing blob never breaks the state — plan text only.
      }
    }
  }
  return {
    profile: {
      name: profile.name,
      age: profile.age,
      bio: profile.bio,
      location: profile.location,
      availableTimes: profile.availableTimes,
      spot: profile.spot ?? "",
      gender: profile.gender,
      sameSex: profile.sameSex,
      qualities: parseQualities(profile.qualities),
      lookingFor: profile.lookingFor,
      discoverable: profile.discoverable,
      contactPref: profile.contactPref,
      hypeOn: hypeLive(profile),
      hypeSpot: profile.hypeSpot,
      hypeMode: profile.hypeMode,
      hypeNote: profile.hypeNote,
      hypeExpiresAt:
        hypeLive(profile) && profile.hypeExpiresAt
          ? profile.hypeExpiresAt.toISOString()
          : null,
      hypePaidCents: profile.hypePaidCents,
      hypePlan: profile.hypePlan,
      metaAiConnected: profile.metaApiKey.trim() !== "",
      metaAiStatus:
        profile.metaApiKey.trim() === ""
          ? "none"
          : profile.metaKeyStatus === "accepted" ||
              profile.metaKeyStatus === "rejected"
            ? profile.metaKeyStatus
            : "saved_unverified",
      metaAiStatusMessage: profile.metaKeyStatusMessage,
      metaAiCheckedAt: profile.metaKeyCheckedAt
        ? profile.metaKeyCheckedAt.toISOString()
        : null,
      provides: myProvides.map(provideToShape),
      photos: profilePhotos,
    },
    provides: provideRows.map(provideToShape),
    listItems: items.map((i) => ({
      id: i.id,
      kind: i.kind,
      text: i.text,
      category: i.category,
      personId: i.personId,
      personName: i.personName,
      occasion: i.occasion,
      priceNote: i.priceNote,
      link: i.link,
      giftStatus: i.giftStatus,
    })),
    people: personRows.map((p) =>
      scorePerson(
        p,
        items,
        checkRows,
        profile,
        dateRows.some((d) => d.personId === p.id && d.status === "accepted"),
        photosByOwner.get(`person:${p.id}`) ?? [],
        msgStatsByPerson.get(p.id),
        providesByPerson.get(p.id) ?? [],
        myProvides,
        giftRows.filter((g) => g.personId === p.id),
        wantsByPerson.get(p.id) ?? [],
      ),
    ),
    // Derived from the unified List (kind="gift" rows) — there is no
    // separate gift store any more.
    gifts: giftRows.map((g) => ({
      id: g.id,
      title: g.text,
      category: g.category,
      personId: g.personId,
      personName: g.personName,
      occasion: g.occasion,
      priceNote: g.priceNote,
      link: g.link,
      status: g.giftStatus ?? "idea",
      locked: giftLocked.get(g.id) ?? false,
      createdAt: g.createdAt.toISOString(),
    })),
    wishlist: {
      freePreviewCount: FREE_WISHLIST_PREVIEW,
      allUnlocked: profile.wishlistAllUnlocked,
      unlocks: unlockRows.map((u) => ({
        id: u.id,
        personId: u.personId,
        personName: u.personName,
        pricePaidCents: u.pricePaidCents,
        createdAt: u.createdAt.toISOString(),
      })),
      totalLocked: giftRows.filter((g) => giftLocked.get(g.id)).length,
    },
    dates: dateRows.map((d) => ({
      id: d.id,
      personId: d.personId,
      personName: d.personName,
      direction: d.direction,
      listItemId: d.listItemId,
      ideaText: d.ideaText,
      meetAt: d.meetAt ? d.meetAt.toISOString() : null,
      spot: d.spot,
      note: d.note,
      status: d.status,
      completedAt: d.completedAt ? d.completedAt.toISOString() : null,
      plan: d.plan,
      planSource:
        d.planSource === "meta-ai" ? "meta-ai" : d.plan ? "list" : "none",
      planImageUrl: planImageUrls.get(d.id) ?? null,
      planImageSource:
        d.planImageSource === "actual"
          ? "actual"
          : d.planImageSource === "generated" || d.planImageBlobKey
            ? "generated"
            : "none",
      planPhotoKeys:
        d.planImageSource === "actual"
          ? d.planPhotoKeys.split(",").map((k) => k.trim()).filter((k) => k !== "")
          : [],
      createdAt: d.createdAt.toISOString(),
    })),
    safetyCheckins: safetyCheckinRows.map((c) => ({
      id: c.id,
      dateId: c.dateId,
      personId: c.personId,
      personName: c.personName,
      ideaText:
        dateRows.find((d) => d.id === c.dateId)?.ideaText ?? "",
      durationMinutes: c.durationMinutes,
      startedAt: c.startedAt
        ? c.startedAt.toISOString()
        : c.createdAt.toISOString(),
      endsAt: c.endsAt
        ? c.endsAt.toISOString()
        : c.createdAt.toISOString(),
      endedAt: c.endedAt ? c.endedAt.toISOString() : null,
      status: safetyCheckinStatus(c),
      createdAt: c.createdAt.toISOString(),
    })),
    messages: messageRows.map((m) => ({
      id: m.id,
      personId: m.personId,
      personName: m.personName,
      direction: m.direction,
      body: m.body,
      kind: m.kind,
      read: m.read,
      dateId: m.dateId,
      createdAt: m.createdAt.toISOString(),
    })),
    reports: reportRows.map((r) => ({
      id: r.id,
      personId: r.personId,
      personName: r.personName,
      reason: r.reason,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
    })),
    promoCodes: promoRows.map((c) => ({
      id: c.id,
      code: c.code,
      label: c.label,
      maxUses: c.maxUses,
      uses: personRows.filter((p) => p.promoCodeId === c.id).length,
      active: c.active,
      createdAt: c.createdAt.toISOString(),
    })),
    hypePayments: hypePaymentRows.map((p) => ({
      id: p.id,
      personId: p.personId,
      personName: p.personName,
      plan: p.plan,
      pricePaidCents: p.pricePaidCents,
      minutes: p.minutes,
      expiresAt: p.expiresAt ? p.expiresAt.toISOString() : null,
      createdAt: p.createdAt.toISOString(),
    })),
    modelComparisons: modelComparisonRows.map((c) => ({
      id: c.id,
      personId: c.personId,
      personName: c.personName,
      dateId: c.dateId,
      dateIdeaText: c.dateIdeaText,
      sparkModel: c.sparkModel,
      wonderModel: c.wonderModel,
      sparkMatchNote: c.sparkMatchNote,
      wonderMatchNote: c.wonderMatchNote,
      sparkMatchNoteStatus: c.sparkMatchNoteStatus,
      wonderMatchNoteStatus: c.wonderMatchNoteStatus,
      sparkDatePlan: c.sparkDatePlan,
      wonderDatePlan: c.wonderDatePlan,
      sparkDatePlanStatus: c.sparkDatePlanStatus,
      wonderDatePlanStatus: c.wonderDatePlanStatus,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
  };
}

// ---------- Meta AI: match notes & date plans ----------
//
// Two generated pieces of writing, both grounded strictly in The List:
// a match note explaining why the user and a member match, and a date
// plan built from one shared List item. When the user has saved a Meta
// AI (Meta Model API) key in the Profile tab, generation calls Meta's
// Model API directly with that key — the exact same channel, endpoint
// and model the connection test uses (unified in the 2026-11-01
// repair) — and the result is
// labeled "meta-ai". Without a key (or if a call fails), the same inputs
// are written up deterministically from the List data and labeled
// "list", so the features always work. Notes and plans are cached on
// the person / date row with a signature of their inputs: regenerating
// with unchanged inputs returns the saved text instead of spending
// another call.

const noteSource = z.enum(["meta-ai", "list"]);
const matchNoteResponse = z.object({
  note: z.string(),
  source: noteSource,
  cached: z.boolean(),
});
type MatchNoteResult = z.infer<typeof matchNoteResponse>;
const datePlanResponse = z.object({
  plan: z.string(),
  source: noteSource,
  cached: z.boolean(),
  // Generated image for this plan (Muse Image on the saved key),
  // or null when no image was made — never required for the plan.
  // Null whenever the plan's picture is an ACTUAL photo instead
  // (imageSource "actual", photoKeys below).
  imageUrl: z.string().nullable(),
  // "actual" = real photograph(s) of the plan's real location /
  // stores; "generated" = Muse Image fallback; "none" = none.
  imageSource: z.enum(["actual", "generated", "none"]),
  photoKeys: z.array(z.string()),
});
type DatePlanResult = z.infer<typeof datePlanResponse>;
const metaKeyStatus = z.enum([
  "none",
  "saved_unverified",
  "accepted",
  "rejected",
]);
type MetaKeyStatus = z.infer<typeof metaKeyStatus>;
const metaTestResponse = z.object({
  connected: z.boolean(),
  status: metaKeyStatus,
  message: z.string(),
});
type MetaTestResult = z.infer<typeof metaTestResponse>;
const saveMetaKeyResponse = z.object({
  ok: z.literal(true),
  status: metaKeyStatus,
  connected: z.boolean(),
  cleaned: z.boolean(),
  message: z.string(),
});
type SaveMetaKeyResult = z.infer<typeof saveMetaKeyResponse>;
const wonderCheckResponse = z.object({
  wonderListed: z.boolean(),
  // The model id exactly as Meta's /models list returns it, or null
  // when no Wonder model is on the list.
  wonderModel: z.string().nullable(),
  testAttempted: z.boolean(),
  testSucceeded: z.boolean(),
  message: z.string(),
  // Every model id Meta returned for this key/team, verbatim — so
  // the result can be checked without guessing a Wonder model name.
  modelIds: z.array(z.string()),
});
type WonderCheckResult = z.infer<typeof wonderCheckResponse>;
const compareMatchNoteResponse = z.object({
  personId: z.number(),
  personName: z.string(),
  sparkModel: z.string(),
  wonderModel: z.string(),
  sparkNote: z.string(),
  wonderNote: z.string(),
  sparkStatus: z.string(),
  wonderStatus: z.string(),
});
type CompareMatchNoteResult = z.infer<typeof compareMatchNoteResponse>;
const compareDatePlanResponse = z.object({
  personId: z.number(),
  personName: z.string(),
  dateId: z.number().nullable(),
  dateIdeaText: z.string(),
  sparkModel: z.string(),
  wonderModel: z.string(),
  sparkPlan: z.string(),
  wonderPlan: z.string(),
  sparkStatus: z.string(),
  wonderStatus: z.string(),
});
type CompareDatePlanResult = z.infer<typeof compareDatePlanResponse>;

// ---------- Meta AI shared channel (repair 2026-11-01) ----------
//
// ONE channel for everything: the connection test AND match-note /
// date-plan generation all call Meta's Model API chat-completions
// endpoint directly with the saved key and the same model. Before
// this repair the test used that direct call while generation went
// through ctx.inference, so the test result said nothing about the
// path that actually writes notes and plans.
//
// Endpoint fix (2026-11-01, second repair): the channel used to aim
// at the retired Llama API host (api.llama.com) with a Llama model
// id. The user's key is a Meta MODEL API key — created in the
// dev.meta.ai dashboard, in the same team that holds her $150 Meta
// Model API credits — and Meta's Model API lives at api.meta.ai and
// serves the Muse Spark models, not Llama ids. Every app call went
// to the wrong host with the wrong model, so Meta answered 401/403
// and perfectly good keys read as "rejected". The key format is the
// same on both platforms (LLM|<id>|<secret>), which is what made the
// mix-up invisible. Sources: the Meta provider reference at
// seminal.ai (base URL https://api.meta.ai/v1, Chat Completions at
// /v1/chat/completions, Muse Spark model ids) and LiteLLM's Meta
// Model API provider docs.

const META_API_URL = "https://api.meta.ai/v1/chat/completions";
const META_MODEL = "muse-spark-1.3";
// Wonder model id exactly as Meta's /models list returned it in
// the 2026-11-02 check on the saved key. Comparison runs resolve
// the id from the live /models list first (findWonderModel) and
// fall back to this constant — Spark stays the app default.
const META_WONDER_MODEL = "muse-wonder-1.0";

// Hardened key cleaning: a key copied via Notes often arrives with
// line breaks or spaces inside it, which Meta rejects. Strip ALL
// whitespace (ends and internal), a pasted "Bearer " prefix, and
// wrapping quotes. Never logs or returns the key itself.
function cleanMetaKey(raw: string): string {
  let k = raw.trim();
  if (
    (k.startsWith('"') && k.endsWith('"') && k.length > 1) ||
    (k.startsWith("'") && k.endsWith("'") && k.length > 1)
  ) {
    k = k.slice(1, -1);
  }
  k = k.replace(/\s+/g, "");
  if (/^bearer/i.test(k)) k = k.slice(6);
  return k;
}

class MetaCallError extends Error {
  status: number;
  // Meta's own error wording (never the key), kept so a rejection
  // message can say WHY Meta refused instead of guessing.
  detail: string;
  constructor(status: number, message: string, detail = "") {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

// Pull the reply text out of a content value in Meta's
// OpenAI-compatible shape: normally a plain string, but an array of
// text parts is accepted too.
function metaContentText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof (part as { text?: unknown })?.text === "string"
          ? (part as { text: string }).text
          : "",
      )
      .join("");
  }
  return "";
}

// One real call to Meta's Model API. Returns the reply text; throws
// MetaCallError with the HTTP status on a non-OK answer, or a plain
// Error when Meta cannot be reached at all.
//
// Writing-call fix (2026-11-01, third repair — the one that
// worked): the key was accepted (the /models check proves it) but
// this "second part" — the actual writing call — never verified.
// The failures peeled away in layers, each measured live:
//   1. Latency/reset layer: Meta's writing endpoint can hold a
//      request for a very long time before answering (a forged key
//      was refused in 8.5s once, 60.6s and 78.2s on other tries),
//      and sockets on the path sometimes reset mid-wait
//      (ECONNRESET). The old 60s abort killed slow-but-healthy
//      calls. Fixed with patient budgets (100s idle / 105s
//      overall), sized to fit the 120s action-invocation limit so
//      the outcome is always recorded.
//   2. Streaming layer: with stream:true, Meta's endpoint returned
//      a single chunk with an EMPTY delta and finish_reason "stop"
//      — a formally complete, totally empty reply (a stream diary
//      in the code below recorded the exact chunk shape). The call
//      is therefore non-streamed (stream:false); the SSE reader
//      stays below as the fallback if a reply ever arrives as an
//      event stream anyway, with proper blank-line event framing.
//   3. THE decisive layer — reasoning ate the token budget: Muse
//      Spark is a reasoning model and its thinking spends from
//      max_completion_tokens. Non-streamed tests at 64 and 256
//      tokens completed with finish_reason "length" and ZERO
//      visible text: the model thought until the budget ran out
//      and was cut off before writing one word. At 1024 tokens the
//      same test call completed with text and the connection
//      verified end-to-end ("accepted", sandbox-tested against the
//      saved key, 2026-11-01). Every caller must therefore pass a
//      budget with real headroom above the reasoning — notes and
//      plans use 1600 — or the writing silently produces nothing
//      and everything falls back to the List writer.
// reasoning_effort "low" is also requested; the budget headroom
// is what measurably fixed it.
async function metaChatCompletionOnce(
  key: string,
  prompt: string,
  maxTokens: number,
  timeoutMs = 105000,
  idleMs = 100000,
  model: string = META_MODEL,
): Promise<string> {
  const controller = new AbortController();
  const overallTimer = setTimeout(() => controller.abort(), timeoutMs);
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const armIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => controller.abort(), idleMs);
  };
  try {
    armIdle();
    const res = await fetch(META_API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_completion_tokens: maxTokens,
        stream: false,
        // Muse Spark is a reasoning model: left alone it can think
        // for a very long time before its first visible token,
        // which is exactly the silence the watchdogs kept starving
        // on. Match notes and date plans are short, warm writing —
        // they do not need deep reasoning — so ask for the lightest
        // reasoning the API offers and get the words flowing fast.
        reasoning_effort: "low",
      }),
    });
    if (!res.ok) {
      // Meta's own error wording distinguishes a dead key from a
      // wrong model, a team mismatch, or an exhausted balance, which
      // the bare status code cannot.
      const detail = await metaErrorDetail(res);
      throw new MetaCallError(
        res.status,
        `Meta AI answered with status ${res.status}.`,
        detail,
      );
    }
    // If Meta ignored the streaming request and answered with one
    // JSON body (or there is no readable stream), read it plainly.
    const contentType = res.headers.get("content-type") ?? "";
    if (!res.body || contentType.includes("application/json")) {
      const data: unknown = await res.json().catch(() => null);
      const choice = (
        data as {
          choices?: {
            message?: { content?: unknown; reasoning_content?: unknown };
            finish_reason?: unknown;
          }[];
        }
      )?.choices?.[0];
      const text = metaContentText(choice?.message?.content);
      if (!text.trim()) {
        const fr =
          typeof choice?.finish_reason === "string" && choice.finish_reason
            ? choice.finish_reason
            : "";
        const reasoningChars =
          typeof choice?.message?.reasoning_content === "string"
            ? choice.message.reasoning_content.length
            : 0;
        throw new MetaCallError(
          0,
          fr
            ? `Meta AI finished (finish_reason: ${fr}) without any visible text.`
            : "Meta AI answered without any text.",
          reasoningChars
            ? `The reply carried ${reasoningChars} characters of reasoning and no visible words — the token budget went to thinking.`
            : "",
        );
      }
      return text.trim();
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let sawDone = false;
    let finishReason = "";
    // Stream structure diary (field names and lengths only, never
    // reply text): if a stream completes with no visible text, the
    // empty-reply error quotes this so the REAL shape Meta sent is
    // visible instead of guessed at — e.g. text arriving under a
    // field this parser does not read yet.
    const diary = {
      chunks: 0,
      dataLines: 0,
      parseFailures: 0,
      rawJsonLines: 0,
      chunkKeys: new Set<string>(),
      choiceKeys: new Set<string>(),
      deltaKeys: new Set<string>(),
      reasoningChars: 0,
      textFieldChars: 0,
      partTypes: new Set<string>(),
    };
    const handlePayload = (payload: string) => {
      if (payload === "[DONE]") {
        sawDone = true;
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(payload);
      } catch {
        diary.parseFailures += 1;
        return;
      }
      const chunk = parsed as {
        error?: { message?: unknown };
        choices?: {
          delta?: { content?: unknown };
          message?: { content?: unknown };
          finish_reason?: unknown;
        }[];
      } & Record<string, unknown>;
      if (chunk?.error) {
        const msg =
          typeof chunk.error.message === "string"
            ? chunk.error.message.slice(0, 180)
            : "";
        controller.abort();
        throw new MetaCallError(
          0,
          "Meta AI sent an error inside its reply stream.",
          msg,
        );
      }
      const choice = chunk?.choices?.[0];
      if (typeof choice?.finish_reason === "string" && choice.finish_reason) {
        finishReason = choice.finish_reason;
      }
      diary.chunks += 1;
      for (const k of Object.keys(chunk)) diary.chunkKeys.add(k);
      if (choice && typeof choice === "object") {
        for (const k of Object.keys(choice)) diary.choiceKeys.add(k);
        const legacyText = (choice as { text?: unknown }).text;
        if (typeof legacyText === "string") {
          diary.textFieldChars += legacyText.length;
        }
      }
      const delta = choice?.delta as
        | (Record<string, unknown> & { content?: unknown })
        | undefined;
      if (delta && typeof delta === "object") {
        for (const k of Object.keys(delta)) diary.deltaKeys.add(k);
        if (typeof delta.reasoning_content === "string") {
          diary.reasoningChars += delta.reasoning_content.length;
        }
        if (Array.isArray(delta.content)) {
          for (const part of delta.content) {
            const t = (part as { type?: unknown })?.type;
            if (typeof t === "string") diary.partTypes.add(t);
          }
        }
      }
      text += metaContentText(choice?.delta?.content);
      text += metaContentText(choice?.message?.content);
      // Legacy completions shape: some endpoints put the words in
      // a plain `text` field on the choice instead of delta.content.
      text += metaContentText(
        (choice as { text?: unknown } | undefined)?.text,
      );
    };
    // Proper SSE framing: an event's data can span several "data:"
    // lines and is only complete at the blank line between events.
    // The first version of this parser treated every line as a
    // whole event, so a multi-line event shattered into unparseable
    // pieces — only a tiny final chunk (finish_reason, empty delta)
    // survived, and a healthy stream read as an empty reply. Raw
    // JSON lines (no "data:" prefix) are also accepted, in case the
    // endpoint ever answers in JSON-lines instead of SSE.
    let eventData = "";
    const dispatchEvent = () => {
      if (!eventData) return;
      const payload = eventData;
      eventData = "";
      handlePayload(payload.trim());
    };
    const handleLine = (rawLine: string) => {
      const line = rawLine.replace(/\r$/, "");
      if (line === "") {
        dispatchEvent();
        return;
      }
      if (line.startsWith("data:")) {
        diary.dataLines += 1;
        const part = line.slice(5).replace(/^ /, "");
        eventData = eventData ? `${eventData}\n${part}` : part;
        return;
      }
      if (line.startsWith("{")) {
        diary.rawJsonLines += 1;
        handlePayload(line);
      }
      // event:/id:/comment lines carry no reply text.
    };
    while (!sawDone) {
      const { done, value } = await reader.read();
      if (done) break;
      // Any bytes at all — even reasoning-only output — prove the
      // call is alive, so the idle watchdog restarts.
      armIdle();
      buffer += decoder.decode(value, { stream: true });
      let nl = buffer.indexOf("\n");
      while (nl >= 0) {
        handleLine(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
        nl = buffer.indexOf("\n");
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) handleLine(buffer);
    dispatchEvent();
    if (!text.trim()) {
      // Name the exact failure: a stream that completed with no
      // visible text is a different problem from a dead connection.
      // finish_reason "length" means the token budget ran out
      // (reasoning spent it before any words appeared); anything
      // else is quoted as Meta reported it.
      throw new MetaCallError(
        0,
        finishReason
          ? `Meta AI finished (finish_reason: ${finishReason}) without any visible text.`
          : "Meta AI answered without any text.",
        `Stream diary: ${diary.chunks} chunks parsed from ${diary.dataLines} data lines (${diary.parseFailures} unparseable, ${diary.rawJsonLines} raw JSON lines); done marker: ${sawDone ? "seen" : "missing"}; chunk fields: ${[...diary.chunkKeys].join(", ") || "none"}; choice fields: ${[...diary.choiceKeys].join(", ") || "none"}; delta fields: ${[...diary.deltaKeys].join(", ") || "none"}; reasoning characters: ${diary.reasoningChars}; legacy text characters: ${diary.textFieldChars}; content part types: ${[...diary.partTypes].join(", ") || "none"}.`,
      );
    }
    return text.trim();
  } finally {
    clearTimeout(overallTimer);
    if (idleTimer) clearTimeout(idleTimer);
  }
}

// The writing call, with retries on connection-level failure.
// Once the streaming call was in place, the live failure finally
// named itself: "TypeError: ECONNRESET — the socket connection was
// closed unexpectedly". The path between this server and Meta
// drops sockets under the writing call (a pooled keep-alive socket
// the middlebox already closed is the classic cause), while the
// quick /models check sails through — which is exactly the shape
// of every failure so far: key accepted, writing call dead. A
// fresh attempt opens a fresh socket, so a reset that kills one
// attempt rarely kills the next. Only connection-level failures
// (plain Errors) are retried; a real answer from Meta — success or
// a MetaCallError refusal — is final.
//
// Budgets are sized against two hard facts found the same day.
// One: an action invocation is killed at 120 seconds, so a call
// that outlives that records NOTHING — worse than failing fast.
// Two: measured from here, Meta's writing endpoint sends NOTHING
// for a long time before the first byte — two test attempts with
// a 30s idle watchdog both starved without a single chunk, and an
// earlier 60s total timeout never once sufficed either. Short
// retries are therefore useless: each attempt must be PATIENT.
// One attempt, 100s idle / 105s overall, plus the few seconds the
// /models check and the status write take, fits inside the cap
// with the List fallback still reachable for generation.
async function metaChatCompletion(
  key: string,
  prompt: string,
  maxTokens: number,
  opts: {
    timeoutMs?: number;
    idleMs?: number;
    attempts?: number;
    // Defaults to Spark (META_MODEL). Only the Wonder availability
    // check passes a different model, and only the exact id Meta's
    // /models list returned — generation never passes this, so
    // match notes and date plans stay on Spark.
    model?: string;
  } = {},
): Promise<string> {
  const attempts = opts.attempts ?? 1;
  const timeoutMs = opts.timeoutMs ?? 105000;
  const idleMs = opts.idleMs ?? 100000;
  const model = opts.model ?? META_MODEL;
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await metaChatCompletionOnce(
        key,
        prompt,
        maxTokens,
        timeoutMs,
        idleMs,
        model,
      );
    } catch (e) {
      if (e instanceof MetaCallError) throw e;
      lastError = e;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Meta AI could not be reached.");
}

// Read Meta's error wording out of a non-OK response body (never
// the key), so status messages can quote why Meta refused.
async function metaErrorDetail(res: Response): Promise<string> {
  try {
    const bodyText = await res.text();
    try {
      const parsed: unknown = JSON.parse(bodyText);
      const err = (
        parsed as {
          error?: { message?: unknown };
          message?: unknown;
          detail?: unknown;
        }
      )?.error;
      const raw =
        typeof err?.message === "string"
          ? err.message
          : typeof (parsed as { message?: unknown })?.message === "string"
            ? (parsed as { message: string }).message
            : typeof (parsed as { detail?: unknown })?.detail === "string"
              ? (parsed as { detail: string }).detail
              : "";
      return raw.trim().slice(0, 180);
    } catch {
      return bodyText.trim().slice(0, 180);
    }
  } catch {
    return "";
  }
}

type MetaModelsCheck =
  | { kind: "ok"; modelIds: string[] }
  | { kind: "http"; status: number; detail: string }
  | { kind: "unreachable" };

// Fast key check on Meta's model-list endpoint. Measured against
// the live API: a bad key gets an instant, clean 401 here, while
// the same bad key on chat completions can take 10–60+ seconds to
// be refused — long enough to look like a hang. A 200 here proves
// Meta accepts the key, and the list proves the writing model is
// offered to the key's team.
async function metaModelsCheck(key: string): Promise<MetaModelsCheck> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  let res: Response;
  try {
    res = await fetch("https://api.meta.ai/v1/models", {
      method: "GET",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}` },
    });
  } catch {
    return { kind: "unreachable" };
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    return {
      kind: "http",
      status: res.status,
      detail: await metaErrorDetail(res),
    };
  }
  try {
    const data: unknown = await res.json();
    const rows = (data as { data?: { id?: unknown }[] })?.data;
    const modelIds = Array.isArray(rows)
      ? rows
          .map((r) => (typeof r?.id === "string" ? r.id : ""))
          .filter((s) => s !== "")
      : [];
    return { kind: "ok", modelIds };
  } catch {
    return { kind: "ok", modelIds: [] };
  }
}

// ---------- Muse Image for date plans (2026-11-02) ----------
//
// When Meta AI writes a date plan, the app also tries to make one
// island-style picture for that plan with Muse Image
// (muse-image-1.0) on the SAME saved key, server-side only — the
// key never leaves the server. The picture is a visual extra,
// never a gate: any failure (model not on the key's list, a
// refused or slow call, an unreadable reply) returns null and the
// plan text is saved and shown exactly as before. A short timeout
// (35s) keeps the image attempt well inside the action limit on
// top of the writing call. Only the plan's main spot / List item
// is pictured — no people, no faces, no text in the image.
const META_IMAGE_MODEL = "muse-image-1.0";
const META_IMAGE_URL = "https://api.meta.ai/v1/images/generations";

function findImageModel(modelIds: string[]): string | null {
  return (
    modelIds.find((id) => id.toLowerCase() === META_IMAGE_MODEL) ??
    modelIds.find((id) => id.toLowerCase().includes("image")) ??
    null
  );
}

async function tryGenerateDatePlanImage(
  ctx: Ctx,
  key: string,
  args: {
    keyword: string;
    ideaText: string;
    dateId: number;
    // The Lululemon + Sephora shopping date (Erin, 2026-11-03):
    // its picture is of Lululemon and Sephora shopping — the two
    // storefronts and their shopping bags — not a beach scene.
    luluSephora?: boolean;
  },
): Promise<string | null> {
  try {
    // If Meta's model list can be read and it names no image
    // model, Muse Image is not available on this key — skip the
    // call entirely instead of spending a doomed request.
    let model = META_IMAGE_MODEL;
    const models = await metaModelsCheck(key);
    if (models.kind === "ok" && models.modelIds.length > 0) {
      const found = findImageModel(models.modelIds);
      if (!found) return null;
      model = found;
    }
    const keyword =
      args.keyword.trim() || args.ideaText.trim() || "a North Shore O'ahu beach";
    const prompt = args.luluSephora
      ? "Stylized island postcard illustration of a Lululemon and Sephora shopping date on Kalakaua Avenue in Waikiki, Honolulu, O'ahu, Hawai'i: the Lululemon and Sephora storefronts side by side on Waikiki's Kalakaua Avenue, the store signs reading \"lululemon\" and \"SEPHORA\", Sephora's red-and-white striped shopping bags and Lululemon shopping bags in the foreground, palm trees, warm golden light, bright sky blue sky, one red hibiscus flower in a corner. Elegant, calm, painterly — not a photograph of people, no people, no faces, no other text, no watermark."
      : `Stylized island postcard illustration of ${keyword} on O'ahu, Hawai'i, for a date built around "${args.ideaText}". ` +
        "Deep ocean blue sea and sky, bright sky blue, palm green palms, warm golden sand and golden light, one red hibiscus flower in a corner. Elegant, calm, painterly — not a photograph of people, no people, no faces, no text, no words, no letters, no logo, no watermark.";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35000);
    let res: Response;
    try {
      res = await fetch(META_IMAGE_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ model, prompt, n: 1, size: "1024x1024" }),
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return null;
    const data: unknown = await res.json().catch(() => null);
    const first = (
      data as {
        data?: { b64_json?: unknown; url?: unknown }[];
        images?: { b64_json?: unknown; url?: unknown }[];
      }
    )?.data?.[0] ??
      (data as { images?: { b64_json?: unknown; url?: unknown }[] })
        ?.images?.[0];
    let bytes: Uint8Array | null = null;
    let contentType = "image/png";
    if (typeof first?.b64_json === "string" && first.b64_json) {
      bytes = base64ToBytes(first.b64_json.replace(/^data:[^,]*,/, ""));
    } else if (typeof first?.url === "string" && first.url) {
      // Meta returned a hosted URL — copy the bytes into the
      // app's own blob store so the picture is owned, not a
      // remote link that can expire.
      const imgRes = await fetch(first.url).catch(() => null);
      if (!imgRes || !imgRes.ok) return null;
      contentType = imgRes.headers.get("content-type") ?? "image/png";
      if (!contentType.startsWith("image/")) return null;
      bytes = new Uint8Array(await imgRes.arrayBuffer());
    }
    if (!bytes || bytes.length === 0 || bytes.length > 8000000) return null;
    const blobKey = `date-plans/${args.dateId}/${Date.now()}.png`;
    await ctx.blobs.put(blobKey, bytes, { contentType });
    return blobKey;
  } catch {
    return null;
  }
}

// The connection test, shared by testMetaConnection and the
// auto-test that runs on every save. Two steps on the same Meta
// Model API account as generation: the fast model-list check proves
// the key, then one real chat completion — the exact call, endpoint,
// model and key handling generation uses — proves the writing path.
async function runMetaTest(key: string): Promise<MetaTestResult> {
  if (!key) {
    return {
      connected: false,
      status: "none",
      message:
        "No Meta AI key saved yet — paste the full key and the writing turns on.",
    };
  }
  const models = await metaModelsCheck(key);
  if (models.kind === "http" && (models.status === 401 || models.status === 403)) {
    return {
      connected: false,
      status: "rejected",
      message:
        "Meta AI didn't accept that key — it may be the key's name instead of the full code (the full code starts with LLM|), a copy broken by Notes, or a key from a different team than your credits. Paste the full code with Meta's Copy button and save again. Until then, notes and plans keep coming straight from your List." +
        (models.detail ? ` Meta's answer: ${models.detail}` : ""),
    };
  }
  if (models.kind === "http") {
    return {
      connected: false,
      status: "saved_unverified",
      message:
        `Meta AI answered with status ${models.status}. Your key is saved but not verified yet — try Test connection again in a little while.` +
        (models.detail ? ` Meta's answer: ${models.detail}` : ""),
    };
  }
  if (models.kind === "unreachable") {
    return {
      connected: false,
      status: "saved_unverified",
      message:
        "Couldn't reach Meta AI from here to verify the key. It's saved but not verified yet — try Test connection again in a little while.",
    };
  }
  if (models.modelIds.length > 0 && !models.modelIds.includes(META_MODEL)) {
    return {
      connected: false,
      status: "saved_unverified",
      message: `Meta accepted your key, but the writing model (${META_MODEL}) is not on your team's model list, so notes and plans keep coming straight from your List for now.`,
    };
  }
  try {
    // 1024 tokens, not a handful: Muse Spark is a reasoning model
    // and its reasoning spends from the same token budget. Live
    // tests proved it: at 64 and at 256 tokens the call completed
    // with finish_reason "length" and NO visible text — the model
    // spent the whole budget thinking and was cut off before it
    // wrote a single word. 1024 leaves room for the reasoning AND
    // the reply. One patient attempt on the default budgets (100s
    // idle / 105s overall): Meta's writing endpoint stays silent
    // for a long stretch before its first byte, so the test has to
    // out-wait that silence without crossing the 120s action limit.
    await metaChatCompletion(key, "Say hello in three words.", 1024);
    return {
      connected: true,
      status: "accepted",
      message:
        "Connected — Meta AI accepted your key. Match notes and date plans will be written by Meta AI.",
    };
  } catch (e) {
    if (e instanceof MetaCallError && (e.status === 401 || e.status === 403)) {
      return {
        connected: false,
        status: "rejected",
        message:
          "Meta AI didn't accept that key — it may be the key's name instead of the full code (the full code starts with LLM|), a copy broken by Notes, or a key from a different team than your credits. Paste the full code with Meta's Copy button and save again. Until then, notes and plans keep coming straight from your List." +
          (e.detail ? ` Meta's answer: ${e.detail}` : ""),
      };
    }
    if (e instanceof MetaCallError) {
      // Status 0 is this app's own code for "Meta answered, but not
      // with an HTTP refusal" — an error inside the reply stream or
      // a reply with no visible text. There is no HTTP status to
      // quote, so quote the exact failure the call recorded (it
      // names the finish_reason when Meta gave one) instead of a
      // meaningless "status 0".
      if (e.status === 0) {
        return {
          connected: false,
          status: "saved_unverified",
          message:
            `Meta accepted your key and answered the test writing call, but ${e.message.charAt(0).toLowerCase()}${e.message.slice(1)} Your key is saved but not verified yet — try Test connection again in a little while.` +
            (e.detail ? ` Meta's answer: ${e.detail}` : ""),
        };
      }
      return {
        connected: false,
        status: "saved_unverified",
        message:
          `Meta AI answered with status ${e.status}. Your key is saved but not verified yet — try Test connection again in a little while.` +
          (e.detail ? ` Meta's answer: ${e.detail}` : ""),
      };
    }
    // A non-MetaCallError here means the call died before Meta
    // answered (an abort from the watchdogs, or a network failure).
    // Name the actual failure in the message: "didn't finish" alone
    // hid for weeks WHICH of those it was, and the fix differs —
    // a timeout points at Meta's slow writing endpoint, a network
    // error points at the connection between here and Meta.
    const failure =
      e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    return {
      connected: false,
      status: "saved_unverified",
      message:
        "Meta accepted your key, but the test writing call didn't finish — Meta's writing endpoint can be slow to answer. The key is saved; try Test connection again in a little while, and the first note or plan that goes through will confirm it here." +
        ` (What stopped it: ${failure.slice(0, 120)})`,
    };
  }
}

// ---------- Wonder availability check (2026-11-02) ----------
//
// A check only — it never switches anything. It reads the saved
// key server-side (the key never leaves the server and is never
// returned), asks Meta's /models list whether a Wonder model is
// offered to this key/team, and — only if one is listed — makes
// ONE test call with the exact model id Meta returned, the same
// way Spark is tested in runMetaTest (same endpoint, same prompt,
// same 1024-token reasoning headroom). Match notes and date plans
// keep using Spark (META_MODEL) regardless of the result, and
// this check writes NOTHING: it does not touch the profile row,
// the saved key, or the Spark connection status.
function findWonderModel(modelIds: string[]): string | null {
  return (
    modelIds.find((id) => id.toLowerCase().includes("wonder")) ?? null
  );
}

async function runWonderCheck(key: string): Promise<WonderCheckResult> {
  if (!key) {
    return {
      wonderListed: false,
      wonderModel: null,
      testAttempted: false,
      testSucceeded: false,
      message:
        "No Meta AI key saved yet — save the key first, then check Wonder.",
      modelIds: [],
    };
  }
  const models = await metaModelsCheck(key);
  if (models.kind === "http") {
    return {
      wonderListed: false,
      wonderModel: null,
      testAttempted: false,
      testSucceeded: false,
      message:
        `Couldn't check the model list — Meta AI answered with status ${models.status}.` +
        (models.detail ? ` Meta's answer: ${models.detail}` : ""),
      modelIds: [],
    };
  }
  if (models.kind === "unreachable") {
    return {
      wonderListed: false,
      wonderModel: null,
      testAttempted: false,
      testSucceeded: false,
      message:
        "Couldn't reach Meta AI from here to check the model list — try again in a little while.",
      modelIds: [],
    };
  }
  const wonderModel = findWonderModel(models.modelIds);
  if (!wonderModel) {
    return {
      wonderListed: false,
      wonderModel: null,
      testAttempted: false,
      testSucceeded: false,
      message:
        models.modelIds.length > 0
          ? `Meta accepted your key, but no Wonder model is on your team's model list. Models on the list: ${models.modelIds.join(", ")}. Notes and plans stay on Spark (${META_MODEL}).`
          : "Meta accepted your key, but the model list came back empty, so no Wonder model could be confirmed. Notes and plans stay on Spark.",
      modelIds: models.modelIds,
    };
  }
  try {
    // Same test as Spark: same prompt, same 1024-token budget (a
    // reasoning model spends from the same budget — see the
    // writing-call repair note above), one patient attempt.
    await metaChatCompletion(key, "Say hello in three words.", 1024, {
      model: wonderModel,
    });
    return {
      wonderListed: true,
      wonderModel,
      testAttempted: true,
      testSucceeded: true,
      message: `Wonder is available on your saved key: Meta lists it as "${wonderModel}", and one test call with that model succeeded on the same key and credits. Nothing has been switched — notes and plans still use Spark (${META_MODEL}).`,
      modelIds: models.modelIds,
    };
  } catch (e) {
    if (e instanceof MetaCallError) {
      return {
        wonderListed: true,
        wonderModel,
        testAttempted: true,
        testSucceeded: false,
        message:
          (e.status > 0
            ? `Wonder is listed as "${wonderModel}", but the test call was answered with status ${e.status}.`
            : `Wonder is listed as "${wonderModel}", but the test call did not produce a reply: ${e.message}`) +
          (e.detail ? ` Meta's answer: ${e.detail}` : "") +
          ` Nothing has been switched — notes and plans still use Spark (${META_MODEL}).`,
        modelIds: models.modelIds,
      };
    }
    const failure = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    return {
      wonderListed: true,
      wonderModel,
      testAttempted: true,
      testSucceeded: false,
      message:
        `Wonder is listed as "${wonderModel}", but the test call didn't finish. (What stopped it: ${failure.slice(0, 120)}) Nothing has been switched — notes and plans still use Spark (${META_MODEL}).`,
      modelIds: models.modelIds,
    };
  }
}

// Persist the outcome of a Meta call on the profile row so the
// three-state signal survives reloads and reflects generation too.
async function recordMetaStatus(
  ctx: Ctx,
  status: MetaKeyStatus,
  message: string,
): Promise<void> {
  const db = ctx.db<typeof schema>();
  const existing = await loadProfile(ctx);
  const values = {
    ...existing,
    qualities:
      typeof existing.qualities === "string"
        ? existing.qualities
        : JSON.stringify(existing.qualities),
    metaKeyStatus: status,
    metaKeyStatusMessage: message,
    metaKeyCheckedAt: new Date(),
    updatedAt: new Date(),
  };
  await db
    .insert(schema.myProfile)
    .values(values)
    .onConflictDoUpdate({ target: schema.myProfile.id, set: values });
}

function hashSig(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

// For every List item, whether this person fulfills it — explicit
// per-person checks override the quality-tag fuzzy match, exactly as in
// scorePerson.
function presentMap(
  person: PersonRow,
  items: ListRow[],
  checks: CheckRow[],
): Map<number, boolean> {
  const qualities = parseQualities(person.qualities);
  const checkMap = new Map<number, boolean>();
  for (const c of checks) {
    if (c.personId === person.id) checkMap.set(c.listItemId, c.present);
  }
  const map = new Map<number, boolean>();
  for (const item of items) {
    map.set(item.id, checkMap.get(item.id) ?? fuzzyMatch(item.text, qualities));
  }
  return map;
}

// ---------- Stale-note + expired-Hype purge (2026-11-02, Erin) ----------
//
// Erin directed: remove ALL stale notes. A stored match note, date
// plan, or Spark vs Wonder comparison is stale when what it says no
// longer matches that person's CURRENT live state — the live match
// score, Erin's current List (must-haves Love, Lululemon, Weed;
// nice-to-haves Car leasing, Bridge $3000, Travel; dealbreakers
// Cats, Homeless, Jobless — whatever the List holds at purge time),
// and the current Provide cover on both sides — or when it was
// generated before the current List or before a Provide that now
// covers a Need was added (e.g. a note written before a member's
// Lululemon Provide existed). Stale rows are DELETED, never
// regenerated here: fresh notes are written only on demand when
// Erin taps Generate / Re-run, so a purge spends no Meta AI
// credits. Anything whose signature and text still exactly match
// live state is kept untouched, as are all members, the profile,
// the List, Provides, Desires, dates, messages, photos and the
// saved Meta AI key (never read for writing, never changed).
//
// The same sweep kills Hype until later (Erin's direction,
// superseding the earlier expired-only Hype purge): ALL Hype
// payment rows are deleted (the expired ones, including her
// $5.98 payment, first among them) and every Hype listing on the
// profile and on members is cleared, live or expired — Hype is
// not visible or usable while it is off. The schema columns and
// the hype_payments table stay so Hype can return later. (The old
// notifications table was dropped with Pop Off in migration 0024,
// so there are no Hype notifications left to purge.)
//
// The purge runs on every getState (writing only when it finds a
// stale row) and as the purgeStaleNotes action, so stale writing
// can never resurface after the List or a Provide changes.

type DateRow = typeof schema.dates.$inferSelect;

const purgeStaleResponse = z.object({
  ok: z.literal(true),
  matchNotesRemoved: z.number(),
  datePlansRemoved: z.number(),
  dateImagesRepaired: z.number(),
  comparisonsRemoved: z.number(),
  hypePaymentsRemoved: z.number(),
  hypeListingsCleared: z.number(),
});
type PurgeStaleResult = z.infer<typeof purgeStaleResponse>;

const bugCheckFixResponse = z.object({
  ok: z.literal(true),
  datesRemapped: z.number(),
  datesStructured: z.number(),
  leilaniFilled: z.boolean(),
  planSigsRefreshed: z.number(),
  notes: z.array(
    z.object({
      name: z.string(),
      source: z.enum(["meta-ai", "list"]),
      cached: z.boolean(),
    }),
  ),
});
type BugCheckFixResult = z.infer<typeof bugCheckFixResponse>;
type PurgeCounts = Omit<PurgeStaleResult, "ok">;

// Rebuild the exact MatchFacts + signature generateMatchNote stores
// with a note, from live state. The object key order below is part
// of the signature — it matches generateMatchNote byte for byte, so
// a note whose stored sig equals this sig was written from exactly
// these facts.
function buildMatchFactsAndSig(
  profile: ProfileRow,
  person: PersonRow,
  items: ListRow[],
  checks: CheckRow[],
  provideRows: ProvideRow[],
  giftRows: ListRow[],
): {
  facts: MatchFacts;
  scored: ReturnType<typeof scorePerson>;
  sig: string;
} {
  const scored = scorePerson(
    person,
    items,
    checks,
    profile,
    false,
    [],
    { unread: 0, lastBody: "", lastAt: null },
    provideRows.filter(
      (pv) => pv.ownerType === "person" && pv.ownerId === person.id,
    ),
    provideRows.filter((pv) => pv.ownerType === "profile"),
    giftRows.filter((g) => g.personId === person.id),
  );
  const fmtCover = (title: string, maxSpendCents: number | null) =>
    maxSpendCents !== null && maxSpendCents > 0
      ? `${title} (up to $${(maxSpendCents / 100).toFixed(0)})`
      : title;
  const facts: MatchFacts = {
    myName: profile.name.trim(),
    personName: person.name,
    myGender: profile.gender,
    personGender: person.gender,
    myLocation: profile.location,
    personLocation: person.location,
    myAvailableTimes: profile.availableTimes,
    personAvailableTimes: person.availableTimes,
    // A specific nightclub venue never shows upfront (Matches /
    // match notes): it reads as the generic nightclub option.
    personSpot: publicSpotLabel(person.spot),
    matchPercent: scored.matchPercent,
    coveredWants: scored.needCovers.map((c) => c.needText),
    uncoveredWants: items
      .filter(
        (i) =>
          (i.kind === "must" || i.kind === "nice") &&
          !scored.needCovers.some((c) => c.listItemId === i.id),
      )
      .map((i) => i.text),
    dealbreakersHit: scored.dealbreakersHit,
    sameSpot: scored.sameSpot,
    coversMyNeeds: scored.needCovers.map(
      (c) => `${c.needText} — via ${fmtCover(c.provideTitle, c.maxSpendCents)}`,
    ),
    iCoverTheirs: scored.coveredByMe.map(
      (c) => `${c.giftTitle} — via ${fmtCover(c.provideTitle, c.maxSpendCents)}`,
    ),
  };
  const sig = hashSig(
    JSON.stringify({
      facts,
      qualities: scored.qualities,
      checks: scored.checks,
    }),
  );
  return { facts, scored, sig };
}

// The one match-note writing path: generateMatchNote and the
// bug-check regeneration (applyBugCheckFixes) both write
// through here, so a note is produced exactly the same way
// wherever it is (re)generated — Meta AI on the saved key when
// it answers, the List-based writer otherwise, cached when the
// stored note already carries the current signature.
async function writeMatchNoteFromFacts(
  ctx: Ctx,
  profile: ProfileRow,
  person: PersonRow,
  facts: MatchFacts,
  sig: string,
  qualities: string[],
): Promise<MatchNoteResult> {
  const db = ctx.db<typeof schema>();
  if (person.matchNote && person.matchNoteSig === sig) {
    return {
      note: person.matchNote,
      source: person.matchNoteSource === "meta-ai" ? "meta-ai" : "list",
      cached: true,
    };
  }
  let note = "";
  let source: "meta-ai" | "list" = "list";
  const metaKey = cleanMetaKey(profile.metaApiKey);
  if (metaKey) {
    try {
      // The exact prompt the Spark vs Wonder comparison uses
      // (buildMatchNotePrompt) — one prompt, concierge tuning
      // included, so the only variable anywhere is the model.
      const text = await metaChatCompletion(
        metaKey,
        buildMatchNotePrompt(facts, qualities),
        // 1600, not a few hundred: the model's reasoning spends
        // from this same budget, and at 256 tokens a live call
        // finished with "length" and no visible text at all.
        // Headroom is what lets the words appear (see the
        // writing-call repair note on metaChatCompletionOnce).
        1600,
      );
      // Generated writing is stored user-facing text too: if
      // a model reply ever contained disallowed wording, drop
      // it and let the List-based writer below write the note.
      if (text && !containsBannedWording(text)) {
        note = text.slice(0, 1500);
        source = "meta-ai";
        await recordMetaStatus(
          ctx,
          "accepted",
          "Connected — Meta AI accepted your key. Match notes and date plans will be written by Meta AI.",
        );
      }
    } catch (e) {
      if (
        e instanceof MetaCallError &&
        (e.status === 401 || e.status === 403)
      ) {
        await recordMetaStatus(
          ctx,
          "rejected",
          "Meta AI didn't accept that key — check it and save it again. Until then, notes and plans keep coming straight from your List.",
        );
      }
      // Fall through to the List-based note below.
    }
  }
  if (!note) note = fallbackMatchNote(facts);
  await db
    .update(schema.people)
    .set({ matchNote: note, matchNoteSource: source, matchNoteSig: sig })
    .where(eq(schema.people.id, person.id));
  ctx.invalidateQueries();
  return { note, source, cached: false };
}

// ---------- Date-plan profile facts (2026-11-03) ----------
//
// Erin's direction: pushing Plan the Date makes its Meta AI call
// from the FULL profiles of both people — not the List item
// alone, and not the bio alone. The plan prompt, the plan
// signature and the generated picture are all built from: both
// bios, both Want lists, and both Provide lists WITH their caps
// and notes. A Provide's note is part of that Provide: Alex's
// Lululemon shopping Provide (up to $200) carries the note that
// the Lululemon shopping date with him includes a Sephora bonus
// up to $100 — so that date's plan covers Lululemon shopping up
// to $200 AND the Sephora bonus up to $100 on the same date, and
// its picture is of Lululemon and Sephora shopping. Sephora
// stays part of that one Provide — never a separate Provide,
// never a 4th.

function formatProvideForPlan(pv: ProvideRow): string {
  const cap =
    pv.maxSpendCents !== null && pv.maxSpendCents > 0
      ? ` — up to $${(pv.maxSpendCents / 100).toFixed(0)}`
      : "";
  const cat = pv.category.trim() ? ` (${pv.category.trim()})` : "";
  const note = pv.note.trim() ? ` — note: ${pv.note.trim()}` : "";
  return `${pv.title}${cat}${cap}${note}`;
}

// The Provide covering a date's List item, whichever side holds
// it, and the cover line the plan is written from. The cover
// line carries the Provide's NOTE as well as its cap, so a bonus
// noted on the Provide (the Sephora $100 bonus on Alex's
// Lululemon Provide) reaches the plan writer.
function datePlanCover(
  profile: ProfileRow,
  personId: number,
  personName: string,
  ideaText: string,
  provideRows: ProvideRow[],
): { coverLine: string; provide: ProvideRow | null; providerName: string } {
  const theirs = provideRows.find(
    (pv) =>
      pv.ownerType === "person" &&
      pv.ownerId === personId &&
      provideCoversText(pv, ideaText),
  );
  if (theirs) {
    return {
      coverLine: `${personName} can provide this themselves — ${formatProvideForPlan(theirs)}. Build the plan around them providing it.`,
      provide: theirs,
      providerName: personName,
    };
  }
  const mine = provideRows.find(
    (pv) => pv.ownerType === "profile" && provideCoversText(pv, ideaText),
  );
  if (mine) {
    const myName = profile.name.trim() || "The member";
    return {
      coverLine: `${myName} can provide this — ${formatProvideForPlan(mine)}. Build the plan around them providing it.`,
      provide: mine,
      providerName: myName,
    };
  }
  return {
    coverLine: "Neither side has a Provide entry covering this item yet.",
    provide: null,
    providerName: "",
  };
}

// Alex's Lululemon shopping date — meetup options (Erin,
// 2026-11-03): Alex can pick Erin up in his Tesla, OR they meet
// at Waikiki to shop the avenue. Both options belong in that
// date's plan, whoever writes it.
const ALEX_LULULEMON_MEETUP_LINE =
  "Meetup options for this date: Alex can pick you up in his Tesla, or you can meet at Waikiki to shop the avenue — both options are in the plan.";

function datePlanMeetupLine(
  personName: string,
  ideaText: string,
  cover: { provide: ProvideRow | null },
): string {
  const hay = `${ideaText} ${cover.provide?.title ?? ""} ${cover.provide?.note ?? ""}`;
  if (/alex/i.test(personName) && /lululemon/i.test(hay)) {
    return ALEX_LULULEMON_MEETUP_LINE;
  }
  return "";
}

// Is this the Lululemon + Sephora shopping date? True when the
// date's item / covering Provide names Lululemon AND its note
// names the Sephora bonus — that date's generated picture is of
// Lululemon and Sephora shopping.
function isLuluSephoraDate(
  ideaText: string,
  cover: { provide: ProvideRow | null },
): boolean {
  const hay = `${ideaText} ${cover.provide?.title ?? ""} ${cover.provide?.note ?? ""}`;
  return /lululemon/i.test(hay) && /sephora/i.test(hay);
}

// One plain line naming the cover on a date, caps and note
// included — used by the List-based fallback plan so the cover
// (and a bonus in its note, e.g. Sephora $100 on the Lululemon
// date) is in the plan even when Meta AI did not write it.
function datePlanCoverDetailLine(cover: {
  provide: ProvideRow | null;
  providerName: string;
}): string {
  if (!cover.provide) return "";
  const pv = cover.provide;
  const cap =
    pv.maxSpendCents !== null && pv.maxSpendCents > 0
      ? ` up to $${(pv.maxSpendCents / 100).toFixed(0)}`
      : "";
  return `Cover on this date: ${cover.providerName} provides ${pv.title}${cap}.${pv.note.trim() ? ` ${pv.note.trim()}` : ""}`;
}

// Both people's full List facts for a date plan: Erin's Wants
// (her scored List), the member's Wants (their wishlist entries
// on The List), and both Provide lists with caps and notes.
function datePlanProfileFacts(
  profile: ProfileRow,
  person: PersonRow | undefined,
  allItems: ListRow[],
  provideRows: ProvideRow[],
): {
  myWants: string[];
  personWants: string[];
  myProvides: string[];
  personProvides: string[];
} {
  void profile;
  const fmtWant = (i: ListRow): string =>
    i.category.trim() ? `${i.text} (${i.category.trim()})` : i.text;
  const myWants = allItems
    .filter(
      (i) => (i.kind === "must" || i.kind === "nice") && i.personId === null,
    )
    .map(fmtWant);
  const personWants = person
    ? allItems
        .filter(
          (i) =>
            i.kind === "gift" &&
            i.personId === person.id &&
            i.giftStatus !== "given",
        )
        .map((i) =>
          i.priceNote.trim() ? `${i.text} (${i.priceNote.trim()})` : fmtWant(i),
        )
    : [];
  const myProvides = provideRows
    .filter((pv) => pv.ownerType === "profile")
    .map(formatProvideForPlan);
  const personProvides = person
    ? provideRows
        .filter((pv) => pv.ownerType === "person" && pv.ownerId === person.id)
        .map(formatProvideForPlan)
    : [];
  return { myWants, personWants, myProvides, personProvides };
}

// Rebuild the exact signature generateDatePlan stores with a plan,
// from live state (same cover line, same key order). The
// signature covers the full profiles the plan is written from —
// both bios, both Want lists, both Provide lists with caps and
// notes — so a plan written before a bio or a Provide note (like
// the Sephora bonus) changed is stale and is regenerated on the
// next Plan the Date push instead of reused.
function buildDatePlanSig(
  profile: ProfileRow,
  date: DateRow,
  person: PersonRow | undefined,
  provideRows: ProvideRow[],
  allItems: ListRow[],
): string {
  const cover = datePlanCover(
    profile,
    date.personId,
    date.personName,
    date.ideaText,
    provideRows,
  );
  const coverLine = cover.coverLine;
  const facts = datePlanProfileFacts(profile, person, allItems, provideRows);
  const myName = profile.name.trim();
  // Same 21+ gate + verified-location check generateDatePlan
  // applies — the signature is over the checked spot + note the
  // plan was actually written from, plus the verified-locations
  // version, so a plan written before the real-location registry
  // (e.g. the Hale'iwa Lululemon plan) is stale and regenerates
  // on the next push for that date only.
  const gated = checkedPlanInputs(
    date.spot,
    date.note,
    profile.age,
    person?.age ?? null,
    `${date.ideaText} ${coverLine} ${facts.myProvides.join(" ")} ${facts.personProvides.join(" ")}`,
  );
  return hashSig(
    JSON.stringify({
      idea: date.ideaText,
      verifiedLocations: VERIFIED_LOCATIONS_VERSION,
      spot: gated.spot,
      spotGateBlocked: gated.blocked,
      note: gated.note,
      meetAt: date.meetAt ? date.meetAt.toISOString() : null,
      person: date.personName,
      me: myName,
      myGender: profile.gender,
      personGender: person?.gender ?? "",
      myLocation: profile.location,
      personLocation: person?.location ?? "",
      myAvailableTimes: profile.availableTimes,
      personAvailableTimes: person?.availableTimes ?? "",
      cover: coverLine,
      meetup: datePlanMeetupLine(date.personName, date.ideaText, cover),
      myBio: profile.bio,
      personBio: person?.bio ?? "",
      myWants: facts.myWants,
      personWants: facts.personWants,
      myProvides: facts.myProvides,
      personProvides: facts.personProvides,
      qualities: person ? parseQualities(person.qualities) : [],
      mine: parseQualities(profile.qualities),
    }),
  );
}

// Every "NN%" figure written in a text — a stored note that names a
// score other than the person's live score is stale on its face
// (the old 100% notes for members now living at 44%).
function percentagesIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/(\d{1,3})\s*%/g)) {
    const n = Number(m[1]);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

// ---------- Core member renames (2026-11-03, Erin) ----------
//
// Erin directed: the member named "Zach" is now "Alex", and the
// member formerly named "Kai" — renamed "Kalani" in the previous
// build — is now "Koa" (K-o-a). "Kalani", "Kailani" and "John"
// are NOT used for this member anywhere. ONLY the names change:
// each renamed member keeps their Wants, Provides, caps,
// scores, Deal / accepted status, dates, plans, photos and bio
// exactly as they were, except that name references inside
// stored text (bios, Provide notes, match notes, date plans,
// Chat bodies, Spark vs Wonder comparisons) are rewritten to
// the new name. "Hawaii Kai" is a place on O'ahu, never a
// person, and is protected from the rewrite. After renaming,
// the stored match-note and date-plan signatures are recomputed
// for the renamed members so the stale-writing purge keeps
// their (renamed) notes and plans instead of deleting them over
// the name change alone. The sweep runs on every getState
// before the purge and as the renameCoreMembers action; it is
// idempotent — once no row carries an old name it writes
// nothing. No notes or plans are generated here, and Erin's
// profile, List and saved Meta AI key are never touched. The
// Kai → Koa and Kailani → Koa entries are belt-and-braces: any
// stored text that still carries either older form for this
// member lands on Koa too (the Kai → Kalani entry stays so a
// not-yet-renamed "Kai" row still resolves through the chain,
// and the final Kai → Koa entry settles its name in one pass).

const CORE_MEMBER_RENAMES = [
  { old: "Zach", next: "Alex" },
  { old: "Kai", next: "Kalani" },
  { old: "Kailani", next: "Koa" },
  { old: "Kalani", next: "Koa" },
  { old: "Kai", next: "Koa" },
] as const;

function replaceMemberName(
  text: string,
  oldName: string,
  newName: string,
): string {
  if (!text) return text;
  const guard = "\u0000HAWAIIKAI\u0000";
  const protectedText = text.split("Hawaii Kai").join(guard);
  const replaced = protectedText.replace(
    new RegExp(`\\b${oldName}\\b`, "g"),
    newName,
  );
  return replaced.split(guard).join("Hawaii Kai");
}

const renameCoreMembersResponse = z.object({
  ok: z.literal(true),
  renamedPeople: z.number(),
  rowsUpdated: z.number(),
});
type RenameCoreMembersResult = z.infer<typeof renameCoreMembersResponse>;

async function renameCoreMembers(
  ctx: Ctx,
): Promise<{ renamedPeople: number; rowsUpdated: number }> {
  const db = ctx.db<typeof schema>();
  let renamedPeople = 0;
  let rowsUpdated = 0;

  // Phase 1: rename the people rows themselves (name + the name
  // references in their bio and stored match note).
  const peopleRows = await db.select().from(schema.people);
  for (const rename of CORE_MEMBER_RENAMES) {
    for (const person of peopleRows) {
      const newName = replaceMemberName(person.name, rename.old, rename.next);
      if (newName === person.name) continue;
      await db
        .update(schema.people)
        .set({
          name: newName,
          bio: replaceMemberName(person.bio, rename.old, rename.next),
          matchNote: replaceMemberName(
            person.matchNote,
            rename.old,
            rename.next,
          ),
        })
        .where(eq(schema.people.id, person.id));
      renamedPeople += 1;
      rowsUpdated += 1;
    }
  }

  // Phase 2: for every member now carrying a new name, point all
  // denormalised person_name snapshots at the new name and
  // rewrite old-name references in their stored text. This also
  // repairs a partially renamed row set.
  const freshPeople = await db.select().from(schema.people);
  const renamedIds = new Set<number>();
  for (const rename of CORE_MEMBER_RENAMES) {
    const targets = freshPeople.filter(
      (p) => replaceMemberName(p.name, rename.next, rename.next) === p.name && p.name.split(/[^A-Za-z]+/).includes(rename.next),
    );
    for (const person of targets) {
      renamedIds.add(person.id);
      const rn = (t: string) => replaceMemberName(t, rename.old, rename.next);
      // Bio / match note (covers a people row renamed elsewhere).
      // Re-read the row fresh: several rename entries can target
      // the same person (Kai / Kailani / Kalani all land on Koa),
      // and each pass must build on the previous pass's write,
      // never on the stale snapshot.
      const freshPerson =
        (
          await db
            .select()
            .from(schema.people)
            .where(eq(schema.people.id, person.id))
        )[0] ?? person;
      if (rn(freshPerson.bio) !== freshPerson.bio || rn(freshPerson.matchNote) !== freshPerson.matchNote) {
        await db
          .update(schema.people)
          .set({ bio: rn(freshPerson.bio), matchNote: rn(freshPerson.matchNote) })
          .where(eq(schema.people.id, person.id));
        rowsUpdated += 1;
      }
      // person_name snapshots.
      const snapshotTables = [
        schema.listItems,
        schema.dates,
        schema.messages,
        schema.safetyCheckins,
        schema.reports,
        schema.modelComparisons,
        schema.hypePayments,
        schema.wishlistUnlocks,
      ] as const;
      for (const table of snapshotTables) {
        const rows = await db
          .select()
          .from(table)
          .where(eq(table.personId, person.id));
        if (rows.some((r) => r.personName !== person.name)) {
          await db
            .update(table)
            .set({ personName: person.name })
            .where(eq(table.personId, person.id));
          rowsUpdated += 1;
        }
      }
      // Stored text that can name the member.
      const dateRows = await db
        .select()
        .from(schema.dates)
        .where(eq(schema.dates.personId, person.id));
      for (const d of dateRows) {
        if (rn(d.plan) !== d.plan || rn(d.ideaText) !== d.ideaText) {
          await db
            .update(schema.dates)
            .set({ plan: rn(d.plan), ideaText: rn(d.ideaText) })
            .where(eq(schema.dates.id, d.id));
          rowsUpdated += 1;
        }
      }
      const messageRows = await db
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.personId, person.id));
      for (const m of messageRows) {
        if (rn(m.body) !== m.body) {
          await db
            .update(schema.messages)
            .set({ body: rn(m.body) })
            .where(eq(schema.messages.id, m.id));
          rowsUpdated += 1;
        }
      }
      const provideRowsForPerson = await db
        .select()
        .from(schema.provides)
        .where(
          and(
            eq(schema.provides.ownerType, "person"),
            eq(schema.provides.ownerId, person.id),
          ),
        );
      for (const pv of provideRowsForPerson) {
        if (rn(pv.note) !== pv.note) {
          await db
            .update(schema.provides)
            .set({ note: rn(pv.note) })
            .where(eq(schema.provides.id, pv.id));
          rowsUpdated += 1;
        }
      }
      const comparisonRows = await db
        .select()
        .from(schema.modelComparisons)
        .where(eq(schema.modelComparisons.personId, person.id));
      for (const c of comparisonRows) {
        const next = {
          sparkMatchNote: rn(c.sparkMatchNote),
          wonderMatchNote: rn(c.wonderMatchNote),
          sparkDatePlan: rn(c.sparkDatePlan),
          wonderDatePlan: rn(c.wonderDatePlan),
          dateIdeaText: rn(c.dateIdeaText),
        };
        if (
          next.sparkMatchNote !== c.sparkMatchNote ||
          next.wonderMatchNote !== c.wonderMatchNote ||
          next.sparkDatePlan !== c.sparkDatePlan ||
          next.wonderDatePlan !== c.wonderDatePlan ||
          next.dateIdeaText !== c.dateIdeaText
        ) {
          await db
            .update(schema.modelComparisons)
            .set(next)
            .where(eq(schema.modelComparisons.id, c.id));
          rowsUpdated += 1;
        }
      }
    }
  }

  if (renamedIds.size === 0) return { renamedPeople, rowsUpdated };

  // Phase 3: refresh the stored signatures of the renamed
  // members' match notes and date plans, recomputed from the
  // renamed live state, so the stale-writing purge (which runs
  // after this on every getState) keeps them.
  rowsUpdated += await refreshRenamedWritingSigs(ctx, renamedIds);
  return { renamedPeople, rowsUpdated };
}

// Refresh the stored match-note and date-plan signatures for
// the given members, recomputed from their current live state,
// so the stale-writing purge keeps writing whose only change
// is a rename / relabel. Returns how many signature rows
// changed. Shared by the core-member renames and the Showcase
// label pass below.
async function refreshRenamedWritingSigs(
  ctx: Ctx,
  renamedIds: Set<number>,
): Promise<number> {
  let rowsUpdated = 0;
  const db = ctx.db<typeof schema>();
  const profile = await loadProfile(ctx);
  const [allItems, checkRows, currentPeople, currentDates, provideRows] =
    await Promise.all([
      db.select().from(schema.listItems),
      db.select().from(schema.personChecks),
      db.select().from(schema.people),
      db.select().from(schema.dates),
      db.select().from(schema.provides),
    ]);
  const scoredItems = allItems.filter((i) => i.kind !== "gift" && (i.personId ?? null) === null);
  const giftRows = allItems.filter((i) => i.kind === "gift");
  for (const person of currentPeople) {
    if (!renamedIds.has(person.id) || !person.matchNote) continue;
    const { sig } = buildMatchFactsAndSig(
      profile,
      person,
      scoredItems,
      checkRows,
      provideRows,
      giftRows,
    );
    if (sig !== person.matchNoteSig) {
      await db
        .update(schema.people)
        .set({ matchNoteSig: sig })
        .where(eq(schema.people.id, person.id));
      rowsUpdated += 1;
    }
  }
  const personById = new Map(currentPeople.map((p) => [p.id, p]));
  for (const date of currentDates) {
    if (!renamedIds.has(date.personId) || !date.plan) continue;
    const sig = buildDatePlanSig(
      profile,
      date,
      personById.get(date.personId),
      provideRows,
      allItems,
    );
    if (sig !== date.planSig) {
      await db
        .update(schema.dates)
        .set({
          planSig: sig,
          planImageSig: date.planImageSig ? sig : date.planImageSig,
        })
        .where(eq(schema.dates.id, date.id));
      rowsUpdated += 1;
    }
  }
  return rowsUpdated;
}

// ---------- Showcase labels (2026-11-04, Erin) ----------
//
// Erin directed: the word "Showcase" goes BEFORE each Showcase
// member's name, everywhere the name appears — "Showcase Alex",
// "Showcase Koa" and "Showcase Leilani" — and then the app can
// be recorded for the demo. (She named the second member "Kai"
// in the request; that member — formerly Kai, then Kalani — is
// Koa since the 2026-11-03 rename, so the label lands on Koa.
// There is no separate Kai member.) Erin herself is real —
// founder and builder — and is NEVER labelled: her profile name
// stays "Erin". This supersedes the bare-name presentation and
// the "Demo — " lead-ins on those three members' own bios and
// Provide notes: a stored "Demo — Alex, 42, Waikiki." becomes
// "Showcase Alex, 42, Waikiki.".
//
// The pass works exactly like the core-member renames above:
// the stored names change (people rows + every person_name
// snapshot), name references inside the members' own stored
// text (bios, Provide notes, match notes, date plans, Chat
// bodies, Spark vs Wonder comparisons) are rewritten with the
// label, and the note / plan signatures are refreshed so the
// stale-writing purge keeps the relabelled writing. ONLY the
// names change: Wants, Provides, caps, scores, Deal status,
// dates, photos and Erin's profile, List and saved Meta AI key
// are untouched, and no notes or plans are generated. The pass
// runs on every getState after the core renames and as the
// applyShowcaseLabels action; it is idempotent — once a name
// carries its label it writes nothing.

const SHOWCASE_LABELS = [
  { bare: "Alex", labelled: "Showcase Alex" },
  { bare: "Koa", labelled: "Showcase Koa" },
  { bare: "Leilani", labelled: "Showcase Leilani" },
] as const;

// The labelled form of one of the three Showcase members' bare
// names; any other name is returned unchanged (Erin included).
function showcaseName(bare: string): string {
  const hit = SHOWCASE_LABELS.find((l) => l.bare === bare);
  return hit ? hit.labelled : bare;
}

// True when a member row IS one of the three Showcase members,
// whether its stored name is still bare or already labelled —
// every server lookup for Alex / Koa / Leilani goes through
// this, so the maintenance actions keep finding them before,
// during and after the relabel.
function isShowcaseMember(person: { name: string }, bare: string): boolean {
  return person.name === bare || person.name === showcaseName(bare);
}

// Rewrite one stored text for a Showcase relabel: a leading
// "Demo — <name>" presentation becomes the labelled name, and
// every remaining bare-name reference gains the label. Text
// that already carries the label is protected first, so the
// rewrite never doubles it ("Showcase Showcase Alex").
function showcaseText(text: string, bare: string, labelled: string): string {
  if (!text) return text;
  let out = text.split(`Demo — ${bare}`).join(labelled);
  const guard = "\u0000SHOWCASELABEL\u0000";
  out = out.split(labelled).join(guard);
  out = out.replace(new RegExp(`\\b${bare}\\b`, "g"), labelled);
  return out.split(guard).join(labelled);
}

const applyShowcaseLabelsResponse = z.object({
  ok: z.literal(true),
  renamedPeople: z.number(),
  rowsUpdated: z.number(),
});
type ApplyShowcaseLabelsResult = z.infer<typeof applyShowcaseLabelsResponse>;

async function applyShowcaseLabels(
  ctx: Ctx,
): Promise<{ renamedPeople: number; rowsUpdated: number }> {
  const db = ctx.db<typeof schema>();
  let renamedPeople = 0;
  let rowsUpdated = 0;

  // Phase 1: relabel the member rows themselves (name + the
  // name references in their bio and stored match note).
  const peopleRows = await db.select().from(schema.people);
  const renamedIds = new Set<number>();
  for (const label of SHOWCASE_LABELS) {
    for (const person of peopleRows) {
      if (person.name !== label.bare) continue;
      const rn = (t: string) => showcaseText(t, label.bare, label.labelled);
      await db
        .update(schema.people)
        .set({
          name: label.labelled,
          bio: rn(person.bio),
          matchNote: rn(person.matchNote),
        })
        .where(eq(schema.people.id, person.id));
      renamedPeople += 1;
      rowsUpdated += 1;
      renamedIds.add(person.id);
    }
  }

  // Phase 2: for every member now carrying a label, point all
  // denormalised person_name snapshots at the labelled name and
  // rewrite bare-name references in their stored text. This
  // also repairs a partially relabelled row set.
  const freshPeople = await db.select().from(schema.people);
  for (const label of SHOWCASE_LABELS) {
    const targets = freshPeople.filter((p) => p.name === label.labelled);
    for (const person of targets) {
      renamedIds.add(person.id);
      const rn = (t: string) => showcaseText(t, label.bare, label.labelled);
      // Bio / match note (covers a member row relabelled
      // elsewhere). Re-read the row fresh so each pass builds
      // on the previous pass's write, never a stale snapshot.
      const freshPerson =
        (
          await db
            .select()
            .from(schema.people)
            .where(eq(schema.people.id, person.id))
        )[0] ?? person;
      if (
        rn(freshPerson.bio) !== freshPerson.bio ||
        rn(freshPerson.matchNote) !== freshPerson.matchNote
      ) {
        await db
          .update(schema.people)
          .set({
            bio: rn(freshPerson.bio),
            matchNote: rn(freshPerson.matchNote),
          })
          .where(eq(schema.people.id, person.id));
        rowsUpdated += 1;
      }
      // person_name snapshots.
      const snapshotTables = [
        schema.listItems,
        schema.dates,
        schema.messages,
        schema.safetyCheckins,
        schema.reports,
        schema.modelComparisons,
        schema.hypePayments,
        schema.wishlistUnlocks,
      ] as const;
      for (const table of snapshotTables) {
        const rows = await db
          .select()
          .from(table)
          .where(eq(table.personId, person.id));
        if (rows.some((r) => r.personName !== person.name)) {
          await db
            .update(table)
            .set({ personName: person.name })
            .where(eq(table.personId, person.id));
          rowsUpdated += 1;
        }
      }
      // Stored text that can name the member.
      const dateRows = await db
        .select()
        .from(schema.dates)
        .where(eq(schema.dates.personId, person.id));
      for (const d of dateRows) {
        if (rn(d.plan) !== d.plan || rn(d.ideaText) !== d.ideaText) {
          await db
            .update(schema.dates)
            .set({ plan: rn(d.plan), ideaText: rn(d.ideaText) })
            .where(eq(schema.dates.id, d.id));
          rowsUpdated += 1;
        }
      }
      const messageRows = await db
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.personId, person.id));
      for (const m of messageRows) {
        if (rn(m.body) !== m.body) {
          await db
            .update(schema.messages)
            .set({ body: rn(m.body) })
            .where(eq(schema.messages.id, m.id));
          rowsUpdated += 1;
        }
      }
      const provideRowsForPerson = await db
        .select()
        .from(schema.provides)
        .where(
          and(
            eq(schema.provides.ownerType, "person"),
            eq(schema.provides.ownerId, person.id),
          ),
        );
      for (const pv of provideRowsForPerson) {
        if (rn(pv.note) !== pv.note) {
          await db
            .update(schema.provides)
            .set({ note: rn(pv.note) })
            .where(eq(schema.provides.id, pv.id));
          rowsUpdated += 1;
        }
      }
      const comparisonRows = await db
        .select()
        .from(schema.modelComparisons)
        .where(eq(schema.modelComparisons.personId, person.id));
      for (const c of comparisonRows) {
        const next = {
          sparkMatchNote: rn(c.sparkMatchNote),
          wonderMatchNote: rn(c.wonderMatchNote),
          sparkDatePlan: rn(c.sparkDatePlan),
          wonderDatePlan: rn(c.wonderDatePlan),
          dateIdeaText: rn(c.dateIdeaText),
        };
        if (
          next.sparkMatchNote !== c.sparkMatchNote ||
          next.wonderMatchNote !== c.wonderMatchNote ||
          next.sparkDatePlan !== c.sparkDatePlan ||
          next.wonderDatePlan !== c.wonderDatePlan ||
          next.dateIdeaText !== c.dateIdeaText
        ) {
          await db
            .update(schema.modelComparisons)
            .set(next)
            .where(eq(schema.modelComparisons.id, c.id));
          rowsUpdated += 1;
        }
      }
    }
  }

  if (renamedIds.size === 0) return { renamedPeople, rowsUpdated };

  // Phase 3: refresh the stored signatures of the relabelled
  // members' match notes and date plans, recomputed from the
  // relabelled live state, so the stale-writing purge (which
  // runs after this on every getState) keeps them.
  rowsUpdated += await refreshRenamedWritingSigs(ctx, renamedIds);
  return { renamedPeople, rowsUpdated };
}

// ---------- Bug-check fixes (2026-11-03, Erin) ----------
//
// One idempotent repair pass for the remaining bug-check fixes.
// It runs on every getState BEFORE the stale-writing purge (so
// the signature refresh below protects the surviving plans
// from that purge) and as the applyBugCheckFixes action. It
// only ever fills or remaps what the bug check found — it
// never deletes a date, never regenerates plan text, never
// changes a plan's picture, and never touches Erin's List,
// Provides, photos, Deals, or her saved Meta AI key.
//
// (1) Orphaned date links: Alex's and Koa's Lululemon dates
//     still point at list_item_id 27, a List row that no longer
//     exists — Erin's current Lululemon Want is the row the
//     List holds now (id 127). Any Lululemon date not pointing
//     at the current Lululemon item is remapped to it. Dates 6,
//     7 and 8 themselves are never deleted.
// (2) Structured spot + meet time: the three demo dates were
//     saved with no spot and no meet time, only plan text. Each
//     gets the spot its own plan names — Alex: Kalakaua Avenue
//     — Waikiki; Koa: Ala Moana Center; Leilani: Haleiwa Beach
//     Park — and the Saturday-morning meet time its plan states
//     (the next Saturday, at the plan's morning hour, Honolulu
//     time). Only empty fields are filled; a spot or time Erin
//     sets herself is never overwritten.
// (5) Leilani's blank location / spot / available times are
//     filled from her own date: Haleiwa, North Shore —
//     Haleiwa Beach Park — Weekend mornings. Only blanks fill.
// After any of those changes, the affected dates' plan
// signatures are recomputed over the new structured fields
// (the same refresh the rename sweep does), so the purge
// keeps the plans exactly as written — text, source and
// actual-photo keys untouched. A plan that fails the
// real-location check is never blessed this way; the purge
// still owns it.

type BugCheckRepairCounts = {
  datesRemapped: number;
  datesStructured: number;
  leilaniFilled: boolean;
  planSigsRefreshed: number;
};

// The next Saturday at a morning hour, Honolulu time
// (Pacific/Honolulu is UTC-10 all year — no daylight saving).
// If today is Saturday and that hour has already passed in
// Honolulu, it is the Saturday after.
function nextSaturdayMorning(hourHst: number): Date {
  const honolulu = new Date(Date.now() - 10 * 60 * 60 * 1000);
  let add = (6 - honolulu.getUTCDay() + 7) % 7;
  if (add === 0 && honolulu.getUTCHours() >= hourHst) add = 7;
  return new Date(
    Date.UTC(
      honolulu.getUTCFullYear(),
      honolulu.getUTCMonth(),
      honolulu.getUTCDate() + add,
      hourHst + 10,
      0,
      0,
    ),
  );
}

async function repairBugCheckFixes(
  ctx: Ctx,
): Promise<BugCheckRepairCounts> {
  const db = ctx.db<typeof schema>();
  const counts: BugCheckRepairCounts = {
    datesRemapped: 0,
    datesStructured: 0,
    leilaniFilled: false,
    planSigsRefreshed: 0,
  };
  const profile = await loadProfile(ctx);
  const [allItems, personRows, dateRows, provideRows] = await Promise.all([
    db.select().from(schema.listItems),
    db.select().from(schema.people),
    db.select().from(schema.dates),
    db.select().from(schema.provides),
  ]);
  const scoredItems = allItems.filter((i) => i.kind !== "gift" && (i.personId ?? null) === null);
  const touchedDateIds = new Set<number>();

  // (1) Remap Lululemon dates to the current Lululemon item.
  const luluItem = scoredItems.find((i) => norm(i.text) === "lululemon");
  if (luluItem) {
    for (const d of dateRows) {
      if (norm(d.ideaText) === "lululemon" && d.listItemId !== luluItem.id) {
        await db
          .update(schema.dates)
          .set({ listItemId: luluItem.id })
          .where(eq(schema.dates.id, d.id));
        counts.datesRemapped += 1;
        touchedDateIds.add(d.id);
      }
    }
  }

  // (5) Fill Leilani's blanks — only the fields still empty.
  const leilani = personRows.find((p) => isShowcaseMember(p, "Leilani"));
  let leilaniChanged = false;
  if (leilani) {
    const patch: { location?: string; spot?: string; availableTimes?: string } =
      {};
    if (!leilani.location.trim()) patch.location = "Haleiwa, North Shore";
    if (!leilani.spot.trim()) patch.spot = "Haleiwa Beach Park";
    if (!leilani.availableTimes.trim()) patch.availableTimes = "Weekend mornings";
    if (Object.keys(patch).length > 0) {
      await db
        .update(schema.people)
        .set(patch)
        .where(eq(schema.people.id, leilani.id));
      leilaniChanged = true;
      counts.leilaniFilled = true;
    }
  }

  // (2) Structured spot + meet time from each date's own plan.
  const structureSpecs = [
    { person: "Showcase Alex", idea: "lululemon", spot: "Kalakaua Avenue — Waikiki", hour: 10 },
    { person: "Showcase Koa", idea: "lululemon", spot: "Ala Moana Center", hour: 9 },
    { person: "Showcase Leilani", idea: "yoga", spot: "Haleiwa Beach Park", hour: 8 },
  ];
  for (const d of dateRows) {
    const spec = structureSpecs.find(
      (s) => s.person === d.personName && norm(d.ideaText) === s.idea,
    );
    if (!spec) continue;
    const patch: { spot?: string; meetAt?: Date } = {};
    if (!d.spot.trim()) patch.spot = spec.spot;
    if (!d.meetAt) patch.meetAt = nextSaturdayMorning(spec.hour);
    if (Object.keys(patch).length > 0) {
      await db
        .update(schema.dates)
        .set(patch)
        .where(eq(schema.dates.id, d.id));
      counts.datesStructured += 1;
      touchedDateIds.add(d.id);
    }
  }

  // Refresh the plan signatures of exactly the dates this pass
  // changed (plus Leilani's dates when her profile fields were
  // filled — her location / times are part of the signature),
  // so their plans survive the purge word for word.
  if (touchedDateIds.size > 0 || leilaniChanged) {
    const [freshDates, freshPeople] = await Promise.all([
      db.select().from(schema.dates),
      db.select().from(schema.people),
    ]);
    const personById = new Map(freshPeople.map((p) => [p.id, p]));
    for (const d of freshDates) {
      if (!d.plan) continue;
      const affected =
        touchedDateIds.has(d.id) ||
        (leilaniChanged && leilani !== undefined && d.personId === leilani.id);
      if (!affected) continue;
      const person = personById.get(d.personId);
      const storedCover = datePlanCover(
        profile,
        d.personId,
        d.personName,
        d.ideaText,
        provideRows,
      );
      const storedFacts = datePlanProfileFacts(
        profile,
        person,
        allItems,
        provideRows,
      );
      const locationHay = `${d.ideaText} ${storedCover.coverLine} ${storedFacts.myProvides.join(" ")} ${storedFacts.personProvides.join(" ")}`;
      if (!planLocationCheck(d.plan, locationHay).ok) continue;
      const sig = buildDatePlanSig(profile, d, person, provideRows, allItems);
      if (sig !== d.planSig) {
        await db
          .update(schema.dates)
          .set({
            planSig: sig,
            ...(d.planImageSource === "actual" ? { planImageSig: sig } : {}),
          })
          .where(eq(schema.dates.id, d.id));
        counts.planSigsRefreshed += 1;
      }
    }
  }
  return counts;
}

async function purgeStaleNotesAndExpiredHype(
  ctx: Ctx,
): Promise<PurgeCounts> {
  const db = ctx.db<typeof schema>();
  const counts: PurgeCounts = {
    matchNotesRemoved: 0,
    datePlansRemoved: 0,
    dateImagesRepaired: 0,
    comparisonsRemoved: 0,
    hypePaymentsRemoved: 0,
    hypeListingsCleared: 0,
  };
  const profile = await loadProfile(ctx);
  const [
    allItems,
    checkRows,
    personRows,
    dateRows,
    provideRows,
    comparisonRows,
    hypePaymentRows,
  ] = await Promise.all([
    db.select().from(schema.listItems),
    db.select().from(schema.personChecks),
    db.select().from(schema.people),
    db.select().from(schema.dates),
    db.select().from(schema.provides),
    db.select().from(schema.modelComparisons),
    db.select().from(schema.hypePayments),
  ]);
  const items = allItems.filter((i) => i.kind !== "gift" && (i.personId ?? null) === null);
  const giftRows = allItems.filter((i) => i.kind === "gift");
  const now = Date.now();
  // The moment Erin's current List took shape: the newest scored
  // List item's creation. Anything generated before it predates
  // the current List.
  const newestListAt = items.reduce(
    (max, i) => Math.max(max, i.createdAt.getTime()),
    0,
  );
  const provideById = new Map(provideRows.map((pv) => [pv.id, pv]));
  const personById = new Map(personRows.map((p) => [p.id, p]));

  // --- Stored match notes (people.match_note) ---
  for (const person of personRows) {
    if (!person.matchNote) continue;
    const { facts, scored, sig } = buildMatchFactsAndSig(
      profile,
      person,
      items,
      checkRows,
      provideRows,
      giftRows,
    );
    let stale = person.matchNoteSig !== sig;
    if (!stale) {
      const pcts = percentagesIn(person.matchNote);
      if (
        scored.matchPercent === null
          ? pcts.length > 0
          : pcts.some((p) => p !== scored.matchPercent)
      ) {
        stale = true;
      }
    }
    if (!stale && person.matchNoteSource !== "meta-ai") {
      // A List-written note is deterministic: fresh means it is
      // exactly the note the current facts write.
      if (person.matchNote !== fallbackMatchNote(facts)) stale = true;
    }
    if (stale) {
      await db
        .update(schema.people)
        .set({ matchNote: "", matchNoteSource: "", matchNoteSig: "" })
        .where(eq(schema.people.id, person.id));
      counts.matchNotesRemoved += 1;
    }
  }

  // --- Stored date plans (dates.plan + its generated image) ---
  for (const date of dateRows) {
    if (!date.plan) continue;
    const sig = buildDatePlanSig(
      profile,
      date,
      personById.get(date.personId),
      provideRows,
      allItems,
    );
    // Real-location check on the stored text itself: a plan that
    // places a registered business in a town where it does not
    // exist (the Hale'iwa Lululemon plan) is removed even if its
    // signature somehow still matches — it is never shown again,
    // and it regenerates correctly on the next push for that
    // date only.
    const storedCover = datePlanCover(
      profile,
      date.personId,
      date.personName,
      date.ideaText,
      provideRows,
    );
    const storedFacts = datePlanProfileFacts(
      profile,
      personById.get(date.personId),
      allItems,
      provideRows,
    );
    const locationHay = `${date.ideaText} ${storedCover.coverLine} ${storedFacts.myProvides.join(" ")} ${storedFacts.personProvides.join(" ")}`;
    const locationOk = planLocationCheck(date.plan, locationHay).ok;
    if (date.planSig !== sig || !locationOk) {
      if (date.planImageBlobKey) {
        try {
          await ctx.blobs.delete(date.planImageBlobKey);
        } catch {
          // Best effort — clearing the row below is the purge.
        }
      }
      await db
        .update(schema.dates)
        .set({
          plan: "",
          planSource: "",
          planSig: "",
          planImageBlobKey: "",
          planImageSig: "",
          planImageSource: "",
          planPhotoKeys: "",
        })
        .where(eq(schema.dates.id, date.id));
      counts.datePlansRemoved += 1;
    } else {
      // Actual-photo repair (2026-11-03, Erin — Koa's date):
      // this plan SURVIVES the purge (current signature, real
      // locations), so its picture must be the actual-photo set
      // whenever the checked registry has real photographs for
      // its verified spot. Koa's accepted Lululemon date at Ala
      // Moana Center still carried a legacy generated
      // illustration (written before the actual-photo registry
      // existed, so its source/keys were never set, and the
      // earlier actual-photo build refreshed only Alex's date):
      // the row kept showing "Generated image" even though its
      // plan text names Ala Moana Center. Repair swaps ONLY the
      // picture fields — plan text, source, signature, spot,
      // status and the Provide cover behind the plan are never
      // touched — and deletes the stale generated blob, so the
      // date shows the actual Ala Moana Center / Lululemon
      // photographs labelled "Actual photo". A date whose spot
      // has no actual photo keeps its generated picture exactly
      // as before.
      const person = personById.get(date.personId);
      const gated = checkedPlanInputs(
        date.spot,
        date.note,
        profile.age,
        person?.age ?? null,
        locationHay,
      );
      const repairKeys = actualPhotoKeysForDate(
        gated.spot,
        locationHay,
        date.plan,
      );
      if (repairKeys) {
        const storedKeys =
          date.planImageSource === "actual"
            ? date.planPhotoKeys
                .split(",")
                .map((k) => k.trim())
                .filter((k) => k !== "")
            : [];
        const needsRepair =
          date.planImageSource !== "actual" ||
          storedKeys.join(",") !== repairKeys.join(",") ||
          date.planImageBlobKey !== "";
        if (needsRepair) {
          if (date.planImageBlobKey) {
            try {
              await ctx.blobs.delete(date.planImageBlobKey);
            } catch {
              // Best effort — the row update below is the switch.
            }
          }
          await db
            .update(schema.dates)
            .set({
              planImageBlobKey: "",
              planImageSig: sig,
              planImageSource: "actual",
              planPhotoKeys: repairKeys.join(","),
            })
            .where(eq(schema.dates.id, date.id));
          counts.dateImagesRepaired += 1;
        }
      }
    }
  }

  // --- Spark vs Wonder comparisons (model_comparisons) ---
  for (const c of comparisonRows) {
    const person = personById.get(c.personId);
    if (!person) {
      await db
        .delete(schema.modelComparisons)
        .where(eq(schema.modelComparisons.id, c.id));
      counts.comparisonsRemoved += 1;
      continue;
    }
    const { facts, scored } = buildMatchFactsAndSig(
      profile,
      person,
      items,
      checkRows,
      provideRows,
      giftRows,
    );
    let stale = false;
    // (a) A score named in either match note that is not the live
    // score — the old Maya / Leila 100% comparisons now at 44%.
    for (const t of [c.sparkMatchNote, c.wonderMatchNote]) {
      if (!t) continue;
      const pcts = percentagesIn(t);
      if (
        scored.matchPercent === null
          ? pcts.length > 0
          : pcts.some((p) => p !== scored.matchPercent)
      ) {
        stale = true;
      }
    }
    // (b) Generated before Erin's current List took shape.
    if (!stale && newestListAt > 0 && c.updatedAt.getTime() < newestListAt) {
      stale = true;
    }
    // (c) Predates a Provide that now covers a Need on either side.
    if (!stale) {
      const coveringIds = [
        ...scored.needCovers.map((n) => n.provideId),
        ...scored.coveredByMe.map((w) => w.provideId),
      ];
      for (const id of coveringIds) {
        const pv = provideById.get(id);
        if (pv && pv.createdAt.getTime() > c.updatedAt.getTime()) {
          stale = true;
          break;
        }
      }
    }
    // (d) List-fallback comparison texts are deterministic: fresh
    // means exactly what the current facts write.
    if (!stale) {
      const fb = fallbackMatchNote(facts);
      if (
        c.sparkMatchNoteStatus === "list" &&
        c.sparkMatchNote &&
        c.sparkMatchNote !== fb
      ) {
        stale = true;
      }
      if (
        c.wonderMatchNoteStatus === "list" &&
        c.wonderMatchNote &&
        c.wonderMatchNote !== fb
      ) {
        stale = true;
      }
    }
    if (!stale && c.dateId !== null && (c.sparkDatePlan || c.wonderDatePlan)) {
      const date = dateRows.find((d) => d.id === c.dateId);
      if (!date) {
        stale = true;
      } else {
        const fbCover = datePlanCover(
          profile,
          date.personId,
          date.personName,
          date.ideaText,
          provideRows,
        );
        const fbFacts = datePlanProfileFacts(
          profile,
          person,
          allItems,
          provideRows,
        );
        const gatedFb = checkedPlanInputs(
          date.spot,
          date.note,
          profile.age,
          person.age ?? null,
          `${date.ideaText} ${fbCover.coverLine} ${fbFacts.myProvides.join(" ")} ${fbFacts.personProvides.join(" ")}`,
        );
        const fbPlan = fallbackDatePlan({
          myName: profile.name.trim(),
          personName: date.personName,
          ideaText: date.ideaText,
          spot: gatedFb.spot,
          note: gatedFb.note,
          meetAt: date.meetAt,
          myLocation: profile.location,
          personLocation: person.location,
          coverDetailLine: datePlanCoverDetailLine(
            datePlanCover(
              profile,
              date.personId,
              date.personName,
              date.ideaText,
              provideRows,
            ),
          ),
          meetupLine: datePlanMeetupLine(
            date.personName,
            date.ideaText,
            datePlanCover(
              profile,
              date.personId,
              date.personName,
              date.ideaText,
              provideRows,
            ),
          ),
        });
        if (
          c.sparkDatePlanStatus === "list" &&
          c.sparkDatePlan &&
          c.sparkDatePlan !== fbPlan
        ) {
          stale = true;
        }
        if (
          c.wonderDatePlanStatus === "list" &&
          c.wonderDatePlan &&
          c.wonderDatePlan !== fbPlan
        ) {
          stale = true;
        }
      }
    }
    if (stale) {
      await db
        .delete(schema.modelComparisons)
        .where(eq(schema.modelComparisons.id, c.id));
      counts.comparisonsRemoved += 1;
    }
  }

  // --- Hype: killed until later (2026-11-02, Erin's direction) ---
  // Hype is paused, not redesigned away: every Hype payment row
  // goes (expired ones like Erin's $5.98 first among them — with
  // the feature off, no payment record stays on display), and
  // every Hype listing — Erin's and every member's, live or
  // expired — is cleared: on/off, spot, mode, note, paid window.
  // The columns and table stay in the schema so Hype can return
  // later exactly as it was; while it is off, this sweep keeps it
  // off even if an older client or action writes a listing.
  void now;
  for (const p of hypePaymentRows) {
    await db
      .delete(schema.hypePayments)
      .where(eq(schema.hypePayments.id, p.id));
    counts.hypePaymentsRemoved += 1;
  }
  const profileHasHype =
    profile.hypeOn ||
    profile.hypeSpot !== "" ||
    profile.hypeMode !== "" ||
    profile.hypeNote !== "" ||
    profile.hypeExpiresAt !== null ||
    profile.hypePaidCents !== null ||
    profile.hypePlan !== "";
  if (profileHasHype) {
    const values = {
      ...profile,
      qualities:
        typeof profile.qualities === "string"
          ? profile.qualities
          : JSON.stringify(profile.qualities),
      hypeOn: false,
      hypeSpot: "",
      hypeMode: "",
      hypeNote: "",
      hypeExpiresAt: null,
      hypePaidCents: null,
      hypePlan: "",
      updatedAt: new Date(),
    };
    await db
      .insert(schema.myProfile)
      .values(values)
      .onConflictDoUpdate({ target: schema.myProfile.id, set: values });
    counts.hypeListingsCleared += 1;
  }
  for (const person of personRows) {
    const personHasHype =
      person.hypeOn ||
      person.hypeSpot !== "" ||
      person.hypeMode !== "" ||
      person.hypeNote !== "" ||
      person.hypeExpiresAt !== null ||
      person.hypePaidCents !== null ||
      person.hypePlan !== "";
    if (personHasHype) {
      await db
        .update(schema.people)
        .set({
          hypeOn: false,
          hypeSpot: "",
          hypeMode: "",
          hypeNote: "",
          hypeExpiresAt: null,
          hypePaidCents: null,
          hypePlan: "",
        })
        .where(eq(schema.people.id, person.id));
      counts.hypeListingsCleared += 1;
    }
  }

  return counts;
}

// Gender wording for Meta AI prompts (2026-11-02): a prompt states
// each person's gender ONLY when that person set one on their
// profile. When none is set, the prompt says so and orders neutral
// language — a name alone never implies a gender.
function genderLine(name: string, gender: string): string {
  const who = name.trim() || "The member";
  return gender
    ? `${who} is a ${gender} (stated on their profile).`
    : `${who}'s gender is not stated — use neutral language (they/them) for ${who} and never infer a gender from their name.`;
}

const GENDER_INSTRUCTION =
  "Use each person's stated gender when one is given; when no gender is stated for a person, use neutral language for them — never infer anyone's gender from their name.";

// ---------- North Shore local concierge tuning (2026-11-02) ----------
//
// Match notes and date plans must read like a North Shore local
// concierge wrote them, not a generic restaurant picker. These
// lines are spliced into EVERY Meta AI prompt for a note or a
// plan — the generate actions and the Spark vs Wonder comparison
// builders share them — and the List-based fallbacks follow the
// same rules, so the voice is the same with or without a key.
// Spots: the model may only name a spot from ALLOWED_OAHU_SPOTS
// (every one is a real entry in the app's own SPOT_GROUPS spot
// list in the client) or the spot already given for the date —
// inventing a spot, address, or business as a fact is forbidden.
const ALLOWED_OAHU_SPOTS = [
  "Sunset Beach", "Pipeline", "Waimea Bay", "Haleiwa", "Haleiwa Beach Park", "Turtle Bay",
  "Puaena Point", "Ehukai Beach Park", "Sharks Cove", "Waikiki",
  "Kailua Beach", "Lanikai Beach", "Ala Moana Beach Park",
  "Ala Moana Center", "Sandy Beach", "Makapu'u", "Windward Mall",
  "Pearlridge Center", "Kahala Mall", "International Market Place — Waikiki",
  "Royal Hawaiian Center", "Kalakaua Avenue — Waikiki", "Honolulu Museum of Art", "Bishop Museum",
  "Shangri La Museum", "Iolani Palace", "Waikiki Aquarium",
  "Honolulu Zoo", "Kapiolani Park", "Diamond Head",
  "Chinatown — Honolulu", "Kaka'ako", "Diamond Head Trail",
  "Manoa Falls", "Tantalus Lookout", "Yoga in the Park",
  "Snorkeling — Hanauma Bay, Hawaii Kai", "Snorkeling — Shark's Cove, North Shore",
  "Surf Contest — Sunset Beach, North Shore", "Surf Contest — Haleiwa Alii Beach Park",
  "Running — Ala Moana Beach Park Loop, Honolulu", "Running — North Shore Path, Haleiwa to Waialua",
  "Walking — Makapu'u Lighthouse Trail, East O'ahu", "Walking — North Shore Stroll, Haleiwa",
  "Training — Beach Training, North Shore", "Sailing — Haleiwa Harbor, North Shore",
  "Sailing — Waikiki Sunset Sail (Kewalo Basin Harbor)", "Horseback Riding — Turtle Bay Trails, North Shore",
  "Live Music — Blue Note Hawaii, Waikiki", "Guitars — Sunset Jam, North Shore",
  "Bowling — Aiea Bowl, Aiea",
];

// ---------- Verified real locations (2026-11-03, Erin) ----------
//
// Date plans must use only real, checked O'ahu locations. The
// failure that forced this: a Meta AI plan placed Lululemon in
// Hale'iwa — there is NO Lululemon (and no Sephora) in Hale'iwa.
// A named business may only be placed where it is listed in
// VERIFIED_BUSINESS_LOCATIONS below (the addresses Erin gave for
// this build, held as the app's checked registry), and a named
// activity may only be placed at one of its verified spots. A
// business or activity that is NOT in the registry gets no
// invented store, address, or town: the plan uses a real spot
// from ALLOWED_OAHU_SPOTS for the meetup and names no store
// location for it. Every generated plan is checked against this
// registry before it is stored or shown (planLocationCheck) —
// a plan that puts a registered business in a town where it does
// not exist is discarded and the List-based fallback, written
// from the same registry, is used instead. The same check runs
// in the stale-plan purge, so a stored plan with a wrong-town
// store (like the Hale'iwa Lululemon plan) is removed on load
// and regenerated correctly on the next Plan the Date push for
// that date only — never in bulk.
const VERIFIED_LOCATIONS_VERSION = "v1-kalakaua-2270-sephora-2250-ala-moana-1450";

const VERIFIED_BUSINESS_LOCATIONS: {
  business: string;
  spot: string;
  address: string;
  area: string;
  // Mall-directory detail (2026-11-03, Erin): where the store
  // sits INSIDE its mall — floor / wing / neighbours — plus the
  // store phone, as Erin gave them for Lululemon at Ala Moana
  // Center. "" where no directory detail is on record; a plan
  // must never invent a floor, wing or phone that is not here.
  directory: string;
  phone: string;
}[] = [
  {
    business: "Lululemon",
    spot: "Kalakaua Avenue — Waikiki",
    address: "2270 Kalakaua Ave, Honolulu",
    area: "Waikiki / Kalakaua Avenue",
    directory: "",
    phone: "",
  },
  {
    business: "Lululemon",
    spot: "Ala Moana Center",
    address: "Ala Moana Center, 1450 Ala Moana Blvd, Honolulu",
    area: "Ala Moana Center",
    directory: "Level 2, near Ewa Wing, between Uniqlo and Coach",
    phone: "(808) 818-8817",
  },
  {
    business: "Sephora",
    spot: "Kalakaua Avenue — Waikiki",
    address: "2250 Kalakaua Ave, Honolulu",
    area: "Waikiki / Kalakaua Avenue",
    directory: "",
    phone: "",
  },
  {
    business: "Sephora",
    spot: "Ala Moana Center",
    address: "Ala Moana Center, 1450 Ala Moana Blvd, Honolulu",
    area: "Ala Moana Center",
    directory: "",
    phone: "",
  },
];

// ---------- Verified park for Yoga in the Park (2026-11-03, Erin) ----------
//
// Erin's fix for Leilani's Yoga date: instead of a generated
// image for a generic "Yoga in the Park, North Shore side, near
// Haleiwa", the date uses an actual real City and County of
// Honolulu park near Hale'iwa — Haleiwa Beach Park, at the
// address Erin gave for this build, held here as the app's
// checked registry entry for a yoga date. Its grassy park area
// is the spot for Yoga in the Park on a Saturday morning, near
// Haleiwa town. A yoga date whose saved spot is generic ("Yoga
// in the Park"), a Hale'iwa / North Shore wording, or no spot at
// all is planned at this park (see verifiedPlanSpot) — the same
// checked-spot mechanism the Lululemon / Sephora dates use — and
// the park carries actual photographs in the registry below, so
// its plan picture is actual, never generated.
const HALEIWA_BEACH_PARK = {
  spot: "Haleiwa Beach Park",
  address: "62-449 Kamehameha Hwy, Haleiwa, HI 96712",
  area: "Haleiwa, North Shore",
  operator: "City and County of Honolulu",
  note: "Grassy park area suitable for Yoga in the Park on a Saturday morning, near Haleiwa town",
} as const;

const VERIFIED_YOGA_LINE =
  `Verified yoga location on O'ahu — Yoga in the Park is at ${HALEIWA_BEACH_PARK.spot}, ${HALEIWA_BEACH_PARK.address} (${HALEIWA_BEACH_PARK.operator}): its grassy park area is the spot for Yoga in the Park on a Saturday morning, near Haleiwa town. Name ${HALEIWA_BEACH_PARK.spot} and that address in the plan; never leave a yoga date at a generic unnamed park and never invent another park, address or town for it.`;

// ---------- Actual photographs for date plans (2026-11-03, Erin) ----------
//
// Erin's direction: a date plan's picture should be an ACTUAL
// real-life photograph of the plan's real location / stores —
// the AI-generated illustration did not fit shopping at Ala
// Moana. So date plans are actual-photo-first: when the checked
// photo registry below has real photographs for the plan's
// verified spot, those photographs are the plan's picture and
// NO generated image is made. Muse Image is only a fallback for
// a spot with no actual photo in the registry, and whichever
// kind a plan ends up with is labelled in the UI — "Actual
// photo" for a real photograph, "Generated image" for the
// fallback — so the two are never confused.
//
// The registry holds KEYS only; the client maps each key to the
// bundled real photograph (client/src/assets/actual-*.jpg,
// sourced and verified at build time — see DATA-PLAN.md for the
// source of each photograph). Keys:
//   ala-moana-center    — Ala Moana Center, 1450 Ala Moana Blvd
//   lululemon-honolulu  — a Lululemon storefront in Honolulu
//   sephora-interior    — inside a Sephora store in Honolulu
//   lululemon-waikiki   — Lululemon, Waikiki (Kalakaua Avenue)
//   sephora-waikiki     — Sephora, Waikiki (Kalakaua Avenue)
//   haleiwa-beach-park       — Haleiwa Beach Park, Haleiwa
//     (grassy park area by the ocean, pillars and palms)
//   haleiwa-beach-park-grass — Haleiwa Beach Park, Haleiwa
//     (the park's pillar walkway and lawn)
// The actual photographs for one date, from its CHECKED spot
// (checkedPlanInputs output — a Lululemon / Sephora date is
// already resolved to Waikiki / Kalakaua Avenue or Ala Moana
// Center before this runs) and its List item + cover text.
// Returns null when the registry has no actual photo for this
// spot — the caller then falls back to a generated image.
function actualPhotoKeysForDate(
  checkedSpot: string,
  hay: string,
  planText = "",
): string[] | null {
  const spot = checkedSpot.trim();
  // Haleiwa Beach Park (Erin, 2026-11-03): a yoga date checked
  // to this park (verifiedPlanSpot) — or a plan text that names
  // it — gets the park's actual photographs, so Leilani's Yoga
  // date reads "actual" like the shopping dates, never
  // generated.
  if (
    spot === HALEIWA_BEACH_PARK.spot ||
    (/yoga/i.test(hay) && /haleiwa beach park/i.test(planText))
  ) {
    return ["haleiwa-beach-park", "haleiwa-beach-park-grass"];
  }
  const hasLulu = /lululemon/i.test(hay);
  const hasSephora = /sephora/i.test(hay);
  if (hasLulu || hasSephora) {
    // A plan that names Ala Moana Center as its shopping
    // location (Koa's Lululemon date) gets the Ala Moana
    // photographs even when no spot was saved on the date —
    // the photo must match the place the plan actually names.
    if (spot === "Ala Moana Center" || /ala moana/i.test(planText)) {
      const keys = ["ala-moana-center"];
      if (hasLulu) keys.push("lululemon-honolulu");
      if (hasSephora) keys.push("sephora-interior");
      return keys;
    }
    // Waikiki / Kalakaua Avenue — the only other verified home
    // for these stores (checkedPlanInputs guarantees one of the
    // two spots for a Lululemon / Sephora date).
    const keys: string[] = [];
    if (hasLulu) keys.push("lululemon-waikiki");
    if (hasSephora) keys.push("sephora-waikiki");
    return keys.length > 0 ? keys : null;
  }
  if (spot === "Ala Moana Center") return ["ala-moana-center"];
  return null;
}

// Towns / areas where a registered business does NOT exist and
// must never be placed. Hale'iwa / the North Shore is the named
// case for Lululemon and Sephora; the check is written generally
// so any registered business paired with any other town in a plan
// (outside its verified areas) also fails.
const LULU_SEPHORA_VERIFIED_LINE =
  "Verified locations for this date — Lululemon: 2270 Kalakaua Ave, Honolulu (Waikiki / Kalakaua Avenue) and Ala Moana Center, 1450 Ala Moana Blvd, Honolulu. Sephora: 2250 Kalakaua Ave, Honolulu (Waikiki / Kalakaua Avenue) and Ala Moana Center, 1450 Ala Moana Blvd, Honolulu. Shop Waikiki / Kalakaua Avenue (or Ala Moana Center) for this date. There is no Lululemon and no Sephora in Hale'iwa or anywhere on the North Shore — never place either store there." +
  " Mall directory at Ala Moana Center: Lululemon is on Level 2, near the Ewa Wing, between Uniqlo and Coach — Ala Moana Center, 1450 Ala Moana Blvd, Honolulu, phone (808) 818-8817. For a Lululemon date at Ala Moana Center, name that Level 2 Ewa Wing spot in the plan; never put Lululemon on another floor or in another wing of the mall, and never invent a floor, wing or phone for any store.";

const VERIFIED_SNORKELING_LINE =
  "Verified snorkeling locations on O'ahu — use only one of these real spots for a snorkeling date: Snorkeling — Hanauma Bay, Hawaii Kai; Snorkeling — Shark's Cove, North Shore; Snorkeling — Waikiki Turtle Canyon; Snorkeling — Kaneohe Bay Sandbar; Snorkeling — Kahe Point / Electric Beach, Kapolei; Snorkeling — Sans Souci / Queen's Beach, Waikiki. Never move one of these spots to a different town or invent another snorkeling spot.";

const VERIFIED_SURF_LINE =
  "Verified surf locations on O'ahu — use only real surf spots from the app's list: Pipeline / Ehukai Beach Park, Sunset Beach, Waimea Bay, Waikiki (Queens & Canoes), Ala Moana Bowls, Puaena Point, Sharks Cove. Never invent a surf break or move one to a different town.";

const VERIFIED_HAIR_SALON_LINE =
  "Hair salon: no salon name or street address is in the app's verified location registry, so do not invent one and do not name a salon in a town where it is not listed. Plan it as a salon appointment in the Honolulu / Waikiki–Ala Moana area or at the salon the person already uses, named only that way.";

const VERIFIED_LOCATION_RULE_LINES = [
  "REAL LOCATION CHECK — MANDATORY, and this plan is checked against it before it is shown: name only real O'ahu locations from the app's spot list and the verified location registry given below. Never invent a store, spot, address, or activity in a town where it does not exist, and never move a real store or spot to a different town. If a business or activity is not in the verified registry, do not state a store location or address for it at all — meet at a real spot from the allowed list instead.",
  `Verified business locations (the ONLY places these stores may be named): ${VERIFIED_BUSINESS_LOCATIONS.map((v) => `${v.business} — ${v.address} (${v.area})${v.directory ? `; mall directory: ${v.directory}` : ""}${v.phone ? `; phone ${v.phone}` : ""}`).join("; ")}. Lululemon and Sephora are NOT in Hale'iwa and NOT anywhere on the North Shore.`,
  VERIFIED_SNORKELING_LINE,
  VERIFIED_SURF_LINE,
];

// The verified-location line that applies to one date, from its
// List item + cover text (idea, covering Provide title / note,
// both Provide lists). "" when no registered business or checked
// activity is involved — the general rule lines still apply.
function verifiedLocationLineForDate(hay: string): string {
  const lines: string[] = [];
  if (/lululemon|sephora/i.test(hay)) lines.push(LULU_SEPHORA_VERIFIED_LINE);
  if (/yoga/i.test(hay)) lines.push(VERIFIED_YOGA_LINE);
  if (/snorkel/i.test(hay)) lines.push(VERIFIED_SNORKELING_LINE);
  if (/\bsurf/i.test(hay)) lines.push(VERIFIED_SURF_LINE);
  if (/hair salon|hair done|haircut/i.test(hay)) lines.push(VERIFIED_HAIR_SALON_LINE);
  return lines.join(" ");
}

// The spot a plan for this date may actually use, after the
// verified-location check: a Lululemon / Sephora shopping date
// is ALWAYS planned at Waikiki / Kalakaua Avenue (or Ala Moana
// Center when that is the spot already saved) — never at
// Hale'iwa or any other town, whatever spot was saved for the
// date. Other dates keep their (already gated) spot.
function verifiedPlanSpot(
  spot: string,
  hay: string,
): { spot: string; overridden: boolean } {
  const s = spot.trim();
  // Yoga (Erin, 2026-11-03): a yoga date with a generic, empty
  // or Hale'iwa / North Shore saved spot is planned at the
  // verified real park — Haleiwa Beach Park (City and County
  // of Honolulu). A yoga date with a different specific real
  // spot already saved keeps that spot.
  if (/yoga/i.test(hay)) {
    if (s === HALEIWA_BEACH_PARK.spot) return { spot: s, overridden: false };
    if (
      s === "" ||
      s === "Yoga in the Park" ||
      /hale'?iwa|north shore/i.test(s)
    ) {
      return { spot: HALEIWA_BEACH_PARK.spot, overridden: s !== HALEIWA_BEACH_PARK.spot };
    }
    return { spot, overridden: false };
  }
  if (!/lululemon|sephora/i.test(hay)) return { spot, overridden: false };
  if (s === "Ala Moana Center") return { spot: s, overridden: false };
  if (s === "Kalakaua Avenue — Waikiki") return { spot: s, overridden: false };
  return { spot: "Kalakaua Avenue — Waikiki", overridden: s !== "" };
}

// gatedPlanInputs + the verified-location override, in one
// place, so generateDatePlan, its signature builder, the
// stale-plan purge and the comparison all plan around the exact
// same checked spot and note. When the saved spot is overridden
// the note tells the writer why and forbids the wrong town.
function checkedPlanInputs(
  spot: string,
  note: string,
  myAge: number | null | undefined,
  personAge: number | null | undefined,
  hay: string,
): { spot: string; note: string; blocked: boolean; overridden: boolean } {
  const gated = gatedPlanInputs(spot, note, myAge, personAge);
  const verified = verifiedPlanSpot(gated.spot, hay);
  if (!verified.overridden) {
    return { ...gated, overridden: false };
  }
  if (verified.spot === HALEIWA_BEACH_PARK.spot) {
    return {
      spot: verified.spot,
      blocked: gated.blocked,
      overridden: true,
      note: `${gated.note} Real location check: this yoga date is planned at ${HALEIWA_BEACH_PARK.spot}, ${HALEIWA_BEACH_PARK.address} (${HALEIWA_BEACH_PARK.operator}) — the real City and County of Honolulu park near Haleiwa town with a grassy park area for Yoga in the Park on a Saturday morning — not at a generic unnamed park${gated.spot ? ` (the spot first saved for it was "${gated.spot}")` : ""}. Name ${HALEIWA_BEACH_PARK.spot} and its address as the meetup spot.`.trim(),
    };
  }
  return {
    spot: verified.spot,
    blocked: gated.blocked,
    overridden: true,
    note: `${gated.note} Real location check: this shopping date is planned at ${verified.spot}, not at the spot first saved for it (${gated.spot}) — Lululemon and Sephora are verified only in Waikiki / Kalakaua Avenue and at Ala Moana Center in Honolulu, and there is no Lululemon or Sephora in Hale'iwa or on the North Shore, so do not name the saved spot as the shopping location.`.trim(),
  };
}

// Does a piece of plan text mention a verified area for the
// Lululemon / Sephora date? Waikiki, Kalakaua or Ala Moana.
function planMentionsVerifiedShoppingArea(text: string): boolean {
  return /waikiki|kalakaua|ala moana/i.test(text);
}

// The pre-show location check every generated plan must pass.
// Returns ok:false (with a plain reason, used only internally —
// a failing Meta plan is replaced by the List fallback, never
// shown and never a dead end) when the text places a registered
// business in a town where it does not exist, or when a
// Lululemon / Sephora date's plan never names its verified area.
// A clearly negated mention ("there is no Lululemon in
// Hale'iwa") is a true statement and passes.
function planLocationCheck(
  text: string,
  hay: string,
): { ok: boolean; reason: string } {
  // Removed clubs & strip clubs (2026-11-03, Erin): a plan that
  // names one — even in passing, even negated — is never shown;
  // the List fallback (which never names one) is used instead.
  // Strip clubs are not part of the nightclub experience at all.
  if (isExcludedVenue(text)) {
    return {
      ok: false,
      reason: "plan named a removed club or a strip club, which are not part of List Dating at all",
    };
  }
  const isLuluSephora = /lululemon|sephora/i.test(hay);
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s !== "");
  const wrongTowns: { keys: RegExp; label: string }[] = [
    { keys: /hale'?iwa|north shore/i, label: "Hale'iwa / the North Shore" },
  ];
  for (const sentence of sentences) {
    const low = sentence.toLowerCase();
    const negated =
      /\b(no|not|never|isn't|is not|aren't|are not|don't|doesn't)\b/.test(low);
    if (negated) continue;
    // A registered business named together with a town it is not
    // verified in — the Hale'iwa Lululemon failure, generalised:
    // any business + wrong-town pairing in one sentence fails.
    if (
      /lululemon|sephora/i.test(sentence) &&
      wrongTowns.some((t) => t.keys.test(sentence))
    ) {
      return {
        ok: false,
        reason: "plan placed Lululemon / Sephora in Hale'iwa or on the North Shore, where neither store exists",
      };
    }
    if (
      /victoria'?s secret/i.test(sentence) &&
      wrongTowns.some((t) => t.keys.test(sentence))
    ) {
      return {
        ok: false,
        reason: "plan placed a named store in Hale'iwa or on the North Shore without a verified location there",
      };
    }
    // Mall-directory accuracy (2026-11-03, Erin): Lululemon at
    // Ala Moana Center sits on Level 2 by the Ewa Wing (see the
    // verified registry) — a sentence that puts it on another
    // floor or in the Diamond Head Wing contradicts the mall
    // directory and fails, exactly like a wrong town.
    if (
      /lululemon/i.test(sentence) &&
      /ala moana/i.test(sentence) &&
      (/level\s*[134]\b/i.test(sentence) ||
        /\b(first|third|fourth)\s+floor\b/i.test(sentence) ||
        /diamond head wing/i.test(sentence))
    ) {
      return {
        ok: false,
        reason: "plan placed Lululemon at Ala Moana Center somewhere other than its mall-directory spot (Level 2, near the Ewa Wing, between Uniqlo and Coach)",
      };
    }
  }
  if (isLuluSephora && !planMentionsVerifiedShoppingArea(text)) {
    return {
      ok: false,
      reason: "Lululemon / Sephora plan never named its verified Waikiki / Kalakaua Avenue or Ala Moana Center location",
    };
  }
  // Yoga (Erin, 2026-11-03): a yoga plan must name its verified
  // real park — Haleiwa Beach Park — not a generic "Yoga in the
  // Park" near a town. A generic yoga plan is discarded for the
  // List fallback, which names the park and its address.
  if (/yoga/i.test(hay) && !/haleiwa beach park/i.test(text)) {
    return {
      ok: false,
      reason: "Yoga plan never named its verified Haleiwa Beach Park location",
    };
  }
  return { ok: true, reason: "" };
}

// ---------- 21+ gate for bars, exotic places & alcohol venues ----------
//
// Age rule (2026-11-02, Erin): List Dating membership is 18 to
// 99 — Join stays inside that range (ageField / joinDiscover
// reject ages under 18 or over 99).
// But bars, night clubs, exotic places and alcohol venues are
// 21+: a spot from the app's 21+ spot collections (Nightlife —
// Nightclubs & Dance Clubs, Nightlife — Speakeasies & Hidden
// Bars, Pole Dancing) may only be a DATE spot when BOTH people
// on that date are 21 or older. If either age is under 21 or NOT
// on record (unknown counts as not 21 — an age is never
// invented), the spot is blocked and a non-bar alternative is
// named instead. Enforced here in proposeDate; generateDatePlan
// / compareDatePlan write around a non-bar spot for a blocked
// pair, and ALLOWED_OAHU_SPOTS above — the only spots a plan may
// suggest — contains no 21+ spot at all.
//
// Removed clubs + strip clubs (2026-11-03, Erin): six clubs
// were removed from the app completely — they are not in the
// spot list, not in the flagged 21+ sets below, not suggested,
// and never named in a date plan. They survive ONLY in
// EXCLUDED_VENUE_KEYS further down, a blocklist (not a spot
// list, not a flag list) that rejects a spot carrying one of
// those names outright and fails any plan text that names one.
// Strip clubs are not part of the nightclub experience at all:
// there is no strip-club spot collection, no strip club is
// listed or promoted, and no plan may name or suggest one — if
// a date goes that way on the night, that is between the people
// once the date happens, outside the app.
//
// Generic nightclub option (2026-11-03, Erin): the nightclub
// spot anyone can pick, see in Matches, or list in Provides is
// GENERIC only ("A Nightclub in Honolulu" / "A Dance Club in
// Waikiki") — no specific venue shows upfront. A specific
// (non-strip) nightclub venue is revealed ONLY inside a date
// plan, when Plan the Date runs through Meta AI: the server-
// only NIGHTCLUB_REVEAL_VENUES list below is spliced into the
// plan prompt for a generic-nightclub date whose pair is both
// 21+, and nowhere else.
const AGE_21_MESSAGE = "21+ only for bars and exotic places";
const NON_BAR_ALTERNATIVE_SPOT = "Ala Moana Beach Park";

const SPOT_21PLUS_EXACT = new Set([
  // Nightlife — Nightclubs & Dance Clubs (bars / clubs, alcohol)
  "The District Nightclub — Honolulu",
  "SKY Waikiki",
  "Scarlet Honolulu — Dance Club",
  "Hula's Bar & Lei Stand — Waikiki",
  "NextDoor — Chinatown",
  "A Nightclub in Honolulu",
  "A Dance Club in Waikiki",
  "Late-Night Lounge — Waikiki",
  // Nightlife — Speakeasies & Hidden Bars (bars, alcohol)
  "Speakeasy — Chinatown, Honolulu",
  "Speakeasy — Downtown Honolulu (Hidden Entrance)",
  "Speakeasy — Waikiki (Secret Bar)",
  "Hidden Cocktail Bar — Kaka'ako, Honolulu",
  "Speakeasy Night — Honolulu (Ask for the Password)",
  // Pole Dancing — Studios & Nights (Adults Only)
  "Pole Dancing — Studio Class, Honolulu",
  "Pole Dancing — Studio Class, Waikiki / Ala Moana Area",
  "Pole Dancing — Pole Fitness Class, Honolulu",
  "Pole Dancing — Private Lesson, Honolulu",
  "Pole Dancing — Beginners Class, Honolulu",
  "Pole Dancing Night — Studio Showcase, Honolulu",
]);

const SPOT_21PLUS_NAME_KEYS = [
  "pole dancing",
  "speakeasy",
  "nightclub",
  "night club",
  "dance club",
  "cocktail bar",
  "hidden bar",
  "secret bar",
  "exotic",
  "ballerina",
];

// ---------- Removed clubs & strip clubs: excluded, not flagged ----------
//
// Erin's direction (2026-11-03): the six removed clubs and strip
// clubs in general are NOT part of List Dating — not listed, not
// flagged as 21+ spots, not suggested, and never named in a date
// plan. The keys below are a BLOCKLIST only: they never appear in
// any spot list, picker, prompt suggestion or plan; they exist so
// a saved or typed spot carrying one of those names is rejected
// outright (assertSpotAllowedForAges / assertOwnSpotAllowedForAge)
// and so a generated plan that names one fails its pre-show check
// (planLocationCheck) and is replaced by the List fallback.
const EXCLUDED_VENUE_KEYS = [
  "femme nu",
  "rock-za",
  "rockza",
  "club 939",
  "blossoms",
  "hot ash",
  "hawaii by night",
  "strip club",
  "stripclub",
  "gentlemen's club",
  "gentlemens club",
  "gentleman's club",
];

const EXCLUDED_VENUE_MESSAGE =
  "That venue is not part of List Dating — the removed clubs and strip clubs are not listed, suggested or planned here at all.";

function isExcludedVenue(text: string): boolean {
  const low = text.trim().toLowerCase();
  if (!low) return false;
  return EXCLUDED_VENUE_KEYS.some((k) => low.includes(k));
}

// ---------- Generic nightclub option: reveal only in a plan ----------
//
// The nightclub spots in the app's spot list are generic only.
// These specific non-strip nightclub venues are SERVER-ONLY: they
// are never a spot-list entry, never shown in Matches, never part
// of a Provide, and never named in a match note. The date-plan
// prompt for a generic-nightclub date (both people 21+) may
// reveal ONE of them inside the plan itself — that reveal, via
// Plan the Date's Meta AI call, is the only place a specific
// nightclub venue ever appears.
const GENERIC_NIGHTCLUB_SPOTS = new Set([
  "A Nightclub in Honolulu",
  "A Dance Club in Waikiki",
]);

const NIGHTCLUB_REVEAL_VENUES = [
  "The District Nightclub — Honolulu",
  "SKY Waikiki",
  "Scarlet Honolulu — Dance Club",
  "NextDoor — Chinatown",
];

// Specific nightclub venues whose name must never show upfront
// (Matches, a member's usual spot, a match note): they read as
// the generic nightclub option until a date plan reveals one.
const SPECIFIC_NIGHTCLUB_SPOTS = new Set([
  ...NIGHTCLUB_REVEAL_VENUES,
  "Hula's Bar & Lei Stand — Waikiki",
]);

// The spot label the rest of the app may see: a specific
// nightclub venue becomes the generic nightclub option.
function publicSpotLabel(spot: string): string {
  const s = spot.trim();
  return SPECIFIC_NIGHTCLUB_SPOTS.has(s) ? "A Nightclub in Honolulu" : s;
}

function is21PlusSpot(spot: string): boolean {
  const s = spot.trim();
  if (!s) return false;
  if (SPOT_21PLUS_EXACT.has(s)) return true;
  const low = s.toLowerCase();
  if (SPOT_21PLUS_NAME_KEYS.some((k) => low.includes(k))) return true;
  // Any other spot that names a bar is an alcohol venue too.
  if (/\bbar\b/.test(low)) return true;
  return false;
}

function bothAges21Plus(
  a: number | null | undefined,
  b: number | null | undefined,
): boolean {
  return (
    a !== null && a !== undefined && a >= 21 &&
    b !== null && b !== undefined && b >= 21
  );
}

// The spot a date plan may actually use: a blocked 21+ spot is
// swapped for the non-bar alternative so a plan never suggests a
// bar / exotic / alcohol venue to a pair that is not both 21+.
function gatedDateSpot(
  spot: string,
  myAge: number | null | undefined,
  personAge: number | null | undefined,
): { spot: string; blocked: boolean } {
  if (is21PlusSpot(spot) && !bothAges21Plus(myAge, personAge)) {
    return { spot: NON_BAR_ALTERNATIVE_SPOT, blocked: true };
  }
  return { spot, blocked: false };
}

// The exact spot + note a date plan is written from, after the
// gate: blocked → the non-bar alternative spot, and a note that
// tells the writer why and forbids naming the 21+ spot. Shared by
// generateDatePlan, its signature builder, the stale-plan purge
// and the Spark vs Wonder comparison, so all four always agree.
function gatedPlanInputs(
  spot: string,
  note: string,
  myAge: number | null | undefined,
  personAge: number | null | undefined,
): { spot: string; note: string; blocked: boolean } {
  // Excluded venues (removed clubs / strip clubs) are never a
  // plan spot at any age: the plan is written around the non-bar
  // alternative and the writer is told not to name the venue.
  if (isExcludedVenue(spot)) {
    return {
      spot: NON_BAR_ALTERNATIVE_SPOT,
      blocked: true,
      note: `${note} ${EXCLUDED_VENUE_MESSAGE} The spot first saved for this date was one of those venues, so meet at ${NON_BAR_ALTERNATIVE_SPOT} instead — do not name or suggest the saved venue.`.trim(),
    };
  }
  const gated = gatedDateSpot(spot, myAge, personAge);
  if (!gated.blocked) return { spot, note, blocked: false };
  return {
    spot: gated.spot,
    blocked: true,
    note: `${note} ${AGE_21_MESSAGE}: the spot first saved for this date is a bar, exotic or alcohol venue and both people are not 21 or older on record, so meet at ${NON_BAR_ALTERNATIVE_SPOT} instead — do not name or suggest the bar / exotic spot.`.trim(),
  };
}

// A person's OWN usual spot follows the same rule as a date
// spot: a bar / night club / exotic / alcohol spot can only be
// saved as someone's spot when their own recorded age is 21 or
// older — tapping "show" in the picker never overrides the age
// on record, and an unknown age counts as not 21.
function assertOwnSpotAllowedForAge(
  spot: string,
  age: number | null | undefined,
): void {
  if (isExcludedVenue(spot)) {
    throw new Error(
      `${EXCLUDED_VENUE_MESSAGE} Pick a different spot instead: ${NON_BAR_ALTERNATIVE_SPOT}.`,
    );
  }
  if (!is21PlusSpot(spot)) return;
  if (age !== null && age !== undefined && age >= 21) return;
  throw new Error(
    `${AGE_21_MESSAGE} — that spot is a bar, night club, exotic or alcohol venue, and it can only be saved as someone's spot when their age on record is 21 or older (${age === null || age === undefined ? "no age is on record" : "the age on record is under 21"}). Pick a non-bar spot instead: ${NON_BAR_ALTERNATIVE_SPOT}.`,
  );
}

function assertSpotAllowedForAges(
  spot: string,
  myAge: number | null | undefined,
  personAge: number | null | undefined,
  personName: string,
): void {
  if (isExcludedVenue(spot)) {
    throw new Error(
      `${EXCLUDED_VENUE_MESSAGE} Try a different spot instead: ${NON_BAR_ALTERNATIVE_SPOT}.`,
    );
  }
  if (!is21PlusSpot(spot) || bothAges21Plus(myAge, personAge)) return;
  const reasons: string[] = [];
  if (myAge === null || myAge === undefined) {
    reasons.push("your age isn't on record");
  } else if (myAge < 21) {
    reasons.push("you are under 21");
  }
  if (personAge === null || personAge === undefined) {
    reasons.push(`${personName}'s age isn't on record`);
  } else if (personAge < 21) {
    reasons.push(`${personName} is under 21`);
  }
  throw new Error(
    `${AGE_21_MESSAGE} — both people on a date need to be 21 or older for a bar, night club, exotic or alcohol spot (${reasons.join(" and ")}). Try a non-bar spot instead: ${NON_BAR_ALTERNATIVE_SPOT}.`,
  );
}

const LOCAL_CONCIERGE_LINES = [
  "Write like a North Shore local concierge who actually lives this island — not a generic restaurant picker, not a tourist brochure.",
  "The List IS the date: plan around the real List item and what each person Provides. Never default to coffee, small talk, or a standard dinner date. The guiding line is: Not coffee. Not small talk. Something real.",
  "Time and traffic matter on O'ahu: use the day, time, both people's locations, and their stated availability below. Never suggest a weekday commute that forces either person into bumper-to-bumper traffic on the H-1 or Farrington Highway at rush hour. Prefer a spot near where the two people already are, or a sensible North Shore / nearby meeting point between them; for a weekday late afternoon, keep it local for pau hana near their side of the island instead of sending anyone across the island.",
  "Match the lifestyle in the List / Provide facts: if the match is about morning fitness — surf, yoga, running, training, a hike, swimming — plan it in the morning: a Dawn Patrol surf session, or a pillbox hike while it is cool, followed by acai bowls — not a dinner. If it is about music, art, the ocean, or a task one person Provides, build the whole plan around doing that real thing together.",
  "Use local framing naturally, the way locals talk: Town versus the Windward side versus the North Shore, pau hana vibes after work, local food trucks over corporate chain restaurants. Keep it natural — a phrase or two, not a costume.",
  "Give it a LIGHT Hawai'i Creole (pidgin) flavour: sprinkle just a few natural local words here and there across the whole piece — Aloha, mahalo, howzit, brah, pau hana, talk story, da kine, grindz, shoots. A few words total, never full pidgin and never a sentence a visitor could not follow — every word must stay clear to judges and newcomers alike.",
  `Name only real O'ahu spots from this list, or the spot already given for the date: ${ALLOWED_OAHU_SPOTS.join(", ")}. Never invent a spot, an address, or a business and present it as a fact. If no spot from the list fits, say to pick a spot together near where they are instead of inventing one. Generic island foods and activities (acai bowls, a local food truck, a pillbox hike, Dawn Patrol) are fine as activities — just do not attach an invented business name or address to them. A named STORE is stricter still: a store may only be placed at its verified location in the registry below (Lululemon and Sephora are in Waikiki / Kalakaua Avenue and at Ala Moana Center in Honolulu — there is no Lululemon and no Sephora in Hale'iwa or anywhere on the North Shore, and a plan must never put one there).`,
];

type MatchFacts = {
  myName: string;
  personName: string;
  myGender: string;
  personGender: string;
  // Where each person is based and when they said they are free —
  // stated on their profiles, "" when not stated. The concierge
  // prompt uses them for time-and-traffic sense; never invented.
  myLocation: string;
  personLocation: string;
  myAvailableTimes: string;
  personAvailableTimes: string;
  personSpot: string;
  matchPercent: number | null;
  // Simple List calculation facts: my Wants this member's
  // Provides cover, and my Wants nobody covers yet. Traits /
  // qualities never enter the score or the note's reasoning.
  coveredWants: string[];
  uncoveredWants: string[];
  dealbreakersHit: string[];
  sameSpot: boolean;
  // Two-sided Provide facts: Needs of mine they cover, and wishlist
  // needs of theirs that my Provides cover — each with the budget.
  coversMyNeeds: string[];
  iCoverTheirs: string[];
};

function fallbackMatchNote(f: MatchFacts): string {
  const me = f.myName || "You";
  if (f.matchPercent === null) {
    return `${me} and ${f.personName} can't be scored yet — add your Wants to your List (flat, 3 max) and the note writes itself from what their Provides cover.`;
  }
  const parts: string[] = [];
  parts.push(
    `${f.personName} matches ${f.matchPercent}% on the List between you — Wants covered by Provides, counted either way: theirs covering ${me === "You" ? "yours" : `${me}'s`}, or ${me === "You" ? "yours" : `${me}'s`} covering theirs.`,
  );
  if (f.uncoveredWants.length > 0 && f.coveredWants.length > 0) {
    parts.push(
      `Not covered yet: ${f.uncoveredWants.join(", ")}.`,
    );
  }
  if (f.sameSpot) {
    parts.push(
      `And you're both hyped at the same spot right now — the fastest route from a note to a meetup.`,
    );
  } else if (f.myLocation.trim() && f.personLocation.trim()) {
    parts.push(
      `You're based around ${f.myLocation.trim()} and ${f.personName} around ${f.personLocation.trim()} — keep a first meet close to home or sensibly in between, not a rush-hour run across the island.`,
    );
  }
  if (f.coversMyNeeds.length > 0) {
    parts.push(
      `On the two-sided List, ${f.personName} can provide cover for ${f.coversMyNeeds.length === 1 ? "one of your Wants" : `${f.coversMyNeeds.length} of your Wants`}: ${f.coversMyNeeds.join("; ")}.`,
    );
  }
  if (f.iCoverTheirs.length > 0) {
    parts.push(
      `And you can provide for ${f.personName} in return: ${f.iCoverTheirs.join("; ")} — a Need on their side met by cover on yours.`,
    );
  }
  if (f.dealbreakersHit.length > 0) {
    parts.push(
      `Caution — ${f.personName}'s own List has a dealbreaker that crosses yours: ${f.dealbreakersHit.join(", ")}. It is theirs, and that warning stands no matter the score.`,
    );
  }
  parts.push(`Aloha — that's the match, plain and simple.`);
  return parts.join(" ");
}

function fallbackDatePlan(args: {
  myName: string;
  personName: string;
  ideaText: string;
  spot: string;
  note: string;
  meetAt: Date | null;
  myLocation?: string;
  personLocation?: string;
  // The cover on this date, caps + Provide note included (e.g.
  // Alex's Lululemon shopping up to $200 with its Sephora bonus
  // up to $100) — named in the plan whoever wrote it.
  coverDetailLine?: string;
  // Directed meetup options for this date (e.g. Alex's Tesla
  // pickup or meeting at Waikiki) — named in the plan whoever
  // wrote it.
  meetupLine?: string;
}): string {
  const where = args.spot.trim() || "a spot you both pick together near where you both are";
  const when = args.meetAt ? hawaiiLongDateTime(args.meetAt) : null;
  const lines = [
    `Howzit — the plan: ${args.ideaText}, with ${args.personName}.`,
    `Not coffee. Not small talk. Something real — the List item is the whole date.`,
    when
      ? `When: ${when}. Meet at ${where}. Show up, do it together, and let that be the adventure — no long planning thread first.`
      : `Meet at ${where}. Show up, do it together, and let that be the adventure — no long planning thread first.`,
  ];
  if (args.coverDetailLine && args.coverDetailLine.trim()) {
    lines.push(args.coverDetailLine.trim());
  }
  // Real-location line (Erin, 2026-11-03): the fallback is
  // written from the same verified registry as the Meta prompt,
  // so a Lululemon / Sephora date names its real Waikiki /
  // Kalakaua Avenue (or Ala Moana Center) locations, a
  // snorkeling date names only real snorkeling spots, and no
  // fallback ever places a store in Hale'iwa.
  const verifiedLine = verifiedLocationLineForDate(
    `${args.ideaText} ${args.coverDetailLine ?? ""}`,
  );
  if (verifiedLine) {
    lines.push(verifiedLine);
  }
  if (args.meetupLine && args.meetupLine.trim()) {
    lines.push(args.meetupLine.trim());
  }
  // Morning-fitness List items get a morning plan, not a dinner.
  if (
    /\b(surf|yoga|run|running|hike|hiking|training|workout|fitness|swim|pillbox|dawn patrol)\b/i.test(
      args.ideaText,
    )
  ) {
    lines.push(
      `Morning fits this one: start early — Dawn Patrol or a pillbox hike while it is cool — then acai bowls after, instead of turning it into a dinner.`,
    );
  }
  // Weekday plans keep the drive short — no cross-island rush hour.
  if (args.meetAt) {
    const weekday = args.meetAt.toLocaleString("en-US", {
      timeZone: HAWAII_TZ,
      weekday: "long",
    });
    if (!["Saturday", "Sunday"].includes(weekday)) {
      const near =
        args.myLocation?.trim() || args.personLocation?.trim()
          ? ` Keep it near ${[args.myLocation?.trim(), args.personLocation?.trim()].filter(Boolean).join(" / ")} or sensibly in between.`
          : "";
      lines.push(
        `Weekday note: keep the drive short — no cross-island run that puts either of you in bumper-to-bumper traffic on the H-1 or Farrington Highway at rush hour.${near}`,
      );
    }
  }
  lines.push(
    when
      ? `Confirm it in Chat (the "Confirm the meetup" button does it in one tap), then use "On my way" and "I'm here" as you go.`
      : `Agree the day and time in Chat (the "Confirm the meetup" button does it in one tap), then use "On my way" and "I'm here" as you go.`,
    `The present touch: one of you brings a small sealed present tied to the item — unwrapped only once you're both there.`,
    `And if you're both hungry after, grab some local grindz nearby and talk story a little — aloha, and mahalo for doing something real.`,
  );
  if (args.note.trim()) lines.push(`Your note on this date: ${args.note.trim()}`);
  return lines.join("\n");
}

// ---------- Spark vs Wonder comparison helpers (2026-11-02) ----------
//
// The SAME prompt is sent to both models. The prompts below are
// the exact prompts generateMatchNote / generateDatePlan use, so
// the only variable in the comparison is the model itself. The
// saved key is read server-side only and never returned, logged,
// or changed by a comparison run; a comparison never writes
// people.match_note or dates.plan and never changes the Spark
// connection status — Spark stays the app's default writer.

function buildMatchNotePrompt(
  facts: MatchFacts,
  qualities: string[],
): string {
  return [
    "You are the match writer for List Dating™ (listdating.com), a members-only dating app where people match on \"The List\" — a short flat list of Wants (3 max) plus what each person can Provide. The match % is simple: the share of one person's Wants that the other person's Provides cover. The List is the whole mechanic: it scores the match and it is also the date idea.",
    `Write a short match note (2–4 sentences) explaining why ${facts.myName || "the member"} and ${facts.personName} match, addressed to ${facts.myName || "the member"} about ${facts.personName}. Warm, specific, and plain-spoken, in a luxury secret-adventure voice — no hype, no emojis, no exclamation marks. Use ONLY the facts below; do not invent anything about either person that is not listed. Reply with the note only, no preamble.`,
    ...LOCAL_CONCIERGE_LINES,
    "For a match note, let the concierge sense show in at most one short clause — where a first meet could sensibly happen or why the timing works — and only from the facts below. Keep the note about the match itself.",
    genderLine(facts.myName, facts.myGender),
    genderLine(facts.personName, facts.personGender),
    GENDER_INSTRUCTION,
    `${facts.myName || "The member"} is based around: ${facts.myLocation.trim() || "not stated"}. Times they said they are available: ${facts.myAvailableTimes.trim() || "not stated"}`,
    `${facts.personName} is based around: ${facts.personLocation.trim() || "not stated"}. Times they said they are available: ${facts.personAvailableTimes.trim() || "not stated"}`,
    `${facts.personName}'s usual spot: ${facts.personSpot.trim() || "none stated"}`,
    `Match score: ${facts.matchPercent === null ? "not scored — the List is empty" : `${facts.matchPercent}%`}`,
    `Wants on ${facts.myName || "the member"}'s List that ${facts.personName} covers with a Provide: ${facts.coveredWants.join("; ") || "none"}`,
    `Wants on ${facts.myName || "the member"}'s List not covered yet: ${facts.uncoveredWants.join("; ") || "none"}`,
    `${facts.personName}'s own dealbreakers that cross ${facts.myName || "the member"}'s List: ${facts.dealbreakersHit.join("; ") || "none"}`,
    `${facts.personName}'s qualities: ${qualities.join(", ") || "none listed"}`,
    `Wants on ${facts.myName || "the member"}'s List that ${facts.personName} can provide cover for (their Provide list, with the most they will spend): ${facts.coversMyNeeds.join("; ") || "none"}`,
    `Wishlist wants of ${facts.personName} that ${facts.myName || "the member"} can provide cover for: ${facts.iCoverTheirs.join("; ") || "none"}`,
    `Both hyped at the same spot right now: ${facts.sameSpot ? "yes" : "no"}`,
    "If one of their dealbreakers is triggered, say plainly that it is their dealbreaker crossing the other member's List — it stands no matter the score.",
  ].join("\n");
}

function buildDatePlanPrompt(args: {
  myName: string;
  personName: string;
  myGender: string;
  personGender: string;
  myLocation: string;
  personLocation: string;
  myAvailableTimes: string;
  personAvailableTimes: string;
  ideaText: string;
  spot: string;
  note: string;
  meetAt: Date | null;
  coverLine: string;
  qualities: string[];
  // Full-profile planning (Erin, 2026-11-03): both bios, both
  // people's qualities, both Want lists, and both Provide lists
  // with caps and notes — the plan is written from the whole
  // profiles, never from the List item or a bio alone.
  myBio: string;
  personBio: string;
  myQualities: string[];
  myWants: string[];
  personWants: string[];
  myProvides: string[];
  personProvides: string[];
  // Directed meetup options for this date, "" when none (e.g.
  // Alex's Lululemon date: Tesla pickup or meet at Waikiki).
  meetupLine: string;
}): string {
  return [
    "You are the date planner for List Dating™ (listdating.com), a members-only dating app where \"The List\" is the date idea: two people meet to do one thing that is on the List. The style is a luxury secret adventure built around a present — elegant, discreet, a little mysterious.",
    `Write the plan for a date between ${args.myName || "the member"} and ${args.personName}, built on their shared List item: "${args.ideaText}".`,
    ...LOCAL_CONCIERGE_LINES,
    ...VERIFIED_LOCATION_RULE_LINES,
    "Strip clubs are NOT part of the nightclub experience and are not part of List Dating at all: never name, suggest, or include a strip club or a gentlemen's club in this plan, and never name a club that is not in the app's spot list. If the night itself goes somewhere unplanned once the date happens, that is left to the people — the plan does not go there.",
    ...(GENERIC_NIGHTCLUB_SPOTS.has(args.spot.trim())
      ? [
          `Nightclub reveal — this date's spot is the generic nightclub option ("${args.spot.trim()}"): no specific venue was shown upfront in Matches or Provides, and this plan is the one place a specific venue is revealed. Reveal exactly ONE specific nightclub venue from this list in the plan: ${NIGHTCLUB_REVEAL_VENUES.join(", ")}. Name only that one venue, give no invented address for it, and do not name any other nightclub. (The generic spot reached this prompt only because both people are 21 or older on record — the 21+ gate already ran.)`,
        ]
      : []),
    ...(verifiedLocationLineForDate(
      `${args.ideaText} ${args.coverLine} ${args.myProvides.join(" ")} ${args.personProvides.join(" ")}`,
    )
      ? [
          verifiedLocationLineForDate(
            `${args.ideaText} ${args.coverLine} ${args.myProvides.join(" ")} ${args.personProvides.join(" ")}`,
          ),
        ]
      : []),
    genderLine(args.myName, args.myGender),
    genderLine(args.personName, args.personGender),
    GENDER_INSTRUCTION,
    `${args.myName || "The member"} is based around: ${args.myLocation.trim() || "not stated"}. Times they said they are available: ${args.myAvailableTimes.trim() || "not stated"}`,
    `${args.personName} is based around: ${args.personLocation.trim() || "not stated"}. Times they said they are available: ${args.personAvailableTimes.trim() || "not stated"}`,
    `Bio — ${args.myName || "The member"}: ${args.myBio.trim() || "not stated"}`,
    `Bio — ${args.personName}: ${args.personBio.trim() || "not stated"}`,
    `${args.myName || "The member"}'s qualities: ${args.myQualities.join(", ") || "none listed"}`,
    `${args.personName}'s qualities: ${args.qualities.join(", ") || "none listed"}`,
    `Spot: ${args.spot.trim() || "not chosen yet — choose one spot from the allowed O'ahu spot list above that fits the item and sits near where the two people are, or say to pick a spot together near them"}`,
    `Day and time: ${args.meetAt ? hawaiiLongDateTime(args.meetAt) : "not set yet — suggest a time of day that fits the item, their stated availability, and the traffic guidance above"}`,
    `Note attached to the date: ${args.note.trim() || "none"}`,
    `Provide cover for this item: ${args.coverLine}`,
    `${args.myName || "The member"}'s Wants (their List): ${args.myWants.join("; ") || "none"}`,
    `${args.personName}'s Wants (their List): ${args.personWants.join("; ") || "none"}`,
    `${args.myName || "The member"}'s Provides (what they can provide, with the most they will cover and their notes): ${args.myProvides.join("; ") || "none"}`,
    `${args.personName}'s Provides (what they can provide, with the most they will cover and their notes): ${args.personProvides.join("; ") || "none"}`,
    "Plan from the FULL profiles above — both bios, both Want lists and both Provide lists with their caps and notes — not from the List item alone and not from a bio alone. A note on a Provide is part of that one Provide: if a Provide's note names a bonus that comes with it on this date (for example, a Sephora bonus up to $100 noted on a Lululemon shopping Provide that covers up to $200), the plan MUST include that bonus as part of this same date, up to its stated amount — it is not a separate date and not a separate Provide.",
    ...(args.meetupLine.trim()
      ? [
          `${args.meetupLine.trim()} The plan MUST present both meetup options for the two of them to choose from.`,
        ]
      : []),
    "Solutions, not click-through (Erin, 2026-11-03): the plan itself must directly present the concrete island-based activity solution — the real Hawai'i / O'ahu activity (or activities) the two of them will actually do for this List item, with where on the island and how it flows — stated in the plan, in full. Never write a teaser, a headline, or a promise that the activity is revealed somewhere else; never make the reader click through, open, or ask to get the solution. The plan IS the solution.",
    "Give: a suggested time of day, exactly where to meet (a spot from the allowed list, or the given spot — and for a shopping date, the store's verified location from the registry above, street address included, plus its mall-directory floor and wing when the registry gives one, e.g. Lululemon at Ala Moana Center is Level 2 by the Ewa Wing), the simple flow of the date in a few short lines, what each person brings, and one small sealed-present surprise touch that fits the List item. Under 130 words, plain short lines, no emojis, no exclamation marks. Do not invent facts about the people beyond what is given. Reply with the plan only, no preamble.",
  ].join("\n");
}

// Resolve the Wonder model id for a comparison run: the exact id
// Meta's /models list returns for this key when it can be read,
// otherwise the known id. Never touches the key or any status.
async function resolveWonderModel(key: string): Promise<string> {
  try {
    const models = await metaModelsCheck(key);
    if (models.kind === "ok") {
      const found = findWonderModel(models.modelIds);
      if (found) return found;
    }
  } catch {
    // fall through to the known id
  }
  return META_WONDER_MODEL;
}

// One model call for a comparison, with the List fallback when
// that model produces nothing usable — labelled honestly via the
// returned status ("meta-ai" vs "list"), never passed off as the
// model's own words when it is the fallback.
async function callModelOrFallback(
  key: string,
  prompt: string,
  model: string,
  fallback: string,
  maxLen: number,
  // Optional extra gate on the model's text — for date plans,
  // the real-location check (planLocationCheck): a plan that
  // places a store in a town where it does not exist is never
  // used, the List fallback for that column is used instead.
  validate?: (text: string) => boolean,
): Promise<{ text: string; status: string }> {
  if (!key) return { text: fallback, status: "list" };
  try {
    const text = await metaChatCompletion(key, prompt, 1600, { model });
    if (
      text &&
      !containsBannedWording(text) &&
      (validate === undefined || validate(text))
    ) {
      return { text: text.slice(0, maxLen), status: "meta-ai" };
    }
  } catch {
    // fall through to the List fallback for this column only
  }
  return { text: fallback, status: "list" };
}

// Upsert the one comparison row for a person, preserving the
// fields the other comparison action wrote.
async function upsertComparison(
  ctx: Ctx,
  personId: number,
  personName: string,
  patch: Partial<{
    dateId: number | null;
    dateIdeaText: string;
    sparkModel: string;
    wonderModel: string;
    sparkMatchNote: string;
    wonderMatchNote: string;
    sparkMatchNoteStatus: string;
    wonderMatchNoteStatus: string;
    sparkDatePlan: string;
    wonderDatePlan: string;
    sparkDatePlanStatus: string;
    wonderDatePlanStatus: string;
  }>,
): Promise<void> {
  const db = ctx.db<typeof schema>();
  const existingRows = await db
    .select()
    .from(schema.modelComparisons)
    .where(eq(schema.modelComparisons.personId, personId));
  const existing = existingRows[0];
  const now = new Date();
  if (existing) {
    await db
      .update(schema.modelComparisons)
      .set({ ...patch, personName, updatedAt: now })
      .where(eq(schema.modelComparisons.id, existing.id));
  } else {
    await db.insert(schema.modelComparisons).values({
      personId,
      personName,
      dateId: patch.dateId ?? null,
      dateIdeaText: patch.dateIdeaText ?? "",
      sparkModel: patch.sparkModel ?? META_MODEL,
      wonderModel: patch.wonderModel ?? META_WONDER_MODEL,
      sparkMatchNote: patch.sparkMatchNote ?? "",
      wonderMatchNote: patch.wonderMatchNote ?? "",
      sparkMatchNoteStatus: patch.sparkMatchNoteStatus ?? "",
      wonderMatchNoteStatus: patch.wonderMatchNoteStatus ?? "",
      sparkDatePlan: patch.sparkDatePlan ?? "",
      wonderDatePlan: patch.wonderDatePlan ?? "",
      sparkDatePlanStatus: patch.sparkDatePlanStatus ?? "",
      wonderDatePlanStatus: patch.wonderDatePlanStatus ?? "",
      createdAt: now,
      updatedAt: now,
    });
  }
}

// ---------- Demo sample members (added 2026-11-02, on request) ----------
//
// Erin asked for 50 sample users in the live app so she can check the
// demo with a full Discover pool, and clear them when she is ready.
// Every sample is an ordinary `people` row (source "joined") whose
// name starts with SAMPLE_NAME_PREFIX and whose bio opens with the
// sample label, so no sample can be mistaken for a real member.
// seedDemoSamples adds them exactly once — it is a no-op when samples
// are already present — and clearDemoSamples removes exactly those
// rows and everything attached to them, and nothing else. Neither
// action ever touches the user's own profile row, her scored List,
// her Chat history with real members, or the saved Meta AI key.
//
// The samples carry O'ahu locations, varied ages, Provide entries and
// wishlist entries; a spread of them have Hype on at real O'ahu spots
// (names taken from the map's own spot table, so they pin on the
// Discover map). To make Matches / Potential demonstrable, the seed
// reads the user's CURRENT List at seed time: the strongest samples
// carry her own must / nice item texts as qualities (the same fuzzy
// quality match every member is scored by), a middle band carries a
// Provide written to cover one of her Needs, and a few carry one of
// her dealbreaker texts so the dealbreaker warning can be seen. No
// List item is ever created or changed for the user — if her List is
// empty, the samples still fill Discover and the map, and
// simply score as unscored like any member would.

const SAMPLE_NAME_PREFIX = "Sample — ";
const SAMPLE_BIO_LABEL =
  "Sample demo profile — not a real person, here for demo checking.";

const SAMPLE_FIRST_NAMES = [
  "Maya", "Kainoa", "Leilani", "Jordan", "Noelani",
  "Keanu", "Sofia", "Marcus", "Hina", "David",
  "Grace", "Kekoa", "Alana", "Chris", "Pua",
  "Sam", "Tiare", "Ben", "Malia", "Josh",
  "Kanoe", "Tyler", "Emma", "Ikaika", "Rose",
  "Noah", "Loke", "Ethan", "Moana", "Ryan",
  "Keala", "Lucas", "Aina", "Matt", "Healani",
  "Zoe", "Kamalei", "Luke", "Nani", "Owen",
  "Kapua", "Eli", "Ulu", "Finn", "Mahina",
  "Cole", "Anela", "Reid", "Wailani", "Jonah",
];

const SAMPLE_LAST_NAMES = [
  "Keawe", "Mahoe", "Tanaka", "Reyes", "Kamaka",
  "Silva", "Park", "Kawamoto", "Santos", "Kim",
  "Oshiro", "Nakamura", "Freitas", "Aiu", "Kanae",
  "Medeiros", "Fujita", "Delacruz", "Nguyen", "Almeida",
];

const SAMPLE_AGES = [
  29, 34, 27, 41, 25, 38, 31, 52, 24, 36,
  45, 28, 33, 57, 26, 39, 30, 47, 35, 23,
  44, 29, 53, 31, 37, 26, 49, 34, 28, 60,
  32, 40, 25, 36, 43, 27, 51, 30, 38, 24,
  46, 33, 29, 55, 35, 42, 28, 48, 31, 37,
];

// Free-text O'ahu locations — each contains one of the Discover
// island-area keywords, so every area chip has samples under it.
const SAMPLE_LOCATIONS = [
  "Haleiwa, North Shore", "Waialua, O'ahu", "Kahuku, North Shore",
  "Waikiki, Honolulu", "Manoa, Honolulu", "Kailua",
  "Kaneohe", "Lanikai, Kailua", "Mililani, Central O'ahu",
  "Pearl City", "Aiea", "Wahiawa",
  "Kapolei", "Ewa Beach", "Ko Olina, Kapolei",
  "Hawaii Kai, East O'ahu", "Waimanalo", "Laie, North Shore",
  "Downtown Honolulu", "Kahala, Honolulu",
];

// Usual spots — every one is a key in the O'ahu Hype map's spot
// table, so a sample with Hype on at one of these pins on the map.
const SAMPLE_SPOTS = [
  "Pipeline", "Sunset Beach", "Waimea Bay", "Haleiwa", "Turtle Bay",
  "Waikiki", "Kailua Beach", "Lanikai Beach", "Ala Moana Beach Park",
  "Sandy Beach", "Diamond Head", "Sharks Cove", "Ala Moana Center",
  "Kahala Mall", "Puaena Point", "Ehukai Beach Park", "Makapu'u",
  "Windward Mall", "Pearlridge Center", "Kapiolani Park",
];

const SAMPLE_HYPE_MODES = [
  "Say hi in person",
  "Fulfill something on the List together",
  "Meet to accomplish something real",
  "An hour of company & conversation",
  "Beauty, grooming & getting ready",
  "Help with a task — car, phone or home",
  "Photos — help me capture the moment",
  "Yoga, hike or wellness together",
];

const SAMPLE_TIMES = [
  "Weekday evenings", "Saturday mornings", "Weekends",
  "Sunday afternoons", "Weekday mornings before work",
  "Friday evenings & weekends", "Most afternoons", "Evenings after 5",
];

const SAMPLE_BIO_LINES = [
  "Happy to help with what's on your List.",
  "Here for real plans, not small talk.",
  "Put it on the List and let's make it happen.",
  "Good company and useful skills, in that order.",
  "Around most weekends — say the word.",
  "I like meeting around something real to do.",
  "Tell me what you need; I might be the cover for it.",
  "Easygoing, on time, and up for the plan.",
];

// Generic quality tags for the samples that are not tailored to the
// user's own List items.
const SAMPLE_QUALITY_POOL = [
  "Windshield wipers", "Oil change", "Hair styling", "Makeup artist",
  "Phone screen repair", "Yoga instructor", "Hiking buddy",
  "Great cook", "Handyman", "Surf instructor", "Photographer",
  "Massage therapist", "Dog sitter", "Airport rides", "Interview prep",
  "Tutoring", "House cleaning", "Personal trainer", "Guitar player",
  "Mechanic", "Plumber", "Gardener", "Baker", "Dog walker",
  "Swim coach", "Dance teacher", "Ukulele teacher", "Car detailing",
  "Babysitter", "Electrician",
];

type SampleProvide = {
  category: string;
  title: string;
  maxSpendCents: number;
  note: string;
};

const SAMPLE_PROVIDE_POOL: SampleProvide[] = [
  { category: "Car & Mechanical", title: "Windshield wipers — buy & fit", maxSpendCents: 10000, note: "Parts store run included." },
  { category: "Car & Mechanical", title: "Oil change & fluids top-up", maxSpendCents: 12000, note: "I bring the tools." },
  { category: "Car & Mechanical", title: "Battery jump or replacement run", maxSpendCents: 9000, note: "Fast if you're stuck nearby." },
  { category: "Beauty & Grooming", title: "Hair styling — wash, cut & blow dry", maxSpendCents: 8000, note: "Salon-trained, gentle hands." },
  { category: "Beauty & Grooming", title: "Makeup for an event", maxSpendCents: 7500, note: "Natural glow or full glam." },
  { category: "Beauty & Grooming", title: "Manicure & pedicure treat", maxSpendCents: 6500, note: "My treat at a salon near you." },
  { category: "Tech & Phone Help", title: "Phone screen replacement run", maxSpendCents: 18000, note: "I know a good repair shop." },
  { category: "Tech & Phone Help", title: "New phone setup & transfer", maxSpendCents: 6000, note: "Photos, contacts, everything moved." },
  { category: "Tech & Phone Help", title: "Wi-Fi & laptop tune-up", maxSpendCents: 8000, note: "Patient with tech questions." },
  { category: "Home & Handy", title: "Hang shelves & assemble furniture", maxSpendCents: 12000, note: "Level, drill and anchors included." },
  { category: "Home & Handy", title: "Small repairs around the house", maxSpendCents: 15000, note: "Leaks, doors, squeaks — bring a list." },
  { category: "Food & Cooking", title: "Home-cooked dinner for two", maxSpendCents: 9000, note: "Tell me your dietary limits." },
  { category: "Food & Cooking", title: "Weekly meal prep", maxSpendCents: 14000, note: "Five lunches, ready to grab." },
  { category: "Food & Cooking", title: "Grocery run & stock-up", maxSpendCents: 10000, note: "Send me your grocery list." },
  { category: "Fitness & Outdoors", title: "Sunrise hike buddy & guide", maxSpendCents: 4000, note: "Easy pace, good conversation." },
  { category: "Fitness & Outdoors", title: "Personal training session", maxSpendCents: 7000, note: "First session is on me." },
  { category: "Fitness & Outdoors", title: "Beginner surf lesson", maxSpendCents: 11000, note: "Board and patience provided." },
  { category: "Fitness & Outdoors", title: "Yoga session in the park", maxSpendCents: 5000, note: "Sunset sessions are my favourite." },
  { category: "Creative & Photos", title: "Photos for your profile", maxSpendCents: 12000, note: "Golden hour shoots." },
  { category: "Creative & Photos", title: "Beach photo session", maxSpendCents: 15000, note: "You keep every shot." },
  { category: "Rides & Errands", title: "Airport pickup or drop-off", maxSpendCents: 6000, note: "Room for bags and boards." },
  { category: "Rides & Errands", title: "Errand runs around town", maxSpendCents: 5000, note: "Two stops included." },
  { category: "Company & Conversation", title: "An hour of company & conversation", maxSpendCents: 4000, note: "Coffee's on me." },
  { category: "Company & Conversation", title: "Walk & talk along the beach", maxSpendCents: 3000, note: "Slow pace, real talk." },
  { category: "Health & Wellness", title: "Massage therapy session", maxSpendCents: 9500, note: "Licensed and local." },
  { category: "Health & Wellness", title: "Ride to an appointment", maxSpendCents: 4500, note: "I'll wait with you." },
  { category: "Home Cleaning & Organizing", title: "Deep clean — kitchen & bath", maxSpendCents: 13000, note: "I bring the supplies." },
  { category: "Home Cleaning & Organizing", title: "Closet organising session", maxSpendCents: 8500, note: "Keep, donate, breathe." },
  { category: "Money & Treats", title: "Treat to something on your wishlist", maxSpendCents: 10000, note: "Pick one thing — it's yours." },
  { category: "Money & Treats", title: "Flowers & a present run", maxSpendCents: 7500, note: "Wrapped and delivered by me." },
];

type SampleWish = { title: string; occasion: string; priceNote: string };

const SAMPLE_WISHLIST_POOL: SampleWish[] = [
  { title: "Beach towel set", occasion: "Just because", priceNote: "about $35" },
  { title: "Ukulele strings & tuner", occasion: "Hobby", priceNote: "about $25" },
  { title: "Sunscreen & aloe pack", occasion: "Beach days", priceNote: "about $20" },
  { title: "New running shoes", occasion: "Birthday", priceNote: "about $120" },
  { title: "Hairdressing voucher", occasion: "Glow-up", priceNote: "about $80" },
  { title: "Car detail", occasion: "Thank you", priceNote: "about $150" },
  { title: "Dinner treat in Haleiwa", occasion: "Date night", priceNote: "about $90" },
  { title: "Surf wax & leash", occasion: "Beach days", priceNote: "about $30" },
  { title: "Yoga mat", occasion: "Wellness", priceNote: "about $45" },
  { title: "Phone case & screen protector", occasion: "Just because", priceNote: "about $40" },
  { title: "Massage session", occasion: "Wellness", priceNote: "about $95" },
  { title: "Concert ticket", occasion: "Birthday", priceNote: "about $110" },
  { title: "Baking supplies", occasion: "Hobby", priceNote: "about $35" },
  { title: "Garden tools", occasion: "Home", priceNote: "about $60" },
  { title: "Bookshop gift card", occasion: "Just because", priceNote: "about $50" },
];

function cycle<T>(arr: readonly T[], i: number, fallback: T): T {
  if (arr.length === 0) return fallback;
  const idx = ((i % arr.length) + arr.length) % arr.length;
  return arr[idx] ?? fallback;
}

// The Provide category whose keywords best match a Need text — the
// same keyword table provideCoversText matches with — so a tailored
// sample Provide reads naturally and genuinely covers the Need.
function sampleCategoryForNeed(needText: string): string {
  const need = norm(needText);
  let best = "Other";
  let bestHits = 0;
  for (const [category, keywords] of Object.entries(PROVIDE_CATEGORY_KEYWORDS)) {
    const hits = keywords.filter((k) => need.includes(k)).length;
    if (hits > bestHits) {
      bestHits = hits;
      best = category;
    }
  }
  return best;
}

const seedDemoResponse = z.object({
  ok: z.literal(true),
  alreadySeeded: z.boolean(),
  people: z.number(),
  provides: z.number(),
  wishlistItems: z.number(),
  hypeLive: z.number(),
});
type SeedDemoResult = z.infer<typeof seedDemoResponse>;

const clearDemoResponse = z.object({
  ok: z.literal(true),
  removed: z.number(),
});
type ClearDemoResult = z.infer<typeof clearDemoResponse>;

// ---------- Small Sample/Test set (added 2026-11-02, on request) ----------
//
// Erin asked for a SMALL test set left in the live app so she can
// look at the corrected app (dark clean look, bottom menu,
// Matches-only tabs) with matching actually demonstrable: one Match
// (50%+), one Potential (could fulfill a List item), one
// dealbreaker hit, and one accepted date that gets a real-life
// thing accomplished from her List — a real List item, with day
// and time set — not coffee or small talk. Only four people, every
// one clearly labelled: names start with TEST_NAME_PREFIX and bios
// open with the test label, so none can be mistaken for a real
// member. seedTestSet runs once (a no-op when the test set is
// already present) and never touches the user's profile row, her
// List, or her saved Meta AI key — it only READS her current scored
// List to tailor the test members, exactly like seedDemoSamples.
// Explicit person_checks pin the outcomes (present on every scored
// item for the Match, absent everywhere for the Potential — whose
// Potential status comes from a Provide covering one of her Needs —
// and present on a dealbreaker item for the dealbreaker hit), so
// the test shows correctly whatever her List currently holds.

const TEST_NAME_PREFIX = "Test — ";
const TEST_BIO_LABEL =
  "Test profile — Sample/Test, not a real person, here so Erin can check matching.";
const TEST_MATCH_NAME = "Test — Maya Match";
const TEST_POTENTIAL_NAME = "Test — Koa Cover";
const TEST_DEALBREAKER_NAME = "Test — Dan Dealbreaker";
const TEST_SECOND_NAME = "Test — Leila List";

const seedTestResponse = z.object({
  ok: z.literal(true),
  alreadySeeded: z.boolean(),
  people: z.number(),
  provides: z.number(),
  wishlistItems: z.number(),
  dates: z.number(),
  matchName: z.string(),
  potentialName: z.string(),
  dealbreakerName: z.string(),
  dateItemText: z.string(),
});
type SeedTestResult = z.infer<typeof seedTestResponse>;

// ---------- Core 4 demo storyline (added 2026-11-02, Erin's direction) ----------
//
// The demo cast is FOUR people with a storyline, and nobody else:
// Erin (her own profile — never read for writing, never touched)
// plus three labelled demo members, first names / code names only,
// no last names, no real workplaces, nobody real contacted:
// - Alex, man, 42, Waikiki — plays guitar and is a computer
//   consultant, looking for pickleball fun jams, and wants to
//   learn to surf. THE date: Erin's own "Surfing lesson" Provide
//   (up to $50, hers, unchanged) covers Alex's wishlist want
//   "Surfing lesson — learn to surf", so the planner's Provide-cover
//   route makes the date.
// - Koa, man, 57, Pipeline, North Shore — inventor and
//   coconut tree climber who can
//   sponsor shopping, so he is a Potential: his Provide covers
//   Lululemon up to $120 (kept, not recreated at a new price). The
//   cats around him are feral cats, NOT domestic cats: "cats" is
//   kept out of his qualities and his checks pin every scored item
//   (the Cats dealbreaker included) absent, so no domestic-cat
//   dealbreaker flag can fire on him.
// - Leilani, woman, 22 (Erin gave her age on 2026-11-02: 22 —
//   inside the 18–99 membership range and over 21, so 21+ spots
//   are allowed for her under the 21+ gate) — studying to be a
//   nurse, code name only, no workplace detail anywhere in her row.
// Two-sided (Erin's correction, same build): every core member
// carries BOTH a Want/Need list (their wishlist entries on the
// List) and a Provide list — never Provide only. Alex's Want is
// learn to surf, his Provides are guitars and computers help.
// Koa's Want is whatever is already on his existing record — his
// "Car detail" wishlist entry — kept as-is, never replaced or
// invented here. Leilani's Provide is nursing help as a nursing
// student; she has no Want on record and none is invented for
// her — her Want side stays empty for Erin to fill in (the
// member Edit form now has a Want editor next to the Provide
// editor, and Join / Add someone stage Wants beside Provides).
// setupCore4 creates/updates those three, then deletes EVERY other
// member (the old Test — Maya / Leila / Dan set and all Test —
// SWARM members) with everything attached to them — photos/blobs,
// checks, dates, safety check-ins, messages, wishlist entries and
// unlocks, Hype payments, Provides, model comparisons and reports.
// It never touches my_profile (so the saved Meta AI key stays
// exactly as it is), Erin's scored List, her Provides, her general
// wishlist, her photos, or promo codes, and it generates no match
// notes or date plans — new writing stays on demand only.

const core4Response = z.object({
  ok: z.literal(true),
  people: z.number(),
  removed: z.number(),
  memberNames: z.array(z.string()),
  // Two-sided check per core member: how many Want entries
  // (wishlist rows) and how many Provide entries each carries
  // after setup, so a Provide-only member is visible at once.
  sides: z.array(
    z.object({
      name: z.string(),
      wants: z.number(),
      provides: z.number(),
    }),
  ),
});
type Core4Result = z.infer<typeof core4Response>;

// ---------- Alex's Wants update + 3-each audit (2026-11-03, Erin) ----------
//
// Erin directed: "Alex wants yoga. Alex wants to play guitar or
// chess." Alex's Wants (his wishlist entries on the List) become
// exactly 3: the existing "Surfing lesson — learn to surf", plus
// "Yoga", plus "Play guitar or chess" — guitar-or-chess is ONE
// Want, not two, and no 4th Want is ever added. SUPERSEDED
// 2026-11-04 by Erin's desires fix (see the Showcase desires
// fix section below): Alex's desires are now exactly "Play
// guitar under the moonlight" and "Chess Party", Koa's are
// exactly "Car detail" and "Trip to Maui (4 days) with tandem
// jet ski ride", and ensureAlexWants reconciles to those sets
// through reconcilePersonDesires instead of adding the rows
// described here. ensureAlexWants
// is idempotent and additive only: it inserts a directed Want
// only when Alex does not already have it AND his Want count is
// still under the flat 3 cap; it never deletes or edits an
// existing row, never touches anyone else's Wants or Provides,
// never touches Erin's List / Provides / profile or her saved
// Meta AI key, and generates no match notes. Its response also
// carries the 3-each audit Erin asked for: Wants and Provides
// counts (with missing counts) for Erin, Alex, Koa and Leilani,
// so any side under 3 is reported exactly — gaps are reported,
// never filled with invented items. Same build, Erin also
// directed two Alex Provides — Lululemon shopping up to $200 and
// Sephora up to $100. CORRECTION (Erin, 2026-11-03): Sephora is
// NOT a separate Provide and NOT a fourth choice — it is a bonus
// attached to the Lululemon shopping Provide: going on the
// Lululemon shopping date with Alex includes a Sephora bonus up
// to $100. So Alex's Provides stay exactly 3 (Computers,
// Guitars, Lululemon shopping up to $200), the Lululemon row's
// note carries the Sephora bonus, Sephora is never added as its
// own Provide row, and it is no longer pending as a swap choice.
// If a standalone Sephora Provide row ever exists, it is folded
// back into the Lululemon note and removed, keeping the count
// at 3.
const alexWantsResponse = z.object({
  ok: z.literal(true),
  added: z.array(z.string()),
  // Alex's directed Provide (Erin, corrected 2026-11-03):
  // "Lululemon shopping" up to $200, whose note carries the
  // Sephora bonus up to $100 on the Lululemon shopping date.
  // Sephora is part of that one Provide — never its own row,
  // never a 4th Provide, never pending. addedProvides lists
  // Provides actually added; updatedProvides lists existing
  // Provides whose note was updated to carry the Sephora bonus
  // (or that had a standalone Sephora row folded into them);
  // pendingProvides stays in the response shape for older
  // callers and is always empty now — nothing is left pending
  // for a swap choice.
  addedProvides: z.array(z.string()),
  updatedProvides: z.array(z.string()),
  pendingProvides: z.array(z.string()),
  // Koa's directed Wants (Erin, same build): "Massage" and
  // "Pool partner to swim", added alongside his existing
  // "Car detail" Want, so Koa's Wants reach exactly 3 — never
  // a 4th. Koa's directed Provides (Erin, same build, updated
  // 2026-11-03): "Hair salon" up to $250 alongside his
  // Lululemon cover up to $120, and "Snorkeling" up to $140
  // REPLACING "Cell phone payment" up to $140 (Erin: "Remove
  // cell phone replace with Snorkeling ($140 budget)") — the
  // cell phone Provide is removed/replaced, never kept, and
  // Koa's Provides stay exactly 3, never a 4th.
  addedKaiWants: z.array(z.string()),
  addedKaiProvides: z.array(z.string()),
  replacedKaiProvides: z.array(z.string()),
  removedKaiProvides: z.array(z.string()),
  // Leilani's directed Provides (Erin): "Massage", alongside
  // her existing Nursing help (Provides 1 → 2), and then
  // "Guitar jam session" (Erin, 2026-11-03: "Leilani can
  // provide guitar jam sesh") as her 3rd Provide — Leilani's
  // Provides reach exactly 3: Nursing help, Massage, Guitar
  // jam session, never a 4th. Her Wants are as directed
  // below.
  addedLeilaniProvides: z.array(z.string()),
  // Leilani's directed Wants (Erin): "Victoria's Secret
  // shopping" up to $100 and "Snorkeling" (Wants 0 → 2), and
  // then "Go to a Rave" (Erin, 2026-11-03: "Leilani wants to
  // go to a Rave") as her 3rd Want — her Wants reach exactly
  // 3: Victoria's Secret shopping $100, Snorkeling, Go to a
  // Rave, never a 4th. A rave is a night-club / music event,
  // so the 21+ gate is relevant: Leilani is 22, so 21+ spots
  // are allowed for her and no gate change is needed.
  addedLeilaniWants: z.array(z.string()),
  alexFound: z.boolean(),
  sides: z.array(
    z.object({
      name: z.string(),
      wants: z.number(),
      provides: z.number(),
      missingWants: z.number(),
      missingProvides: z.number(),
    }),
  ),
});
type AlexWantsResult = z.infer<typeof alexWantsResponse>;

// Koa's location + spot (2026-11-04, Erin): Pipeline, North
// Shore — Papailoa is removed from his profile entirely. His
// location reads "Pipeline, North Shore" and his usual spot
// ("Usually around") is "Pipeline", a spot already in the
// app's spot list.
const KOA_LOCATION = "Pipeline, North Shore";
const KOA_SPOT = "Pipeline";

const CORE4_KAI_BIO =
  "Showcase Koa, 57, Pipeline, North Shore. Inventor, coconut tree climber, and he can sponsor shopping — that's why he's a Potential: his Provide covers Lululemon. The cats around Pipeline are feral cats, not domestic cats.";
const CORE4_ALEX_BIO =
  "Showcase Alex, 42, Waikiki. Plays guitar and is a computer consultant, looking for pickleball fun jams, and wants to learn to surf.";
const CORE4_LEILANI_BIO =
  "Showcase Leilani, 22, studying to be a nurse. Code name only — no workplace detail.";

// Alex's Lululemon Provide note (Erin, corrected 2026-11-03):
// Sephora is a bonus on the Lululemon shopping date, part of
// that one Provide — not a separate Provide.
const ALEX_LULULEMON_NOTE =
  "Includes a Sephora bonus up to $100 when you go on the Lululemon shopping date with him.";

// Koa's sample photos (Erin confirmed 2026-11-03): exactly three
// blended sample photos for Koa's profile, in this order —
// 1 outdoor knee-up (his profile picture), 2 restaurant (re-run),
// 3 indoor table — and no more (the 3-photo cap). The exact bytes
// are embedded in ./koa-sample-*.b64.txt. setKoaSamplePhotos is
// idempotent: it adds only the missing slots, in order, and is a
// no-op once Koa has photos, so it never adds a 4th photo and
// never replaces a photo Erin put there herself.
const setKoaSamplePhotosResponse = z.object({
  ok: z.literal(true),
  koaFound: z.boolean(),
  added: z.number(),
  total: z.number(),
});
type SetKoaSamplePhotosResult = z.infer<typeof setKoaSamplePhotosResponse>;

// Alex's sample photos (Erin confirmed 2026-11-03): exactly three
// balanced Alex + Jake Gyllenhaal blended sample photos for
// Alex's profile, in this order — 1 blue T-shirt solo (his
// profile picture), 2 green shirt bar crop, 3 beach sunset —
// and no more (the 3-photo cap). Alex is personId 1843 and
// previously had no photos. The exact bytes are embedded in
// ./alex-sample-*.b64.txt. setAlexSamplePhotos is idempotent:
// it adds only the missing slots, in order, and is a no-op once
// Alex has photos, so it never adds a 4th photo and never
// replaces a photo Erin put there herself.
const setAlexSamplePhotosResponse = z.object({
  ok: z.literal(true),
  alexFound: z.boolean(),
  added: z.number(),
  total: z.number(),
});
type SetAlexSamplePhotosResult = z.infer<typeof setAlexSamplePhotosResponse>;

// Leilani's sample photos (Erin confirmed 2026-11-03, updated
// order later the same day): exactly three blended sample
// photos for Leilani's profile, in this order — 1 mountain
// (Dorothy Wang blend with more blonde highlights; her profile
// picture), 2 black dress (Kylie blend with blonde highlights),
// 3 yoga in front of the ocean (Dorothy Wang blend with blonde
// highlights) — and no more (the 3-photo cap). The taro field
// photo from the earlier set is REMOVED. Leilani is personId
// 1844, age 22, code name only. The exact bytes are embedded in
// ./leilani-sample-*.b64.txt (byte-for-byte copies of the three
// supplied .webp files). setLeilaniSamplePhotos REPLACES
// Leilani's photo set with exactly these three, in this order:
// when her existing photos already are exactly these three blob
// keys in this order it is a no-op (added 0); otherwise it
// deletes her existing photo rows (and their blobs, best effort)
// and inserts the three new ones in order, so it never leaves a
// 4th photo and never leaves the taro photo behind.
const setLeilaniSamplePhotosResponse = z.object({
  ok: z.literal(true),
  leilaniFound: z.boolean(),
  added: z.number(),
  total: z.number(),
});
type SetLeilaniSamplePhotosResult = z.infer<typeof setLeilaniSamplePhotosResponse>;

// ---------- Showcase desires fix (2026-11-04, Erin's direction) ----------
//
// Erin fixed the Showcase members' DESIRES (their gift-kind
// entries on the List — the entries shown under "🎁 Gifts &
// Desires" on their profiles). Desires are NOT Wants/Needs and
// never count toward a match %; this fix only rewrites those
// gift rows, for Alex and Koa only:
//
// - Alex: "Alex needs a new desire chess ♟️" — the combined
//   "Play guitar or chess" desire is replaced by two separate
//   ones, "Play guitar under the moonlight" and "Chess Party",
//   and "No yoga and no surfing lesson for desires": his "Yoga"
//   and "Surfing lesson — learn to surf" desire rows are
//   removed. His desires are exactly the two new ones. (This
//   supersedes the 2026-11-03 direction that added "Yoga" and
//   "Play guitar or chess" alongside the surfing entry. His
//   Wants storyline, Provides, bio and dates are untouched —
//   only the desire/gift rows change, so Erin's Surfing lesson
//   Provide simply no longer covers a desire of his.)
// - Koa: keep "Car detail" (his existing row stays — occasion,
//   price note and status untouched — with its category set to
//   Car & Mechanical), REMOVE "Massage" and "Pool partner to
//   swim" from his desires, and ADD "Trip to Maui (4 days)
//   with tandem jet ski ride" (Travel & Trips category). His
//   desires are exactly those two. (Supersedes the 2026-11-03
//   direction that added Massage / Pool partner as his Wants,
//   and the 2026-11-04 wording "with wind surf lesson", which
//   Erin replaced the same day: remove the wind surf lesson,
//   add the tandem jet ski ride inside the same Maui trip.)
// - Categories (Erin, 2026-11-04): every fixed desire carries
//   a proper category, never blank or Other — Alex's two are
//   Entertainment, Koa's Car detail is Car & Mechanical, and
//   the Maui trip is Travel & Trips; a kept row whose category
//   differs gets its category corrected in place.
//
// Leilani's desires and Erin's own List / Desires / Provides
// are not touched. reconcilePersonDesires is the single
// implementation: it deletes that person's gift rows that are
// not in the directed set and inserts any directed entry that
// is missing, so it is idempotent and safe to re-run.
// fixShowcaseDesires runs it for Alex and Koa, and
// ensureAlexWants now calls it too, so the older action can no
// longer resurrect the removed entries.

type DesireSpec = {
  text: string;
  category: string;
  occasion: string;
  priceNote: string;
};

const ALEX_DESIRES: DesireSpec[] = [
  {
    text: "Play guitar under the moonlight",
    category: "Entertainment",
    occasion: "",
    priceNote: "",
  },
  {
    text: "Chess Party",
    category: "Entertainment",
    occasion: "",
    priceNote: "",
  },
];

const KOA_DESIRES: DesireSpec[] = [
  {
    text: "Car detail",
    category: "Car & Mechanical",
    occasion: "Thank you",
    priceNote: "about $150",
  },
  {
    text: "Trip to Maui (4 days) with tandem jet ski ride",
    category: "Travel & Trips",
    occasion: "",
    priceNote: "",
  },
];

async function reconcilePersonDesires(
  ctx: Ctx,
  person: { id: number; name: string },
  desired: DesireSpec[],
): Promise<{ removed: string[]; added: string[] }> {
  const db = ctx.db<typeof schema>();
  const allItems = await db.select().from(schema.listItems);
  const rows = allItems.filter(
    (i) => i.kind === "gift" && i.personId === person.id,
  );
  const desiredNorms = desired.map((d) => norm(d.text));
  const removed: string[] = [];
  for (const row of rows) {
    const spec = desired.find((d) => norm(d.text) === norm(row.text));
    if (!spec) {
      await db
        .delete(schema.listItems)
        .where(eq(schema.listItems.id, row.id));
      removed.push(row.text);
      continue;
    }
    // A kept row carries its directed category (Erin, 2026-11-04:
    // every desire gets a proper category, never blank or Other).
    // Only the category is corrected — a kept row's occasion,
    // price note and status stay exactly as they are (e.g. Koa's
    // Car detail keeps "Thank you · about $150").
    if (row.category !== spec.category) {
      await db
        .update(schema.listItems)
        .set({ category: spec.category })
        .where(eq(schema.listItems.id, row.id));
    }
  }
  const keptNorms = rows
    .map((i) => norm(i.text))
    .filter((t) => desiredNorms.includes(t));
  const added: string[] = [];
  for (const d of desired) {
    if (keptNorms.includes(norm(d.text))) continue;
    await db.insert(schema.listItems).values({
      kind: "gift",
      text: d.text,
      category: d.category,
      personId: person.id,
      personName: person.name,
      occasion: d.occasion,
      priceNote: d.priceNote,
      link: "",
      giftStatus: "idea",
    });
    added.push(d.text);
  }
  return { removed, added };
}

// Showcase members' WANTS (Erin's direction, 2026-11-04): each
// member's known Wants, filled back in so Open Profile's
// "What they want" is never empty for the Core 4. These are
// WANTS — scored List items (kind "must") tied to that member
// (list_items.person_id = the member) — a separate store from
// their Desires (kind "gift" rows above: ALEX_DESIRES /
// KOA_DESIRES), which never count toward a match %. The two
// stores can hold a like-named entry without being the same
// thing: Koa's "Car detail" is both a Want here and a Desire
// in KOA_DESIRES, exactly as Erin directed each. The fill is
// ADDITIVE and idempotent (reconcileMemberWants): a directed
// Want that is missing is inserted (never past the flat 3 cap
// per member), a present one only gets its directed category /
// price note corrected, and nothing is ever deleted — a Want
// Erin adds or edits by hand through the member Edit form is
// hers and stays. It runs on every getState (best effort, like
// the rename / label sweeps) and as the fillShowcaseMemberWants
// action.

type MemberWantSpec = {
  text: string;
  category: string;
  priceNote: string;
};

const SHOWCASE_MEMBER_WANTS: { bare: string; wants: MemberWantSpec[] }[] = [
  {
    bare: "Alex",
    wants: [
      { text: "Learn to surf", category: "Fitness & Outdoors", priceNote: "" },
      { text: "Yoga", category: "Health & Wellness", priceNote: "" },
      {
        text: "Play guitar or chess",
        category: "Entertainment",
        priceNote: "",
      },
    ],
  },
  {
    bare: "Koa",
    wants: [
      { text: "Car detail", category: "Car & Mechanical", priceNote: "" },
      { text: "Massage", category: "Health & Wellness", priceNote: "" },
      { text: "Pool partner", category: "Fitness & Outdoors", priceNote: "" },
    ],
  },
  {
    bare: "Leilani",
    wants: [
      {
        text: "Victoria's Secret shopping",
        category: "Money & Treats",
        priceNote: "up to $100",
      },
      { text: "Snorkeling", category: "Fitness & Outdoors", priceNote: "" },
      { text: "Go to a Rave", category: "Entertainment", priceNote: "" },
    ],
  },
];

async function reconcileMemberWants(
  ctx: Ctx,
  person: { id: number; name: string },
  desired: MemberWantSpec[],
): Promise<{ added: string[] }> {
  const db = ctx.db<typeof schema>();
  const allItems = await db.select().from(schema.listItems);
  // This member's OWN Wants only: scored rows tied to them.
  // Gift rows (their Desires) are a different store and are
  // never read or written here.
  const rows = allItems.filter(
    (i) => i.kind !== "gift" && i.personId === person.id,
  );
  const added: string[] = [];
  let count = rows.length;
  for (const spec of desired) {
    const existing = rows.find((r) => norm(r.text) === norm(spec.text));
    if (existing) {
      // Present: only its directed category / price note are
      // corrected in place; the row itself is never rewritten.
      if (
        existing.category !== spec.category ||
        (spec.priceNote !== "" && existing.priceNote !== spec.priceNote)
      ) {
        await db
          .update(schema.listItems)
          .set({
            category: spec.category,
            priceNote: spec.priceNote !== "" ? spec.priceNote : existing.priceNote,
          })
          .where(eq(schema.listItems.id, existing.id));
      }
      continue;
    }
    if (count >= 3) continue; // flat cap: 3 Wants per member, never a 4th
    await db.insert(schema.listItems).values({
      kind: "must",
      text: spec.text,
      category: spec.category,
      personId: person.id,
      personName: person.name,
      occasion: "",
      priceNote: spec.priceNote,
      link: "",
      giftStatus: null,
    });
    added.push(spec.text);
    count += 1;
  }
  return { added };
}

const fillShowcaseMemberWantsResponse = z.object({
  ok: z.literal(true),
  members: z.array(
    z.object({
      name: z.string(),
      found: z.boolean(),
      added: z.array(z.string()),
      // This member's Wants (scored rows, titles) after the fill.
      wants: z.array(z.string()),
    }),
  ),
});
type FillShowcaseMemberWantsResult = z.infer<
  typeof fillShowcaseMemberWantsResponse
>;

async function fillShowcaseMemberWants(
  ctx: Ctx,
): Promise<FillShowcaseMemberWantsResult> {
  const db = ctx.db<typeof schema>();
  for (const entry of SHOWCASE_MEMBER_WANTS) {
    for (const w of entry.wants) assertCleanWording(w.text, w.category);
  }
  const peopleRows = await db.select().from(schema.people);
  const members: FillShowcaseMemberWantsResult["members"] = [];
  for (const entry of SHOWCASE_MEMBER_WANTS) {
    const person =
      peopleRows.find((p) => isShowcaseMember(p, entry.bare)) ??
      (entry.bare === "Alex"
        ? peopleRows.find((p) => p.name === "Zach")
        : entry.bare === "Koa"
          ? peopleRows.find((p) => p.name === "Kalani" || p.name === "Kai")
          : undefined);
    if (!person) {
      members.push({
        name: showcaseName(entry.bare),
        found: false,
        added: [],
        wants: [],
      });
      continue;
    }
    const { added } = await reconcileMemberWants(ctx, person, entry.wants);
    const finalItems = await db.select().from(schema.listItems);
    members.push({
      name: person.name,
      found: true,
      added,
      wants: finalItems
        .filter((i) => i.kind !== "gift" && i.personId === person.id)
        .map((i) => i.text),
    });
  }
  return { ok: true as const, members };
}

// ---------- Directed dealbreakers (2026-11-04, Erin) ----------
//
// Erin set one dealbreaker for each Showcase member and changed
// her own, in her exact words:
// - Showcase Koa: "Sexually transmitted diseases" (his ONLY
//   dealbreaker — not Alex's, not Leilani's).
// - Showcase Alex: "long distance relationships"
//   (superseding his briefly-directed "off Island
//   relationships", "horror movies and metal fans",
//   "Drama Queens" and "eating with your mouth open" — a
//   stored row with any of those texts is renamed in
//   place to the final text by the pass).
// - Showcase Leilani: "non-vegetarian" (superseding her
//   briefly-directed "Kids" wording and the earlier "a stay
//   at home person, a homebody" wording — neither is the
//   final text; a stored "Kids" row of hers is renamed in
//   place to "non-vegetarian" by the pass).
// - Erin herself: "being ungroomed", REPLACING her "Cats"
//   dealbreaker — her Dealbreakers are "being ungroomed", not
//   Cats, after this pass.
// Member dealbreakers are that member's OWN List rows (kind
// "dealbreaker", person_id = the member): background only,
// never scored, exposed on the person shape as `dealbreakers`
// and shown in their Open Profile "Dealbreakers · background"
// section (which read "None set." for all three before this).
// Erin-side scoring scopes scored rows to person_id null, so a
// member's dealbreaker can never leak into her List or scores.
// The member side is idempotent: a missing directed
// dealbreaker is inserted, and a superseded directed wording
// (Leilani's "Kids", Alex's earlier wordings) is renamed in
// place to the final text; nothing else of theirs is ever
// removed or rewritten.
// Erin's side renames her Cats row in
// place (same row id, so her person_checks stay attached) —
// or, if "being ungroomed" already exists as its own row,
// removes the Cats row so she ends with exactly the one
// directed dealbreaker; if she somehow has neither, the
// directed one is inserted.
// NOTE on the wording filter: "Sexually transmitted diseases"
// is Erin's directed medical term. It is written directly
// here, NOT through assertCleanWording — the hookup wording
// set contains "sexually", which guards user-typed and
// generated text; stored List rows are never scanned by
// cleanStoredWordingOnce (it only covers bios / hype notes /
// date notes), so the row stands as directed.
// Runs on every getState (best effort, like the other sweeps)
// and as the applyDirectedDealbreakers action.

const SHOWCASE_MEMBER_DEALBREAKERS: {
  bare: string;
  text: string;
  // Earlier directed wordings for this same dealbreaker that
  // Erin superseded before they settled — renamed in place
  // (or removed if the final text already exists) so the
  // member ends with exactly the final directed dealbreaker.
  supersedes: string[];
}[] = [
  {
    bare: "Alex",
    text: "long distance relationships",
    supersedes: [
      "off Island relationships",
      "horror movies and metal fans",
      "Drama Queens",
      "eating with your mouth open",
    ],
  },
  { bare: "Koa", text: "Sexually transmitted diseases", supersedes: [] },
  { bare: "Leilani", text: "non-vegetarian", supersedes: ["Kids"] },
];
const MY_DEALBREAKER_TEXT = "being ungroomed";
const MY_OLD_DEALBREAKER_TEXT = "Cats";

const applyDirectedDealbreakersResponse = z.object({
  ok: z.literal(true),
  members: z.array(
    z.object({
      name: z.string(),
      found: z.boolean(),
      added: z.array(z.string()),
      // This member's dealbreakers after the pass.
      dealbreakers: z.array(z.string()),
    }),
  ),
  // Erin's own dealbreakers after the pass.
  mine: z.array(z.string()),
  mineChanged: z.boolean(),
});
type ApplyDirectedDealbreakersResult = z.infer<
  typeof applyDirectedDealbreakersResponse
>;

async function applyDirectedDealbreakers(
  ctx: Ctx,
): Promise<ApplyDirectedDealbreakersResult> {
  const db = ctx.db<typeof schema>();
  const peopleRows = await db.select().from(schema.people);
  const members: ApplyDirectedDealbreakersResult["members"] = [];
  for (const entry of SHOWCASE_MEMBER_DEALBREAKERS) {
    const person =
      peopleRows.find((p) => isShowcaseMember(p, entry.bare)) ??
      (entry.bare === "Alex"
        ? peopleRows.find((p) => p.name === "Zach")
        : entry.bare === "Koa"
          ? peopleRows.find((p) => p.name === "Kalani" || p.name === "Kai")
          : undefined);
    if (!person) {
      members.push({
        name: showcaseName(entry.bare),
        found: false,
        added: [],
        dealbreakers: [],
      });
      continue;
    }
    const allItems = await db.select().from(schema.listItems);
    const rows = allItems.filter(
      (i) => i.kind === "dealbreaker" && i.personId === person.id,
    );
    const added: string[] = [];
    const hasFinal = rows.some((r) => norm(r.text) === norm(entry.text));
    // A superseded directed wording (Leilani's "Kids") is
    // renamed in place to the final text, or removed when the
    // final text already has its own row — she ends with
    // exactly the final directed dealbreaker.
    for (const old of entry.supersedes) {
      const oldRow = rows.find((r) => norm(r.text) === norm(old));
      if (!oldRow) continue;
      if (!hasFinal) {
        await db
          .update(schema.listItems)
          .set({ text: entry.text })
          .where(eq(schema.listItems.id, oldRow.id));
        added.push(entry.text);
      } else {
        await db
          .delete(schema.listItems)
          .where(eq(schema.listItems.id, oldRow.id));
      }
    }
    const afterSupersede = await db.select().from(schema.listItems);
    const nowHasFinal = afterSupersede.some(
      (i) =>
        i.kind === "dealbreaker" &&
        i.personId === person.id &&
        norm(i.text) === norm(entry.text),
    );
    if (!nowHasFinal) {
      await db.insert(schema.listItems).values({
        kind: "dealbreaker",
        text: entry.text,
        category: "",
        personId: person.id,
        personName: person.name,
        occasion: "",
        priceNote: "",
        link: "",
        giftStatus: null,
      });
      added.push(entry.text);
    }
    const finalItems = await db.select().from(schema.listItems);
    members.push({
      name: person.name,
      found: true,
      added,
      dealbreakers: finalItems
        .filter((i) => i.kind === "dealbreaker" && i.personId === person.id)
        .map((i) => i.text),
    });
  }

  // Erin's own dealbreaker: Cats -> being ungroomed.
  const myItems = await db.select().from(schema.listItems);
  const myRows = myItems.filter(
    (i) => i.kind === "dealbreaker" && (i.personId ?? null) === null,
  );
  const ungroomedRow = myRows.find(
    (r) => norm(r.text) === norm(MY_DEALBREAKER_TEXT),
  );
  const catsRow = myRows.find(
    (r) => norm(r.text) === norm(MY_OLD_DEALBREAKER_TEXT),
  );
  let mineChanged = false;
  if (catsRow && !ungroomedRow) {
    await db
      .update(schema.listItems)
      .set({ text: MY_DEALBREAKER_TEXT })
      .where(eq(schema.listItems.id, catsRow.id));
    mineChanged = true;
  } else if (catsRow && ungroomedRow) {
    await db
      .delete(schema.listItems)
      .where(eq(schema.listItems.id, catsRow.id));
    mineChanged = true;
  } else if (!catsRow && !ungroomedRow) {
    await db.insert(schema.listItems).values({
      kind: "dealbreaker",
      text: MY_DEALBREAKER_TEXT,
      category: "",
      personId: null,
      personName: "",
      occasion: "",
      priceNote: "",
      link: "",
      giftStatus: null,
    });
    mineChanged = true;
  }
  const finalMine = await db.select().from(schema.listItems);
  return {
    ok: true as const,
    members,
    mine: finalMine
      .filter((i) => i.kind === "dealbreaker" && (i.personId ?? null) === null)
      .map((i) => i.text),
    mineChanged,
  };
}

// ---------- Koa's profile: climber placement + Pipeline (2026-11-04, Erin) ----------
//
// Erin directed, in order: add "coconut tree climber" to
// Showcase Koa's biography (her first wording, "coconut tree
// trimmer", was corrected to "climber" — climber only), then
// MOVE it so it sits right after the descriptor in the bio
// instead of as a trailing sentence, change his "usually
// around" location to Pipeline, and remove Papailoa (and the
// old "Papailoa, North Shore") from his profile — his location
// is just "Pipeline, North Shore" now, in the location line,
// the Usually around spot, and the About / bio text (the cats
// sentence names Pipeline too). The pass reconciles his
// STORED row to exactly the directed profile — bio
// CORE4_KAI_BIO, location KOA_LOCATION, spot KOA_SPOT — the
// stored row stays the source of truth, nothing is derived or
// merged at display time, and once the row reads as directed
// it writes nothing (idempotent). "Papailoa" is also rewritten
// to "Pipeline" inside Koa's own generated writing (his match
// note, his date plans, his Spark vs Wonder comparisons) so
// no stale place name survives there. Latest descriptor
// (2026-11-04, Erin, superseding "trust-fund baby"): Koa is
// an "inventor" — the bio opens "Inventor, coconut tree
// climber, …", and the same swap rewrites "trust-fund baby" /
// "trust fund baby" to "inventor" / "Inventor" inside his own
// generated writing, so no stale descriptor survives there
// either. A member's bio AND
// location feed the date-plan signature (buildDatePlanSig),
// and location + spot feed the match-note signature
// (buildMatchFactsAndSig), so when anything changes the pass
// refreshes Koa's note / plan signatures through the shared
// refreshRenamedWritingSigs helper, so his stored writing
// survives the stale-writing purge word for word. Nobody
// else's row is read for writing, and no notes or plans are
// generated. The pass runs on every getState (best effort,
// like the other sweeps) and as the applyKoaProfileUpdate
// action (applyKoaCoconutBio stays as an alias action for the
// earlier build's post-submit name).

const applyKoaProfileUpdateResponse = z.object({
  ok: z.literal(true),
  koaFound: z.boolean(),
  updated: z.boolean(),
  sigsRefreshed: z.number(),
  bio: z.string(),
  location: z.string(),
  spot: z.string(),
});
type ApplyKoaProfileUpdateResult = z.infer<
  typeof applyKoaProfileUpdateResponse
>;

async function applyKoaProfileUpdate(
  ctx: Ctx,
): Promise<ApplyKoaProfileUpdateResult> {
  const db = ctx.db<typeof schema>();
  const peopleRows = await db.select().from(schema.people);
  const koa =
    peopleRows.find((p) => isShowcaseMember(p, "Koa")) ??
    peopleRows.find((p) => p.name === "Kalani" || p.name === "Kai");
  if (!koa) {
    return {
      ok: true as const,
      koaFound: false,
      updated: false,
      sigsRefreshed: 0,
      bio: "",
      location: "",
      spot: "",
    };
  }
  let updated = false;
  // (1) The profile row itself: directed bio (climber right
  // after "Inventor", Pipeline in the About text, no
  // Papailoa, no trailing climber sentence, no "trimmer",
  // no "trust-fund baby"), directed location and directed
  // usual spot.
  if (
    koa.bio !== CORE4_KAI_BIO ||
    koa.location !== KOA_LOCATION ||
    koa.spot !== KOA_SPOT
  ) {
    await db
      .update(schema.people)
      .set({ bio: CORE4_KAI_BIO, location: KOA_LOCATION, spot: KOA_SPOT })
      .where(eq(schema.people.id, koa.id));
    updated = true;
  }
  // (2) Koa's own generated writing: the old place name and
  // the old descriptor go wherever they were written from his
  // old profile — his match note, his date plans and his
  // Spark vs Wonder comparisons. Only those words change;
  // every other word stays.
  const swapPlace = (text: string): string =>
    text
      .replace(/Papailoa/g, "Pipeline")
      .replace(/papailoa/g, "pipeline")
      .replace(/trust[-\s]fund baby/gi, (m) =>
        m.charAt(0) === m.charAt(0).toUpperCase() ? "Inventor" : "inventor",
      );
  const staleWriting = /papailoa|trust[-\s]fund baby/i;
  const freshKoa = (await db.select().from(schema.people)).find(
    (p) => p.id === koa.id,
  );
  if (freshKoa && staleWriting.test(freshKoa.matchNote)) {
    await db
      .update(schema.people)
      .set({ matchNote: swapPlace(freshKoa.matchNote) })
      .where(eq(schema.people.id, koa.id));
    updated = true;
  }
  const dateRows = await db.select().from(schema.dates);
  for (const d of dateRows) {
    if (d.personId !== koa.id || !d.plan || !staleWriting.test(d.plan)) continue;
    await db
      .update(schema.dates)
      .set({ plan: swapPlace(d.plan) })
      .where(eq(schema.dates.id, d.id));
    updated = true;
  }
  const comparisonRows = await db.select().from(schema.modelComparisons);
  for (const c of comparisonRows) {
    if (c.personId !== koa.id) continue;
    const fields = {
      sparkMatchNote: swapPlace(c.sparkMatchNote),
      wonderMatchNote: swapPlace(c.wonderMatchNote),
      sparkDatePlan: swapPlace(c.sparkDatePlan),
      wonderDatePlan: swapPlace(c.wonderDatePlan),
    };
    if (
      fields.sparkMatchNote === c.sparkMatchNote &&
      fields.wonderMatchNote === c.wonderMatchNote &&
      fields.sparkDatePlan === c.sparkDatePlan &&
      fields.wonderDatePlan === c.wonderDatePlan
    ) {
      continue;
    }
    await db
      .update(schema.modelComparisons)
      .set(fields)
      .where(eq(schema.modelComparisons.id, c.id));
    updated = true;
  }
  // (3) Bio + location feed the date-plan signature and
  // location + spot feed the match-note signature: refresh
  // Koa's signatures through the shared helper (the rename
  // passes' pattern) so the stale-writing purge keeps his
  // note and plans word for word.
  let sigsRefreshed = 0;
  if (updated) {
    sigsRefreshed = await refreshRenamedWritingSigs(ctx, new Set([koa.id]));
  }
  return {
    ok: true as const,
    koaFound: true,
    updated,
    sigsRefreshed,
    bio: CORE4_KAI_BIO,
    location: KOA_LOCATION,
    spot: KOA_SPOT,
  };
}

// ---------- Alex's biography update (2026-11-04, Erin) ----------
//
// Erin directed: Showcase Alex's About biography now says he
// plays guitar and is a computer consultant looking for
// pickleball fun jams. His age (42), Waikiki and his want to
// learn to surf are kept exactly, and the bio ends there —
// the surf lesson note that used to follow ("— THE date:
// Erin's Surfing lesson Provide (up to $50) covers his want
// to learn to surf.") was REMOVED at Erin's direction on
// 2026-11-04, dash and all, so the bio is exactly
// CORE4_ALEX_BIO above.
// The pass reconciles his STORED row to exactly that bio —
// the stored row stays the source of truth, nothing is derived
// or merged at display time, and once the row reads as directed
// it writes nothing (idempotent). A member's bio feeds the
// date-plan signature (buildDatePlanSig), so when the bio
// changes the pass refreshes Alex's note / plan signatures
// through the shared refreshRenamedWritingSigs helper, so his
// stored match note and date plans survive the stale-writing
// purge word for word. His Wants, Provides, Desires, photos,
// match %, Deal status and dates are never touched, nobody
// else's row is read for writing, Erin's own profile / List /
// Provides and her saved Meta AI key are never touched, and no
// notes or plans are generated. The pass runs on every getState
// (best effort, like the Koa pass above) and as the
// applyAlexBioUpdate action.

const applyAlexBioUpdateResponse = z.object({
  ok: z.literal(true),
  alexFound: z.boolean(),
  updated: z.boolean(),
  sigsRefreshed: z.number(),
  bio: z.string(),
});
type ApplyAlexBioUpdateResult = z.infer<typeof applyAlexBioUpdateResponse>;

async function applyAlexBioUpdate(
  ctx: Ctx,
): Promise<ApplyAlexBioUpdateResult> {
  const db = ctx.db<typeof schema>();
  const peopleRows = await db.select().from(schema.people);
  const alex =
    peopleRows.find((p) => isShowcaseMember(p, "Alex")) ??
    peopleRows.find((p) => p.name === "Zach");
  if (!alex) {
    return {
      ok: true as const,
      alexFound: false,
      updated: false,
      sigsRefreshed: 0,
      bio: "",
    };
  }
  let updated = false;
  if (alex.bio !== CORE4_ALEX_BIO) {
    await db
      .update(schema.people)
      .set({ bio: CORE4_ALEX_BIO })
      .where(eq(schema.people.id, alex.id));
    updated = true;
  }
  let sigsRefreshed = 0;
  if (updated) {
    sigsRefreshed = await refreshRenamedWritingSigs(ctx, new Set([alex.id]));
  }
  return {
    ok: true as const,
    alexFound: true,
    updated,
    sigsRefreshed,
    bio: CORE4_ALEX_BIO,
  };
}

const fixShowcaseDesiresResponse = z.object({
  ok: z.literal(true),
  alexFound: z.boolean(),
  koaFound: z.boolean(),
  removedAlex: z.array(z.string()),
  addedAlex: z.array(z.string()),
  removedKoa: z.array(z.string()),
  addedKoa: z.array(z.string()),
  // Every Showcase member's desires (gift-entry titles) after
  // the fix, so the result can be checked at a glance.
  desires: z.array(
    z.object({ name: z.string(), desires: z.array(z.string()) }),
  ),
});
type FixShowcaseDesiresResult = z.infer<typeof fixShowcaseDesiresResponse>;

// ---------- actions ----------

// Guest access (platform v27, 2026-11-04): this is a
// single-owner personal app. Everyday List / Matches / Dates /
// Chat operations stay callable so the shared demo surface
// and the Discover join flow keep working, but owner-only
// operations — anything that reads or spends the saved Meta
// AI key, runs AI generation / comparison, manages promo
// codes or wishlist pricing, or seeds / wipes / repairs data
// in bulk — require the owner. A guest has no ctx.viewer, so
// the guard must require isOwner === true exactly: rejecting
// only isOwner === false would let a missing viewer through.
// This app calls no ctx.inference / ctx.tool / ctx.agent /
// privileged callbacks (AI generation goes to the Meta API
// with the owner's saved key), so there is no shared-VM
// capability to surface as unavailable; the owner guard is
// what stops a shared-page visitor spending the owner's key.
function requireOwner(ctx: Ctx): void {
  if (ctx.viewer?.isOwner !== true) {
    throw new Error(
      "Owner sign-in required — this part of List Dating is private to the owner.",
    );
  }
}

export const Actions = {
  getState: defineAction({
    description: "Load the full List Dating state: profile, The List (including wishlist entries), members with match and Provide cover scores, dates, messages, reports, promo codes and Hype payments.",
    request: z.object({}),
    response: stateResponse,
    handler: async (ctx): Promise<State> => {
      // First load of a server process sweeps any pre-filter stored
      // wording (see cleanStoredWordingOnce) so the live profile
      // never keeps displaying a disallowed Hype note.
      await cleanStoredWordingOnce(ctx);
      // Core member renames (Zach → Alex, Kai / Kalani → Koa)
      // run before the purge, so renamed notes / plans keep
      // their refreshed signatures and are never purged over
      // the name change alone. Best effort, like the purge below.
      try {
        await renameCoreMembers(ctx);
      } catch {
        // fall through to the purge + state load
      }
      // Showcase labels (2026-11-04): "Showcase" goes before
      // Alex, Koa and Leilani's names everywhere they appear.
      // Runs after the core renames and before the bug-check
      // fixes + purge, idempotent and best effort, exactly like
      // the rename sweep above.
      try {
        await applyShowcaseLabels(ctx);
      } catch {
        // fall through to the purge + state load
      }
      // Showcase members' Wants fill (2026-11-04): each Core 4
      // member's known Wants are restored as their own scored
      // List rows so Open Profile's "What they want" is not
      // empty. Additive and idempotent — once the rows are
      // there it writes nothing, and their Desires (gift rows),
      // Provides, scores, dates, plans, photos, Erin's own
      // List and the saved Meta AI key are never touched.
      try {
        await fillShowcaseMemberWants(ctx);
      } catch {
        // fall through to the purge + state load
      }
      // Directed dealbreakers (2026-11-04): each Showcase
      // member's own dealbreaker set in their exact words
      // (Alex — long distance relationships; Koa — Sexually
      // transmitted diseases; Leilani — non-vegetarian), and
      // Erin's own dealbreaker changed from Cats to being
      // ungroomed. Idempotent and best effort, like the Wants
      // fill above — once the rows read as directed it writes
      // nothing.
      try {
        await applyDirectedDealbreakers(ctx);
      } catch {
        // fall through to the purge + state load
      }
      // Koa's profile update (2026-11-04): his stored bio
      // (coconut tree climber right after "Inventor"),
      // location ("Pipeline, North Shore") and usual spot
      // ("Pipeline") reconciled to Erin's directed wording —
      // Papailoa removed everywhere on his profile — with his
      // note / plan signatures refreshed in the same pass so
      // his writing survives the purge below. Idempotent and
      // best effort, like the Wants fill above.
      try {
        await applyKoaProfileUpdate(ctx);
      } catch {
        // fall through to the purge + state load
      }
      // Alex's biography update (2026-11-04): his stored bio
      // reconciled to Erin's directed wording — plays guitar
      // and is a computer consultant, looking for pickleball
      // fun jams — with his age, Waikiki and learn-to-surf
      // want kept and the surf lesson note removed (the bio
      // ends at "learn to surf."), and his note / plan
      // signatures refreshed in the same pass so his writing
      // survives the purge below. Idempotent and best effort,
      // like the Koa pass above.
      try {
        await applyAlexBioUpdate(ctx);
      } catch {
        // fall through to the purge + state load
      }
      // Bug-check fixes (2026-11-03): remap the orphaned
      // Lululemon date links to the current Lululemon item,
      // fill the demo dates' structured spot / meet time from
      // their own plans, and fill Leilani's blank location /
      // spot / times — refreshing the affected plan signatures
      // so the purge below keeps those plans word for word.
      // Idempotent and best effort, like the rename sweep.
      try {
        await repairBugCheckFixes(ctx);
      } catch {
        // fall through to the purge + state load
      }
      // Every load sweeps stale generated writing and expired Hype
      // (see purgeStaleNotesAndExpiredHype): a match note, date
      // plan or comparison that no longer matches live List /
      // Provide state is deleted — never regenerated here — and
      // expired Hype payments / listing notes go with it. Best
      // effort: a purge failure must never block reads.
      try {
        await purgeStaleNotesAndExpiredHype(ctx);
      } catch {
        // fall through to the state load
      }
      return loadState(ctx);
    },
  }),

  renameCoreMembers: defineAction({
    description: "Rename the core demo members Zach to Alex and Kai / Kalani to Koa everywhere: profile name, bio, Provide notes, all person-name snapshots (List wishlist entries, Dates, Chat, safety check-ins, reports, comparisons, payments, unlocks), and name references inside stored match notes, date plans, Chat bodies and Spark vs Wonder comparisons — with stored note/plan signatures refreshed so the renamed writing is kept. Only names change: Wants, Provides, caps, scores, Deal status, dates, photos and Erin's profile, List and saved Meta AI key are untouched, Hawaii Kai the place is never renamed, and no notes or plans are generated.",
    request: z.object({}),
    response: renameCoreMembersResponse,
    handler: async (ctx): Promise<RenameCoreMembersResult> => {
      requireOwner(ctx);
      const counts = await renameCoreMembers(ctx);
      ctx.invalidateQueries();
      return { ok: true as const, ...counts };
    },
  }),

  applyShowcaseLabels: defineAction({
    description: "Put Erin's directed Showcase label before the three Showcase members' names — Alex becomes 'Showcase Alex', Koa (the member formerly named Kai) becomes 'Showcase Koa' and Leilani becomes 'Showcase Leilani' — on their profiles and every person-name snapshot (List wishlist entries, Dates, Chat, safety check-ins, reports, comparisons, payments, unlocks), rewriting name references inside their bios, Provide notes, stored match notes, date plans, Chat bodies and Spark vs Wonder comparisons, with stored note/plan signatures refreshed so the labelled writing is kept. Idempotent: once the names carry the label it writes nothing. Only the three members' names change — Wants, Provides, caps, scores, Deal status, dates, photos and Erin's own profile, List and saved Meta AI key are untouched, and no notes or plans are generated.",
    request: z.object({}),
    response: applyShowcaseLabelsResponse,
    handler: async (ctx): Promise<ApplyShowcaseLabelsResult> => {
      requireOwner(ctx);
      const counts = await applyShowcaseLabels(ctx);
      ctx.invalidateQueries();
      return { ok: true as const, ...counts };
    },
  }),

  applyBugCheckFixes: defineAction({
    description: "Apply the 2026-11-03 bug-check fixes: remap Alex's and Koa's Lululemon dates from the orphaned list item 27 to Erin's current Lululemon item (dates 6, 7 and 8 are never deleted), fill the demo dates' structured spot and Saturday-morning meet time from their own plan text (Waikiki / Kalakaua Avenue, Ala Moana Center, Haleiwa Beach Park — plan text and actual photos unchanged, signatures refreshed so the plans survive), fill Leilani's blank location, spot and available times from her Haleiwa Beach Park date, and regenerate match notes for the CURRENT List only — one note per current member, written from today's List facts through the same Meta AI / List path as generateMatchNote, never a bulk regeneration for an old List. Erin's List (Yoga, Lululemon, Car, Cats dealbreaker) is read, never changed; her profile, Provides, photos, Deals, dates' plans and saved Meta AI key are untouched, and nothing is deleted on a mode switch.",
    request: z.object({}),
    response: bugCheckFixResponse,
    handler: async (ctx): Promise<BugCheckFixResult> => {
      requireOwner(ctx);
      const counts = await repairBugCheckFixes(ctx);
      // (3) Match notes for the current List only: every note
      // is rebuilt from the facts buildMatchFactsAndSig derives
      // from the List as it stands NOW — a note already carrying
      // the current signature is kept (cached), a missing or
      // stale one is rewritten through the one writing path.
      // Notes for old Lists are never regenerated: the purge
      // deletes those, and this loop only ever sees today's
      // members and today's List.
      const db = ctx.db<typeof schema>();
      const [profile, allItems, checkRows, personRows, provideRows] =
        await Promise.all([
          loadProfile(ctx),
          db.select().from(schema.listItems),
          db.select().from(schema.personChecks),
          db.select().from(schema.people),
          db.select().from(schema.provides),
        ]);
      const items = allItems.filter((i) => i.kind !== "gift" && (i.personId ?? null) === null);
      const giftRows = allItems.filter((i) => i.kind === "gift");
      const notes: BugCheckFixResult["notes"] = [];
      for (const person of personRows) {
        const { facts, scored, sig } = buildMatchFactsAndSig(
          profile,
          person,
          items,
          checkRows,
          provideRows,
          giftRows,
        );
        const written = await writeMatchNoteFromFacts(
          ctx,
          profile,
          person,
          facts,
          sig,
          scored.qualities,
        );
        notes.push({
          name: person.name,
          source: written.source,
          cached: written.cached,
        });
      }
      ctx.invalidateQueries();
      return { ok: true as const, ...counts, notes };
    },
  }),

  purgeStaleNotes: defineAction({
    description: "Purge stale generated writing and all Hype records (Hype is killed until later): deletes any stored match note, date plan or Spark vs Wonder comparison whose signature, named score or text no longer matches that person's current live score, List and Provide state (or that predates the current List or a now-covering Provide), and deletes every Hype payment and clears every Hype listing, live or expired. Also repairs the picture on a surviving date plan: when the checked photo registry has actual photographs for the plan's verified spot (e.g. Koa's Lululemon date at Ala Moana Center), the date is switched to those actual photos and any legacy generated illustration is removed — plan text, status and cover are never touched by the repair. Never generates replacement notes, and never touches members, Erin's profile details, her List, Provides, Desires, dates, messages, photos, or her saved Meta AI key.",
    request: z.object({}),
    response: purgeStaleResponse,
    handler: async (ctx): Promise<PurgeStaleResult> => {
      requireOwner(ctx);
      const counts = await purgeStaleNotesAndExpiredHype(ctx);
      ctx.invalidateQueries();
      return { ok: true as const, ...counts };
    },
  }),

  saveProfile: defineAction({
    description: "Save the user's own profile: name, age, bio, location, times available, Usually around spot (the same spot list as every member's), their stated gender (\"I am\": man / woman / not set), the pride Same sex matching toggle (off = heterosexual matching by default, on = same-sex matching), qualities, what they are looking for, Discover visibility and contact preference.",
    request: z.object({
      name: z.string().max(80),
      age: ageField,
      bio: z.string().max(600),
      location: z.string().max(120),
      availableTimes: z.string().max(200),
      spot: z.string().max(80).optional(),
      gender: genderField,
      sameSex: z.boolean(),
      qualities: z.array(z.string().max(60)).max(30),
      lookingFor: z.string().max(300),
      discoverable: z.boolean(),
      contactPref,
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<Ok> => {
      const db = ctx.db<typeof schema>();
      // Content filter: editable fields are always checked. The
      // pass-through fields (lookingFor, qualities — no longer
      // edited in the UI) are only checked when they actually
      // change, so a legacy stored value can never wedge saving.
      const existingProfile = await loadProfile(ctx);
      const spotValue = (args.spot ?? existingProfile.spot ?? "").trim();
      assertCleanWording(
        args.name,
        args.bio,
        args.location,
        args.availableTimes,
        spotValue,
      );
      assertOwnSpotAllowedForAge(spotValue, args.age);
      if (args.lookingFor !== existingProfile.lookingFor) {
        assertCleanWording(args.lookingFor);
      }
      const newQualities = JSON.stringify(
        args.qualities.map((q) => q.trim()).filter(Boolean),
      );
      if (newQualities !== existingProfile.qualities) {
        assertCleanWording(args.qualities);
      }
      const values = {
        id: 1,
        name: args.name.trim(),
        age: args.age,
        bio: args.bio.trim(),
        location: args.location.trim(),
        availableTimes: args.availableTimes.trim(),
        spot: spotValue,
        gender: args.gender,
        sameSex: args.sameSex,
        qualities: JSON.stringify(args.qualities.map((q) => q.trim()).filter(Boolean)),
        lookingFor: args.lookingFor.trim(),
        discoverable: args.discoverable,
        contactPref: args.contactPref,
        updatedAt: new Date(),
      };
      await db
        .insert(schema.myProfile)
        .values(values)
        .onConflictDoUpdate({ target: schema.myProfile.id, set: values });
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  setMatchMode: defineAction({
    description: "Set only the user's stated gender (\"I am\": man / woman / not set) and the pride Same sex matching toggle — off (default) means heterosexual matching, on means same-sex matching — so the Matches tab can switch modes and re-filter at once without touching any other profile field.",
    request: z.object({
      gender: genderField,
      sameSex: z.boolean(),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<Ok> => {
      const db = ctx.db<typeof schema>();
      const existing = await loadProfile(ctx);
      const values = {
        ...existing,
        qualities:
          typeof existing.qualities === "string"
            ? existing.qualities
            : JSON.stringify(existing.qualities),
        gender: args.gender,
        sameSex: args.sameSex,
        updatedAt: new Date(),
      };
      await db
        .insert(schema.myProfile)
        .values(values)
        .onConflictDoUpdate({ target: schema.myProfile.id, set: values });
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  setHype: defineAction({
    description: "Hype is paused until later (Erin killed it for now): turning Hype on is refused, and any call clears the user's Hype listing completely. The paid Hype flow ($2.99 per 30 minutes) returns only when Erin brings Hype back.",
    request: z.object({
      hypeOn: z.boolean(),
      hypeSpot: z.string().max(80),
      hypeMode: z.string().max(40),
      hypeNote: z.string().max(200),
      hypePlan: hypePlanEnum.nullable(),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<Ok> => {
      // Hype is killed until later — not visible, not usable. An
      // "on" request is refused outright; an "off" request just
      // clears whatever listing is stored.
      if (args.hypeOn) {
        throw new Error(
          "setHype: Hype is paused for now — it will return later.",
        );
      }
      const db = ctx.db<typeof schema>();
      const existing = await loadProfile(ctx);
      const values = {
        ...existing,
        qualities:
          typeof existing.qualities === "string"
            ? existing.qualities
            : JSON.stringify(existing.qualities),
        hypeOn: false,
        hypeSpot: "",
        hypeMode: "",
        hypeNote: "",
        hypeExpiresAt: null,
        hypePaidCents: null,
        hypePlan: "",
        updatedAt: new Date(),
      };
      await db
        .insert(schema.myProfile)
        .values(values)
        .onConflictDoUpdate({ target: schema.myProfile.id, set: values });
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  addListItem: defineAction({
    description: "Add an item to The List: a Want (flat, 3 max per owner across the old must/nice kinds — personId null is the user's own Want, a member id is THAT member's own Want, kept separate from the user's List and scoring), a dealbreaker (the user's background only), or a wishlist entry (kind gift — a Desire, never a Want) with its category (the same category list as Provides), occasion, price note, link, status and whose wishlist it is on.",
    request: z.object({
      kind: listKind,
      text: z.string().min(1).max(120),
      category: z.string().max(60).optional(),
      personId: z.number().int().positive().nullable().optional(),
      occasion: z.string().max(80).optional(),
      priceNote: z.string().max(80).optional(),
      link: z.string().max(500).optional(),
      giftStatus: giftStatus.optional(),
    }),
    response: z.object({ id: z.number() }),
    handler: async (ctx, args) => {
      assertCleanWording(args.text, args.category, args.occasion, args.priceNote, args.link);
      const db = ctx.db<typeof schema>();
      const isGift = args.kind === "gift";
      let personName = "";
      // Owner of the row (2026-11-04 separation): gift rows keep
      // their wishlist owner (null = the user's General Desires,
      // a member id = that member's Desires). Scored Want rows
      // (must / nice) now carry an owner too: null = the USER's
      // own Wants; a member id = THAT member's own Wants — the
      // same store and kinds as the user's Wants, told apart by
      // personId, and never mixed into the user's List or
      // scoring. Dealbreakers are the user's background only and
      // always stay unowned.
      const personId =
        args.kind === "dealbreaker" ? null : (args.personId ?? null);
      // Flat Wants cap (2026-11-03, superseding the split caps):
      // The List is flat Wants, 3 max TOTAL — the old must and
      // nice kinds are both Wants now and count together in one
      // pool, with no sections and no weighting. The cap only
      // gates ADDING: existing rows over the cap are never
      // deleted or converted here; Erin trims them herself.
      // Dealbreakers stay uncapped (background warnings only),
      // and three wishlist entries (Desires) max per wishlist —
      // Desires are separate and never counted in the Wants or
      // the match %. Matching is Wants vs Provides, so both
      // sides stay short: Wants 3 max, Provides 3 max.
      // The Wants cap is PER OWNER (2026-11-04): the user's 3
      // and each member's own 3 are separate pools — a member's
      // Wants never fill the user's List, and vice versa.
      if (args.kind === "must" || args.kind === "nice") {
        const wants = await db
          .select()
          .from(schema.listItems)
          .where(
            or(
              eq(schema.listItems.kind, "must"),
              eq(schema.listItems.kind, "nice"),
            ),
          );
        const mine = wants.filter(
          (w) => (w.personId ?? null) === personId,
        );
        if (mine.length >= 3) {
          throw new Error(
            personId === null
              ? "Your Wants are full — 3 max. Remove one first."
              : "Their Wants are full — 3 max. Remove one first.",
          );
        }
      }
      if (isGift) {
        const gifts = await db
          .select()
          .from(schema.listItems)
          .where(eq(schema.listItems.kind, "gift"));
        const mine = gifts.filter(
          (g) => (g.personId ?? null) === personId,
        );
        if (mine.length >= 3) {
          throw new Error("That Desires list is full — 3 max each (General, or for one person). Remove one first.");
        }
      }
      if (personId !== null) {
        const rows = await db
          .select()
          .from(schema.people)
          .where(eq(schema.people.id, personId));
        personName = rows[0]?.name ?? "";
      }
      const result = await db
        .insert(schema.listItems)
        .values({
          kind: args.kind,
          text: args.text.trim(),
          // The Want/Need category: scored items keep the category
          // picked in Profile Edit; gift entries always keep it.
          category: (args.category ?? "").trim(),
          personId,
          personName,
          // Occasion / price note ride along on gift rows and on
          // a member's own Want rows (their Want editor collects
          // them, exactly as before); the user's own Want rows
          // keep them blank, as before.
          occasion:
            isGift || personId !== null ? (args.occasion ?? "").trim() : "",
          priceNote:
            isGift || personId !== null ? (args.priceNote ?? "").trim() : "",
          link: isGift ? (args.link ?? "").trim() : "",
          giftStatus: isGift ? (args.giftStatus ?? "idea") : null,
        })
        .returning({ id: schema.listItems.id });
      const inserted = result[0];
      if (!inserted) throw new Error("addListItem: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  updateListItemGift: defineAction({
    description: "Update a wishlist entry on The List: its title, category (the same category list as Provides), whose wishlist it is on, occasion, price note, link and status.",
    request: z.object({
      id: z.number().int().positive(),
      title: z.string().min(1).max(120),
      category: z.string().max(60),
      personId: z.number().int().positive().nullable(),
      occasion: z.string().max(80),
      priceNote: z.string().max(80),
      link: z.string().max(500),
      status: giftStatus,
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<Ok> => {
      assertCleanWording(args.title, args.category, args.occasion, args.priceNote, args.link);
      const db = ctx.db<typeof schema>();
      // Cap (Erin's direction, 2026-11-04): up to 3 desires
      // each — General, or for one person. Moving an entry into
      // a group that already has 3 is refused, same as adding
      // a fourth there.
      const existingRows = await db
        .select()
        .from(schema.listItems)
        .where(eq(schema.listItems.id, args.id));
      const currentRow = existingRows[0];
      if (currentRow && (currentRow.personId ?? null) !== args.personId) {
        const allGifts = await db
          .select()
          .from(schema.listItems)
          .where(eq(schema.listItems.kind, "gift"));
        if (
          allGifts.filter((g) => (g.personId ?? null) === args.personId)
            .length >= 3
        ) {
          throw new Error(
            "That Desires list is full — 3 max each (General, or for one person). Remove one first.",
          );
        }
      }
      let personName = "";
      if (args.personId !== null) {
        const rows = await db
          .select()
          .from(schema.people)
          .where(eq(schema.people.id, args.personId));
        personName = rows[0]?.name ?? "";
      }
      await db
        .update(schema.listItems)
        .set({
          text: args.title.trim(),
          category: args.category.trim(),
          personId: args.personId,
          personName,
          occasion: args.occasion.trim(),
          priceNote: args.priceNote.trim(),
          link: args.link.trim(),
          giftStatus: args.status,
        })
        .where(eq(schema.listItems.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  deleteListItem: defineAction({
    description: "Remove an item from the user's List and clear any per-member checks for it.",
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    handler: async (ctx, args): Promise<Ok> => {
      const db = ctx.db<typeof schema>();
      await db.batch([
        db.delete(schema.listItems).where(eq(schema.listItems.id, args.id)),
        db
          .delete(schema.personChecks)
          .where(eq(schema.personChecks.listItemId, args.id)),
      ]);
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  addProvide: defineAction({
    description: "Add a Provide entry \u2014 what this person can cover, its category, and the most they will spend \u2014 for the user's profile or for a member. Wants and Provides are each capped at 3 independently: one side never limits the other, and existing entries are never deleted to enforce the cap.",
    request: z.object({
      ownerType: z.enum(["profile", "person"]),
      // null = the user's own profile; otherwise the member's id
      personId: z.number().int().positive().nullable(),
      category: z.string().max(60),
      title: z.string().min(1).max(120),
      maxSpendCents: z.number().int().min(0).max(10000000).nullable(),
      note: z.string().max(200),
    }),
    response: z.object({ id: z.number() }),
    handler: async (ctx, args) => {
      assertCleanWording(args.category, args.title, args.note);
      const db = ctx.db<typeof schema>();
      const ownerId = args.ownerType === "profile" ? 1 : args.personId;
      if (ownerId === null || ownerId === undefined) {
        throw new Error("addProvide: missing owner");
      }
      const existingProvides = await db
        .select()
        .from(schema.provides)
        .where(
          and(
            eq(schema.provides.ownerType, args.ownerType),
            eq(schema.provides.ownerId, ownerId),
          ),
        );
      // Independent 3 cap (Erin's direction, 2026-11-02,
      // corrected the same evening): Wants and Provides are each
      // capped at 3 INDEPENDENTLY. There is NO link between the
      // sides \u2014 a person may have 1 Want and 3 Provides, or
      // 0 Wants and 3 Provides; only a side's own count matters.
      // An earlier balanced rule (Provides at or under Wants) was
      // removed at Erin's direction. The cap only gates ADDING:
      // existing entries are never deleted to enforce it.
      if (existingProvides.length >= 3) {
        throw new Error(
          "Wants and Provides are capped at 3 each \u2014 3 Provides is the max. Remove a Provide first.",
        );
      }
      if (args.ownerType === "person") {
        const rows = await db
          .select()
          .from(schema.people)
          .where(eq(schema.people.id, ownerId));
        if (!rows[0]) throw new Error("addProvide: member not found");
      } else {
        const existing = await loadProfile(ctx);
        await db
          .insert(schema.myProfile)
          .values({
            ...existing,
            qualities:
              typeof existing.qualities === "string"
                ? existing.qualities
                : JSON.stringify(existing.qualities),
          })
          .onConflictDoNothing();
      }
      const result = await db
        .insert(schema.provides)
        .values({
          ownerType: args.ownerType,
          ownerId,
          category: args.category.trim(),
          title: args.title.trim(),
          maxSpendCents: args.maxSpendCents,
          note: args.note.trim(),
        })
        .returning({ id: schema.provides.id });
      const inserted = result[0];
      if (!inserted) throw new Error("addProvide: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  updateProvide: defineAction({
    description: "Update a Provide entry's category, title, max spend and note.",
    request: z.object({
      id: z.number().int().positive(),
      category: z.string().max(60),
      title: z.string().min(1).max(120),
      maxSpendCents: z.number().int().min(0).max(10000000).nullable(),
      note: z.string().max(200),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<Ok> => {
      assertCleanWording(args.category, args.title, args.note);
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.provides)
        .set({
          category: args.category.trim(),
          title: args.title.trim(),
          maxSpendCents: args.maxSpendCents,
          note: args.note.trim(),
        })
        .where(eq(schema.provides.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  deleteProvide: defineAction({
    description: "Remove a Provide entry.",
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    handler: async (ctx, args): Promise<Ok> => {
      const db = ctx.db<typeof schema>();
      await db
        .delete(schema.provides)
        .where(eq(schema.provides.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  addPerson: defineAction({
    description: "Add someone by hand with name, age, bio, location, times available, their stated gender (man / woman / not set) and Same sex toggle, qualities and usual spot.",
    request: z.object({
      name: z.string().min(1).max(80),
      age: ageField,
      bio: z.string().max(600),
      location: z.string().max(120),
      availableTimes: z.string().max(200),
      gender: genderField,
      sameSex: z.boolean(),
      qualities: z.array(z.string().max(60)).max(30),
      spot: z.string().max(80),
    }),
    response: z.object({ id: z.number() }),
    handler: async (ctx, args) => {
      assertCleanWording(
        args.name,
        args.bio,
        args.location,
        args.availableTimes,
        args.qualities,
        args.spot,
      );
      assertOwnSpotAllowedForAge(args.spot, args.age);
      const db = ctx.db<typeof schema>();
      const result = await db
        .insert(schema.people)
        .values({
          source: "added",
          name: args.name.trim(),
          age: args.age,
          bio: args.bio.trim(),
          location: args.location.trim(),
          availableTimes: args.availableTimes.trim(),
          gender: args.gender,
          sameSex: args.sameSex,
          qualities: JSON.stringify(args.qualities.map((q) => q.trim()).filter(Boolean)),
          spot: args.spot.trim(),
        })
        .returning({ id: schema.people.id });
      const inserted = result[0];
      if (!inserted) throw new Error("addPerson: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  joinDiscover: defineAction({
    description: "Join Discover as a new member with a profile, their stated gender (\"I am\": man / woman / not set) and Same sex toggle, qualities, Hype choices, and an optional promo code.",
    request: z.object({
      name: z.string().min(1).max(80),
      // Joining is 18 to 99: age is required here (unlike the
      // nullable ageField used when the owner records someone by
      // hand), so a member can never join with a blank age, and an
      // age outside the 18–99 membership range is rejected.
      age: z
        .number()
        .int()
        .min(18, "Age must be 18 or older — List Dating is for members 18 to 99")
        .max(99, "Age must be 99 or younger — List Dating is for members 18 to 99"),
      bio: z.string().max(600),
      location: z.string().max(120),
      availableTimes: z.string().max(200),
      gender: genderField,
      sameSex: z.boolean(),
      qualities: z.array(z.string().max(60)).max(30),
      spot: z.string().max(80),
      contactPref,
      hypeOn: z.boolean(),
      hypeSpot: z.string().max(80),
      hypeMode: z.string().max(40),
      hypeNote: z.string().max(200),
      hypePlan: hypePlanEnum.nullable(),
      promoCode: z.string().max(40),
    }),
    response: z.object({ id: z.number() }),
    handler: async (ctx, args) => {
      assertCleanWording(
        args.name,
        args.bio,
        args.location,
        args.availableTimes,
        args.qualities,
        args.spot,
      );
      assertOwnSpotAllowedForAge(args.spot, args.age);
      // Hype wording is only checked when the listing is
      // actually being switched on (same rule as setHype:
      // switching off discards rather than displays).
      if (args.hypeOn) {
        assertCleanWording(args.hypeSpot, args.hypeMode, args.hypeNote);
      }
      const db = ctx.db<typeof schema>();
      // A promo code is optional, but when one is entered it has to be a
      // real, active code with uses left — an invalid code can't join.
      let promoCodeId: number | null = null;
      let promoCodeText = "";
      const entered = normalizeCode(args.promoCode);
      if (entered) {
        const codeRows = await db.select().from(schema.promoCodes);
        const match = codeRows.find((c) => c.code === entered);
        if (!match) {
          throw new Error("joinDiscover: that promo code isn't valid");
        }
        if (!match.active) {
          throw new Error("joinDiscover: that promo code is no longer active");
        }
        if (match.maxUses !== null) {
          const joined = await db.select().from(schema.people);
          const uses = joined.filter((p) => p.promoCodeId === match.id).length;
          if (uses >= match.maxUses) {
            throw new Error("joinDiscover: that promo code has been fully used");
          }
        }
        promoCodeId = match.id;
        promoCodeText = match.code;
      }
      // Hype is killed until later: a join never creates a Hype
      // listing or a Hype payment, whatever the request carries.
      // The hype fields stay in the request shape so older clients
      // keep working; they are stored cleared.
      const result = await db
        .insert(schema.people)
        .values({
          source: "joined",
          name: args.name.trim(),
          age: args.age,
          bio: args.bio.trim(),
          location: args.location.trim(),
          availableTimes: args.availableTimes.trim(),
          gender: args.gender,
          sameSex: args.sameSex,
          qualities: JSON.stringify(args.qualities.map((q) => q.trim()).filter(Boolean)),
          spot: args.spot.trim(),
          contactPref: args.contactPref,
          hypeOn: false,
          hypeSpot: "",
          hypeMode: "",
          hypeNote: "",
          hypeExpiresAt: null,
          hypePaidCents: null,
          hypePlan: "",
          promoCodeId,
          promoCode: promoCodeText,
        })
        .returning({ id: schema.people.id });
      const inserted = result[0];
      if (!inserted) throw new Error("joinDiscover: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  updatePerson: defineAction({
    description: "Update a member's profile, times available, stated gender and Same sex toggle, qualities, spot, contact preference and Hype details.",
    request: z.object({
      id: z.number().int().positive(),
      name: z.string().min(1).max(80),
      age: ageField,
      bio: z.string().max(600),
      location: z.string().max(120),
      availableTimes: z.string().max(200),
      gender: genderField,
      sameSex: z.boolean(),
      qualities: z.array(z.string().max(60)).max(30),
      spot: z.string().max(80),
      contactPref,
      hypeOn: z.boolean(),
      hypeSpot: z.string().max(80),
      hypeMode: z.string().max(40),
      hypeNote: z.string().max(200),
      hypePlan: hypePlanEnum.nullable(),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<Ok> => {
      const db = ctx.db<typeof schema>();
      const existingRows = await db
        .select()
        .from(schema.people)
        .where(eq(schema.people.id, args.id));
      const existingPerson = existingRows[0];
      if (!existingPerson) throw new Error("updatePerson: person not found");
      // Content filter: every UI-editable field is checked. The
      // qualities value is passed through unchanged by the current
      // UI, so it is only checked when it actually changes — a
      // legacy stored tag can never wedge saving this member.
      assertCleanWording(
        args.name,
        args.bio,
        args.location,
        args.availableTimes,
        args.spot,
      );
      assertOwnSpotAllowedForAge(args.spot, args.age);
      if (args.hypeOn) {
        assertCleanWording(args.hypeSpot, args.hypeMode, args.hypeNote);
      }
      if (
        JSON.stringify(args.qualities.map((q) => q.trim()).filter(Boolean)) !==
        existingPerson.qualities
      ) {
        assertCleanWording(args.qualities);
      }
      // Hype is killed until later: an edit never creates or
      // keeps a Hype listing or payment — the member's Hype
      // fields are stored cleared, whatever the request carries.
      await db
        .update(schema.people)
        .set({
          name: args.name.trim(),
          age: args.age,
          bio: args.bio.trim(),
          location: args.location.trim(),
          availableTimes: args.availableTimes.trim(),
          gender: args.gender,
          sameSex: args.sameSex,
          qualities: JSON.stringify(args.qualities.map((q) => q.trim()).filter(Boolean)),
          spot: args.spot.trim(),
          contactPref: args.contactPref,
          hypeOn: false,
          hypeSpot: "",
          hypeMode: "",
          hypeNote: "",
          hypeExpiresAt: null,
          hypePaidCents: null,
          hypePlan: "",
        })
        .where(eq(schema.people.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  deletePerson: defineAction({
    description: "Remove a member entirely, including their photos, checks, dates, safety check-ins, messages, wishlist unlocks, Hype payments and Provide entries.",
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    handler: async (ctx, args): Promise<Ok> => {
      const db = ctx.db<typeof schema>();
      const photoRows = await db.select().from(schema.photos);
      const mine = photoRows.filter((p) => p.ownerType === "person" && p.ownerId === args.id);
      for (const ph of mine) {
        try { await ctx.blobs.delete(ph.blobKey); } catch { /* best effort */ }
        await db.delete(schema.photos).where(eq(schema.photos.id, ph.id));
      }
      await db.batch([
        db.delete(schema.people).where(eq(schema.people.id, args.id)),
        db
          .delete(schema.personChecks)
          .where(eq(schema.personChecks.personId, args.id)),
        db.delete(schema.dates).where(eq(schema.dates.personId, args.id)),
        db
          .delete(schema.safetyCheckins)
          .where(eq(schema.safetyCheckins.personId, args.id)),
        db.delete(schema.messages).where(eq(schema.messages.personId, args.id)),
        db
          .delete(schema.wishlistUnlocks)
          .where(eq(schema.wishlistUnlocks.personId, args.id)),
        db
          .delete(schema.hypePayments)
          .where(eq(schema.hypePayments.personId, args.id)),
        db
          .delete(schema.provides)
          .where(
            and(
              eq(schema.provides.ownerType, "person"),
              eq(schema.provides.ownerId, args.id),
            ),
          ),
        // Every List row owned by this member goes with them:
        // their own Wants (scored rows tied to them) AND their
        // Desires / Gifts (gift rows tied to them). The user's
        // own rows carry personId null and are never matched.
        db
          .delete(schema.listItems)
          .where(eq(schema.listItems.personId, args.id)),
      ]);
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  uploadPhoto: defineAction({
    description: "Upload a photo for the user's profile or a member (up to 3 each); the image bytes are stored as a blob.",
    request: z.object({
      target: z.enum(["profile", "person"]),
      personId: z.number().int().positive().nullable(),
      dataBase64: z.string().min(1).max(12000000),
      mimeType: z.string().max(80),
    }),
    response: z.object({ id: z.number(), url: z.string() }),
    handler: async (ctx, args) => {
      if (!ALLOWED_PHOTO_TYPES.includes(args.mimeType)) {
        throw new Error("uploadPhoto: only JPEG, PNG, WebP or GIF photos are allowed");
      }
      const db = ctx.db<typeof schema>();
      const ownerType = args.target;
      const ownerId = args.target === "profile" ? 1 : args.personId;
      if (ownerId === null || ownerId === undefined) throw new Error("uploadPhoto: missing owner");
      if (args.target === "person") {
        const rows = await db.select().from(schema.people).where(eq(schema.people.id, ownerId));
        if (!rows[0]) throw new Error("uploadPhoto: member not found");
      } else {
        // Ensure the single profile row exists so the photo has a home
        const existing = await loadProfile(ctx);
        await db.insert(schema.myProfile).values({ ...existing, qualities: typeof existing.qualities === "string" ? existing.qualities : JSON.stringify(existing.qualities) }).onConflictDoNothing();
      }
      const existingPhotos = await db.select().from(schema.photos);
      const ownPhotos = existingPhotos.filter((p) => p.ownerType === ownerType && p.ownerId === ownerId);
      const count = ownPhotos.length;
      if (count >= 3) throw new Error("uploadPhoto: up to 3 photos per profile — that's the max, remove one first");
      const bytes = base64ToBytes(args.dataBase64);
      if (bytes.length === 0) throw new Error("uploadPhoto: empty file");
      if (bytes.length > 8000000) throw new Error("uploadPhoto: photo is too large");
      const key = `photos/${ownerType}/${ownerId}/${Date.now()}-${Math.floor(Math.random()*100000)}.${extFor(args.mimeType)}`;
      await ctx.blobs.put(key, bytes, { contentType: args.mimeType });
      // A new photo goes last in the display order.
      const nextSort = ownPhotos.reduce((max, p) => Math.max(max, p.sortOrder), -1) + 1;
      const result = await db.insert(schema.photos).values({ ownerType, ownerId, blobKey: key, contentType: args.mimeType, sortOrder: nextSort }).returning({ id: schema.photos.id });
      const inserted = result[0];
      if (!inserted) throw new Error("uploadPhoto: insert returned no rows");
      const url = await ctx.blobs.getUrl(key);
      ctx.invalidateQueries();
      return { id: inserted.id, url };
    },
  }),

  deletePhoto: defineAction({
    description: "Delete one uploaded photo and its stored image.",
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    handler: async (ctx, args): Promise<Ok> => {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.photos).where(eq(schema.photos.id, args.id));
      const row = rows[0];
      if (row) {
        try { await ctx.blobs.delete(row.blobKey); } catch { /* best effort */ }
        await db.delete(schema.photos).where(eq(schema.photos.id, args.id));
      }
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  reorderPhotos: defineAction({
    description: "Reorder one owner's photos (the user's profile or a member's) into exactly the order given: the first photo id becomes the profile picture. Only the display order changes — no photo is deleted, replaced or re-uploaded, and nothing else (matches, dates, chats, Wants, Provides, Dealbreakers, the saved Meta AI key) is touched.",
    request: z.object({
      target: z.enum(["profile", "person"]),
      personId: z.number().int().positive().nullable(),
      photoIds: z.array(z.number().int().positive()).min(1).max(3),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<Ok> => {
      const db = ctx.db<typeof schema>();
      const ownerType = args.target;
      const ownerId = args.target === "profile" ? 1 : args.personId;
      if (ownerId === null || ownerId === undefined) throw new Error("reorderPhotos: missing owner");
      const rows = await db.select().from(schema.photos);
      const own = rows.filter((p) => p.ownerType === ownerType && p.ownerId === ownerId);
      // The given order must name each of this owner's photos exactly
      // once — a partial or foreign list changes nothing.
      if (own.length !== args.photoIds.length || !own.every((p) => args.photoIds.includes(p.id))) {
        throw new Error("reorderPhotos: the order must list every photo for this profile exactly once");
      }
      for (const [i, id] of args.photoIds.entries()) {
        await db.update(schema.photos).set({ sortOrder: i }).where(eq(schema.photos.id, id));
      }
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  setKoaSamplePhotos: defineAction({
    description: "Set Koa's three confirmed blended sample photos as his profile photos, in order — outdoor knee-up first (his profile picture), restaurant second, indoor table third — exactly three and never a fourth. Idempotent: adds only missing slots and is a no-op once Koa has photos. Changes nothing else: not Koa's name, bio, age, location, Wants, Provides, caps, scores, Deal/accepted status, dates or plans, not anyone else's photos, and not Erin's profile, List, Provides or saved Meta AI key.",
    request: z.object({}),
    response: setKoaSamplePhotosResponse,
    handler: async (ctx): Promise<SetKoaSamplePhotosResult> => {
      requireOwner(ctx);
      const db = ctx.db<typeof schema>();
      const peopleRows = await db.select().from(schema.people);
      const koa =
        peopleRows.find((p) => p.id === 178 && isShowcaseMember(p, "Koa")) ??
        peopleRows.find((p) => isShowcaseMember(p, "Koa"));
      if (!koa) return { ok: true as const, koaFound: false, added: 0, total: 0 };
      const photoRows = await db.select().from(schema.photos);
      const existing = photoRows
        .filter((p) => p.ownerType === "person" && p.ownerId === koa.id)
        .sort((a, b) => a.id - b.id);
      const samples = [
        { b64: KOA_SAMPLE_PHOTO_OUTDOOR_B64, slot: "outdoor" },
        { b64: KOA_SAMPLE_PHOTO_RESTAURANT_B64, slot: "restaurant" },
        { b64: KOA_SAMPLE_PHOTO_INDOOR_B64, slot: "indoor-table" },
      ];
      let added = 0;
      for (let i = existing.length; i < samples.length; i++) {
        const sample = samples[i];
        if (!sample) continue;
        const bytes = base64ToBytes(sample.b64);
        if (bytes.length === 0) throw new Error("setKoaSamplePhotos: empty sample photo");
        const key = `photos/person/${koa.id}/koa-sample-${sample.slot}.webp`;
        await ctx.blobs.put(key, bytes, { contentType: "image/webp" });
        await db.insert(schema.photos).values({
          ownerType: "person",
          ownerId: koa.id,
          blobKey: key,
          contentType: "image/webp",
        });
        added += 1;
      }
      ctx.invalidateQueries();
      return { ok: true as const, koaFound: true, added, total: existing.length + added };
    },
  }),

  setAlexSamplePhotos: defineAction({
    description: "Set Alex's three confirmed balanced Alex + Jake Gyllenhaal blended sample photos as his profile photos, in order — blue T-shirt solo first (his profile picture), green shirt bar crop second, beach sunset third — exactly three and never a fourth. Alex is personId 1843. Idempotent: adds only missing slots and is a no-op once Alex has photos. Changes nothing else: not Alex's name, bio, age, location, Wants, Provides, caps, scores, Deal/accepted status, dates or plans, not anyone else's photos including Koa's, and not Erin's profile, List, Provides or saved Meta AI key.",
    request: z.object({}),
    response: setAlexSamplePhotosResponse,
    handler: async (ctx): Promise<SetAlexSamplePhotosResult> => {
      requireOwner(ctx);
      const db = ctx.db<typeof schema>();
      const peopleRows = await db.select().from(schema.people);
      const alex =
        peopleRows.find((p) => p.id === 1843 && isShowcaseMember(p, "Alex")) ??
        peopleRows.find((p) => p.id === 1843) ??
        peopleRows.find((p) => isShowcaseMember(p, "Alex"));
      if (!alex) return { ok: true as const, alexFound: false, added: 0, total: 0 };
      const photoRows = await db.select().from(schema.photos);
      const existing = photoRows
        .filter((p) => p.ownerType === "person" && p.ownerId === alex.id)
        .sort((a, b) => a.id - b.id);
      const samples = [
        { b64: ALEX_SAMPLE_PHOTO_BLUE_B64, slot: "blue" },
        { b64: ALEX_SAMPLE_PHOTO_GREEN_B64, slot: "green" },
        { b64: ALEX_SAMPLE_PHOTO_BEACH_B64, slot: "beach" },
      ];
      let added = 0;
      for (let i = existing.length; i < samples.length; i++) {
        const sample = samples[i];
        if (!sample) continue;
        const bytes = base64ToBytes(sample.b64);
        if (bytes.length === 0) throw new Error("setAlexSamplePhotos: empty sample photo");
        const key = `photos/person/${alex.id}/alex-sample-${sample.slot}.webp`;
        await ctx.blobs.put(key, bytes, { contentType: "image/webp" });
        await db.insert(schema.photos).values({
          ownerType: "person",
          ownerId: alex.id,
          blobKey: key,
          contentType: "image/webp",
        });
        added += 1;
      }
      ctx.invalidateQueries();
      return { ok: true as const, alexFound: true, added, total: existing.length + added };
    },
  }),

  setLeilaniSamplePhotos: defineAction({
    description: "Set Leilani's three confirmed blended sample photos as her profile photos, in this order — mountain (Dorothy Wang blend, more blonde highlights) first as her profile picture, black dress (Kylie blend, blonde highlights) second, yoga in front of the ocean (Dorothy Wang blend, blonde highlights) third — exactly three, never a fourth, and the earlier taro field photo removed. Leilani is personId 1844. Replaces her previous photo set with exactly these three; idempotent: once her photos already are exactly these three in this order, a further run adds 0. Changes nothing else: not Leilani's bio, Wants, Provides, score or match/chat state, not Erin, Alex or Koa or their photos, dates, plans or messages, and not Erin's saved Meta AI key.",
    request: z.object({}),
    response: setLeilaniSamplePhotosResponse,
    handler: async (ctx): Promise<SetLeilaniSamplePhotosResult> => {
      requireOwner(ctx);
      const db = ctx.db<typeof schema>();
      const peopleRows = await db.select().from(schema.people);
      const leilani =
        peopleRows.find((p) => p.id === 1844 && isShowcaseMember(p, "Leilani")) ??
        peopleRows.find((p) => p.id === 1844) ??
        peopleRows.find((p) => isShowcaseMember(p, "Leilani"));
      if (!leilani) return { ok: true as const, leilaniFound: false, added: 0, total: 0 };
      const samples = [
        { b64: LEILANI_SAMPLE_PHOTO_MOUNTAIN_BLONDE_B64, slot: "mountain-blonde" },
        { b64: LEILANI_SAMPLE_PHOTO_BLACK_DRESS_BLONDE_B64, slot: "black-dress-blonde" },
        { b64: LEILANI_SAMPLE_PHOTO_YOGA_BLONDE_V2_B64, slot: "yoga-blonde-v2" },
      ];
      const expectedKeys = samples.map(
        (s) => `photos/person/${leilani.id}/leilani-sample-${s.slot}.webp`,
      );
      const photoRows = await db.select().from(schema.photos);
      const existing = photoRows
        .filter((p) => p.ownerType === "person" && p.ownerId === leilani.id)
        .sort((a, b) => a.id - b.id);
      const alreadySet =
        existing.length === expectedKeys.length &&
        existing.every((p, i) => p.blobKey === expectedKeys[i]);
      if (alreadySet) {
        return { ok: true as const, leilaniFound: true, added: 0, total: existing.length };
      }
      // Replace the whole set: remove every existing Leilani photo
      // row (taro included) and its blob, then insert exactly the
      // three new photos in order — first inserted is her profile
      // picture (photos render in id order).
      for (const ph of existing) {
        try { await ctx.blobs.delete(ph.blobKey); } catch { /* best effort */ }
        await db.delete(schema.photos).where(eq(schema.photos.id, ph.id));
      }
      let added = 0;
      for (let i = 0; i < samples.length; i++) {
        const sample = samples[i];
        const key = expectedKeys[i];
        if (!sample || !key) continue;
        const bytes = base64ToBytes(sample.b64);
        if (bytes.length === 0) throw new Error("setLeilaniSamplePhotos: empty sample photo");
        await ctx.blobs.put(key, bytes, { contentType: "image/webp" });
        await db.insert(schema.photos).values({
          ownerType: "person",
          ownerId: leilani.id,
          blobKey: key,
          contentType: "image/webp",
        });
        added += 1;
      }
      ctx.invalidateQueries();
      return { ok: true as const, leilaniFound: true, added, total: added };
    },
  }),

  setPersonCheck: defineAction({
    description: "Set whether a member fulfills one specific List item, overriding the automatic quality match.",
    request: z.object({
      personId: z.number().int().positive(),
      listItemId: z.number().int().positive(),
      present: z.boolean(),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<Ok> => {
      const db = ctx.db<typeof schema>();
      const existing = await db
        .select()
        .from(schema.personChecks)
        .where(eq(schema.personChecks.personId, args.personId));
      const row = existing.find((c) => c.listItemId === args.listItemId);
      if (row) {
        await db
          .update(schema.personChecks)
          .set({ present: args.present })
          .where(eq(schema.personChecks.id, row.id));
      } else {
        await db.insert(schema.personChecks).values({
          personId: args.personId,
          listItemId: args.listItemId,
          present: args.present,
        });
      }
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  setBlocked: defineAction({
    description: "Block or unblock a member.",
    request: z.object({
      personId: z.number().int().positive(),
      blocked: z.boolean(),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<Ok> => {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.people)
        .set({ blocked: args.blocked })
        .where(eq(schema.people.id, args.personId));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  setMatchDecision: defineAction({
    description:
      "Record the user's decision on a match: make a Deal with them (shown as Deal in the app), decline/remove the person from Matches, or clear the decision to restore them.",
    request: z.object({
      personId: z.number().int().positive(),
      decision: z.enum(["none", "accepted", "declined"]),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<Ok> => {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.people)
        .where(eq(schema.people.id, args.personId));
      const person = rows[0];
      if (!person) throw new Error("setMatchDecision: person not found");
      // A decision is only about matching: it never deletes the
      // person, never blocks them, and never creates a date or a
      // chat. "declined" takes them out of Matches / Potential and
      // out of matching with the user's profile; "none" restores
      // them exactly as they were.
      await db
        .update(schema.people)
        .set({ matchDecision: args.decision })
        .where(eq(schema.people.id, args.personId));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  // ---------- Out of the Blue Deal ----------
  //
  // Erin's direction (2026-11-03): List Dating has a built-in
  // element of surprise. A person at 0% SPECIFIC — no Provide
  // covers a Want either way, so they are not a Match and not a
  // Potential — can appear in Matches as a 2% Out of the Blue
  // option. Pushing it is the user's choice: it makes a Deal
  // (matchDecision "accepted", exactly like a normal Deal) and
  // creates ONE date from an uncovered Want, so the client can
  // immediately run generateDatePlan for that date — the same
  // Meta AI plan flow (saved key, server-side only) as a normal
  // Plan the Date. The 2% is NOT a cover: this action never
  // changes any score, cover, List item, Provide or existing
  // date/plan, and because the whole point is trying to make a
  // surprise happen, it deliberately does NOT require a trait,
  // a Provide cover or the proposeDate contact gate — the
  // user's push IS the agency here. An existing non-declined
  // date for the picked Want is reused, never duplicated, and
  // its saved plan is left for generateDatePlan's cache rules.
  createOutOfBlueDeal: defineAction({
    description:
      "Accept a 2% Out of the Blue surprise as a Deal: for a person at 0% specific covers (not a Match, not a Potential), record the Deal and create (or reuse) one date from an uncovered Want, returning its id so the client can run the normal Meta AI date plan for that specific deal. Never changes Match or Potential scoring.",
    request: z.object({
      personId: z.number().int().positive(),
    }),
    response: z.object({
      ok: z.literal(true),
      dateId: z.number(),
      listItemId: z.number(),
      ideaText: z.string(),
      alreadyHadDate: z.boolean(),
      alreadyDeal: z.boolean(),
    }),
    handler: async (ctx, args) => {
      const db = ctx.db<typeof schema>();
      const [personRows, allItems, checkRows, profile, provideRows, dateRows] =
        await Promise.all([
          db
            .select()
            .from(schema.people)
            .where(eq(schema.people.id, args.personId)),
          db.select().from(schema.listItems),
          db.select().from(schema.personChecks),
          loadProfile(ctx),
          db.select().from(schema.provides),
          db.select().from(schema.dates),
        ]);
      const person = personRows[0];
      if (!person) throw new Error("createOutOfBlueDeal: person not found");
      if (person.blocked) throw new Error("createOutOfBlueDeal: person is blocked");
      const scoredItems = allItems.filter((i) => i.kind !== "gift" && (i.personId ?? null) === null);
      const giftRows = allItems.filter((i) => i.kind === "gift");
      const personProvides = provideRows.filter(
        (pv) => pv.ownerType === "person" && pv.ownerId === person.id,
      );
      const myProvides = provideRows.filter(
        (pv) => pv.ownerType === "profile",
      );
      const personGifts = giftRows.filter((g) => g.personId === person.id);
      const scored = scorePerson(
        person,
        scoredItems,
        checkRows,
        profile,
        dateRows.some(
          (d) => d.personId === person.id && d.status === "accepted",
        ),
        [],
        { unread: 0, lastBody: "", lastAt: null },
        personProvides,
        myProvides,
        personGifts,
      );
      if (!scored.outOfBlue) {
        throw new Error(
          "createOutOfBlueDeal: this person isn't an Out of the Blue surprise — Out of the Blue is only for someone at 0% specific who is not a Match or a Potential in your current mode. A Match or Potential uses the normal Deal and Plan the date.",
        );
      }
      // Pick the surprise idea: my first uncovered Want (in List
      // order — for Erin that is Yoga, Leilani's Haleiwa Beach
      // Park surprise), else this member's first uncovered Want
      // on their wishlist. Uncovered only: a covered Want would
      // be a specific cover, and this is not one.
      const coveredWantIds = new Set(
        scored.needCovers.map((c) => c.listItemId),
      );
      const coveredGiftIds = new Set(
        scored.coveredByMe.map((c) => c.giftId),
      );
      const myWant = scoredItems
        .filter((i) => i.kind === "must" || i.kind === "nice")
        .sort((a, b) => a.id - b.id)
        .find((i) => !coveredWantIds.has(i.id));
      const theirWant = personGifts
        .filter((g) => g.giftStatus !== "given")
        .sort((a, b) => a.id - b.id)
        .find((g) => !coveredGiftIds.has(g.id));
      const idea = myWant ?? theirWant;
      if (!idea) {
        throw new Error(
          "createOutOfBlueDeal: there is no Want to build a surprise date from yet — add a Want to a List first.",
        );
      }
      const alreadyDeal = person.matchDecision === "accepted";
      const existing = dateRows
        .filter(
          (d) =>
            d.personId === person.id &&
            d.listItemId === idea.id &&
            d.status !== "declined",
        )
        .sort((a, b) => a.id - b.id)[0];
      let dateId: number;
      let alreadyHadDate = false;
      if (existing) {
        dateId = existing.id;
        alreadyHadDate = true;
      } else {
        const insertedRows = await db
          .insert(schema.dates)
          .values({
            personId: person.id,
            personName: person.name,
            direction: "out",
            listItemId: idea.id,
            ideaText: idea.text,
            meetAt: null,
            spot: "",
            note: "Out of the Blue Deal — a 2% surprise, not a Match or Potential cover. You chose to try to make it happen.",
            status: "proposed",
          })
          .returning({ id: schema.dates.id });
        const inserted = insertedRows[0];
        if (!inserted) {
          throw new Error("createOutOfBlueDeal: insert returned no rows");
        }
        dateId = inserted.id;
      }
      if (!alreadyDeal) {
        await db
          .update(schema.people)
          .set({ matchDecision: "accepted" })
          .where(eq(schema.people.id, person.id));
      }
      ctx.invalidateQueries();
      return {
        ok: true as const,
        dateId,
        listItemId: idea.id,
        ideaText: idea.text,
        alreadyHadDate,
        alreadyDeal,
      };
    },
  }),

  reportPerson: defineAction({
    description: "File a report about a member and block them.",
    request: z.object({
      personId: z.number().int().positive(),
      reason: z.string().min(1).max(80),
      note: z.string().max(400),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<Ok> => {
      assertCleanWording(args.reason, args.note);
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.people)
        .where(eq(schema.people.id, args.personId));
      const person = rows[0];
      if (!person) throw new Error("reportPerson: person not found");
      await db.batch([
        db.insert(schema.reports).values({
          personId: person.id,
          personName: person.name,
          reason: args.reason,
          note: args.note.trim(),
        }),
        db
          .update(schema.people)
          .set({ blocked: true })
          .where(eq(schema.people.id, person.id)),
      ]);
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  proposeDate: defineAction({
    description: "Propose or record a date built on a List item the other side fulfills — by a checked/fuzzy trait OR by a Provide cover, both ways: a member's Provide covering one of the user's List items, or the user's Provide covering a want on that member's wishlist — with the day and time of the meetup.",
    request: z.object({
      personId: z.number().int().positive(),
      direction: dateDirection,
      listItemId: z.number().int().positive(),
      // ISO instant for the day + time of the meetup; null = not set yet.
      meetAt: z.string().max(40).nullable(),
      spot: z.string().max(80),
      note: z.string().max(200),
    }),
    response: z.object({ id: z.number() }),
    handler: async (ctx, args) => {
      assertCleanWording(args.note);
      const db = ctx.db<typeof schema>();
      const [personRows, itemRows, items, checkRows, profile, provideRows] =
        await Promise.all([
          db
            .select()
            .from(schema.people)
            .where(eq(schema.people.id, args.personId)),
          db
            .select()
            .from(schema.listItems)
            .where(eq(schema.listItems.id, args.listItemId)),
          db.select().from(schema.listItems),
          db.select().from(schema.personChecks),
          loadProfile(ctx),
          db.select().from(schema.provides),
        ]);
      const person = personRows[0];
      if (!person) throw new Error("proposeDate: person not found");
      if (person.blocked) throw new Error("proposeDate: person is blocked");
      // 21+ gate: a bar / night club / exotic / alcohol spot can
      // only be this date's spot when BOTH people are 21+ — an
      // age that is not on record counts as not 21, never guessed.
      assertSpotAllowedForAges(args.spot, profile.age, person.age, person.name);
      const item = itemRows[0];
      if (!item) throw new Error("proposeDate: list item not found");
      if (item.kind === "dealbreaker") {
        throw new Error("proposeDate: a dealbreaker can't be a date idea — pick a Want, or a Provide cover");
      }
      // Score WITH both sides' Provides loaded, so needCovers (this
      // member's Provides covering my scored List items) and
      // coveredByMe (my Provides covering this member's wishlist
      // wants) are real — the old call loaded no Provides at all, so
      // a cover could never satisfy the check below.
      const scoredItems = items.filter((i) => i.kind !== "gift" && (i.personId ?? null) === null);
      const giftRows = items.filter((i) => i.kind === "gift");
      const personProvides = provideRows.filter(
        (pv) => pv.ownerType === "person" && pv.ownerId === person.id,
      );
      const myProvides = provideRows.filter(
        (pv) => pv.ownerType === "profile",
      );
      const scored = scorePerson(
        person,
        scoredItems,
        checkRows,
        profile,
        false,
        [],
        { unread: 0, lastBody: "", lastAt: null },
        personProvides,
        myProvides,
        giftRows.filter((g) => g.personId === person.id),
      );
      if (item.kind === "gift") {
        // A wishlist entry can be a date idea ONLY as a Provide
        // cover: it must be THIS member's own want, not yet given,
        // and one of MY Provides must cover it (e.g. my "Surfing
        // lesson" up to $50 covering Alex's "learn to surf" want) —
        // or, symmetrically, one of their own Provides covers it.
        // A cover is a cover: it is never relabelled as a trait
        // either side "has".
        if (item.personId !== person.id) {
          throw new Error("proposeDate: that wishlist entry isn't this person's want — a date from your Provides has to start from a want of theirs");
        }
        if (item.giftStatus === "given") {
          throw new Error("proposeDate: that want is already marked given — pick another date idea");
        }
        const covered =
          scored.coveredByMe.some((c) => c.giftId === item.id) ||
          personProvides.some((pv) => provideCoversText(pv, item.text));
        if (!covered) {
          throw new Error("proposeDate: that want isn't covered by a Provide yet — a Provide cover is what makes it a date idea");
        }
      } else {
        // A scored (must / nice) idea is valid when the other side
        // fulfills it — by a checked/fuzzy trait (the original
        // rule) OR by a Provide cover: this member's Provide
        // covering my List item (e.g. Koa's Lululemon cover) makes
        // the item a date idea even when no trait is checked for
        // it. The cover is checked as a cover, never as a trait.
        const checkMap = new Map(
          scored.checks.map((c) => [c.listItemId, c.present]),
        );
        const personFulfills =
          checkMap.get(item.id) ?? fuzzyMatch(item.text, scored.qualities);
        const iFulfill = fuzzyMatch(item.text, parseQualities(profile.qualities));
        const traitFulfilled =
          args.direction === "out" ? personFulfills : iFulfill;
        const coveredByThem =
          scored.needCovers.some((c) => c.listItemId === item.id) ||
          personProvides.some((pv) => provideCoversText(pv, item.text));
        if (!traitFulfilled && !coveredByThem) {
          throw new Error(
            args.direction === "out"
              ? "proposeDate: that list item isn't one this person fulfills or covers with a Provide"
              : "proposeDate: that list item isn't one you fulfill, and this person doesn't cover it with a Provide either",
          );
        }
      }
      if (args.direction === "out" && !scored.canContact) {
        throw new Error(
          "proposeDate: contact settings don't allow proposing a date to this person",
        );
      }
      let meetAt: Date | null = null;
      if (args.meetAt !== null && args.meetAt.trim() !== "") {
        const parsed = new Date(args.meetAt);
        if (!Number.isFinite(parsed.getTime())) {
          throw new Error("proposeDate: that day and time isn't valid");
        }
        meetAt = parsed;
      }
      const result = await db
        .insert(schema.dates)
        .values({
          personId: person.id,
          personName: person.name,
          direction: args.direction,
          listItemId: item.id,
          ideaText: item.text,
          meetAt,
          spot: args.spot.trim(),
          note: args.note.trim(),
          status: "proposed",
        })
        .returning({ id: schema.dates.id });
      const inserted = result[0];
      if (!inserted) throw new Error("proposeDate: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  respondDate: defineAction({
    description: "Deal (set) or decline a proposed date — the app calls setting a date a Deal.",
    request: z.object({
      id: z.number().int().positive(),
      response: z.enum(["accepted", "declined"]),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<Ok> => {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.dates)
        .set({
          status: args.response,
          // A date that gets passed on is no longer completed.
          ...(args.response === "declined" ? { completedAt: null } : {}),
        })
        .where(eq(schema.dates.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  // ---------- date completed ----------
  //
  // The last step of the demo flow: Match on List -> Accept match
  // -> Arrange a real List date -> Mark date completed. A simple
  // tap on an ACCEPTED date only: it records the completion time
  // (dates.completed_at), the date card shows "Completed", and a
  // short note is posted into that member's Chat thread so the
  // completion is on record there too. There is deliberately NO
  // voice check, NO camera check, NO proof photo and NO location
  // tracking — completing a date is a tap, not a gate. Tapping
  // again the other way (completed: false) undoes it: the time is
  // cleared and a short undo note is posted to Chat the same way,
  // so a mistaken tap is fully reversible. The date's status stays
  // "accepted" either way, so contact / Chat / safety check-ins
  // that key off an accepted date are untouched. Re-marking an
  // already-completed date (or un-marking one that is not
  // completed) is a no-op that posts no duplicate Chat note.

  setDateCompleted: defineAction({
    description: "Mark an accepted date completed, or undo that mark: records (or clears) the completion time and posts a short note to that member's Chat thread. No voice, camera, proof photo or location check.",
    request: z.object({
      id: z.number().int().positive(),
      completed: z.boolean(),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<Ok> => {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.dates)
        .where(eq(schema.dates.id, args.id));
      const date = rows[0];
      if (!date) throw new Error("setDateCompleted: date not found");
      if (date.status !== "accepted") {
        throw new Error(
          "setDateCompleted: only an accepted date can be marked completed — this date hasn't been accepted yet",
        );
      }
      const alreadyCompleted = date.completedAt !== null;
      if (args.completed === alreadyCompleted) {
        // Nothing to change — and no duplicate Chat note.
        return { ok: true as const };
      }
      if (args.completed) {
        const completedAt = new Date();
        await db
          .update(schema.dates)
          .set({ completedAt })
          .where(eq(schema.dates.id, date.id));
        // No clock time is baked into the note's text: the server
        // clock is not the reader's timezone. The exact completion
        // instant lives on the date (completed_at, rendered
        // viewer-local on the card as "✓ Completed {time}") and in
        // this message's own timestamp, which Chat also renders
        // viewer-local — so the note stays short and never shows
        // a wrong-zone time.
        await db.insert(schema.messages).values({
          personId: date.personId,
          personName: date.personName,
          direction: "out",
          body: `✓ Date completed — ${date.ideaText} — we did it, something real from the List ✦`,
          kind: "quick",
          read: true,
          dateId: date.id,
        });
      } else {
        await db
          .update(schema.dates)
          .set({ completedAt: null })
          .where(eq(schema.dates.id, date.id));
        await db.insert(schema.messages).values({
          personId: date.personId,
          personName: date.personName,
          direction: "out",
          body: `Date marked not completed — ${date.ideaText} — that completion was tapped by mistake, so it's undone. It's a regular date again.`,
          kind: "quick",
          read: true,
          dateId: date.id,
        });
      }
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  deleteDate: defineAction({
    description: "Delete a date.",
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    handler: async (ctx, args): Promise<Ok> => {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.dates)
        .where(eq(schema.dates.id, args.id));
      const row = rows[0];
      if (row?.planImageBlobKey) {
        try {
          await ctx.blobs.delete(row.planImageBlobKey);
        } catch {
          /* best effort */
        }
      }
      await db.batch([
        db.delete(schema.dates).where(eq(schema.dates.id, args.id)),
        db
          .delete(schema.safetyCheckins)
          .where(eq(schema.safetyCheckins.dateId, args.id)),
      ]);
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  // ---------- safety check-in ----------
  //
  // A timed check-in tied to a confirmed (accepted) date, in the
  // spirit of Pure's Safety Signal but in List Dating's clean style:
  // the user picks a length, it runs quietly, then ends
  // automatically when its time runs out (liveness is derived on
  // read — no cleanup job, no cron). It is transparent by design:
  // starting one posts a notice into the member's Chat thread saying
  // it is on and when it ends, and ending early posts an "all good"
  // note — the date is told, never secretly tracked. There is NO
  // live GPS tracking: no location is read, stored, or shared —
  // only a timer. The user can end it early at any time. Chat in
  // this app never disappears, so the notices stay on record.

  startSafetyCheckin: defineAction({
    description: "Start a timed safety check-in for a confirmed (accepted) date: pick a length, it runs quietly and ends automatically, the date is told it is on via a Chat notice, and no live location is shared.",
    request: z.object({
      dateId: z.number().int().positive(),
      durationMinutes: z.number().int().positive(),
    }),
    response: z.object({ id: z.number() }),
    handler: async (ctx, args) => {
      if (
        !(SAFETY_CHECKIN_DURATIONS as readonly number[]).includes(
          args.durationMinutes,
        )
      ) {
        throw new Error(
          "startSafetyCheckin: pick one of the check-in lengths offered",
        );
      }
      const db = ctx.db<typeof schema>();
      const [dateRows, personRows, existingRows] = await Promise.all([
        db.select().from(schema.dates).where(eq(schema.dates.id, args.dateId)),
        db.select().from(schema.people),
        db.select().from(schema.safetyCheckins),
      ]);
      const date = dateRows[0];
      if (!date) throw new Error("startSafetyCheckin: date not found");
      if (date.status !== "accepted") {
        throw new Error(
          "startSafetyCheckin: a safety check-in is for a confirmed date — this date hasn't been accepted yet",
        );
      }
      const person = personRows.find((p) => p.id === date.personId);
      if (!person) throw new Error("startSafetyCheckin: member not found");
      if (person.blocked) {
        throw new Error("startSafetyCheckin: this member is blocked");
      }
      const alreadyOn = existingRows.some(
        (c) => c.dateId === date.id && safetyCheckinLive(c),
      );
      if (alreadyOn) {
        throw new Error(
          "startSafetyCheckin: a check-in is already running for this date",
        );
      }
      const startedAt = new Date();
      const endsAt = new Date(
        startedAt.getTime() + args.durationMinutes * 60 * 1000,
      );
      const result = await db
        .insert(schema.safetyCheckins)
        .values({
          dateId: date.id,
          personId: person.id,
          personName: person.name,
          durationMinutes: args.durationMinutes,
          startedAt,
          endsAt,
          endedAt: null,
        })
        .returning({ id: schema.safetyCheckins.id });
      const inserted = result[0];
      if (!inserted) {
        throw new Error("startSafetyCheckin: insert returned no rows");
      }
      // Transparency: the date is told it is on. The notice lands in
      // the member's Chat thread (which never disappears) and names
      // the length, the automatic end time, and that no live
      // location is shared.
      const endsLabel = hawaiiWeekdayTime(endsAt);
      await db.insert(schema.messages).values({
        personId: person.id,
        personName: person.name,
        direction: "out",
        body: `🛡 Safety check-in on for our meetup — I'm running a timed check-in for ${safetyDurationLabel(args.durationMinutes)}, until ${endsLabel}. It ends on its own then. No live location is shared — just a timer, so someone knows I'm out meeting you.`,
        kind: "quick",
        read: true,
        dateId: date.id,
      });
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  endSafetyCheckin: defineAction({
    description: "End a running safety check-in early; an 'all good' note is posted to the member's Chat thread so they know the timer is off.",
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    handler: async (ctx, args): Promise<Ok> => {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.safetyCheckins)
        .where(eq(schema.safetyCheckins.id, args.id));
      const checkin = rows[0];
      if (!checkin) throw new Error("endSafetyCheckin: check-in not found");
      if (!safetyCheckinLive(checkin)) {
        throw new Error("endSafetyCheckin: this check-in has already ended");
      }
      await db
        .update(schema.safetyCheckins)
        .set({ endedAt: new Date() })
        .where(eq(schema.safetyCheckins.id, checkin.id));
      // The date is told it ended early, too — same transparency.
      await db.insert(schema.messages).values({
        personId: checkin.personId,
        personName: checkin.personName,
        direction: "out",
        body: "🛡 Safety check-in ended early — all good, thank you! The timer is off now. No live location was shared.",
        kind: "quick",
        read: true,
        dateId: checkin.dateId,
      });
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  // ---------- messenger ----------
  //
  // Small messages whose job is coordinating the meetup. A thread
  // only exists inside the Chat gate (Deal-only rule, 2026-11-04):
  // a Deal exists with the person — the Deal button was hit on
  // their match card, or they have an accepted date — AND contact
  // is allowed on top of that (a Deal or an accepted date
  // establishes contact right away). A Match or a Potential with
  // no Deal has no thread and cannot be messaged. A contact
  // preference can only narrow an already-eligible thread; it can
  // never create one for someone outside the gate. Blocked
  // members can never be messaged. Non-eligible threads do not
  // appear in Chat; their messages are never deleted. "in"
  // messages are how the member's side of the conversation is
  // recorded in this single-user app.

  sendMessage: defineAction({
    description: "Send a message to a member in the meetup messenger; allowed only once a Deal exists with that member (Deal button hit on their match card, or an accepted date) and contact rules permit it.",
    request: z.object({
      personId: z.number().int().positive(),
      body: z.string().min(1).max(500),
      kind: z.enum(["text", "quick"]),
      dateId: z.number().int().positive().nullable(),
    }),
    response: z.object({ id: z.number() }),
    handler: async (ctx, args) => {
      // Chat is for coordinating the meetup — the same wording
      // filter applies to every message, quick helpers included
      // (their fixed wording is clean by construction).
      assertCleanWording(args.body);
      const db = ctx.db<typeof schema>();
      const [personRows, allItems, checkRows, dateRows, profile, provideRows] =
        await Promise.all([
          db
            .select()
            .from(schema.people)
            .where(eq(schema.people.id, args.personId)),
          db.select().from(schema.listItems),
          db.select().from(schema.personChecks),
          db.select().from(schema.dates),
          loadProfile(ctx),
          db.select().from(schema.provides),
        ]);
      const person = personRows[0];
      if (!person) throw new Error("sendMessage: person not found");
      if (person.blocked) {
        throw new Error("sendMessage: this member is blocked");
      }
      const hasAcceptedDate = dateRows.some(
        (d) => d.personId === person.id && d.status === "accepted",
      );
      // Score exactly as getState does, so the Chat gate sees
      // the same Deal state (matchDecision + accepted dates).
      const scored = scorePerson(
        person,
        allItems.filter((i) => i.kind !== "gift" && (i.personId ?? null) === null),
        checkRows,
        profile,
        hasAcceptedDate,
        [],
        { unread: 0, lastBody: "", lastAt: null },
        provideRows.filter(
          (pv) => pv.ownerType === "person" && pv.ownerId === person.id,
        ),
        provideRows.filter((pv) => pv.ownerType === "profile"),
        allItems.filter(
          (i) => i.kind === "gift" && i.personId === person.id,
        ),
      );
      if (!scored.chatEligible) {
        throw new Error(
          "sendMessage: chat only opens once you hit Deal — a Match or a Potential has no chat until then",
        );
      }
      if (!scored.canContact) {
        throw new Error(
          "sendMessage: contact settings don't allow messaging this member yet — a Deal from the List opens contact right away",
        );
      }
      if (args.dateId !== null) {
        const date = dateRows.find((d) => d.id === args.dateId);
        if (!date || date.personId !== person.id) {
          throw new Error("sendMessage: that date isn't with this member");
        }
      }
      const result = await db
        .insert(schema.messages)
        .values({
          personId: person.id,
          personName: person.name,
          direction: "out",
          body: args.body.trim(),
          kind: args.kind,
          read: true,
          dateId: args.dateId,
        })
        .returning({ id: schema.messages.id });
      const inserted = result[0];
      if (!inserted) throw new Error("sendMessage: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  receiveMessage: defineAction({
    description: "Record an incoming message from a member in the meetup messenger; the member must pass the same Chat gate as sending (a Deal exists — Deal button hit, or an accepted date).",
    request: z.object({
      personId: z.number().int().positive(),
      body: z.string().min(1).max(500),
    }),
    response: z.object({ id: z.number() }),
    handler: async (ctx, args) => {
      assertCleanWording(args.body);
      const db = ctx.db<typeof schema>();
      const [rows, allItems, checkRows, dateRows, profile, provideRows] =
        await Promise.all([
          db
            .select()
            .from(schema.people)
            .where(eq(schema.people.id, args.personId)),
          db.select().from(schema.listItems),
          db.select().from(schema.personChecks),
          db.select().from(schema.dates),
          loadProfile(ctx),
          db.select().from(schema.provides),
        ]);
      const person = rows[0];
      if (!person) throw new Error("receiveMessage: person not found");
      if (person.blocked) {
        throw new Error("receiveMessage: this member is blocked");
      }
      // Same Chat gate as sendMessage: logging a reply must not
      // create a Chat thread for someone outside the gate.
      // Eligibility alone is enough here (no contact-preference
      // check) — recording what an eligible member said never
      // opens sending.
      const hasAcceptedDate = dateRows.some(
        (d) => d.personId === person.id && d.status === "accepted",
      );
      const scored = scorePerson(
        person,
        allItems.filter((i) => i.kind !== "gift" && (i.personId ?? null) === null),
        checkRows,
        profile,
        hasAcceptedDate,
        [],
        { unread: 0, lastBody: "", lastAt: null },
        provideRows.filter(
          (pv) => pv.ownerType === "person" && pv.ownerId === person.id,
        ),
        provideRows.filter((pv) => pv.ownerType === "profile"),
        allItems.filter(
          (i) => i.kind === "gift" && i.personId === person.id,
        ),
      );
      if (!scored.chatEligible) {
        throw new Error(
          "receiveMessage: chat only opens once you hit Deal — a Match or a Potential has no chat until then",
        );
      }
      const result = await db
        .insert(schema.messages)
        .values({
          personId: person.id,
          personName: person.name,
          direction: "in",
          body: args.body.trim(),
          kind: "text",
          read: false,
          dateId: null,
        })
        .returning({ id: schema.messages.id });
      const inserted = result[0];
      if (!inserted) throw new Error("receiveMessage: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  markThreadRead: defineAction({
    description: "Mark all incoming messages in a member's thread as read.",
    request: z.object({ personId: z.number().int().positive() }),
    response: okResponse,
    handler: async (ctx, args): Promise<Ok> => {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.personId, args.personId));
      const unread = rows.filter((m) => m.direction === "in" && !m.read);
      for (const m of unread) {
        await db
          .update(schema.messages)
          .set({ read: true })
          .where(eq(schema.messages.id, m.id));
      }
      if (unread.length > 0) ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  deleteMessage: defineAction({
    description: "Delete one message.",
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    handler: async (ctx, args): Promise<Ok> => {
      const db = ctx.db<typeof schema>();
      await db.delete(schema.messages).where(eq(schema.messages.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  createPromoCode: defineAction({
    description: "Create a shareable promo code members can join with, optionally capped by max uses.",
    request: z.object({
      code: z.string().max(40),
      label: z.string().max(80),
      maxUses: z.number().int().min(1).max(10000).nullable(),
    }),
    response: z.object({ id: z.number(), code: z.string() }),
    handler: async (ctx, args) => {
      requireOwner(ctx);
      assertCleanWording(args.code, args.label);
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.promoCodes);
      const existing = new Set(rows.map((r) => r.code));
      let code = normalizeCode(args.code);
      if (!code) {
        code = generateCode(existing);
      } else {
        if (code.length < 3) {
          throw new Error("createPromoCode: code needs at least 3 characters");
        }
        if (existing.has(code)) {
          throw new Error("createPromoCode: that code already exists");
        }
      }
      const result = await db
        .insert(schema.promoCodes)
        .values({ code, label: args.label.trim(), maxUses: args.maxUses })
        .returning({ id: schema.promoCodes.id });
      const inserted = result[0];
      if (!inserted) throw new Error("createPromoCode: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id, code };
    },
  }),

  setPromoCodeActive: defineAction({
    description: "Pause or reactivate a promo code.",
    request: z.object({
      id: z.number().int().positive(),
      active: z.boolean(),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<Ok> => {
      requireOwner(ctx);
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.promoCodes)
        .set({ active: args.active })
        .where(eq(schema.promoCodes.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  deletePromoCode: defineAction({
    description: "Delete a promo code.",
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    handler: async (ctx, args): Promise<Ok> => {
      requireOwner(ctx);
      const db = ctx.db<typeof schema>();
      await db
        .delete(schema.promoCodes)
        .where(eq(schema.promoCodes.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  // Back-compat alias: wishlist entries now live on The List.
  // This writes a kind="gift" list_items row — same store as addListItem.
  addGift: defineAction({
    description: "Add a wishlist entry to The List, optionally tied to a member (same unified List store as addListItem with kind gift).",
    request: z.object({
      title: z.string().min(1).max(120),
      category: z.string().max(60).optional(),
      personId: z.number().int().positive().nullable(),
      occasion: z.string().max(80),
      priceNote: z.string().max(80),
      link: z.string().max(500),
      status: giftStatus,
    }),
    response: z.object({ id: z.number() }),
    handler: async (ctx, args) => {
      assertCleanWording(args.title, args.category, args.occasion, args.priceNote, args.link);
      const db = ctx.db<typeof schema>();
      // Cap (2026-11-02, set to 3 at Erin's direction — less is
      // more): three Want/Need entries max per wishlist.
      const gifts = await db
        .select()
        .from(schema.listItems)
        .where(eq(schema.listItems.kind, "gift"));
      if (
        gifts.filter((g) => (g.personId ?? null) === args.personId).length >= 3
      ) {
        throw new Error("That Desires list is full — 3 max each (General, or for one person). Remove one first.");
      }
      let personName = "";
      if (args.personId !== null) {
        const rows = await db
          .select()
          .from(schema.people)
          .where(eq(schema.people.id, args.personId));
        personName = rows[0]?.name ?? "";
      }
      const result = await db
        .insert(schema.listItems)
        .values({
          kind: "gift",
          text: args.title.trim(),
          category: (args.category ?? "").trim(),
          personId: args.personId,
          personName,
          occasion: args.occasion.trim(),
          priceNote: args.priceNote.trim(),
          link: args.link.trim(),
          giftStatus: args.status,
        })
        .returning({ id: schema.listItems.id });
      const inserted = result[0];
      if (!inserted) throw new Error("addGift: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  updateGift: defineAction({
    description: "Update a wishlist entry on The List.",
    request: z.object({
      id: z.number().int().positive(),
      title: z.string().min(1).max(120),
      category: z.string().max(60).optional(),
      personId: z.number().int().positive().nullable(),
      occasion: z.string().max(80),
      priceNote: z.string().max(80),
      link: z.string().max(500),
      status: giftStatus,
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<Ok> => {
      assertCleanWording(args.title, args.category, args.occasion, args.priceNote, args.link);
      const db = ctx.db<typeof schema>();
      // Same 3-each Desires cap as updateListItemGift: moving an
      // entry into a full group is refused.
      const existingRows = await db
        .select()
        .from(schema.listItems)
        .where(eq(schema.listItems.id, args.id));
      const currentRow = existingRows[0];
      if (currentRow && (currentRow.personId ?? null) !== args.personId) {
        const allGifts = await db
          .select()
          .from(schema.listItems)
          .where(eq(schema.listItems.kind, "gift"));
        if (
          allGifts.filter((g) => (g.personId ?? null) === args.personId)
            .length >= 3
        ) {
          throw new Error(
            "That Desires list is full — 3 max each (General, or for one person). Remove one first.",
          );
        }
      }
      let personName = "";
      if (args.personId !== null) {
        const rows = await db
          .select()
          .from(schema.people)
          .where(eq(schema.people.id, args.personId));
        personName = rows[0]?.name ?? "";
      }
      await db
        .update(schema.listItems)
        .set({
          text: args.title.trim(),
          category: (args.category ?? "").trim(),
          personId: args.personId,
          personName,
          occasion: args.occasion.trim(),
          priceNote: args.priceNote.trim(),
          link: args.link.trim(),
          giftStatus: args.status,
        })
        .where(eq(schema.listItems.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  setGiftStatus: defineAction({
    description: "Set a wishlist entry's status on The List: idea, planned or given.",
    request: z.object({
      id: z.number().int().positive(),
      status: giftStatus,
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<Ok> => {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.listItems)
        .set({ giftStatus: args.status })
        .where(eq(schema.listItems.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  // ---------- Meta AI settings & generation ----------

  saveMetaKey: defineAction({
    description: "Save the user's Meta AI (Meta Model API) key server-side (whitespace-cleaned, never returned to the client) and immediately test it on the same Model API channel generation uses, returning the three-state result.",
    request: z.object({ apiKey: z.string().max(2000) }),
    response: saveMetaKeyResponse,
    handler: async (ctx, args): Promise<SaveMetaKeyResult> => {
      requireOwner(ctx);
      const db = ctx.db<typeof schema>();
      const cleaned = cleanMetaKey(args.apiKey);
      const wasCleaned = cleaned !== args.apiKey.trim();
      const existing = await loadProfile(ctx);
      const values = {
        ...existing,
        qualities:
          typeof existing.qualities === "string"
            ? existing.qualities
            : JSON.stringify(existing.qualities),
        metaApiKey: cleaned,
        metaKeyStatus: (cleaned ? "saved_unverified" : "none") as MetaKeyStatus,
        metaKeyStatusMessage: "",
        metaKeyCheckedAt: null,
        updatedAt: new Date(),
      };
      await db
        .insert(schema.myProfile)
        .values(values)
        .onConflictDoUpdate({ target: schema.myProfile.id, set: values });
      if (!cleaned) {
        ctx.invalidateQueries();
        return {
          ok: true as const,
          status: "none",
          connected: false,
          cleaned: false,
          message:
            "Key removed — match notes and date plans now come straight from your List.",
        };
      }
      // A save is not done until it is tested: run the same call
      // generation uses and persist the outcome as the status.
      const result = await runMetaTest(cleaned);
      await recordMetaStatus(ctx, result.status, result.message);
      ctx.invalidateQueries();
      return {
        ok: true as const,
        status: result.status,
        connected: result.connected,
        cleaned: wasCleaned,
        message:
          (wasCleaned
            ? "Cleaned up spaces/line breaks from the pasted key. "
            : "") + result.message,
      };
    },
  }),

  testMetaConnection: defineAction({
    description: "Test the saved Meta AI key with one small call on the same Meta Model API channel that match-note and date-plan generation uses, and persist the three-state result.",
    request: z.object({}),
    response: metaTestResponse,
    handler: async (ctx): Promise<MetaTestResult> => {
      requireOwner(ctx);
      const profile = await loadProfile(ctx);
      const key = cleanMetaKey(profile.metaApiKey);
      const result = await runMetaTest(key);
      if (key) await recordMetaStatus(ctx, result.status, result.message);
      ctx.invalidateQueries();
      return result;
    },
  }),

  checkWonderAvailability: defineAction({
    description: "Check whether a Wonder model is available on the saved Meta AI key: reads the key server-side only, checks Meta's model list for a Wonder model, and if one is listed tests one call with the exact model id Meta returned, on the same channel Spark is tested on. Reports whether Wonder is listed, the exact model name, and whether the test call succeeded. Never switches match notes or date plans from Spark, never changes the saved key, profile, or Spark connection status, and writes nothing.",
    request: z.object({}),
    response: wonderCheckResponse,
    handler: async (ctx): Promise<WonderCheckResult> => {
      requireOwner(ctx);
      const profile = await loadProfile(ctx);
      const key = cleanMetaKey(profile.metaApiKey);
      return runWonderCheck(key);
    },
  }),

  compareMatchNote: defineAction({
    description: "Run the Spark vs Wonder comparison for one person's match note: the identical match-note prompt (built from the List scoring and Provide cover facts, exactly as generateMatchNote builds it) is sent once to Spark (muse-spark-1.3) and once to Wonder (muse-wonder-1.0) using the saved Meta AI key server-side only, and both versions are stored side by side in model_comparisons for display in Profile. Spark stays the default: this never writes the person's saved match note, never changes the saved key, profile, or Spark connection status.",
    request: z.object({ personId: z.number().int().positive() }),
    response: compareMatchNoteResponse,
    handler: async (ctx, args): Promise<CompareMatchNoteResult> => {
      requireOwner(ctx);
      const db = ctx.db<typeof schema>();
      const [profile, allItems, checkRows, personRows, provideRows] =
        await Promise.all([
          loadProfile(ctx),
          db.select().from(schema.listItems),
          db.select().from(schema.personChecks),
          db
            .select()
            .from(schema.people)
            .where(eq(schema.people.id, args.personId)),
          db.select().from(schema.provides),
        ]);
      const items = allItems.filter((i) => i.kind !== "gift" && (i.personId ?? null) === null);
      const giftRows = allItems.filter((i) => i.kind === "gift");
      const person = personRows[0];
      if (!person) throw new Error("compareMatchNote: person not found");
      const scored = scorePerson(
        person,
        items,
        checkRows,
        profile,
        false,
        [],
        { unread: 0, lastBody: "", lastAt: null },
        provideRows.filter(
          (pv) => pv.ownerType === "person" && pv.ownerId === person.id,
        ),
        provideRows.filter((pv) => pv.ownerType === "profile"),
        giftRows.filter((g) => g.personId === person.id),
      );
      const fmtCover = (title: string, maxSpendCents: number | null) =>
        maxSpendCents !== null && maxSpendCents > 0
          ? `${title} (up to $${(maxSpendCents / 100).toFixed(0)})`
          : title;
      const facts: MatchFacts = {
        myName: profile.name.trim(),
        personName: person.name,
        myGender: profile.gender,
        personGender: person.gender,
        myLocation: profile.location,
        personLocation: person.location,
        myAvailableTimes: profile.availableTimes,
        personAvailableTimes: person.availableTimes,
        personSpot: publicSpotLabel(person.spot),
        matchPercent: scored.matchPercent,
        coveredWants: scored.needCovers.map((c) => c.needText),
        uncoveredWants: items
          .filter(
            (i) =>
              (i.kind === "must" || i.kind === "nice") &&
              !scored.needCovers.some((c) => c.listItemId === i.id),
          )
          .map((i) => i.text),
        dealbreakersHit: scored.dealbreakersHit,
        sameSpot: scored.sameSpot,
        coversMyNeeds: scored.needCovers.map(
          (c) => `${c.needText} — via ${fmtCover(c.provideTitle, c.maxSpendCents)}`,
        ),
        iCoverTheirs: scored.coveredByMe.map(
          (c) => `${c.giftTitle} — via ${fmtCover(c.provideTitle, c.maxSpendCents)}`,
        ),
      };
      const prompt = buildMatchNotePrompt(facts, scored.qualities);
      const fallback = fallbackMatchNote(facts);
      const key = cleanMetaKey(profile.metaApiKey);
      const wonderModel = key ? await resolveWonderModel(key) : META_WONDER_MODEL;
      const spark = await callModelOrFallback(key, prompt, META_MODEL, fallback, 1500);
      const wonder = await callModelOrFallback(key, prompt, wonderModel, fallback, 1500);
      await upsertComparison(ctx, person.id, person.name, {
        sparkModel: META_MODEL,
        wonderModel,
        sparkMatchNote: spark.text,
        wonderMatchNote: wonder.text,
        sparkMatchNoteStatus: spark.status,
        wonderMatchNoteStatus: wonder.status,
      });
      ctx.invalidateQueries();
      return {
        personId: person.id,
        personName: person.name,
        sparkModel: META_MODEL,
        wonderModel,
        sparkNote: spark.text,
        wonderNote: wonder.text,
        sparkStatus: spark.status,
        wonderStatus: wonder.status,
      };
    },
  }),

  compareDatePlan: defineAction({
    description: "Run the Spark vs Wonder comparison for one person's date plan: the identical date-plan prompt (built from that person's real date when one exists — otherwise from the List item they fulfill or cover — exactly as generateDatePlan builds it) is sent once to Spark (muse-spark-1.3) and once to Wonder (muse-wonder-1.0) using the saved Meta AI key server-side only, and both versions are stored side by side in model_comparisons for display in Profile. Spark stays the default: this never writes the date's saved plan, never changes the saved key, profile, or Spark connection status.",
    request: z.object({ personId: z.number().int().positive() }),
    response: compareDatePlanResponse,
    handler: async (ctx, args): Promise<CompareDatePlanResult> => {
      requireOwner(ctx);
      const db = ctx.db<typeof schema>();
      const [profile, allItems, checkRows, personRows, provideRows, dateRows] =
        await Promise.all([
          loadProfile(ctx),
          db.select().from(schema.listItems),
          db.select().from(schema.personChecks),
          db
            .select()
            .from(schema.people)
            .where(eq(schema.people.id, args.personId)),
          db.select().from(schema.provides),
          db.select().from(schema.dates),
        ]);
      const person = personRows[0];
      if (!person) throw new Error("compareDatePlan: person not found");
      const items = allItems.filter((i) => i.kind !== "gift" && (i.personId ?? null) === null);
      // The person's real date wins (accepted first, then the
      // latest); otherwise the plan is built on the first List
      // item they fulfill or cover — still a real List item.
      const myDates = dateRows
        .filter((d) => d.personId === person.id)
        .sort((a, b) => {
          const rank = (s: string) => (s === "accepted" ? 0 : s === "proposed" ? 1 : 2);
          return rank(a.status) - rank(b.status) || b.id - a.id;
        });
      const date = myDates[0] ?? null;
      let ideaText = date?.ideaText ?? "";
      let spot = date?.spot ?? person.spot ?? "";
      let note = date?.note ?? "";
      let meetAt: Date | null = date?.meetAt ?? null;
      if (!date) {
        const present = presentMap(person, items, checkRows);
        const fulfilled = items.find(
          (i) => i.kind !== "dealbreaker" && (present.get(i.id) ?? false),
        );
        const covered = provideRows.find(
          (pv) =>
            pv.ownerType === "person" &&
            pv.ownerId === person.id &&
            items.some(
              (i) => i.kind !== "dealbreaker" && provideCoversText(pv, i.text),
            ),
        );
        const coveredItem = covered
          ? items.find(
              (i) => i.kind !== "dealbreaker" && provideCoversText(covered, i.text),
            )
          : undefined;
        const firstNeed = items.find((i) => i.kind !== "dealbreaker");
        ideaText =
          fulfilled?.text ?? coveredItem?.text ?? firstNeed?.text ?? "Something on the List";
        note = "Comparison plan — no date set for this person yet, so this plan is built on the List item above.";
      }
      const cover = datePlanCover(
        profile,
        person.id,
        person.name,
        ideaText,
        provideRows,
      );
      const coverLine = cover.coverLine;
      const cmpFacts = datePlanProfileFacts(profile, person, allItems, provideRows);
      const cmpMeetupLine = datePlanMeetupLine(person.name, ideaText, cover);
      // 21+ gate + verified-location check, same as
      // generateDatePlan: a comparison plan is still a suggested
      // date plan, so a bar / exotic / alcohol spot is written
      // around the non-bar alternative whenever the pair is not
      // both 21+ on record, and a Lululemon / Sephora date is
      // planned at its verified Waikiki / Kalakaua Avenue (or
      // Ala Moana Center) location, never Hale'iwa.
      const gatedCmp = checkedPlanInputs(
        spot,
        note,
        profile.age,
        person.age,
        `${ideaText} ${coverLine} ${cmpFacts.myProvides.join(" ")} ${cmpFacts.personProvides.join(" ")}`,
      );
      const cmpLocationHay = `${ideaText} ${coverLine} ${cmpFacts.myProvides.join(" ")} ${cmpFacts.personProvides.join(" ")}`;
      const cmpLocationOk = (text: string): boolean =>
        planLocationCheck(text, cmpLocationHay).ok;
      const prompt = buildDatePlanPrompt({
        myName: profile.name.trim(),
        personName: person.name,
        myGender: profile.gender,
        personGender: person.gender,
        myLocation: profile.location,
        personLocation: person.location,
        myAvailableTimes: profile.availableTimes,
        personAvailableTimes: person.availableTimes,
        ideaText,
        spot: gatedCmp.spot,
        note: gatedCmp.note,
        meetAt,
        coverLine,
        qualities: parseQualities(person.qualities),
        myBio: profile.bio,
        personBio: person.bio,
        myQualities: parseQualities(profile.qualities),
        myWants: cmpFacts.myWants,
        personWants: cmpFacts.personWants,
        myProvides: cmpFacts.myProvides,
        personProvides: cmpFacts.personProvides,
        meetupLine: cmpMeetupLine,
      });
      const fallback = fallbackDatePlan({
        myName: profile.name.trim(),
        personName: person.name,
        ideaText,
        spot: gatedCmp.spot,
        note: gatedCmp.note,
        meetAt,
        myLocation: profile.location,
        personLocation: person.location,
        coverDetailLine: datePlanCoverDetailLine(cover),
        meetupLine: cmpMeetupLine,
      });
      const key = cleanMetaKey(profile.metaApiKey);
      const wonderModel = key ? await resolveWonderModel(key) : META_WONDER_MODEL;
      const spark = await callModelOrFallback(key, prompt, META_MODEL, fallback, 2000, cmpLocationOk);
      const wonder = await callModelOrFallback(key, prompt, wonderModel, fallback, 2000, cmpLocationOk);
      await upsertComparison(ctx, person.id, person.name, {
        dateId: date?.id ?? null,
        dateIdeaText: ideaText,
        sparkModel: META_MODEL,
        wonderModel,
        sparkDatePlan: spark.text,
        wonderDatePlan: wonder.text,
        sparkDatePlanStatus: spark.status,
        wonderDatePlanStatus: wonder.status,
      });
      ctx.invalidateQueries();
      return {
        personId: person.id,
        personName: person.name,
        dateId: date?.id ?? null,
        dateIdeaText: ideaText,
        sparkModel: META_MODEL,
        wonderModel,
        sparkPlan: spark.text,
        wonderPlan: wonder.text,
        sparkStatus: spark.status,
        wonderStatus: wonder.status,
      };
    },
  }),

  generateMatchNote: defineAction({
    description: "Generate a match note for a member from the List scoring and Provide cover facts, using Meta AI when a key is saved and the List-based writer otherwise.",
    request: z.object({ personId: z.number().int().positive() }),
    response: matchNoteResponse,
    handler: async (ctx, args): Promise<MatchNoteResult> => {
      requireOwner(ctx);
      const db = ctx.db<typeof schema>();
      const [profile, allItems, checkRows, personRows, provideRows] =
        await Promise.all([
          loadProfile(ctx),
          db.select().from(schema.listItems),
          db.select().from(schema.personChecks),
          db
            .select()
            .from(schema.people)
            .where(eq(schema.people.id, args.personId)),
          db.select().from(schema.provides),
        ]);
      const items = allItems.filter((i) => i.kind !== "gift" && (i.personId ?? null) === null);
      const giftRows = allItems.filter((i) => i.kind === "gift");
      const person = personRows[0];
      if (!person) throw new Error("generateMatchNote: person not found");
      const scored = scorePerson(
        person,
        items,
        checkRows,
        profile,
        false,
        [],
        { unread: 0, lastBody: "", lastAt: null },
        provideRows.filter(
          (pv) => pv.ownerType === "person" && pv.ownerId === person.id,
        ),
        provideRows.filter((pv) => pv.ownerType === "profile"),
        giftRows.filter((g) => g.personId === person.id),
      );
      const fmtCover = (title: string, maxSpendCents: number | null) =>
        maxSpendCents !== null && maxSpendCents > 0
          ? `${title} (up to $${(maxSpendCents / 100).toFixed(0)})`
          : title;
      const facts: MatchFacts = {
        myName: profile.name.trim(),
        personName: person.name,
        myGender: profile.gender,
        personGender: person.gender,
        myLocation: profile.location,
        personLocation: person.location,
        myAvailableTimes: profile.availableTimes,
        personAvailableTimes: person.availableTimes,
        personSpot: publicSpotLabel(person.spot),
        matchPercent: scored.matchPercent,
        coveredWants: scored.needCovers.map((c) => c.needText),
        uncoveredWants: items
          .filter(
            (i) =>
              (i.kind === "must" || i.kind === "nice") &&
              !scored.needCovers.some((c) => c.listItemId === i.id),
          )
          .map((i) => i.text),
        dealbreakersHit: scored.dealbreakersHit,
        sameSpot: scored.sameSpot,
        coversMyNeeds: scored.needCovers.map(
          (c) => `${c.needText} — via ${fmtCover(c.provideTitle, c.maxSpendCents)}`,
        ),
        iCoverTheirs: scored.coveredByMe.map(
          (c) => `${c.giftTitle} — via ${fmtCover(c.provideTitle, c.maxSpendCents)}`,
        ),
      };
      const sig = hashSig(
        JSON.stringify({
          facts,
          qualities: scored.qualities,
          checks: scored.checks,
        }),
      );
      return writeMatchNoteFromFacts(
        ctx,
        profile,
        person,
        facts,
        sig,
        scored.qualities,
      );
    },
  }),

  generateDatePlan: defineAction({
    description: "Generate a date plan for ONE date (the one Plan the Date was pushed for — never in bulk) from the FULL profiles of both people: both bios, both Want lists, and both Provide lists with caps and notes, plus the date's shared List item and any Provide cover. Uses the saved Meta AI key server-side only when one is saved, and the List-based writer otherwise. Every plan passes a real-location check against the app's verified O'ahu registry before it is stored or shown: a named store may only be placed where it actually is (Lululemon at 2270 Kalakaua Ave, Honolulu and Ala Moana Center; Sephora at 2250 Kalakaua Ave, Honolulu and Ala Moana Center — never Hale'iwa, where neither exists), and a Meta plan that places a store or activity in a wrong town is discarded for the List-based plan written from the same registry. The plan's picture is actual-photo-first: when the checked photo registry has real photographs for the plan's verified spot (Ala Moana Center, Lululemon and Sephora in Honolulu, or Haleiwa Beach Park — the verified City and County of Honolulu park at 62-449 Kamehameha Hwy, Haleiwa, HI 96712 for a Yoga in the Park date), those actual photos are used and labelled 'Actual photo'; a Muse Image generated picture is only the fallback for a spot with no actual photo, and is labelled 'Generated image'. Accuracy is the rule for every generated plan: mall-directory detail from the registry is included where it applies (Lululemon at Ala Moana Center is Level 2, near the Ewa Wing, between Uniqlo and Coach, phone (808) 818-8817), and a plan that puts that store on another floor or wing fails the location check like a wrong town.",
    request: z.object({ dateId: z.number().int().positive() }),
    response: datePlanResponse,
    handler: async (ctx, args): Promise<DatePlanResult> => {
      requireOwner(ctx);
      const db = ctx.db<typeof schema>();
      const [profile, dateRows, personRows, provideRows, allItems] =
        await Promise.all([
          loadProfile(ctx),
          db.select().from(schema.dates).where(eq(schema.dates.id, args.dateId)),
          db.select().from(schema.people),
          db.select().from(schema.provides),
          db.select().from(schema.listItems),
        ]);
      const date = dateRows[0];
      if (!date) throw new Error("generateDatePlan: date not found");
      const person = personRows.find((p) => p.id === date.personId);
      // Full-profile planning (Erin, 2026-11-03): the cover
      // (with its cap AND its note — the Sephora bonus rides in
      // the note), both bios, both Want lists and both Provide
      // lists feed the prompt, the signature and the picture.
      const cover = datePlanCover(
        profile,
        date.personId,
        date.personName,
        date.ideaText,
        provideRows,
      );
      const coverLine = cover.coverLine;
      const facts = datePlanProfileFacts(profile, person, allItems, provideRows);
      // 21+ gate + real-location check (Erin, 2026-11-03): if
      // this date's saved spot is a bar / exotic / alcohol venue
      // and the pair is not both 21+ on record, the plan is
      // written around the non-bar alternative instead; and a
      // Lululemon / Sephora shopping date is planned at its
      // verified Waikiki / Kalakaua Avenue (or Ala Moana Center)
      // location — never Hale'iwa, where neither store exists —
      // whatever spot was saved. The stored date spot itself is
      // not rewritten; the plan is written around the checked
      // spot, and any Meta plan that still places a store in a
      // wrong town is discarded for the List fallback below.
      const locationHay = `${date.ideaText} ${coverLine} ${facts.myProvides.join(" ")} ${facts.personProvides.join(" ")}`;
      const gated = checkedPlanInputs(
        date.spot,
        date.note,
        profile.age,
        person?.age ?? null,
        locationHay,
      );
      const planSpot = gated.spot;
      const planNote = gated.note;
      const meetupLine = datePlanMeetupLine(date.personName, date.ideaText, cover);
      const luluSephora = isLuluSephoraDate(date.ideaText, cover);
      const myName = profile.name.trim();
      const sig = buildDatePlanSig(profile, date, person, provideRows, allItems);
      const metaKey = cleanMetaKey(profile.metaApiKey);
      // Actual-photo-first (Erin, 2026-11-03): if the checked
      // photo registry has real photographs for this date's
      // verified spot, those are the plan's picture — no
      // generated image is made or kept for this date.
      const actualKeys = actualPhotoKeysForDate(planSpot, locationHay, date.plan);
      if (
        date.plan &&
        date.planSig === sig &&
        planLocationCheck(date.plan, locationHay).ok
      ) {
        // Cached plan: reuse its cached image too (same signature)
        // — no new Meta call of either kind is spent. One
        // exception: a current plan whose picture never landed
        // gets its ONE picture made now (this date only), so a
        // Plan the Date push always ends with plan + photo.
        if (actualKeys) {
          // Attach the actual photographs to this date (this
          // date only — the plan text is reused untouched), and
          // drop any generated picture it carried: actual wins.
          const storedKeys =
            date.planImageSource === "actual"
              ? date.planPhotoKeys.split(",").map((k) => k.trim()).filter((k) => k !== "")
              : [];
          const alreadyActual =
            date.planImageSig === sig &&
            storedKeys.join(",") === actualKeys.join(",");
          if (!alreadyActual) {
            if (date.planImageBlobKey) {
              try {
                await ctx.blobs.delete(date.planImageBlobKey);
              } catch {
                // Best effort — the row update below is the switch.
              }
            }
            await db
              .update(schema.dates)
              .set({
                planImageBlobKey: "",
                planImageSig: sig,
                planImageSource: "actual",
                planPhotoKeys: actualKeys.join(","),
              })
              .where(eq(schema.dates.id, date.id));
          }
          return {
            plan: date.plan,
            source: date.planSource === "meta-ai" ? "meta-ai" : "list",
            cached: true,
            imageUrl: null,
            imageSource: "actual" as const,
            photoKeys: actualKeys,
          };
        }
        let cachedImageUrl: string | null = null;
        if (date.planImageBlobKey && date.planImageSig === sig) {
          try {
            cachedImageUrl = await ctx.blobs.getUrl(date.planImageBlobKey);
          } catch {
            cachedImageUrl = null;
          }
        }
        if (!cachedImageUrl && metaKey && date.planSource === "meta-ai") {
          const made = await tryGenerateDatePlanImage(ctx, metaKey, {
            keyword: planSpot.trim(),
            ideaText: date.ideaText,
            dateId: date.id,
            luluSephora,
          });
          if (made) {
            await db
              .update(schema.dates)
              .set({
                planImageBlobKey: made,
                planImageSig: sig,
                planImageSource: "generated",
                planPhotoKeys: "",
              })
              .where(eq(schema.dates.id, date.id));
            try {
              cachedImageUrl = await ctx.blobs.getUrl(made);
            } catch {
              cachedImageUrl = null;
            }
          }
        }
        return {
          plan: date.plan,
          source: date.planSource === "meta-ai" ? "meta-ai" : "list",
          cached: true,
          imageUrl: cachedImageUrl,
          imageSource: cachedImageUrl ? ("generated" as const) : ("none" as const),
          photoKeys: [],
        };
      }
      let plan = "";
      let source: "meta-ai" | "list" = "list";
      if (metaKey) {
        try {
          // The exact prompt the Spark vs Wonder comparison uses
          // (buildDatePlanPrompt) — one prompt, concierge tuning
          // included, so the only variable anywhere is the model.
          const text = await metaChatCompletion(
            metaKey,
            buildDatePlanPrompt({
              myName,
              personName: date.personName,
              myGender: profile.gender,
              personGender: person?.gender ?? "",
              myLocation: profile.location,
              personLocation: person?.location ?? "",
              myAvailableTimes: profile.availableTimes,
              personAvailableTimes: person?.availableTimes ?? "",
              ideaText: date.ideaText,
              spot: planSpot,
              note: planNote,
              meetAt: date.meetAt,
              coverLine,
              qualities: person ? parseQualities(person.qualities) : [],
              myBio: profile.bio,
              personBio: person?.bio ?? "",
              myQualities: parseQualities(profile.qualities),
              myWants: facts.myWants,
              personWants: facts.personWants,
              myProvides: facts.myProvides,
              personProvides: facts.personProvides,
              meetupLine,
            }),
            // 1600 for the same reason as the match note above:
            // reasoning spends from this budget first, and too
            // small a budget ends the call with no visible text.
            1600,
          );
          // Same wording guard as the match note: a generated plan
          // with disallowed wording is never stored — the List-based
          // plan below is used instead. The real-location check
          // (Erin, 2026-11-03) runs here too, before the plan is
          // shown: a Meta plan that places Lululemon / Sephora in
          // Hale'iwa or another wrong town, or never names the
          // verified Waikiki / Kalakaua / Ala Moana location, is
          // discarded and the List-based plan below — written
          // from the verified registry — is used instead. That is
          // a plain fallback, never a dead end.
          if (
            text &&
            !containsBannedWording(text) &&
            planLocationCheck(text, locationHay).ok
          ) {
            plan = text.slice(0, 2000);
            source = "meta-ai";
            await recordMetaStatus(
              ctx,
              "accepted",
              "Connected — Meta AI accepted your key. Match notes and date plans will be written by Meta AI.",
            );
          }
        } catch (e) {
          if (
            e instanceof MetaCallError &&
            (e.status === 401 || e.status === 403)
          ) {
            await recordMetaStatus(
              ctx,
              "rejected",
              "Meta AI didn't accept that key — check it and save it again. Until then, notes and plans keep coming straight from your List.",
            );
          }
          // Fall through to the List-based plan below.
        }
      }
      if (!plan) {
        plan = fallbackDatePlan({
          myName,
          personName: date.personName,
          ideaText: date.ideaText,
          spot: planSpot,
          note: planNote,
          meetAt: date.meetAt,
          myLocation: profile.location,
          personLocation: person?.location ?? "",
          coverDetailLine: datePlanCoverDetailLine(cover),
          meetupLine,
        });
      }
      // The plan's picture, actual-photo-first (Erin,
      // 2026-11-03): when the checked registry has real
      // photographs for this date's verified spot, those are
      // the picture — for a shopping date at Ala Moana Center,
      // actual photos of Ala Moana Center and its Lululemon /
      // Sephora stores; for the Waikiki / Kalakaua date, actual
      // photos of the Waikiki Lululemon and Sephora storefronts.
      // Muse Image runs ONLY as the fallback for a spot with no
      // actual photo, alongside a Meta-written plan, exactly as
      // before — and whichever kind lands is labelled in the UI.
      let imageBlobKey = "";
      let imageUrl: string | null = null;
      let imageSource: "actual" | "generated" | "none" = "none";
      let photoKeys: string[] = [];
      if (actualKeys) {
        imageSource = "actual";
        photoKeys = actualKeys;
        // A stale generated picture from an earlier version of
        // this date never survives an actual-photo plan.
        if (date.planImageBlobKey) {
          try {
            await ctx.blobs.delete(date.planImageBlobKey);
          } catch {
            // Best effort — the row update below is the switch.
          }
        }
      } else if (source === "meta-ai" && metaKey) {
        const made = await tryGenerateDatePlanImage(ctx, metaKey, {
          keyword: planSpot.trim(),
          ideaText: date.ideaText,
          dateId: date.id,
          luluSephora,
        });
        if (made) {
          imageBlobKey = made;
          imageSource = "generated";
          try {
            imageUrl = await ctx.blobs.getUrl(made);
          } catch {
            imageUrl = null;
          }
        }
      }
      await db
        .update(schema.dates)
        .set({
          plan,
          planSource: source,
          planSig: sig,
          planImageBlobKey: imageBlobKey,
          planImageSig: imageSource !== "none" ? sig : "",
          planImageSource: imageSource === "none" ? "" : imageSource,
          planPhotoKeys: photoKeys.join(","),
        })
        .where(eq(schema.dates.id, date.id));
      ctx.invalidateQueries();
      return { plan, source, cached: false, imageUrl, imageSource, photoKeys };
    },
  }),

  deleteGift: defineAction({
    description: "Delete a wishlist entry from The List.",
    request: z.object({ id: z.number().int().positive() }),
    response: okResponse,
    handler: async (ctx, args): Promise<Ok> => {
      const db = ctx.db<typeof schema>();
      await db.delete(schema.listItems).where(eq(schema.listItems.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  // ---------- wishlist unlock — KILLED UNTIL LATER ----------
  //
  // NO payments in the app (Erin's direction, 2026-11-02, the
  // same treatment as Hype): the pay-to-unlock paywall is out —
  // no panel, no prices, no checkout language, and every
  // wishlist entry is visible (getState never locks one). The
  // unlock and pricing actions refuse while it is paused; the
  // wishlist_unlocks table and price columns stay in the schema
  // so it can return later exactly as it was. Re-locking stays
  // available and harmless: with nothing locked, it changes
  // nothing anyone can see.

  unlockWishlist: defineAction({
    description: "Wishlist unlocks are paused (no payments in the app): every wishlist is fully visible, so this refuses and records nothing.",
    request: z.object({
      // null = the general wishlist (gifts not tied to a person)
      personId: z.number().int().positive().nullable(),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<Ok> => {
      requireOwner(ctx);
      void ctx;
      void args;
      throw new Error(
        "Wishlist unlocks are paused for now — every wishlist is fully visible, nothing to unlock.",
      );
    },
  }),

  unlockAllWishlists: defineAction({
    description: "Wishlist unlocks are paused (no payments in the app): every wishlist is fully visible, so this refuses and records nothing.",
    request: z.object({}),
    response: okResponse,
    handler: async (ctx, args): Promise<Ok> => {
      requireOwner(ctx);
      void ctx;
      void args;
      throw new Error(
        "Wishlist unlocks are paused for now — every wishlist is fully visible, nothing to unlock.",
      );
    },
  }),

  relockWishlist: defineAction({
    description: "Clear one wishlist's recorded unlock (the paywall is paused, so nothing is locked either way).",
    request: z.object({
      personId: z.number().int().positive().nullable(),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<Ok> => {
      requireOwner(ctx);
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.wishlistUnlocks);
      for (const u of rows) {
        if ((u.personId ?? null) === args.personId) {
          await db
            .delete(schema.wishlistUnlocks)
            .where(eq(schema.wishlistUnlocks.id, u.id));
        }
      }
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  relockAllWishlists: defineAction({
    description: "Clear every recorded wishlist unlock (the paywall is paused, so nothing is locked either way).",
    request: z.object({}),
    response: okResponse,
    handler: async (ctx, args): Promise<Ok> => {
      requireOwner(ctx);
      void args;
      const db = ctx.db<typeof schema>();
      const existing = await loadProfile(ctx);
      const values = {
        ...existing,
        qualities:
          typeof existing.qualities === "string"
            ? existing.qualities
            : JSON.stringify(existing.qualities),
        wishlistAllUnlocked: false,
        updatedAt: new Date(),
      };
      await db
        .insert(schema.myProfile)
        .values(values)
        .onConflictDoUpdate({ target: schema.myProfile.id, set: values });
      await db.delete(schema.wishlistUnlocks);
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  saveWishlistPricing: defineAction({
    description: "Wishlist unlocks are paused (no payments in the app), so unlock pricing refuses and saves nothing; the stored price columns are left untouched for later.",
    request: z.object({
      singlePriceCents: z.number().int().min(0).max(100000),
      bundlePriceCents: z.number().int().min(0).max(100000),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<Ok> => {
      requireOwner(ctx);
      void ctx;
      void args;
      throw new Error(
        "Wishlist unlocks are paused for now — there are no unlock prices to set.",
      );
    },
  }),

  wipeAllData: defineAction({
    description: "Wipe all List Dating data for a fresh start while preserving the saved Meta AI key: clears the user's profile details and List, all members, dates, messages, photos, promo codes, wishlist unlocks, provides and reports, but keeps the Meta AI key connected.",
    request: z.object({}),
    response: okResponse,
    handler: async (ctx): Promise<Ok> => {
      requireOwner(ctx);
      const db = ctx.db<typeof schema>();
      // Preserve the saved Meta AI key exactly — wipe everything else.
      const existingProfile = await loadProfile(ctx);
      const preservedKey = existingProfile.metaApiKey;
      const preservedKeyStatus = existingProfile.metaKeyStatus;
      const preservedKeyStatusMessage = existingProfile.metaKeyStatusMessage;
      const preservedKeyCheckedAt = existingProfile.metaKeyCheckedAt;
      // Delete photo blobs first (best effort), then all rows.
      const photoRows = await db.select().from(schema.photos);
      for (const ph of photoRows) {
        try {
          await ctx.blobs.delete(ph.blobKey);
        } catch {
          // best effort — row deletion below still clears the record
        }
      }
      await db.batch([
        db.delete(schema.photos),
        db.delete(schema.personChecks),
        db.delete(schema.dates),
        db.delete(schema.safetyCheckins),
        db.delete(schema.messages),
        db.delete(schema.reports),
        db.delete(schema.promoCodes),
        db.delete(schema.hypePayments),
        db.delete(schema.wishlistUnlocks),
        db.delete(schema.provides),
        db.delete(schema.listItems),
        db.delete(schema.people),
        db.delete(schema.gifts),
        db.delete(schema.myProfile),
      ]);
      // Recreate a fresh empty profile row carrying ONLY the preserved key.
      if (preservedKey && preservedKey.trim() !== "") {
        await db.insert(schema.myProfile).values({
          id: 1,
          name: "",
          age: null,
          bio: "",
          spot: "",
          qualities: "[]",
          lookingFor: "",
          discoverable: false,
          contactPref: "matches_only",
          hypeOn: false,
          hypeSpot: "",
          hypeMode: "",
          hypeNote: "",
          hypeExpiresAt: null,
          hypePaidCents: null,
          hypePlan: "",
          metaApiKey: preservedKey,
          metaKeyStatus: preservedKeyStatus,
          metaKeyStatusMessage: preservedKeyStatusMessage,
          metaKeyCheckedAt: preservedKeyCheckedAt,
          wishlistPriceCents: 499,
          wishlistBundlePriceCents: 1388,
          wishlistAllUnlocked: false,
          updatedAt: new Date(),
        });
      }
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  seedDemoSamples: defineAction({
    description: "Seed the 50 clearly labelled Sample demo members Erin asked for (O'ahu locations, varied ages, Provides, wishlists and some Hype) so the app can be demo-checked with a full pool. Runs once: a no-op when samples are already present. Never touches the user's profile, List, existing members, Chat, or the saved Meta AI key.",
    request: z.object({}),
    response: seedDemoResponse,
    handler: async (ctx): Promise<SeedDemoResult> => {
      requireOwner(ctx);
      const db = ctx.db<typeof schema>();
      const existingPeople = await db.select().from(schema.people);
      const existingSamples = existingPeople.filter((p) =>
        p.name.startsWith(SAMPLE_NAME_PREFIX),
      );
      if (existingSamples.length > 0) {
        return {
          ok: true as const,
          alreadySeeded: true,
          people: existingSamples.length,
          provides: 0,
          wishlistItems: 0,
          hypeLive: existingSamples.filter((p) => p.hypeOn).length,
        };
      }

      // Tailor part of the pool to the user's CURRENT List so
      // Matches / Potential / dealbreaker warnings are demonstrable.
      // Read-only: her List is never created or changed here.
      const allItems = await db.select().from(schema.listItems);
      const scored = allItems.filter((i) => i.kind !== "gift" && (i.personId ?? null) === null);
      const mustTexts = scored.filter((i) => i.kind === "must").map((i) => i.text);
      const niceTexts = scored.filter((i) => i.kind === "nice").map((i) => i.text);
      const dealTexts = scored
        .filter((i) => i.kind === "dealbreaker")
        .map((i) => i.text);
      const needTexts = [...mustTexts, ...niceTexts];

      // Which samples get Hype (real mappable spots, in order).
      const hypeIndices = new Set([0, 3, 5, 8, 11, 14, 18, 21, 26, 30, 36, 42, 47]);
      const now = Date.now();
      let hypeCursor = 0;
      let provideCount = 0;
      let wishlistCount = 0;
      let hypeLive = 0;

      for (let i = 0; i < 50; i++) {
        const first = cycle(SAMPLE_FIRST_NAMES, i, "Sample");
        const last = cycle(SAMPLE_LAST_NAMES, i * 3 + 1, "Demo");
        const name = `${SAMPLE_NAME_PREFIX}${first} ${last}`;
        const spot = cycle(SAMPLE_SPOTS, i * 7 + 2, "Haleiwa");

        // Qualities: two generic tags, then the List tailoring.
        const qualities: string[] = [
          cycle(SAMPLE_QUALITY_POOL, i * 2, "Great company"),
          cycle(SAMPLE_QUALITY_POOL, i * 2 + 11, "Good conversation"),
        ];
        if (i < 12) {
          // Strong matches: carry every must-have and a few nice ones.
          qualities.push(...mustTexts);
          qualities.push(...niceTexts.slice(0, 3));
        } else if (i < 25 && needTexts.length > 0) {
          // Middle band: carry one or two of her items.
          qualities.push(cycle(needTexts, i, ""));
          if (niceTexts.length > 0) qualities.push(cycle(niceTexts, i + 1, ""));
        }
        if (dealTexts.length > 0 && (i === 2 || i === 19 || i === 41)) {
          qualities.push(cycle(dealTexts, i, ""));
        }
        const cleanQualities = [...new Set(qualities.map((q) => q.trim()).filter(Boolean))];

        // Hype is killed until later: samples are never seeded
        // with a Hype listing. (hypeIndices / hypeCursor /
        // SAMPLE_HYPE_MODES stay in the file so Hype seeding
        // returns with the feature.)
        void hypeIndices;
        void hypeCursor;
        void now;
        void SAMPLE_HYPE_MODES;

        const inserted = await db
          .insert(schema.people)
          .values({
            source: "joined",
            name,
            age: cycle(SAMPLE_AGES, i, 30),
            bio: `${SAMPLE_BIO_LABEL} ${cycle(SAMPLE_BIO_LINES, i, "")}`,
            location: cycle(SAMPLE_LOCATIONS, i, "Haleiwa, North Shore"),
            availableTimes: cycle(SAMPLE_TIMES, i, "Weekends"),
            qualities: JSON.stringify(cleanQualities),
            spot,
            contactPref: i % 3 === 2 ? "matches_only" : "everyone",
            hypeOn: false,
            hypeSpot: "",
            hypeMode: "",
            hypeNote: "",
            hypeExpiresAt: null,
            hypePaidCents: null,
            hypePlan: "",
          })
          .returning({ id: schema.people.id });
        const person = inserted[0];
        if (!person) throw new Error("seedDemoSamples: insert returned no rows");

        // Provides: two from the general pool for everyone; the
        // middle band also gets one written to cover a real Need.
        const providesToAdd: SampleProvide[] = [
          cycle(SAMPLE_PROVIDE_POOL, i * 2, SAMPLE_PROVIDE_POOL[0] as SampleProvide),
          cycle(SAMPLE_PROVIDE_POOL, i * 2 + 7, SAMPLE_PROVIDE_POOL[1] as SampleProvide),
        ];
        if (i >= 12 && i < 35 && needTexts.length > 0) {
          const need = cycle(needTexts, i, "");
          if (need) {
            providesToAdd.push({
              category: sampleCategoryForNeed(need),
              title: `${need} — I can cover this`,
              maxSpendCents: 15000,
              note: "Sample cover for one of your List items.",
            });
          }
        }
        for (const pv of providesToAdd) {
          await db.insert(schema.provides).values({
            ownerType: "person",
            ownerId: person.id,
            category: pv.category,
            title: pv.title,
            maxSpendCents: pv.maxSpendCents,
            note: pv.note,
          });
          provideCount += 1;
        }

        // Wishlist entries for every second sample (2–5 items, so a
        // few wishlists run past the free preview and show sealed).
        if (i % 2 === 0) {
          const wishCount = 2 + (i % 4);
          for (let w = 0; w < wishCount; w++) {
            const wish = cycle(SAMPLE_WISHLIST_POOL, i + w * 3, SAMPLE_WISHLIST_POOL[0] as SampleWish);
            await db.insert(schema.listItems).values({
              kind: "gift",
              text: wish.title,
              personId: person.id,
              personName: name,
              occasion: wish.occasion,
              priceNote: wish.priceNote,
              link: "",
              giftStatus: w === 4 ? "planned" : "idea",
            });
            wishlistCount += 1;
          }
        }

      }

      ctx.invalidateQueries();
      return {
        ok: true as const,
        alreadySeeded: false,
        people: 50,
        provides: provideCount,
        wishlistItems: wishlistCount,
        hypeLive,
      };
    },
  }),

  clearDemoSamples: defineAction({
    description: "Remove ONLY the labelled Sample demo members (names starting with 'Sample — ') and everything attached to them — photos, checks, dates, safety check-ins, messages, wishlist entries and unlocks, Hype payments and Provides. Real members, the user's profile, List, Chat and Meta AI key are untouched. Used when Erin says she is ready to clear the demo data.",
    request: z.object({}),
    response: clearDemoResponse,
    handler: async (ctx): Promise<ClearDemoResult> => {
      requireOwner(ctx);
      const db = ctx.db<typeof schema>();
      const allPeople = await db.select().from(schema.people);
      const ids = allPeople
        .filter((p) => p.name.startsWith(SAMPLE_NAME_PREFIX))
        .map((p) => p.id);
      if (ids.length === 0) return { ok: true as const, removed: 0 };
      const photoRows = await db.select().from(schema.photos);
      const mine = photoRows.filter(
        (p) => p.ownerType === "person" && ids.includes(p.ownerId),
      );
      for (const ph of mine) {
        try {
          await ctx.blobs.delete(ph.blobKey);
        } catch {
          // best effort — row deletion below still clears the record
        }
        await db.delete(schema.photos).where(eq(schema.photos.id, ph.id));
      }
      await db.batch([
        db.delete(schema.people).where(inArray(schema.people.id, ids)),
        db.delete(schema.personChecks).where(inArray(schema.personChecks.personId, ids)),
        db.delete(schema.dates).where(inArray(schema.dates.personId, ids)),
        db.delete(schema.safetyCheckins).where(inArray(schema.safetyCheckins.personId, ids)),
        db.delete(schema.messages).where(inArray(schema.messages.personId, ids)),
        db.delete(schema.wishlistUnlocks).where(inArray(schema.wishlistUnlocks.personId, ids)),
        db.delete(schema.hypePayments).where(inArray(schema.hypePayments.personId, ids)),
        db
          .delete(schema.provides)
          .where(
            and(
              eq(schema.provides.ownerType, "person"),
              inArray(schema.provides.ownerId, ids),
            ),
          ),
        // All List rows owned by those members (their own
        // Wants and their Desires / Gifts alike) — personId
        // null rows are the user's own and never matched.
        db
          .delete(schema.listItems)
          .where(inArray(schema.listItems.personId, ids)),
      ]);
      ctx.invalidateQueries();
      return { ok: true as const, removed: ids.length };
    },
  }),

  clearAllMembers: defineAction({
    description: "Remove ALL members (every row in people, including the Sample demo members and Alex) and everything attached to them — photos, checks, dates, safety check-ins, messages, wishlist entries and unlocks, Hype payments and Provide entries. Erin's own profile row is never touched: her List, Provides, Desires, Hype and saved Meta AI key stay exactly as they are.",
    request: z.object({}),
    response: clearDemoResponse,
    handler: async (ctx): Promise<ClearDemoResult> => {
      requireOwner(ctx);
      const db = ctx.db<typeof schema>();
      const allPeople = await db.select().from(schema.people);
      const ids = allPeople.map((p) => p.id);
      if (ids.length === 0) return { ok: true as const, removed: 0 };
      const photoRows = await db.select().from(schema.photos);
      const mine = photoRows.filter(
        (p) => p.ownerType === "person" && ids.includes(p.ownerId),
      );
      for (const ph of mine) {
        try {
          await ctx.blobs.delete(ph.blobKey);
        } catch {
          // best effort — row deletion below still clears the record
        }
        await db.delete(schema.photos).where(eq(schema.photos.id, ph.id));
      }
      // Only member-attached rows are deleted. Erin's own rows are
      // keyed differently and are never matched here: my_profile is
      // not touched at all, her scored List and her own Desires are
      // list_items with person_id null, her Provides are
      // owner_type "profile", and her own wishlist unlocks carry
      // person_id null.
      await db.batch([
        db.delete(schema.people).where(inArray(schema.people.id, ids)),
        db.delete(schema.personChecks).where(inArray(schema.personChecks.personId, ids)),
        db.delete(schema.dates).where(inArray(schema.dates.personId, ids)),
        db.delete(schema.safetyCheckins).where(inArray(schema.safetyCheckins.personId, ids)),
        db.delete(schema.messages).where(inArray(schema.messages.personId, ids)),
        db.delete(schema.wishlistUnlocks).where(inArray(schema.wishlistUnlocks.personId, ids)),
        db.delete(schema.hypePayments).where(inArray(schema.hypePayments.personId, ids)),
        db
          .delete(schema.provides)
          .where(
            and(
              eq(schema.provides.ownerType, "person"),
              inArray(schema.provides.ownerId, ids),
            ),
          ),
        // All List rows owned by those members (their own
        // Wants and their Desires / Gifts alike) — personId
        // null rows are the user's own and never matched.
        db
          .delete(schema.listItems)
          .where(inArray(schema.listItems.personId, ids)),
      ]);
      ctx.invalidateQueries();
      return { ok: true as const, removed: ids.length };
    },
  }),

  seedTestSet: defineAction({
    description: "Seed the small Sample/Test set Erin asked to LEAVE in the live app: four clearly labelled Test members — a Match (50%+ on her List), a Potential (a Provide covering one of her Needs), a dealbreaker hit, and a second Match — plus one accepted date with Maya that does a real item from Erin's List, with day and time set. Runs once: a no-op when the test set is already present. Never touches Erin's profile, her List, or her saved Meta AI key.",
    request: z.object({}),
    response: seedTestResponse,
    handler: async (ctx): Promise<SeedTestResult> => {
      requireOwner(ctx);
      const db = ctx.db<typeof schema>();
      const existingPeople = await db.select().from(schema.people);
      const existingTests = existingPeople.filter((p) =>
        p.name.startsWith(TEST_NAME_PREFIX),
      );
      if (existingTests.length > 0) {
        const existingDates = await db.select().from(schema.dates);
        const testDate = existingDates.find((d) =>
          existingTests.some((p) => p.id === d.personId),
        );
        return {
          ok: true as const,
          alreadySeeded: true,
          people: existingTests.length,
          provides: 0,
          wishlistItems: 0,
          dates: testDate ? 1 : 0,
          matchName: TEST_MATCH_NAME,
          potentialName: TEST_POTENTIAL_NAME,
          dealbreakerName: TEST_DEALBREAKER_NAME,
          dateItemText: testDate?.ideaText ?? "",
        };
      }

      // Tailor the test to Erin's CURRENT List — read-only. Her
      // profile row and List are never created or changed here,
      // and the saved Meta AI key is never read or written.
      const allItems = await db.select().from(schema.listItems);
      const scored = allItems.filter((i) => i.kind !== "gift" && (i.personId ?? null) === null);
      const mustItems = scored.filter((i) => i.kind === "must");
      const niceItems = scored.filter((i) => i.kind === "nice");
      const dealItems = scored.filter((i) => i.kind === "dealbreaker");
      const needItems = [...mustItems, ...niceItems];
      const dateItem = mustItems[0] ?? niceItems[0] ?? null;

      let provideCount = 0;
      let wishlistCount = 0;

      const insertPerson = async (args: {
        name: string;
        age: number;
        bioLine: string;
        location: string;
        availableTimes: string;
        qualities: string[];
        spot: string;
        // Stated gender for the demo filter: Maya and Leila are
        // women, Koa and Dan are men — so with Erin (a woman) in
        // the default heterosexual mode, Koa and Dan are who her
        // Matches / Potential show; the pride Same sex mode shows
        // Maya and Leila instead.
        gender: "man" | "woman";
      }): Promise<number> => {
        const inserted = await db
          .insert(schema.people)
          .values({
            source: "joined",
            name: args.name,
            age: args.age,
            bio: `${TEST_BIO_LABEL} ${args.bioLine}`,
            location: args.location,
            availableTimes: args.availableTimes,
            gender: args.gender,
            sameSex: false,
            qualities: JSON.stringify(
              [...new Set(args.qualities.map((q) => q.trim()).filter(Boolean))],
            ),
            spot: args.spot,
            contactPref: "everyone",
            hypeOn: false,
            hypeSpot: "",
            hypeMode: "",
            hypeNote: "",
          })
          .returning({ id: schema.people.id });
        const row = inserted[0];
        if (!row) throw new Error("seedTestSet: insert returned no rows");
        return row.id;
      };

      const setCheck = async (
        personId: number,
        listItemId: number,
        present: boolean,
      ) => {
        await db.insert(schema.personChecks).values({
          personId,
          listItemId,
          present,
        });
      };

      const addProvideFor = async (
        personId: number,
        pv: SampleProvide,
      ) => {
        await db.insert(schema.provides).values({
          ownerType: "person",
          ownerId: personId,
          category: pv.category,
          title: pv.title,
          maxSpendCents: pv.maxSpendCents,
          note: pv.note,
        });
        provideCount += 1;
      };

      const addWishlistFor = async (
        personId: number,
        personName: string,
        wishes: SampleWish[],
      ) => {
        for (const wish of wishes) {
          await db.insert(schema.listItems).values({
            kind: "gift",
            text: wish.title,
            personId,
            personName,
            occasion: wish.occasion,
            priceNote: wish.priceNote,
            link: "",
            giftStatus: "idea",
          });
          wishlistCount += 1;
        }
      };

      const coverProvideFor = (
        needText: string,
        maxSpendCents: number,
      ): SampleProvide => ({
        category: sampleCategoryForNeed(needText),
        title: `${needText} — I can cover this`,
        maxSpendCents,
        note: "Test cover — Sample/Test provide for one of your List items.",
      });

      // 1 — The Match: checked present on every scored item, so
      // she scores 100% (50%+ = Match) whatever the List holds,
      // and a Provide covering the first Need as well.
      const mayaId = await insertPerson({
        name: TEST_MATCH_NAME,
        age: 31,
        bioLine: "Here to do real things from the List.",
        location: "Haleiwa, North Shore",
        availableTimes: "Saturday mornings, weekday evenings",
        qualities: [
          ...needItems.map((i) => i.text),
          "Great company",
        ],
        spot: "Haleiwa",
        gender: "woman",
      });
      for (const item of needItems) await setCheck(mayaId, item.id, true);
      for (const item of dealItems) await setCheck(mayaId, item.id, false);
      const firstNeed = needItems[0];
      if (firstNeed) {
        await addProvideFor(mayaId, coverProvideFor(firstNeed.text, 15000));
      }
      await addProvideFor(mayaId, {
        category: "Fitness & Outdoors",
        title: "Sunrise hike buddy & guide",
        maxSpendCents: 4000,
        note: "Test provide — Sample/Test.",
      });
      await addWishlistFor(mayaId, TEST_MATCH_NAME, [
        cycle(SAMPLE_WISHLIST_POOL, 3, SAMPLE_WISHLIST_POOL[0] as SampleWish),
        cycle(SAMPLE_WISHLIST_POOL, 8, SAMPLE_WISHLIST_POOL[1] as SampleWish),
      ]);

      // 2 — The Potential: checked absent on every scored item
      // (0%), but a Provide covers one of Erin's Needs — so Koa
      // could fulfill a List item on a date = Potential.
      const kaiId = await insertPerson({
        name: TEST_POTENTIAL_NAME,
        age: 36,
        bioLine: "I cover things on the List — that's my way in.",
        location: "Waialua, O'ahu",
        availableTimes: "Weekends",
        qualities: ["Good conversation", "Easygoing"],
        spot: "Waialua",
        gender: "man",
      });
      for (const item of scored) await setCheck(kaiId, item.id, false);
      const kaiNeed = needItems[needItems.length - 1] ?? null;
      if (kaiNeed) {
        await addProvideFor(kaiId, coverProvideFor(kaiNeed.text, 12000));
      } else {
        await addProvideFor(kaiId, {
          category: "Home & Handy",
          title: "Small repairs around the house",
          maxSpendCents: 12000,
          note: "Test provide — Sample/Test.",
        });
      }
      await addWishlistFor(kaiId, TEST_POTENTIAL_NAME, [
        cycle(SAMPLE_WISHLIST_POOL, 5, SAMPLE_WISHLIST_POOL[2] as SampleWish),
      ]);

      // 3 — The dealbreaker hit: checked present on Erin's first
      // dealbreaker item, absent on her Needs — the member card
      // shows the dealbreaker warning.
      const danId = await insertPerson({
        name: TEST_DEALBREAKER_NAME,
        age: 44,
        bioLine: "Here to show the dealbreaker warning working.",
        location: "Kahuku, North Shore",
        availableTimes: "Evenings after 5",
        qualities: [
          ...(dealItems[0] ? [dealItems[0].text] : []),
          "Easygoing",
        ],
        spot: "Kahuku",
        gender: "man",
      });
      for (const item of needItems) await setCheck(danId, item.id, false);
      if (dealItems[0]) await setCheck(danId, dealItems[0].id, true);
      await addWishlistFor(danId, TEST_DEALBREAKER_NAME, [
        cycle(SAMPLE_WISHLIST_POOL, 10, SAMPLE_WISHLIST_POOL[3] as SampleWish),
      ]);

      // 4 — A second Match, lighter: must-haves covered, one nice
      // item too, so Matches reads as a group, not a one-off.
      const leilaId = await insertPerson({
        name: TEST_SECOND_NAME,
        age: 28,
        bioLine: "Put it on the List and let's make it happen.",
        location: "Haleiwa, North Shore",
        availableTimes: "Sunday afternoons, Friday evenings",
        qualities: [
          ...mustItems.map((i) => i.text),
          ...(niceItems[0] ? [niceItems[0].text] : []),
          "Good conversation",
        ],
        spot: "Haleiwa",
        gender: "woman",
      });
      for (const item of mustItems) await setCheck(leilaId, item.id, true);
      if (niceItems[0]) await setCheck(leilaId, niceItems[0].id, true);
      for (const item of dealItems) await setCheck(leilaId, item.id, false);
      await addProvideFor(leilaId, {
        category: "Creative & Photos",
        title: "Photos for your profile",
        maxSpendCents: 12000,
        note: "Test provide — Sample/Test.",
      });
      await addWishlistFor(leilaId, TEST_SECOND_NAME, [
        cycle(SAMPLE_WISHLIST_POOL, 1, SAMPLE_WISHLIST_POOL[4] as SampleWish),
        cycle(SAMPLE_WISHLIST_POOL, 12, SAMPLE_WISHLIST_POOL[5] as SampleWish),
      ]);

      // The date: Maya + Erin, doing a REAL item from Erin's List
      // (her first must-have, else first nice item) — accepted,
      // with the next Saturday at 10:00 AM set as day AND time,
      // plus the Chat confirmation that goes with it. Not coffee,
      // not small talk: the List item itself is the date.
      let dateCount = 0;
      if (dateItem) {
        const meet = new Date();
        meet.setDate(meet.getDate() + (((6 - meet.getDay()) % 7 + 7) % 7 || 7));
        meet.setHours(10, 0, 0, 0);
        const insertedDate = await db
          .insert(schema.dates)
          .values({
            personId: mayaId,
            personName: TEST_MATCH_NAME,
            direction: "out",
            listItemId: dateItem.id,
            ideaText: dateItem.text,
            meetAt: meet,
            spot: "Haleiwa",
            note: "Test date — Sample/Test: a real item from the List, getting done.",
            status: "accepted",
            plan: "",
            planSource: "",
            planSig: "",
          })
          .returning({ id: schema.dates.id });
        const dateRow = insertedDate[0];
        if (!dateRow) throw new Error("seedTestSet: date insert returned no rows");
        dateCount = 1;
        await db.insert(schema.messages).values({
          personId: mayaId,
          personName: TEST_MATCH_NAME,
          direction: "out",
          body: `Confirm the meetup: ${dateItem.text} — Saturday 10:00 AM at Haleiwa. See you there.`,
          kind: "quick",
          read: true,
          dateId: dateRow.id,
        });
      }

      ctx.invalidateQueries();
      return {
        ok: true as const,
        alreadySeeded: false,
        people: 4,
        provides: provideCount,
        wishlistItems: wishlistCount,
        dates: dateCount,
        matchName: TEST_MATCH_NAME,
        potentialName: TEST_POTENTIAL_NAME,
        dealbreakerName: TEST_DEALBREAKER_NAME,
        dateItemText: dateItem?.text ?? "",
      };
    },
  }),

  setupCore4: defineAction({
    description: "Set up the Core 4 demo storyline, two-sided: create/update the Showcase members Showcase Alex (42, Waikiki; Want: learn to surf; Provides: guitars and computers help), Showcase Koa (57, Pipeline, North Shore, inventor, coconut tree climber and shopping sponsor whose Lululemon Provide cover up to $120 is kept; feral cats, not domestic; his existing Want on record is kept, never invented) and Showcase Leilani (22, studying to be a nurse, code name only; Provide: nursing help as a nursing student; no Want is invented for her), then delete every other member and everything attached to them, leaving Erin plus Showcase Alex, Showcase Koa and Showcase Leilani, and report each core member's Want and Provide counts. Erin's profile, List, Provides and saved Meta AI key are never touched, and no notes or plans are generated.",
    request: z.object({}),
    response: core4Response,
    handler: async (ctx): Promise<Core4Result> => {
      requireOwner(ctx);
      const db = ctx.db<typeof schema>();
      const allItems = await db.select().from(schema.listItems);
      const scoredItems = allItems.filter((i) => i.kind !== "gift" && (i.personId ?? null) === null);
      const peopleRows = await db.select().from(schema.people);
      const provideRowsAll = await db.select().from(schema.provides);
      const findPerson = (pred: (p: PersonRow) => boolean) =>
        peopleRows.find(pred);

      // Pin a member absent on EVERY scored item, dealbreakers
      // included, so their score and flags come only from Provide
      // covers and their bio — never from a stray fuzzy quality.
      const resetChecks = async (personId: number) => {
        await db
          .delete(schema.personChecks)
          .where(eq(schema.personChecks.personId, personId));
        for (const item of scoredItems) {
          await db.insert(schema.personChecks).values({
            personId,
            listItemId: item.id,
            present: false,
          });
        }
      };
      const renameSnapshots = async (personId: number, name: string) => {
        await db
          .update(schema.listItems)
          .set({ personName: name })
          .where(eq(schema.listItems.personId, personId));
        await db
          .update(schema.messages)
          .set({ personName: name })
          .where(eq(schema.messages.personId, personId));
        await db
          .update(schema.dates)
          .set({ personName: name })
          .where(eq(schema.dates.personId, personId));
      };
      const clearedListing = {
        blocked: false,
        matchDecision: "none" as const,
        matchNote: "",
        matchNoteSource: "",
        matchNoteSig: "",
        hypeOn: false,
        hypeSpot: "",
        hypeMode: "",
        hypeNote: "",
        hypeExpiresAt: null,
        hypePaidCents: null,
        hypePlan: "",
      };

      // ----- Koa: update the existing Koa row in place -----
      const kaiFound =
        findPerson((p) => isShowcaseMember(p, "Koa")) ??
        findPerson((p) => p.name === "Kalani") ??
        findPerson((p) => p.name === "Kailani") ??
        findPerson((p) => p.name === "Kai") ??
        findPerson((p) => p.name === TEST_POTENTIAL_NAME) ??
        findPerson((p) => p.name.startsWith("Test — Koa")) ??
        findPerson((p) => p.name.startsWith("Test — Kalani")) ??
        findPerson((p) => p.name.startsWith("Test — Kai"));
      let kaiId: number;
      if (kaiFound) {
        kaiId = kaiFound.id;
        await db
          .update(schema.people)
          .set({
            name: "Showcase Koa",
            age: 57,
            bio: CORE4_KAI_BIO,
            location: KOA_LOCATION,
            availableTimes: kaiFound.availableTimes.trim()
              ? kaiFound.availableTimes
              : "Weekends",
            gender: "man",
            sameSex: false,
            qualities: JSON.stringify(["Good conversation", "Easygoing"]),
            spot: KOA_SPOT,
            contactPref: "everyone",
            ...clearedListing,
          })
          .where(eq(schema.people.id, kaiId));
      } else {
        const inserted = await db
          .insert(schema.people)
          .values({
            source: "joined",
            name: "Showcase Koa",
            age: 57,
            bio: CORE4_KAI_BIO,
            location: KOA_LOCATION,
            availableTimes: "Weekends",
            gender: "man",
            sameSex: false,
            qualities: JSON.stringify(["Good conversation", "Easygoing"]),
            spot: KOA_SPOT,
            contactPref: "everyone",
          })
          .returning({ id: schema.people.id });
        const row = inserted[0];
        if (!row) throw new Error("setupCore4: Koa insert returned no rows");
        kaiId = row.id;
      }
      await resetChecks(kaiId);
      // Keep Koa's Lululemon Provide cover up to $120: update the
      // existing covering row in place; only create it if it's gone.
      const kaiLulu = provideRowsAll.find(
        (pv) =>
          pv.ownerType === "person" &&
          pv.ownerId === kaiId &&
          norm(pv.title).includes("lululemon"),
      );
      if (kaiLulu) {
        await db
          .update(schema.provides)
          .set({
            category: "Money & Treats",
            maxSpendCents: 12000,
            note: "Showcase Koa can sponsor shopping: covers Lululemon up to $120.",
          })
          .where(eq(schema.provides.id, kaiLulu.id));
      } else {
        await db.insert(schema.provides).values({
          ownerType: "person",
          ownerId: kaiId,
          category: "Money & Treats",
          title: "Lululemon — I can cover this",
          maxSpendCents: 12000,
          note: "Showcase Koa can sponsor shopping: covers Lululemon up to $120.",
        });
      }
      await renameSnapshots(kaiId, "Showcase Koa");

      // ----- Alex: THE date -----
      const alexFound =
        findPerson((p) => isShowcaseMember(p, "Alex")) ??
        findPerson((p) => p.name === "Zach") ??
        findPerson((p) => p.name.startsWith("Demo — Alex")) ??
        findPerson((p) => p.name.startsWith("Demo — Zach")) ??
        findPerson((p) => p.name.startsWith("Test — Alex")) ??
        findPerson((p) => p.name.startsWith("Test — Zach"));
      let alexId: number;
      const alexFields = {
        name: "Showcase Alex",
        age: 42,
        bio: CORE4_ALEX_BIO,
        location: "Waikiki",
        availableTimes: "Weekday evenings, weekends",
        gender: "man" as const,
        sameSex: false,
        qualities: JSON.stringify([
          "Guitars",
          "Computers",
          "Wants to learn to surf",
        ]),
        spot: "Waikiki",
        contactPref: "everyone" as const,
      };
      if (alexFound) {
        alexId = alexFound.id;
        await db
          .update(schema.people)
          .set({ ...alexFields, ...clearedListing })
          .where(eq(schema.people.id, alexId));
      } else {
        const inserted = await db
          .insert(schema.people)
          .values({ source: "joined", ...alexFields })
          .returning({ id: schema.people.id });
        const row = inserted[0];
        if (!row) throw new Error("setupCore4: Alex insert returned no rows");
        alexId = row.id;
      }
      await resetChecks(alexId);
      // Alex's own Provides are what he does — guitars, computers.
      // Neither covers a Need on Erin's List, by design: Alex's
      // route in is the other way, Erin's Provide covering his want.
      await db
        .delete(schema.provides)
        .where(
          and(
            eq(schema.provides.ownerType, "person"),
            eq(schema.provides.ownerId, alexId),
          ),
        );
      await db.insert(schema.provides).values([
        {
          ownerType: "person",
          ownerId: alexId,
          category: "Tech & Phone Help",
          title: "Computers — help & fixes",
          maxSpendCents: null,
          note: "Showcase Alex does computers.",
        },
        {
          ownerType: "person",
          ownerId: alexId,
          category: "Other",
          title: "Guitars — setup, strings & a jam",
          maxSpendCents: null,
          note: "Showcase Alex does guitars.",
        },
      ]);
      // Alex's want — the wishlist entry Erin's Surfing lesson
      // Provide covers, so coveredByMe and the date planner's
      // Provide-cover route both find it.
      await db
        .delete(schema.listItems)
        .where(
          and(
            eq(schema.listItems.kind, "gift"),
            eq(schema.listItems.personId, alexId),
          ),
        );
      await db.insert(schema.listItems).values({
        kind: "gift",
        text: "Surfing lesson — learn to surf",
        personId: alexId,
        personName: "Showcase Alex",
        occasion: "First date",
        priceNote: "about $50",
        link: "",
        giftStatus: "idea",
      });
      await renameSnapshots(alexId, "Showcase Alex");

      // ----- Leilani: code name only -----
      const leilaniFound =
        findPerson((p) => isShowcaseMember(p, "Leilani")) ??
        findPerson((p) => p.name.startsWith("Demo — Leilani"));
      let leilaniId: number;
      const leilaniFields = {
        name: "Showcase Leilani",
        age: 22,
        bio: CORE4_LEILANI_BIO,
        location: "",
        availableTimes: "",
        gender: "woman" as const,
        sameSex: false,
        qualities: JSON.stringify(["Studying to be a nurse"]),
        spot: "",
        contactPref: "everyone" as const,
      };
      if (leilaniFound) {
        leilaniId = leilaniFound.id;
        await db
          .update(schema.people)
          .set({ ...leilaniFields, ...clearedListing })
          .where(eq(schema.people.id, leilaniId));
      } else {
        const inserted = await db
          .insert(schema.people)
          .values({ source: "joined", ...leilaniFields })
          .returning({ id: schema.people.id });
        const row = inserted[0];
        if (!row) throw new Error("setupCore4: Leilani insert returned no rows");
        leilaniId = row.id;
      }
      await resetChecks(leilaniId);
      // Leilani's Provide: nursing help, as a nursing student —
      // the one Provide her storyline states. Her Want side is
      // NOT touched and NOT invented: any Want already on her
      // record stays, and if there is none it stays empty for
      // Erin to fill (reported in this action's `sides` counts).
      await db
        .delete(schema.provides)
        .where(
          and(
            eq(schema.provides.ownerType, "person"),
            eq(schema.provides.ownerId, leilaniId),
          ),
        );
      await db.insert(schema.provides).values({
        ownerType: "person",
        ownerId: leilaniId,
        category: "Health & Wellness",
        title: "Nursing help — as a nursing student",
        maxSpendCents: null,
        note: "Showcase Leilani is studying to be a nurse.",
      });
      await renameSnapshots(leilaniId, "Showcase Leilani");

      // ----- Delete everyone else, with everything attached -----
      const keepIds = [kaiId, alexId, leilaniId];
      const removeIds = peopleRows
        .map((p) => p.id)
        .filter((id) => !keepIds.includes(id));
      let removed = 0;
      if (removeIds.length > 0) {
        const photoRows = await db.select().from(schema.photos);
        const mine = photoRows.filter(
          (p) => p.ownerType === "person" && removeIds.includes(p.ownerId),
        );
        for (const ph of mine) {
          try {
            await ctx.blobs.delete(ph.blobKey);
          } catch {
            // best effort — row deletion below still clears the record
          }
          await db.delete(schema.photos).where(eq(schema.photos.id, ph.id));
        }
        await db.batch([
          db.delete(schema.people).where(inArray(schema.people.id, removeIds)),
          db
            .delete(schema.personChecks)
            .where(inArray(schema.personChecks.personId, removeIds)),
          db.delete(schema.dates).where(inArray(schema.dates.personId, removeIds)),
          db
            .delete(schema.safetyCheckins)
            .where(inArray(schema.safetyCheckins.personId, removeIds)),
          db
            .delete(schema.messages)
            .where(inArray(schema.messages.personId, removeIds)),
          db
            .delete(schema.wishlistUnlocks)
            .where(inArray(schema.wishlistUnlocks.personId, removeIds)),
          db
            .delete(schema.hypePayments)
            .where(inArray(schema.hypePayments.personId, removeIds)),
          db
            .delete(schema.modelComparisons)
            .where(inArray(schema.modelComparisons.personId, removeIds)),
          db
            .delete(schema.reports)
            .where(inArray(schema.reports.personId, removeIds)),
          db
            .delete(schema.provides)
            .where(
              and(
                eq(schema.provides.ownerType, "person"),
                inArray(schema.provides.ownerId, removeIds),
              ),
            ),
          db
            .delete(schema.listItems)
            .where(inArray(schema.listItems.personId, removeIds)),
        ]);
        removed = removeIds.length;
      }

      // Verify before reporting: re-read the member rows, and
      // count each core member's two sides (Wants + Provides).
      const finalPeople = await db.select().from(schema.people);
      const finalItems = await db.select().from(schema.listItems);
      const finalProvides = await db.select().from(schema.provides);
      const sides = [
        { name: "Showcase Alex", id: alexId },
        { name: "Showcase Koa", id: kaiId },
        { name: "Showcase Leilani", id: leilaniId },
      ].map((k) => ({
        name: k.name,
        wants: finalItems.filter(
          (i) => i.kind === "gift" && i.personId === k.id,
        ).length,
        provides: finalProvides.filter(
          (pv) => pv.ownerType === "person" && pv.ownerId === k.id,
        ).length,
      }));
      ctx.invalidateQueries();
      return {
        ok: true as const,
        people: finalPeople.length,
        removed,
        memberNames: finalPeople.map((p) => p.name).sort(),
        sides,
      };
    },
  }),

  ensureAlexWants: defineAction({
    description: "Set Alex's directed desires to exactly 'Play guitar under the moonlight' and 'Chess Party' (both Entertainment — his Yoga, learn-to-surf and combined guitar-or-chess desire rows are removed; Erin, 2026-11-04, superseding the 2026-11-03 Yoga / guitar-or-chess direction); keep his directed Provide Lululemon shopping up to $200 as his 3rd Provide with its note carrying the Sephora bonus up to $100 on the Lululemon shopping date (Erin corrected: Sephora is a bonus attached to the Lululemon Provide, NOT a separate Provide, NOT a 4th choice, and no longer pending as a swap — Alex's Provides stay exactly 3: Computers, Guitars, Lululemon shopping up to $200; a standalone Sephora Provide row, if one ever exists, is folded into the Lululemon note and removed); set Koa's directed desires to exactly 'Car detail' (kept, Car & Mechanical) and 'Trip to Maui (4 days) with tandem jet ski ride' (Travel & Trips) — his Massage and Pool partner to swim desire rows are removed (Erin, 2026-11-04), replace Koa's Provide Cell phone payment up to $140 with Snorkeling up to $140 (same $140 budget, cell phone payment is removed and not kept) and keep Hair salon up to $250 alongside his Lululemon cover up to $120 (Koa's Provides stay exactly 3: Lululemon $120, Snorkeling $140, Hair salon $250, never a 4th), add Leilani's directed Provides Massage and Guitar jam session alongside her Nursing help (her Provides reach exactly 3: Nursing help, Massage, Guitar jam session, never a 4th), and add Leilani's directed Wants Victoria's Secret shopping up to $100, Snorkeling and Go to a Rave (her Wants reach exactly 3, never a 4th; Leilani is 22, so the 21+ gate for a rave / night-club spot allows her). Idempotent (the Koa replacement and the Sephora fold are one-time in-place updates, then no-ops), and returns the 3-each Wants/Provides audit for Erin, Alex, Koa and Leilani with missing counts (gaps are reported, never filled).",
    request: z.object({}),
    response: alexWantsResponse,
    handler: async (ctx): Promise<AlexWantsResult> => {
      requireOwner(ctx);
      const db = ctx.db<typeof schema>();
      const peopleRows = await db.select().from(schema.people);
      const alex =
        peopleRows.find((p) => isShowcaseMember(p, "Alex")) ??
        peopleRows.find((p) => p.name === "Zach");
      const added: string[] = [];
      const addedProvides: string[] = [];
      const updatedProvides: string[] = [];
      const pendingProvides: string[] = [];
      const addedKaiWants: string[] = [];
      const addedKaiProvides: string[] = [];
      const replacedKaiProvides: string[] = [];
      const removedKaiProvides: string[] = [];
      const addedLeilaniProvides: string[] = [];
      const addedLeilaniWants: string[] = [];
      if (alex) {
        // Alex's directed desires (Erin, 2026-11-04, superseding
        // the 2026-11-03 "Yoga" / "Play guitar or chess"
        // direction): exactly "Play guitar under the moonlight"
        // and "Chess Party" (both Entertainment) — no Yoga and
        // no surfing-lesson desire. Reconciled through the same
        // helper fixShowcaseDesires uses, so this action can no
        // longer resurrect the removed rows; `added` reports any
        // of the two that were actually inserted.
        const alexFix = await reconcilePersonDesires(
          ctx,
          alex,
          ALEX_DESIRES,
        );
        added.push(...alexFix.added);
        // Alex's directed Provide, exact cap Erin gave:
        // Lululemon shopping up to $200. CORRECTION (Erin,
        // 2026-11-03): Sephora up to $100 is a BONUS attached to
        // this one Provide — included when you go on the
        // Lululemon shopping date with him — NOT a separate
        // Provide, NOT a 4th choice, and no longer pending as a
        // swap. So: the Lululemon row is added (only when
        // missing AND the side is under the flat 3 cap) with the
        // Sephora bonus in its note; an existing Lululemon row
        // whose note does not yet carry the bonus gets the note
        // set (a one-time in-place update, then a no-op); and a
        // standalone "Sephora" Provide row, if one ever exists,
        // is folded into the Lululemon note and deleted, so
        // Alex's Provides stay exactly 3: Computers, Guitars,
        // Lululemon shopping up to $200 (Sephora $100 bonus on
        // the Lululemon date).
        assertCleanWording("Lululemon shopping", "Sephora");
        const provideRows = await db.select().from(schema.provides);
        const alexProvides = provideRows.filter(
          (pv) => pv.ownerType === "person" && pv.ownerId === alex.id,
        );
        const lululemonRow = alexProvides.find((pv) =>
          norm(pv.title).includes("lululemon"),
        );
        const sephoraRows = alexProvides.filter(
          (pv) =>
            norm(pv.title).includes("sephora") && pv !== lululemonRow,
        );
        if (!lululemonRow && alexProvides.length < 3) {
          await db.insert(schema.provides).values({
            ownerType: "person",
            ownerId: alex.id,
            category: "Money & Treats",
            title: "Lululemon shopping",
            maxSpendCents: 20000,
            note: ALEX_LULULEMON_NOTE,
          });
          addedProvides.push("Lululemon shopping");
        } else if (
          lululemonRow &&
          !norm(lululemonRow.note).includes("sephora")
        ) {
          await db
            .update(schema.provides)
            .set({
              note: lululemonRow.note.trim()
                ? `${lululemonRow.note.trim()} ${ALEX_LULULEMON_NOTE}`
                : ALEX_LULULEMON_NOTE,
            })
            .where(eq(schema.provides.id, lululemonRow.id));
          updatedProvides.push("Lululemon shopping");
        }
        // Fold any standalone Sephora Provide back into the
        // Lululemon bonus: it is part of that one Provide, so
        // the separate row goes away and the count stays at 3.
        for (const row of sephoraRows) {
          await db
            .delete(schema.provides)
            .where(eq(schema.provides.id, row.id));
          if (!updatedProvides.includes("Lululemon shopping")) {
            updatedProvides.push("Lululemon shopping");
          }
        }
      }
      // Koa's directed desires (Erin, 2026-11-04, superseding
      // the 2026-11-03 "Massage" / "Pool partner to swim"
      // direction): exactly "Car detail" (kept, Car & Mechanical)
      // and "Trip to Maui (4 days) with tandem jet ski ride"
      // (Travel & Trips) — Massage and Pool partner to swim are
      // removed from his desires, and the earlier "with wind
      // surf lesson" wording is replaced by the tandem jet ski
      // ride inside the same Maui trip. Reconciled through the
      // same helper fixShowcaseDesires uses; addedKaiWants
      // reports any directed desire that was actually inserted.
      const kai =
        peopleRows.find((p) => isShowcaseMember(p, "Koa")) ??
        peopleRows.find((p) => p.name === "Kalani") ??
        peopleRows.find((p) => p.name === "Kai");
      if (kai) {
        const kaiFix = await reconcilePersonDesires(ctx, kai, KOA_DESIRES);
        addedKaiWants.push(...kaiFix.added);
        // Koa's directed Provides (Erin, updated 2026-11-03):
        // "Snorkeling" up to $140 REPLACES "Cell phone payment"
        // up to $140 — same $140 budget, now for snorkeling,
        // not cell phone payment (Erin: "Remove cell phone
        // replace with Snorkeling ($140 budget)"). The cell
        // phone Provide must NOT remain. Replacement is done
        // in place when a cell phone row exists (keeping the
        // count at 3), or by deleting it if Snorkeling already
        // exists. "Hair salon" up to $250 stays alongside his
        // Lululemon cover up to $120 — Koa's Provides are
        // exactly 3: Lululemon $120, Snorkeling $140, Hair
        // salon $250. Never a 4th Provide.
        assertCleanWording("Snorkeling", "Hair salon");
        let kaiProvideRows = await db.select().from(schema.provides);
        let kaiProvides = kaiProvideRows.filter(
          (pv) => pv.ownerType === "person" && pv.ownerId === kai.id,
        );
        // Step 1: remove / replace any cell phone payment Provide.
        const cellPhoneRows = kaiProvides.filter((pv) =>
          norm(pv.title).includes("cell phone"),
        );
        if (cellPhoneRows.length > 0) {
          const existingSnorkeling = kaiProvides.find((pv) =>
            norm(pv.title).includes("snorkel"),
          );
          if (existingSnorkeling) {
            for (const row of cellPhoneRows) {
              await db
                .delete(schema.provides)
                .where(eq(schema.provides.id, row.id));
              removedKaiProvides.push(row.title);
            }
          } else {
            const first = cellPhoneRows[0];
            if (first) {
              await db
                .update(schema.provides)
                .set({
                  title: "Snorkeling",
                  category: "Fitness & Outdoors",
                  maxSpendCents: 14000,
                  note: "",
                })
                .where(eq(schema.provides.id, first.id));
              replacedKaiProvides.push(
                "Cell phone payment -> Snorkeling",
              );
              for (const extra of cellPhoneRows.slice(1)) {
                await db
                  .delete(schema.provides)
                  .where(eq(schema.provides.id, extra.id));
                removedKaiProvides.push(extra.title);
              }
            }
          }
          // Re-read after the replacement so counts/titles are fresh.
          kaiProvideRows = await db.select().from(schema.provides);
          kaiProvides = kaiProvideRows.filter(
            (pv) => pv.ownerType === "person" && pv.ownerId === kai.id,
          );
        }
        const kaiProvideTitles = kaiProvides.map((pv) => norm(pv.title));
        let kaiProvideCount = kaiProvides.length;
        const kaiProvideCandidates: {
          title: string;
          category: string;
          maxSpendCents: number;
          present: boolean;
        }[] = [
          {
            title: "Snorkeling",
            category: "Fitness & Outdoors",
            maxSpendCents: 14000,
            present: kaiProvideTitles.some((t) => t.includes("snorkel")),
          },
          {
            title: "Hair salon",
            category: "Beauty & Grooming",
            maxSpendCents: 25000,
            present: kaiProvideTitles.some((t) => t.includes("hair")),
          },
        ];
        for (const c of kaiProvideCandidates) {
          if (c.present || kaiProvideCount >= 3) continue;
          await db.insert(schema.provides).values({
            ownerType: "person",
            ownerId: kai.id,
            category: c.category,
            title: c.title,
            maxSpendCents: c.maxSpendCents,
            note: "",
          });
          addedKaiProvides.push(c.title);
          kaiProvideCount += 1;
        }
      }
      // Leilani's directed Provides: "Massage" alongside her
      // existing Nursing help (Provides 1 → 2), and "Guitar
      // jam session" (Erin, 2026-11-03: "Leilani can provide
      // guitar jam sesh") as her 3rd Provide — her Provides
      // reach exactly 3: Nursing help, Massage, Guitar jam
      // session. Same additive rule for both: only when
      // missing and under the flat 3 cap; never a 4th Provide.
      // Her Wants are handled below.
      const leilani = peopleRows.find((p) => isShowcaseMember(p, "Leilani"));
      if (leilani) {
        assertCleanWording("Massage", "Guitar jam session");
        const leilaniProvideRows = await db.select().from(schema.provides);
        const leilaniProvides = leilaniProvideRows.filter(
          (pv) => pv.ownerType === "person" && pv.ownerId === leilani.id,
        );
        const leilaniHasMassage = leilaniProvides.some((pv) =>
          norm(pv.title).includes("massage"),
        );
        let leilaniProvideCount = leilaniProvides.length;
        if (!leilaniHasMassage && leilaniProvideCount < 3) {
          await db.insert(schema.provides).values({
            ownerType: "person",
            ownerId: leilani.id,
            category: "Health & Wellness",
            title: "Massage",
            maxSpendCents: null,
            note: "",
          });
          addedLeilaniProvides.push("Massage");
          leilaniProvideCount += 1;
        }
        const leilaniHasGuitarJam = leilaniProvides.some((pv) => {
          const t = norm(pv.title);
          return t.includes("guitar") && t.includes("jam");
        });
        if (!leilaniHasGuitarJam && leilaniProvideCount < 3) {
          await db.insert(schema.provides).values({
            ownerType: "person",
            ownerId: leilani.id,
            category: "Other",
            title: "Guitar jam session",
            maxSpendCents: null,
            note: "",
          });
          addedLeilaniProvides.push("Guitar jam session");
          leilaniProvideCount += 1;
        }
        // Leilani's directed Wants (Erin): "Victoria's
        // Secret shopping" up to $100, "Snorkeling", and
        // "Go to a Rave" — her Wants reach exactly 3. Same
        // additive rule: each added only when missing and
        // under the flat 3 cap; never a 4th Want. A rave is
        // a night-club / music event (21+ gate): Leilani is
        // 22, so 21+ spots are allowed for her — no gate
        // change is needed or made.
        assertCleanWording(
          "Victoria's Secret shopping",
          "Snorkeling",
          "Go to a Rave",
        );
        const leilaniGiftRows = await db.select().from(schema.listItems);
        const leilaniWants = leilaniGiftRows.filter(
          (i) => i.kind === "gift" && i.personId === leilani.id,
        );
        const leilaniWantTexts = leilaniWants.map((i) => norm(i.text));
        let leilaniWantCount = leilaniWants.length;
        const leilaniWantCandidates: {
          text: string;
          priceNote: string;
          present: boolean;
        }[] = [
          {
            text: "Victoria's Secret shopping",
            priceNote: "up to $100",
            present: leilaniWantTexts.some((t) => t.includes("victoria")),
          },
          {
            text: "Snorkeling",
            priceNote: "",
            present: leilaniWantTexts.some((t) => t.includes("snorkel")),
          },
          {
            text: "Go to a Rave",
            priceNote: "",
            present: leilaniWantTexts.some((t) => t.includes("rave")),
          },
        ];
        for (const c of leilaniWantCandidates) {
          if (c.present || leilaniWantCount >= 3) continue;
          await db.insert(schema.listItems).values({
            kind: "gift",
            text: c.text,
            category: "",
            personId: leilani.id,
            personName: "Showcase Leilani",
            occasion: "",
            priceNote: c.priceNote,
            link: "",
            giftStatus: "idea",
          });
          addedLeilaniWants.push(c.text);
          leilaniWantCount += 1;
        }
      }
      // 3-each audit, re-read after the update: Erin's Wants are
      // her scored List (must + nice kinds, flat); a member's
      // Wants are their wishlist entries on the List; Provides
      // are counted per owner. Missing = how far under 3 a side
      // sits (0 when the side is at or over 3 — nothing is ever
      // removed for being over).
      const finalItems = await db.select().from(schema.listItems);
      const finalProvides = await db.select().from(schema.provides);
      const finalPeople = await db.select().from(schema.people);
      const sideFor = (name: string, wants: number, provides: number) => ({
        name,
        wants,
        provides,
        missingWants: Math.max(0, 3 - wants),
        missingProvides: Math.max(0, 3 - provides),
      });
      const memberSide = (name: string) => {
        const person = finalPeople.find((p) => isShowcaseMember(p, name));
        if (!person) return sideFor(showcaseName(name), 0, 0);
        return sideFor(
          showcaseName(name),
          finalItems.filter(
            (i) => i.kind === "gift" && i.personId === person.id,
          ).length,
          finalProvides.filter(
            (pv) => pv.ownerType === "person" && pv.ownerId === person.id,
          ).length,
        );
      };
      const sides = [
        sideFor(
          "Erin",
          finalItems.filter(
            (i) => i.kind === "must" || i.kind === "nice",
          ).length,
          finalProvides.filter((pv) => pv.ownerType === "profile").length,
        ),
        memberSide("Alex"),
        memberSide("Koa"),
        memberSide("Leilani"),
      ];
      ctx.invalidateQueries();
      return {
        ok: true as const,
        added,
        addedProvides,
        updatedProvides,
        pendingProvides,
        addedKaiWants,
        addedKaiProvides,
        replacedKaiProvides,
        removedKaiProvides,
        addedLeilaniProvides,
        addedLeilaniWants,
        alexFound: !!alex,
        sides,
      };
    },
  }),

  fixShowcaseDesires: defineAction({
    description: "Fix the Showcase members' desires (gift entries — never Wants/Needs, never scored) to Erin's 2026-11-04 direction: Alex's desires become exactly 'Play guitar under the moonlight' (Entertainment) and 'Chess Party' (Entertainment) — his 'Surfing lesson — learn to surf', 'Yoga' and combined 'Play guitar or chess' desire rows are removed; Koa's desires become exactly 'Car detail' (kept as-is, category set to Car & Mechanical) and 'Trip to Maui (4 days) with tandem jet ski ride' (Travel & Trips, added) — his 'Massage' and 'Pool partner to swim' desire rows are removed. Idempotent; touches nothing else — no Wants, Provides, bios, dates, plans, photos, Leilani's desires, Erin's own List/Desires/Provides or the saved Meta AI key — and returns each Showcase member's desires after the fix.",
    request: z.object({}),
    response: fixShowcaseDesiresResponse,
    handler: async (ctx): Promise<FixShowcaseDesiresResult> => {
      requireOwner(ctx);
      const db = ctx.db<typeof schema>();
      assertCleanWording(
        "Play guitar under the moonlight",
        "Chess Party",
        "Car detail",
        "Trip to Maui (4 days) with tandem jet ski ride",
      );
      const peopleRows = await db.select().from(schema.people);
      const alex =
        peopleRows.find((p) => isShowcaseMember(p, "Alex")) ??
        peopleRows.find((p) => p.name === "Zach");
      const koa =
        peopleRows.find((p) => isShowcaseMember(p, "Koa")) ??
        peopleRows.find((p) => p.name === "Kalani") ??
        peopleRows.find((p) => p.name === "Kai");
      let removedAlex: string[] = [];
      let addedAlex: string[] = [];
      let removedKoa: string[] = [];
      let addedKoa: string[] = [];
      if (alex) {
        const r = await reconcilePersonDesires(ctx, alex, ALEX_DESIRES);
        removedAlex = r.removed;
        addedAlex = r.added;
      }
      if (koa) {
        const r = await reconcilePersonDesires(ctx, koa, KOA_DESIRES);
        removedKoa = r.removed;
        addedKoa = r.added;
      }
      const finalItems = await db.select().from(schema.listItems);
      const desires = ["Alex", "Koa", "Leilani"].map((bare) => {
        const person =
          peopleRows.find((p) => isShowcaseMember(p, bare)) ??
          (bare === "Alex"
            ? peopleRows.find((p) => p.name === "Zach")
            : bare === "Koa"
              ? peopleRows.find(
                  (p) => p.name === "Kalani" || p.name === "Kai",
                )
              : undefined);
        return {
          name: showcaseName(bare),
          desires: person
            ? finalItems
                .filter(
                  (i) => i.kind === "gift" && i.personId === person.id,
                )
                .map((i) => i.text)
            : [],
        };
      });
      ctx.invalidateQueries();
      return {
        ok: true as const,
        alexFound: !!alex,
        koaFound: !!koa,
        removedAlex,
        addedAlex,
        removedKoa,
        addedKoa,
        desires,
      };
    },
  }),

  fillShowcaseMemberWants: defineAction({
    description: "Fill each Showcase member's Wants back in with their known Wants (Erin, 2026-11-04) as their own scored List rows, so Open Profile's 'What they want' is not empty: Showcase Alex — Learn to surf, Yoga, Play guitar or chess; Showcase Koa — Car detail, Massage, Pool partner; Showcase Leilani — Victoria's Secret shopping (up to $100), Snorkeling, Go to a Rave. Wants are a separate store from Desires: no gift (Desire) row is read, added, changed or removed, Desires never count toward a match %, and nothing else is touched — no Provides, bios, dates, plans, photos, Erin's own List/Desires/Provides or the saved Meta AI key. Additive and idempotent: only missing Wants are inserted, never past the flat 3-per-member cap, and nothing is ever deleted.",
    request: z.object({}),
    response: fillShowcaseMemberWantsResponse,
    handler: async (ctx): Promise<FillShowcaseMemberWantsResult> => {
      requireOwner(ctx);
      const result = await fillShowcaseMemberWants(ctx);
      ctx.invalidateQueries();
      return result;
    },
  }),

  applyDirectedDealbreakers: defineAction({
    description: "Set the dealbreakers Erin directed on 2026-11-04, in her exact words: Showcase Alex — 'long distance relationships' (superseding his briefly-directed 'off Island relationships', 'horror movies and metal fans', 'Drama Queens' and 'eating with your mouth open', any of them renamed in place if present); Showcase Koa — 'Sexually transmitted diseases' (his only); Showcase Leilani — 'non-vegetarian' (superseding her briefly-directed 'Kids', which is renamed in place if present, and the earlier homebody wording, which is never written); and Erin's own dealbreaker changed from 'Cats' to 'being ungroomed' (her Cats row renamed in place, same row id). Member dealbreakers are their own background List rows — never scored, never part of Erin's List — and show in their Open Profile 'Dealbreakers · background' section instead of 'None set.'. Idempotent: once every row reads as directed it writes nothing. No Wants, Provides, Desires, bios, photos, matches, dates, chats or the saved Meta AI key are touched.",
    request: z.object({}),
    response: applyDirectedDealbreakersResponse,
    handler: async (ctx): Promise<ApplyDirectedDealbreakersResult> => {
      requireOwner(ctx);
      const result = await applyDirectedDealbreakers(ctx);
      ctx.invalidateQueries();
      return result;
    },
  }),

  applyAlexBioUpdate: defineAction({
    description: "Reconcile Showcase Alex's About biography to Erin's directed wording: 'Showcase Alex, 42, Waikiki. Plays guitar and is a computer consultant, looking for pickleball fun jams, and wants to learn to surf.' (the surf lesson note and its dash were removed at Erin's direction on 2026-11-04 — the bio ends at 'learn to surf.'). Only his bio text changes; when it changes, his match-note / date-plan signatures are refreshed in the same pass so his stored writing survives word for word. His age, location, Wants, Provides, Desires, photos, match %, Deal status and dates are untouched, nobody else changes, Erin's own profile / List / Provides and her saved Meta AI key are never touched, and no notes or plans are generated. Idempotent: once his bio reads as directed it writes nothing.",
    request: z.object({}),
    response: applyAlexBioUpdateResponse,
    handler: async (ctx): Promise<ApplyAlexBioUpdateResult> => {
      requireOwner(ctx);
      const result = await applyAlexBioUpdate(ctx);
      ctx.invalidateQueries();
      return result;
    },
  }),

  applyKoaProfileUpdate: defineAction({
    description: "Reconcile Showcase Koa's profile to Erin's directed wording: his bio reads 'Showcase Koa, 57, Pipeline, North Shore. Inventor, coconut tree climber, and he can sponsor shopping…' — he is an inventor (not a trust-fund baby), coconut tree climber right after that, no trailing climber sentence, no 'trimmer' — his location is 'Pipeline, North Shore' and his usual spot is 'Pipeline', with Papailoa removed from his profile and rewritten to Pipeline, and 'trust-fund baby' rewritten to 'inventor', inside his own match note, date plans and comparisons. When anything changes, his note / plan signatures are refreshed in the same pass so his stored writing survives word for word; his Wants, Provides, Desires, photos, Deal status and scores are untouched, nobody else's row changes, Erin's own profile / List / Provides and her saved Meta AI key are never touched, and no notes or plans are generated. Idempotent: once his profile reads as directed it writes nothing.",
    request: z.object({}),
    response: applyKoaProfileUpdateResponse,
    handler: async (ctx): Promise<ApplyKoaProfileUpdateResult> => {
      requireOwner(ctx);
      const result = await applyKoaProfileUpdate(ctx);
      ctx.invalidateQueries();
      return result;
    },
  }),

  // Alias for the previous build's post-submit action name:
  // runs the same Koa profile reconciliation pass above.
  applyKoaCoconutBio: defineAction({
    description: "Reconcile Showcase Koa's profile to Erin's directed wording — inventor with coconut tree climber right after it in his bio, location 'Pipeline, North Shore', usual spot 'Pipeline', Papailoa removed — exactly the applyKoaProfileUpdate pass under its earlier name. Idempotent; his Wants, Provides, Desires, photos, Deal status, scores, Erin's own profile / List / Provides and her saved Meta AI key are untouched, and no notes or plans are generated.",
    request: z.object({}),
    response: applyKoaProfileUpdateResponse,
    handler: async (ctx): Promise<ApplyKoaProfileUpdateResult> => {
      requireOwner(ctx);
      const result = await applyKoaProfileUpdate(ctx);
      ctx.invalidateQueries();
      return result;
    },
  }),
} satisfies ActionsModule;
