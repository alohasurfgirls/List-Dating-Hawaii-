import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "./api";
import { fileToBase64 } from "@hatch/space-sdk/client";
import { OahuHypeMap, spotCoords, findSpotInText } from "./OahuHypeMap";
import actualAlaMoanaCenter from "./assets/actual-ala-moana-center.jpg";
import actualLululemonHonolulu from "./assets/actual-lululemon-honolulu.jpg";
import actualSephoraInterior from "./assets/actual-sephora-interior.jpg";
import actualLululemonWaikiki from "./assets/actual-lululemon-waikiki.jpg";
import actualSephoraWaikiki from "./assets/actual-sephora-waikiki.jpg";
import actualHaleiwaBeachPark from "./assets/actual-haleiwa-beach-park.jpg";
import actualHaleiwaBeachParkGrass from "./assets/actual-haleiwa-beach-park-grass.jpg";

// Actual photographs for date plans (2026-11-03, Erin): real
// photographs of the real places, bundled with the app — the
// server picks the keys per date from its checked registry
// (actual-photo-first; a generated image is only the fallback
// for a spot with no actual photo). Each entry carries the
// caption the UI shows under the photo, naming the real place.
// Sources for every photograph are recorded in DATA-PLAN.md.
const ACTUAL_PLAN_PHOTOS: Record<string, { src: string; caption: string }> = {
  "ala-moana-center": {
    src: actualAlaMoanaCenter,
    caption: "Ala Moana Center — 1450 Ala Moana Blvd, Honolulu",
  },
  "lululemon-honolulu": {
    src: actualLululemonHonolulu,
    caption: "Lululemon storefront — Honolulu",
  },
  "sephora-interior": {
    src: actualSephoraInterior,
    caption: "Inside Sephora — Honolulu",
  },
  "lululemon-waikiki": {
    src: actualLululemonWaikiki,
    caption: "Lululemon — 2270 Kalakaua Ave, Waikiki, Honolulu",
  },
  "sephora-waikiki": {
    src: actualSephoraWaikiki,
    caption: "Sephora — 2250 Kalakaua Ave, Waikiki, Honolulu",
  },
  "haleiwa-beach-park": {
    src: actualHaleiwaBeachPark,
    caption:
      "Haleiwa Beach Park — 62-449 Kamehameha Hwy, Haleiwa, HI 96712",
  },
  "haleiwa-beach-park-grass": {
    src: actualHaleiwaBeachParkGrass,
    caption:
      "Haleiwa Beach Park — grassy park area, 62-449 Kamehameha Hwy, Haleiwa",
  },
};

// Haleiwa Beach Park (2026-11-03, Erin): the real City and
// County of Honolulu park near Haleiwa town whose grassy park
// area is the spot for Leilani's Yoga in the Park date — shown
// as an info box on a date plan that names the park, under its
// actual photos, the way the Ala Moana mall directory is shown
// for Koa's date. Address exactly as Erin gave it.
const HALEIWA_BEACH_PARK_INFO = {
  name: "Haleiwa Beach Park",
  operator: "City and County of Honolulu",
  address: "62-449 Kamehameha Hwy, Haleiwa, HI 96712",
  note: "Grassy park area — Yoga in the Park, Saturday morning, near Haleiwa town",
};

// Mall directory for Lululemon at Ala Moana Center (2026-11-03,
// Erin): where the store sits INSIDE the mall — Level 2, near
// the Ewa Wing, between Uniqlo and Coach — with the mall address
// and the store phone, exactly as Erin gave them. Shown as a
// directory box on a date plan that names Lululemon at Ala
// Moana Center (Koa's date), under the actual photos. This is
// directory text, not a caption on any photograph: the bundled
// Lululemon storefront photo stays captioned "Honolulu" and is
// never presented as the Ala Moana store itself.
const ALA_MOANA_LULULEMON_DIRECTORY = {
  where: "Level 2, near Ewa Wing, between Uniqlo and Coach",
  address: "Ala Moana Center, 1450 Ala Moana Blvd, Honolulu",
  phone: "(808) 818-8817",
};

type State = ApiResponse<typeof api, "getState">;
type Person = State["people"][number];
type ListItem = State["listItems"][number];
type Gift = State["gifts"][number];
type PromoCode = State["promoCodes"][number];
type DateIdea = State["dates"][number];
type SafetyCheckin = State["safetyCheckins"][number];
type DateStatus = DateIdea["status"];
type DateDirection = DateIdea["direction"];
type Profile = State["profile"];
type ContactPref = Profile["contactPref"];
type ListKind = ListItem["kind"];
type ScoredKind = Exclude<ListKind, "gift">;
type GiftStatus = Gift["status"];

const SPOT_GROUPS: { label: string; spots: string[] }[] = [
  {
    label: "North Shore & Beaches",
    spots: [
      "Sunset Beach",
      "Pipeline",
      "Waimea Bay",
      "Haleiwa",
      "Haleiwa Beach Park",
      "Turtle Bay",
      "Turtle Bay Lobby",
      "Puaena Point",
      "Ehukai Beach Park",
      "Sharks Cove",
      "Waikiki",
      "Kailua Beach",
      "Lanikai Beach",
      "Ala Moana Beach Park",
      "Sandy Beach",
      "Makapu'u",
    ],
  },
  {
    label: "Malls & Shopping — O'ahu",
    spots: [
      "Ala Moana Center",
      "Windward Mall",
      "Pearlridge Center",
      "Ka Makana Ali'i — Kapolei",
      "Kahala Mall",
      "International Market Place — Waikiki",
      "Royal Hawaiian Center",
      "Kalakaua Avenue — Waikiki",
      "The Mall",
    ],
  },
  {
    label: "Movie Theaters — O'ahu",
    spots: [
      "Consolidated Theatres — Ward 16",
      "Consolidated Theatres — Kahala 8",
      "Consolidated Theatres — Kapolei 16",
      "Consolidated Theatres — Mililani 14",
      "Regal Dole Cannery — Honolulu",
      "Regal Windward — Kaneohe",
      "Regal Pearl Highlands — Pearl City",
    ],
  },
  {
    label: "Art, Museums & Culture — O'ahu",
    spots: [
      "Honolulu Museum of Art",
      "Bishop Museum",
      "Shangri La Museum",
      "Hawaii State Art Museum — Capitol Modern",
      "Honolulu Museum of Art — Spalding House",
      "Iolani Palace",
      "Queen Emma Summer Palace",
      "Waikiki Aquarium",
    ],
  },
  {
    label: "Honolulu, Waikiki & Town",
    spots: [
      "Honolulu Zoo",
      "Kapiolani Park",
      "Diamond Head",
      "Chinatown — Honolulu",
      "Kaka'ako",
      "Somewhere else on Oahu",
    ],
  },
  {
    label: "Outdoors, Wellness & Adventure",
    spots: [
      "Hiking Trails",
      "Diamond Head Trail",
      "Manoa Falls",
      "Tantalus Lookout",
      "Yoga in the Park",
      "Sunrise Walk & Talk",
    ],
  },
  {
    label: "Other Islands — Meet Me There",
    spots: [
      "Maui — Wailea",
      "Maui — Lahaina & Ka'anapali",
      "Maui — Paia & Upcountry",
      "Big Island — Kona",
      "Big Island — Hilo",
      "Big Island — Waikoloa",
      "Kauai — Hanalei & Princeville",
      "Kauai — Poipu",
      "Kauai — Lihue",
      "Lanai",
      "Molokai",
    ],
  },
  {
    // Generic only (2026-11-03, Erin): the nightclub option is
    // never a specific venue upfront — Matches and Provides see
    // only these generic spots. A specific nightclub venue is
    // revealed only inside a date plan, when Plan the Date runs
    // through Meta AI. Strip clubs are not in the app at all:
    // no strip-club group, no strip-club spot, ever.
    label: "Nightlife — Nightclubs & Dance Clubs",
    spots: [
      "A Nightclub in Honolulu",
      "A Dance Club in Waikiki",
      "Late-Night Lounge — Waikiki",
    ],
  },
  {
    label: "Ocean Adventures — Jet Skis, Sailing & Shark Dives",
    spots: [
      "Jet Skiing — Keehi Lagoon, Honolulu",
      "Jet Skiing — Ala Moana & Waikiki Waters",
      "Jet Skiing — Kaneohe Bay",
      "Jet Skiing — Maunalua Bay, Hawaii Kai",
      "Sailing — Waikiki Sunset Sail (Kewalo Basin Harbor)",
      "Sailing — Ala Wai Harbor, Waikiki",
      "Sailing — Day Sail off Waikiki & Diamond Head",
      "Sailing — Ko Olina Marina, Kapolei",
      "Sailing — Haleiwa Harbor, North Shore",
      "Shark Dive — Haleiwa Harbor, North Shore (Cage Dive)",
      "Shark Dive — Haleiwa, North Shore (Cageless Dive)",
      "Shark Dive — Pelagic Dive off O'ahu",
    ],
  },
  {
    label: "Sky Adventures — Skydiving & Parasailing",
    spots: [
      "Skydiving — Kawaihapai / Dillingham Airfield, Waialua",
      "Skydiving — North Shore, O'ahu",
      "Parasailing — Waikiki (Kewalo Basin Departure)",
      "Parasailing — Ala Moana & Waikiki Waters",
      "Parasailing — Maunalua Bay, Hawaii Kai",
    ],
  },
  {
    label: "Horseback Riding & Ranch — O'ahu",
    spots: [
      "Horseback Riding — Turtle Bay Trails, North Shore",
      "Horseback Riding — Kualoa Ranch, Kaneohe",
      "Horseback Riding — Waialua & North Shore Trails",
      "Horseback Riding — Waimanalo, East O'ahu",
      "Horseback Riding — Sunset Ride, North Shore",
    ],
  },
  {
    label: "Surf Contests & Snorkeling — O'ahu",
    spots: [
      "Surf Contest — Banzai Pipeline, Ehukai Beach Park",
      "Surf Contest — Sunset Beach, North Shore",
      "Surf Contest — Haleiwa Alii Beach Park",
      "Surf Contest — Waimea Bay (The Eddie)",
      "Surf Contest — Ala Moana Bowls, Honolulu",
      "Surf Contest — Queens & Canoes, Waikiki",
      "Snorkeling — Hanauma Bay, Hawaii Kai",
      "Snorkeling — Shark's Cove, North Shore",
      "Snorkeling — Waikiki Turtle Canyon",
      "Snorkeling — Kahe Point / Electric Beach, Kapolei",
      "Snorkeling — Sans Souci / Queen's Beach, Waikiki",
      "Snorkeling — Kaneohe Bay Sandbar",
    ],
  },
  {
    label: "Nightlife — Speakeasies & Hidden Bars",
    spots: [
      "Speakeasy — Chinatown, Honolulu",
      "Speakeasy — Downtown Honolulu (Hidden Entrance)",
      "Speakeasy — Waikiki (Secret Bar)",
      "Hidden Cocktail Bar — Kaka'ako, Honolulu",
      "Speakeasy Night — Honolulu (Ask for the Password)",
    ],
  },
  {
    label: "Bowling & Games — O'ahu",
    spots: [
      "Bowling — Aiea Bowl, Aiea",
      "Bowling — Lucky Strike Honolulu, Ala Moana",
      "Bowling — Honolulu (League Night)",
      "Bowling — Pearl City & Leeward O'ahu",
      "Bowling Night — Waikiki / Ala Moana Area",
    ],
  },
  {
    label: "Music — Karaoke, Guitars, Live Music & Open Mic",
    spots: [
      "Karaoke — Private Room, Waikiki",
      "Karaoke — Ala Moana / Honolulu Karaoke Room",
      "Karaoke Night — Chinatown, Honolulu",
      "Live Music — Blue Note Hawaii, Waikiki",
      "Live Music — Hawaiian Brian's, Honolulu",
      "Live Music — The Republik, Honolulu",
      "Guitars — Beach Jam at Ala Moana Beach Park",
      "Guitars — Kapiolani Park, Waikiki",
      "Guitars — Sunset Jam, North Shore",
      "Open Mic Night — Anna O'Brien's, Moiliili",
      "Open Mic Night — Hawaiian Brian's, Honolulu",
      "Open Mic Night — Honolulu (Singer-Songwriter Night)",
    ],
  },
  {
    label: "Running, Walking & Training — O'ahu",
    spots: [
      "Running — Ala Moana Beach Park Loop, Honolulu",
      "Running — Kapiolani Park Loop, Waikiki",
      "Running — Diamond Head Loop, Honolulu",
      "Running — Waikiki Beach Path, Waikiki",
      "Running — North Shore Path, Haleiwa to Waialua",
      "Running — Kailua Beach Path, Kailua",
      "Running — Sunrise Run, North Shore",
      "Walking — Ala Moana Beach Park, Honolulu",
      "Walking — Kapiolani Park — Sunset Walk, Waikiki",
      "Walking — Waikiki Beach Walk, Waikiki",
      "Walking — Makapu'u Lighthouse Trail, East O'ahu",
      "Walking — Manoa Falls Trail Walk, Manoa",
      "Walking — North Shore Stroll, Haleiwa",
      "Walking — Beach Walk & Talk, Ala Moana",
      "Training — Outdoor Workout at Ala Moana Beach Park",
      "Training — Outdoor Workout at Kapiolani Park, Waikiki",
      "Training — Beach Training, North Shore",
      "Training — Sunrise Training, Diamond Head Area",
      "Training — Gym Session, Honolulu",
      "Training — Gym Session, Waikiki / Ala Moana Area",
      "Training — Gym Session, North Shore / Haleiwa Area",
    ],
  },
  {
    label: "Pole Dancing — Studios & Nights (Adults Only)",
    spots: [
      "Pole Dancing — Studio Class, Honolulu",
      "Pole Dancing — Studio Class, Waikiki / Ala Moana Area",
      "Pole Dancing — Pole Fitness Class, Honolulu",
      "Pole Dancing — Private Lesson, Honolulu",
      "Pole Dancing — Beginners Class, Honolulu",
      "Pole Dancing Night — Studio Showcase, Honolulu",
    ],
  },
];

// ---------- 21+ gate for bars, exotic places & alcohol venues ----------
//
// Age rule (2026-11-02, Erin): List Dating membership is 18 to
// 99 — Join, Add someone and Edit member all keep ages inside
// that range. But bars, exotic
// places and alcohol venues are 21+: a spot from one of the 21+
// collections below (nightclubs & dance clubs, speakeasies &
// hidden bars, pole dancing) may only be shown, suggested or
// used as a DATE spot when BOTH people on that date are 21 or
// older. If either person is under 21 — or their age is not on
// record (unknown counts as not 21 for these spots, an age is
// never guessed) — those spots stay hidden for that date, the
// planner says so plainly, and a non-bar spot is offered instead.
// The server enforces the same rule in proposeDate, and date-plan
// writing never suggests a 21+ spot for a pair that is not both
// 21+.
// Removed clubs + strip clubs (2026-11-03, Erin): six clubs were
// removed from the app completely — they are not in the spot list
// above, not in the flagged sets below, not suggested, and never
// named in a date plan (the server rejects them outright and
// fails any plan that names one). Strip clubs are not part of
// the nightclub experience at all — no strip-club group, spot or
// plan mention exists here. The nightclub spots above are
// GENERIC only: a specific nightclub venue never shows upfront
// (Matches, Provides, a member's usual spot); it is revealed
// only inside a date plan when Plan the Date runs through
// Meta AI — see publicSpotLabel below.
const SPOT_21PLUS_GROUP_LABELS = new Set([
  "Nightlife — Nightclubs & Dance Clubs",
  "Nightlife — Speakeasies & Hidden Bars",
  "Pole Dancing — Studios & Nights (Adults Only)",
]);

const AGE_21_MESSAGE = "21+ only for bars and exotic places";
const NON_BAR_ALTERNATIVE_SPOT = "Ala Moana Beach Park";
const NON_BAR_ALTERNATIVE_SPOTS = [
  "Ala Moana Beach Park",
  "Kapiolani Park",
  "Honolulu Museum of Art",
  "Ala Moana Center",
];

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

// Specific nightclub venues never show upfront: anywhere the app
// displays a person's spot (Matches, their card, their usual
// spot), one of these reads as the generic nightclub option. A
// specific venue is revealed only inside a date plan, when Plan
// the Date runs through Meta AI (server-side).
const SPECIFIC_NIGHTCLUB_SPOTS = new Set([
  "The District Nightclub — Honolulu",
  "SKY Waikiki",
  "Scarlet Honolulu — Dance Club",
  "Hula's Bar & Lei Stand — Waikiki",
  "NextDoor — Chinatown",
]);

function publicSpotLabel(spot: string): string {
  const s = spot.trim();
  return SPECIFIC_NIGHTCLUB_SPOTS.has(s) ? "A Nightclub in Honolulu" : s;
}

function is21PlusSpot(spot: string): boolean {
  const s = spot.trim();
  if (!s) return false;
  if (
    SPOT_GROUPS.some(
      (g) => SPOT_21PLUS_GROUP_LABELS.has(g.label) && g.spots.includes(s),
    )
  ) {
    return true;
  }
  const low = s.toLowerCase();
  if (SPOT_21PLUS_NAME_KEYS.some((k) => low.includes(k))) return true;
  // Any other spot that names a bar is an alcohol venue too.
  if (/\bbar\b/.test(low)) return true;
  return false;
}

function bothAges21Plus(
  myAge: number | null | undefined,
  personAge: number | null | undefined,
): boolean {
  return (
    myAge !== null &&
    myAge !== undefined &&
    myAge >= 21 &&
    personAge !== null &&
    personAge !== undefined &&
    personAge >= 21
  );
}

// Why the 21+ gate is closed for this pair, in plain words — an
// age that is not on record is named as unknown, never guessed.
function age21BlockReason(
  myAge: number | null | undefined,
  personAge: number | null | undefined,
  personName: string,
): string {
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
  return reasons.join(" and ");
}

// Hype is killed until later (2026-11-02, Erin): its modes,
// paid plans ($2.99 per 30 minutes), listings, panels, map and
// payments are all out of the app for now — not a permanent
// design decision. The server keeps the schema so Hype can
// return later exactly as it was.

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Older Safety check-in Chat notes
// were written by the server with its UTC clock baked into the
// text ("until 11/3/2026, 9:56:12 AM", "until Mon 10:06 PM"),
// while the stored instants behind them are correct Hawaii
// times. This display-only pass re-reads those two baked
// patterns as the UTC they were written in and shows them in
// Hawaii time; the stored text and instants are never changed.
// New notes are written in Hawaii time with an HST label, and
// the patterns below deliberately skip any time carrying one,
// so a corrected note is never converted twice.
const BAKED_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fixBakedUtcUntil(body: string): string {
  const withDates = body.replace(
    /until (\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2}):(\d{2}) (AM|PM)(?! HST)/,
    (_m, mo, d, y, h, mi, s, ap) => {
      let hour = Number(h) % 12;
      if (ap === "PM") hour += 12;
      const utc = new Date(
        Date.UTC(Number(y), Number(mo) - 1, Number(d), hour, Number(mi), Number(s)),
      );
      return `until ${utc.toLocaleString("en-US", { timeZone: "Pacific/Honolulu" })} HST`;
    },
  );
  return withDates.replace(
    /until (Mon|Tue|Wed|Thu|Fri|Sat|Sun) (\d{1,2}):(\d{2}) (AM|PM)(?! HST)/,
    (_m, wd, h, mi, ap) => {
      let hour = Number(h) % 12;
      if (ap === "PM") hour += 12;
      let minutes = hour * 60 + Number(mi) - 10 * 60;
      let dayIdx = BAKED_WEEKDAYS.indexOf(wd);
      if (minutes < 0) {
        minutes += 24 * 60;
        dayIdx = (dayIdx + 6) % 7;
      }
      const h24 = Math.floor(minutes / 60);
      const mm = String(minutes % 60).padStart(2, "0");
      const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
      const suffix = h24 < 12 ? "AM" : "PM";
      return `until ${BAKED_WEEKDAYS[dayIdx]} ${h12}:${mm} ${suffix} HST`;
    },
  );
}

// Safety check-in lengths the user can pick (mirrors
// SAFETY_CHECKIN_DURATIONS in server/src/actions.ts). A check-in is
// tied to a confirmed date, runs quietly for the chosen length,
// then ends automatically. The date is told it is on — a notice
// lands in their Chat thread — and no live location is ever
// shared: it is a timer, not tracking.
const SAFETY_CHECKIN_OPTIONS: { minutes: number; label: string }[] = [
  { minutes: 30, label: "30 min" },
  { minutes: 60, label: "1 hour" },
  { minutes: 120, label: "2 hours" },
  { minutes: 180, label: "3 hours" },
  { minutes: 240, label: "4 hours" },
];

function safetyDurationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  const hours = minutes / 60;
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

function timeLeft(iso: string | null): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "time's up";
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

// The Provide list — what someone can cover for someone else. A
// category (a kind of help), the specific thing, and the most they
// will spend on it. Matched server-side against the other side's
// Needs: the user's List items, and a member's wishlist gifts.
const PROVIDE_CATEGORIES = [
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
];

type Provide = State["provides"][number];
type StagedProvide = {
  category: string;
  title: string;
  maxSpend: string;
  note: string;
};
// A member's Want/Need side, staged in the Join / Add forms and
// saved as wishlist entries on The List (kind "gift", tied to
// that member) right after the person is created — the mirror of
// StagedProvide, so a new member is two-sided from the start:
// what they want AND what they can provide. A Want carries the
// SAME category as a Provide (Erin's direction, 2026-11-02),
// picked from the identical dropdown, first in its editor.
type StagedWant = {
  category: string;
  title: string;
  occasion: string;
  priceNote: string;
};

const REPORT_REASONS = [
  "Fake profile",
  "Harassment",
  "Inappropriate messages",
  "Scam or spam",
  "Made me feel unsafe",
  "Other",
];

const CONTACT_LABELS: Record<ContactPref, string> = {
  everyone: "Anyone discoverable",
  matches_only: "Matches 50%+ only",
  hype_spot: "Same spot only",
  nobody: "Nobody — browsing only",
};

// No Must-haves / Nice-to-haves labels any more (2026-11-03):
// The List is flat Wants, and dealbreakers are background only,
// so there are no per-kind section headings left to label.

const STATUS_LABELS: Record<GiftStatus, string> = {
  idea: "Idea",
  planned: "Planned",
  given: "Given",
};

const DATE_STATUS_LABELS: Record<DateStatus, string> = {
  proposed: "Waiting for an answer",
  // A set date says "Deal" (Erin's direction): an accepted /
  // confirmed date is a Deal, shown with its day, time and spot
  // on the card — never just "Accepted" or "Confirmed" alone.
  accepted: "Deal",
  declined: "Passed",
};

// Small messages exist to get the meetup done, not to chat forever —
// these one-tap lines cover the whole job.
const QUICK_REPLIES = [
  "Hi! You stood out on my List ✦",
  "Shall we meet and do something from the List — something truly useful or delightful?",
  "Name the place, and let's make it happen",
  "What day works for you?",
];

const MEETUP_ACTIONS: { label: string; body: string }[] = [
  { label: "On my way", body: "On my way — see you soon ✦" },
  { label: "I'm here", body: "I'm here — come find me ✦" },
  {
    label: "Running a little late",
    body: "Running a little late — don't wait on me to start, I'll catch up!",
  },
];

// ---------- Content filter mirror (server stays authoritative) ----------
//
// List Dating is for meeting up to do something real from the List —
// not for hookups — so sexual or vulgar wording can't be saved in
// Lists, profiles, Provides or Chat. This is the SAME word list and
// matching logic as the server filter in server/src/actions.ts,
// mirrored here only so the friendly error shows immediately,
// without a round-trip; the server re-checks every save and is the
// authority. Matching is whole-token, never substring, so clean
// words like "Essex", "sextant", "cocktail" or "class" always pass.
// Texting abbreviations for hookups and sexual content (DTF, FWB,
// NSA, BJ, …) are blocked the same way — whole abbreviations only,
// including dotted ("d.t.f") and spaced ("d t f", "b j") forms;
// ambiguous everyday shorthand (fs = for sale, asl = sign
// language, dt = downtown) is deliberately not blocked. The
// sexting-abbreviation lists Erin screenshotted were sorted the
// same way: the sexual / hookup entries (IWS, CU46, 53X, GNOC,
// NIFOC, …) were added, while the innocent codes on those lists
// stay allowed — 143, 182, 459, 1337, 420, a plain standalone 8,
// and the parents-around / alert codes cd9, kpc, mos, p911, pal,
// paw, pir, pos, morf, sorg, wycm, nmu, ru/18. Digit-bearing
// abbreviations (cu46, k4y, 1174, 53x) are also matched against
// the raw, undecoded tokens, since leetspeak decoding rewrites
// digits; slash pairs (if/ib, ilf/md) are stored joined
// ("ifib", "ilfmd") so the plain word "if" never trips. One
// exception: "jo" is NOT in the abbreviation set, because "Jo"
// is an ordinary name and must save normally — only its slang
// forms block, via the case-aware containsJoSlang check below:
// every spelling that reads as "jo" except the plain name
// forms "Jo" and "jo" (all-caps "JO", mixed-case "jO",
// leetspeak "J0" / "j0", "JOO", "J/O", "J.O.", "j o"). "cum"
// is a banned standalone word, and ejaculation phrases built
// on "blow" ("blow your load", "blow a load", and the related
// load / wad / nut phrases) are banned phrases — but "come"
// is a different, ordinary word and stays allowed, and "blow"
// on its own stays allowed too ("blow dry" for hair saves).
// Drug-use blocking (2026-11-03) mirrors the server the same
// way: drug words, abbreviations and phrases (weed, THC, 420,
// cocaine, "smoke weed", …) run through the identical matching
// machinery, and the message is TYPE-SPECIFIC — drug wording
// shows DRUG_ERROR, hookup / vulgar wording shows
// WORDING_ERROR, clean wording passes untouched. Ambiguous
// everyday words stay allowed alone and block only inside drug
// phrases: "pot" (cooking pot), "coke" (the drink), "crack"
// (a cracked windshield), "joint", "acid", "spice", and
// "molly" (a person's name — MDMA blocks by its own name);
// "drug store" (a pharmacy) is scrubbed before checking.
// Hawai'i drug slang mirrors the server too: "batu" and
// "shabu" (meth) and "pakalolo" (marijuana) are drug words
// (leet map decodes "8" as "b", so "84tu" is caught); the
// Hawai'i strain names "maui wowie" / "maui waui",
// "kona gold" and "puna bud" are phrases only, so Maui, Kona
// and Puna pass on their own; "ice" is phrases only too —
// "ice cream", "ice water" and "shave ice" always pass, only
// drug contexts ("smoke ice", "buy ice", "ice pipe", …)
// block; and the dish "shabu shabu" is scrubbed, so it
// always passes while a standalone "shabu" blocks.

const WORDING_ERROR =
  "That wording isn't allowed here — List Dating is for meeting up to do something real from the List, not for hookups. Please reword it without sexual or vulgar language.";

// The drug-type counterpart: shown ONLY when drug wording (and
// no hookup / vulgar wording) is what tripped the filter.
const DRUG_ERROR =
  "That wording isn't allowed here — List Dating isn't for drug use. Please reword it without any drug references.";

const BANNED_WORDS = new Set([
  "dick", "dicks", "dickhead", "dickheads", "cock", "cocks",
  "cocksucker", "penis", "penises", "vagina", "vaginas", "vaginal",
  "pussy", "pussies", "cunt", "cunts", "clit", "clits", "clitoris",
  "scrotum", "testicle", "testicles", "ballsack", "dildo", "dildos",
  "vibrator", "vibrators", "boner", "boners", "erection",
  "erections", "semen", "fingering", "rimming", "deepthroat",
  "creampie", "cum", "cums", "cumming", "cumshot", "cumshots",
  "jizz",
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
  "fuck", "fucks", "fucked", "fucking", "fucker", "fuckers",
  "motherfucker", "motherfuckers", "shit", "shits", "shitty",
  "bitch", "bitches", "ass", "asses", "asshole", "assholes",
  "whore", "whores", "slut", "sluts", "slutty", "bastard",
  "bastards",
]);

const BANNED_ABBREVS = new Set([
  "dtf", "fwb", "nsa", "ons", "pnp", "iwsn",
  "bj", "bbbj", "cbj", "hj", "rj", "dp",
  "cim", "cob", "cof", "msog", "gfe", "pse",
  "bdsm",
  "mfm", "mmf", "ffm", "fmf",
  "xxx", "pron", "fck", "fuk",
  // From the sexting-abbreviation lists Erin screenshotted —
  // only the sexual / hookup entries; innocent codes stay allowed.
  "iws", "cu46", "53x", "gnoc", "nifoc", "ipn", "s2r", "gypo",
  "gnrn", "ruh", "tdtm", "fmh", "dum", "dusl", "fb",
  "fmltwia", "fol", "iaym", "ifib", "iit", "ilfmd", "imezru",
  "kfy", "k4y", "lmirl", "moos", "q2c", "1174",
]);

const BANNED_PHRASES = [
  "oral sex", "anal sex", "group sex", "casual sex", "phone sex",
  "sex toy", "sex toys", "sex chat", "sex tape", "sex tapes",
  "blow job", "blow jobs", "hand job", "hand jobs",
  // Ejaculation phrases built on "blow" / "shoot" / "bust" —
  // "blow" itself is NOT a banned word; it only blocks inside
  // these phrases.
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

// Drug-use words / abbreviations / phrases — mirror of the
// server sets in actions.ts. Whole tokens only; ambiguous
// everyday neighbours (pot, coke, crack, joint, acid, spice,
// molly) block only inside DRUG_PHRASES.
const DRUG_WORDS = new Set([
  "drug", "drugs", "narcotic", "narcotics", "dope",
  "weed", "marijuana", "cannabis", "ganja", "hashish", "kush",
  "reefer", "maryjane", "bong", "bongs", "blunt", "blunts",
  "spliff", "spliffs", "doobie", "doobies", "edibles",
  "stoner", "stoners", "stoned", "hotbox", "hotboxing",
  "shroom", "shrooms",
  // Hawai'i cannabis slang (mirror of the server set).
  "pakalolo", "mauiwowie",
  "cocaine", "heroin", "morphine", "fentanyl", "opium",
  "oxycodone", "oxycontin", "hydrocodone", "codeine",
  "tramadol", "percocet", "vicodin", "xanax", "valium",
  "klonopin", "adderall", "ritalin", "methadone",
  "meth", "methamphetamine", "amphetamine", "amphetamines",
  "ecstasy", "ketamine", "mescaline", "peyote", "ayahuasca",
  "psilocybin",
  // Hawai'i meth slang (mirror of the server set): batu is
  // the local name for crystal meth; shabu is meth slang —
  // the dish "shabu shabu" is scrubbed and always passes.
  "batu", "shabu",
]);

const DRUG_ABBREVS = new Set([
  "thc", "cbd", "mdma", "lsd", "pcp", "ghb", "dmt", "xtc",
  "k2", "oxy", "420",
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
  // Hawai'i cannabis strain names — phrases only (mirror).
  "maui wowie", "maui waui", "kona gold", "puna bud",
  // "ice" in drug context only (mirror) — the word on its
  // own ("ice cream", "ice water", "shave ice") always passes.
  "smoke ice", "smoking ice", "buy ice", "sell ice",
  "selling ice", "ice pipe", "ice dealer",
];

const WORDING_LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  // "8" decodes as "b" (mirror of the server), so leetspeak
  // "84tu" / "847u" for "batu" is caught. No clean token or
  // innocent code decodes to a banned word through this.
  "8": "b",
  "@": "a",
  $: "s",
};

function squeezeWording(w: string): string {
  return w.replace(/(.)\1+/g, "$1");
}

const BANNED_SQUEEZED = new Set([...BANNED_WORDS].map(squeezeWording));

// Kept out of the squeeze so clean tokens survive: "moos" would
// block "moss", "fol" would block "fool", "iit" squeezes to the
// generic "it", and "1174" would block innocent numbers like
// 1774. Their plain / dotted / spaced / raw forms still catch.
const ABBREVS_NO_SQUEEZE = new Set(["moos", "fol", "iit", "1174"]);

const BANNED_ABBREVS_SQUEEZED = new Set(
  [...BANNED_ABBREVS]
    .filter((w) => !ABBREVS_NO_SQUEEZE.has(w))
    .map(squeezeWording),
);

const DRUG_SQUEEZED = new Set([...DRUG_WORDS].map(squeezeWording));

const DRUG_ABBREVS_SQUEEZED = new Set(
  [...DRUG_ABBREVS].map(squeezeWording),
);

function wordingTokens(text: string): string[] {
  const decoded = text
    .toLowerCase()
    .split("")
    .map((c) => WORDING_LEET[c] ?? c)
    .join("");
  return decoded.split(/[^a-z0-9]+/).filter(Boolean);
}

// Tokenisation without the leetspeak decode — digit-bearing
// abbreviations (cu46, k4y, 1174, 53x) only exist in raw form.
function rawWordingTokens(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

// The one case-aware filter entry: "jo" (jerk off, also typed
// j/o). "Jo" is an ordinary person's name, so the plain name
// forms — "Jo", and a lowercase "jo" in running text — always
// pass. Every other bare spelling that reads as "jo" blocks:
// all-caps "JO" and mixed-case "jO", leetspeak in any case
// ("J0", "j0") and repeated-letter spellings ("JOO"),
// separated spellings in any case ("J/O", "J.O.", "j-o", "j_o" —
// a separator inside the word, never how the name is written,
// so trailing punctuation like "Jo, …" never trips this), and
// spaced-out letters ("j o"). Mirrors the server check.
function containsJoSlang(raw: string): boolean {
  for (const w of raw.split(/[^A-Za-z0-9]+/).filter(Boolean)) {
    if (w === "Jo" || w === "jo") continue;
    const decoded = w
      .toLowerCase()
      .split("")
      .map((c) => WORDING_LEET[c] ?? c)
      .join("");
    if (decoded === "jo" || squeezeWording(decoded) === "jo") return true;
  }
  for (const chunk of raw.split(/\s+/)) {
    if (!chunk) continue;
    const core = chunk
      .replace(/^[^A-Za-z0-9]+/, "")
      .replace(/[^A-Za-z0-9]+$/, "");
    if (!/[^A-Za-z0-9]/.test(core)) continue;
    const stripped = wordingTokens(core).join("");
    if (stripped === "jo" || squeezeWording(stripped) === "jo") return true;
    const rawStripped = core.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (rawStripped === "jo" || squeezeWording(rawStripped) === "jo") {
      return true;
    }
  }
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

// Allowlisted phrases scrubbed before any check runs — mirror
// of the server scrub (a shop, a pharmacy and a hot-pot dish,
// not violations).
function scrubWording(raw: string): string {
  return raw
    .replace(/dick'?s\s+sporting\s+goods/gi, " sporting goods ")
    .replace(/\bdrug\s+stores?\b/gi, " pharmacy ")
    .replace(/\bshabu[-\s]+shabu\b/gi, " hot pot ");
}

// The shared matching machinery, run once per wording type with
// that type's sets — mirror of matchesWordingSets on the server.
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
  for (const t of tokens) {
    if (words.has(t)) return true;
    if (abbrevs.has(t)) return true;
    const sq = squeezeWording(t);
    if (sq !== t && wordsSqueezed.has(sq)) return true;
    if (sq !== t && abbrevsSqueezed.has(sq)) return true;
  }
  // Raw (undecoded) whole-token check for digit abbreviations
  // ("cu46", "420").
  const rawTokens = rawWordingTokens(scrubbed);
  for (const t of rawTokens) {
    if (abbrevs.has(t)) return true;
  }
  const padded = ` ${tokens.join(" ")} `;
  // Same phrase check over the repeated-letter-squeezed token
  // stream, mirroring the server, so "bloww your loaad" cannot
  // slip a phrase past by stretching its letters.
  const squeezedPadded = ` ${tokens.map((t) => squeezeWording(t)).join(" ")} `;
  for (const p of phrases) {
    if (padded.includes(` ${p} `)) return true;
    if (squeezedPadded.includes(` ${p} `)) return true;
  }
  for (const rawToken of scrubbed.split(/\s+/)) {
    if (!rawToken || !/[^a-zA-Z0-9]/.test(rawToken)) continue;
    const stripped = wordingTokens(rawToken).join("");
    if (stripped.length >= 3 && words.has(stripped)) return true;
    if (stripped.length >= 2 && abbrevs.has(stripped)) return true;
    // Raw join too: "c.u.46", "k-4-y", "1.1.7.4", "i.f/i.b", "4.2.0".
    const rawStripped = rawToken.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (rawStripped.length >= 2 && abbrevs.has(rawStripped)) {
      return true;
    }
  }
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
  // Raw spaced-out runs too ("1 1 7 4", "c u 4 6", "4 2 0") —
  // exact equality only, same as the decoded runs.
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

function containsHookupWording(raw: string): boolean {
  if (!raw || !raw.trim()) return false;
  const scrubbed = scrubWording(raw);
  // The JO slang forms, checked case-aware on the original
  // text — the name "Jo" itself always passes.
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

function containsDrugWording(raw: string): boolean {
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

// (The boolean either-type check lives server-side as
// containsBannedWording; the client only needs the typed
// message below.)

// The type-specific friendly message for the given fields, or
// null when everything is clean: drug wording gets DRUG_ERROR,
// hookup / vulgar wording gets WORDING_ERROR. Hookup wins per
// field, mirroring the server, so a value blocked before the
// drug sets existed keeps the message it always showed.
function wordingErrorFor(...values: (string | string[])[]): string | null {
  for (const v of values) {
    const items = typeof v === "string" ? [v] : v;
    for (const s of items) {
      if (containsHookupWording(s)) return WORDING_ERROR;
      if (containsDrugWording(s)) return DRUG_ERROR;
    }
  }
  return null;
}



// For mutation error lines: show the friendly wording error when
// the server (or a client guard) rejected for wording, else the
// form's usual fallback.
function errText(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message === WORDING_ERROR) {
    return WORDING_ERROR;
  }
  if (error instanceof Error && error.message === DRUG_ERROR) {
    return DRUG_ERROR;
  }
  // The server's 21+ spot gate error is written for the user —
  // show it as-is instead of the generic fallback.
  if (error instanceof Error && error.message.includes(AGE_21_MESSAGE)) {
    return error.message;
  }
  // Same for the server's 18–99 membership range messages.
  if (
    error instanceof Error &&
    error.message.includes("List Dating is for members 18 to 99")
  ) {
    return error.message;
  }
  // Owner-only operations (Meta AI key, AI generation, admin):
  // a guest / non-owner denial is written for the user — show
  // it as-is so nothing reads as saved when it was not.
  if (
    error instanceof Error &&
    error.message.includes("Owner sign-in required")
  ) {
    return error.message;
  }
  return fallback;
}

function fmtBudget(cents: number | null): string {
  if (cents === null || cents <= 0) return "";
  const dollars = cents / 100;
  return `$${Number.isInteger(dollars) ? dollars.toLocaleString() : dollars.toFixed(2)}`;
}

function parseBudgetToCents(s: string): number | null {
  const t = s.replace(/[^0-9.]/g, "");
  if (!t) return null;
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function fmtMsgTime(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ---------- small building blocks ----------

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["state"] });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0] ?? "?").slice(0, 2).toUpperCase();
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

type Photo = State["profile"]["photos"][number];
type StagedPhoto = { dataBase64: string; mimeType: string; preview: string };

function Avatar({
  name,
  size = "md",
  photoUrl,
}: {
  name: string;
  size?: "md" | "lg";
  photoUrl?: string;
}) {
  const cls = size === "lg" ? "h-16 w-16 text-xl" : "h-12 w-12 text-base";
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={`Photo of ${name || "member"}`}
        className={`${cls} shrink-0 rounded-full border-2 border-[var(--gold)] object-cover`}
      />
    );
  }
  return (
    <div
      aria-hidden
      className={`flex ${cls} shrink-0 items-center justify-center rounded-full bg-[var(--accent)] font-bold text-[#fffaf0]`}
    >
      {initials(name)}
    </div>
  );
}

function PhotoGallery({ photos, name }: { photos: Photo[]; name: string }) {
  const [active, setActive] = useState(0);
  // Start back on the first photo whenever a different person's
  // photos (or a different set) are shown — the gallery is reused
  // across people on the Matches and Open pages, and carrying the
  // old index over would open on the wrong picture.
  const idsKey = photos.map((ph) => ph.id).join(",");
  useEffect(() => {
    setActive(0);
  }, [idsKey]);
  if (photos.length === 0) return null;
  const safeActive = Math.min(active, photos.length - 1);
  const current = photos[safeActive] ?? photos[0];
  if (!current) return null;
  return (
    <div className="mb-3">
      <img
        src={current.url}
        alt={`Photo of ${name}`}
        className="h-80 w-full rounded-3xl border border-[var(--border)] object-cover sm:h-[26rem]"
      />
      {photos.length > 1 && (
        <div
          className="mt-2 flex flex-wrap gap-2"
          role="group"
          aria-label={`Photos of ${name} — tap one to see it big`}
        >
          {photos.map((ph, i) => (
            <button
              key={ph.id}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show photo ${i + 1} of ${name}`}
              aria-pressed={i === safeActive}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 ${i === safeActive ? "border-[var(--gold)] ring-2 ring-[var(--gold)]" : "border-[var(--border)] opacity-80"}`}
            >
              <img src={ph.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PhotoManager({
  photos,
  target,
  personId,
  label,
}: {
  photos: Photo[];
  target: "profile" | "person";
  personId: number | null;
  label: string;
}) {
  const invalidate = useInvalidate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputId = `photo-upload-${target}-${personId ?? "me"}`;
  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError("");
    try {
      for (const file of Array.from(files).slice(0, 3 - photos.length)) {
        if (!file.type.startsWith("image/")) continue;
        const { dataBase64, mimeType } = await fileToBase64(file);
        await api.uploadPhoto({ target, personId, dataBase64, mimeType });
      }
      invalidate();
    } catch {
      setError("Couldn't add that photo — use a JPEG, PNG, WebP or GIF under about 6 MB, up to 3 photos per profile.");
    } finally {
      setBusy(false);
    }
  };
  const remove = useMutation({
    mutationFn: (id: number) => api.deletePhoto({ id }),
    onSuccess: invalidate,
  });
  const reorder = useMutation({
    mutationFn: (photoIds: number[]) =>
      api.reorderPhotos({ target, personId, photoIds }),
    onSuccess: invalidate,
    onError: () =>
      setError("Couldn't reorder those photos — please try again."),
  });
  const move = (index: number, dir: -1 | 1) => {
    const next = photos.map((ph) => ph.id);
    const swap = index + dir;
    if (swap < 0 || swap >= next.length) return;
    const a = next[index];
    const b = next[swap];
    if (a === undefined || b === undefined) return;
    next[index] = b;
    next[swap] = a;
    reorder.mutate(next);
  };
  return (
    <div>
      <span className={labelCls}>{label}</span>
      {photos.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {photos.map((ph, i) => (
            <span key={ph.id} className="relative inline-block">
              <img
                src={ph.url}
                alt="Uploaded photo"
                className="h-20 w-20 rounded-2xl border border-[var(--border)] object-cover"
              />
              <button
                type="button"
                onClick={() => remove.mutate(ph.id)}
                disabled={remove.isPending}
                aria-label="Remove this photo"
                className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--danger-bg)] text-xs font-bold text-white"
              >
                ✕
              </button>
              {photos.length > 1 && (
                <span className="mt-1 flex justify-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0 || reorder.isPending}
                    aria-label={`Move photo ${i + 1} earlier`}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-sm font-bold text-[var(--accent-ink)] disabled:opacity-40"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === photos.length - 1 || reorder.isPending}
                    aria-label={`Move photo ${i + 1} later`}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-sm font-bold text-[var(--accent-ink)] disabled:opacity-40"
                  >
                    →
                  </button>
                </span>
              )}
            </span>
          ))}
        </div>
      )}
      {photos.length >= 3 && (
        <p className="mt-1 text-xs text-[var(--dim)]">
          That&apos;s the max — 3 photos. Remove one above to add a different one.
        </p>
      )}
      {photos.length < 3 && (
        <>
          <label
            htmlFor={inputId}
            className={`${btnGhost} inline-block cursor-pointer`}
          >
            {busy ? "Adding photo…" : photos.length === 0 ? "＋ Add a photo" : "＋ Add another photo"}
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="sr-only"
            aria-label={label}
            onChange={(e) => {
              void onFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <p className="mt-1 text-xs text-[var(--dim)]">
            Up to 3 photos. The first one becomes the profile picture — use the ← → buttons to reorder.
          </p>
        </>
      )}
      {error && <p className="mt-1 text-sm text-[var(--danger)]">{error}</p>}
    </div>
  );
}

function StagedPhotoPicker({
  staged,
  setStaged,
  label,
}: {
  staged: StagedPhoto[];
  setStaged: (v: StagedPhoto[]) => void;
  label: string;
}) {
  const [busy, setBusy] = useState(false);
  const inputId = `staged-${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const next: StagedPhoto[] = [...staged];
      for (const file of Array.from(files)) {
        if (next.length >= 3) break;
        if (!file.type.startsWith("image/")) continue;
        const { dataBase64, mimeType } = await fileToBase64(file);
        next.push({ dataBase64, mimeType, preview: `data:${mimeType};base64,${dataBase64}` });
      }
      setStaged(next);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <span className={labelCls}>{label}</span>
      {staged.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {staged.map((s, i) => (
            <span key={i} className="relative inline-block">
              <img
                src={s.preview}
                alt="Photo to add"
                className="h-20 w-20 rounded-2xl border border-[var(--border)] object-cover"
              />
              <button
                type="button"
                onClick={() => setStaged(staged.filter((_, j) => j !== i))}
                aria-label={`Remove photo ${i + 1} before saving`}
                className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--danger-bg)] text-xs font-bold text-white"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      {staged.length >= 3 && (
        <p className="mt-1 text-xs text-[var(--dim)]">
          That&apos;s the max — 3 photos. Remove one above to add a different one.
        </p>
      )}
      {staged.length < 3 && (
        <>
          <label htmlFor={inputId} className={`${btnGhost} inline-block cursor-pointer`}>
            {busy ? "Adding photo…" : "＋ Add a photo"}
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="sr-only"
            aria-label={label}
            onChange={(e) => {
              void onFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <p className="mt-1 text-xs text-[var(--dim)]">Photos upload when you save — up to 3.</p>
        </>
      )}
    </div>
  );
}

async function uploadStaged(
  staged: StagedPhoto[],
  target: "profile" | "person",
  personId: number | null,
): Promise<void> {
  for (const s of staged) {
    try {
      await api.uploadPhoto({ target, personId, dataBase64: s.dataBase64, mimeType: s.mimeType });
    } catch {
      // Keep going: the profile is saved even if one photo fails.
    }
  }
}

function MatchBadge({ percent }: { percent: number | null }) {
  if (percent === null) {
    return (
      <span className="rounded-full bg-[var(--surface-alt)] px-2.5 py-1 text-xs font-semibold text-[var(--dim)]">
        No List yet
      </span>
    );
  }
  const strong = percent >= 75;
  const mid = percent >= 50;
  const bg = strong
    ? "bg-[var(--accent)] text-[#fffaf0]"
    : mid
      ? "bg-[var(--gold)] text-white"
      : "bg-[var(--surface-alt)] text-[var(--text)]";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${bg}`}>
      {percent}% match
    </span>
  );
}

// Simple match labels — the whole app in two words, on the
// simple List calculation (2026-11-03, two-sided): match % is
// the HIGHER of the two directions — your Wants covered by
// their Provides ÷ your Wants, and their Wants covered by your
// Provides ÷ their Wants (the server does that math; Desires
// never count). Either direction alone makes the match. Match:
// 50% or more covered in either direction. Potential: under
// 50% both ways, but at least one real List item can happen
// via a Provide cover either way. Traits / qualities alone
// never make a Match or a Potential any more.
type MatchStatus = "match" | "potential" | null;

function matchStatusFor(person: {
  matchPercent: number | null;
  coverCount: number;
  coveredByMeCount: number;
}): MatchStatus {
  if (person.matchPercent !== null && person.matchPercent >= 50) {
    return "match";
  }
  if (person.coverCount > 0 || person.coveredByMeCount > 0) {
    return "potential";
  }
  return null;
}

function MatchStatusBadge({ person }: { person: Person }) {
  const status = matchStatusFor(person);
  if (status === "match") {
    return (
      <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-xs font-bold text-[#fffaf0]">
        ✓ Match
      </span>
    );
  }
  if (status === "potential") {
    return (
      <span className="rounded-full border border-[var(--gold)] bg-[var(--surface)] px-2.5 py-1 text-xs font-bold text-[var(--text)]">
        Potential
      </span>
    );
  }
  return null;
}

// ---------- Out of the Blue: the tiny wave ----------
//
// Erin's direction (2026-11-03): the out-of-the-blue surprise
// carries a little tiny wave — small and subtle, not large.
// Life comes in waves, and everything ripples and has
// frequency, so the tiny wave is the visual mark of the
// surprise. One small wavy line in the bright sky blue, drawn
// once here and reused wherever the Out of the Blue mark shows.
function TinyWave() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 36 10"
      className="h-[10px] w-9 shrink-0"
      fill="none"
    >
      <path
        d="M1 5 Q 5.5 0.8, 10 5 T 19 5 T 28 5 T 35 5"
        stroke="var(--sky)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

// The 2% Out of the Blue badge — with the tiny wave. The 2% is
// a surprise label only: it is never a Match or Potential badge
// and never a cover.
function OutOfBlueBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--sky)] bg-[var(--surface)] px-2.5 py-1 text-xs font-bold text-[var(--text)]">
      <TinyWave />
      2% Out of the Blue
    </span>
  );
}

// One Out of the Blue card, in Matches only. Pushing its button
// is the user's choice: the server records the Deal and creates
// (or reuses) one date from an uncovered Want, then the normal
// Meta AI plan runs for THAT date — the saved key, server-side
// only, exactly like Plan the Date — so the surprise ends with a
// real plan on a real date in Dates.
function OutOfBlueCard({
  person,
  dates,
  onOpenPerson,
}: {
  person: Person;
  dates: DateIdea[];
  onOpenPerson: (personId: number) => void;
}) {
  const invalidate = useInvalidate();
  const [pushing, setPushing] = useState(false);
  const [status, setStatus] = useState("");
  const [err, setErr] = useState("");
  const undoDeal = useMutation({
    mutationFn: () =>
      api.setMatchDecision({ personId: person.id, decision: "none" }),
    onSuccess: () => {
      setStatus("");
      invalidate();
    },
  });
  const myDates = dates.filter((d) => d.status !== "declined");
  const plannedDate = myDates.find((d) => d.plan.trim() !== "");
  const isDeal = person.matchDecision === "accepted";

  const pushDeal = async () => {
    if (pushing) return;
    setErr("");
    setPushing(true);
    setStatus(
      "Making your Out of the Blue Deal — then writing its plan with your saved Meta AI key…",
    );
    try {
      const deal = await api.createOutOfBlueDeal({ personId: person.id });
      const planRes = await api.generateDatePlan({ dateId: deal.dateId });
      setStatus(
        planRes.source === "meta-ai"
          ? `✓ Surprise Deal made — the ${deal.ideaText} plan was written by Meta AI with your saved key. It's on the date in Dates.`
          : `✓ Surprise Deal made — the ${deal.ideaText} plan was written from your List. It's on the date in Dates.`,
      );
      invalidate();
    } catch (e) {
      setStatus("");
      setErr(errText(e, "Couldn't make that surprise Deal — try again."));
    } finally {
      setPushing(false);
    }
  };

  return (
    <article className="rounded-[28px] border border-[var(--sky)] bg-[var(--surface-alt)] px-4 py-3">
      <div className="flex items-start gap-3">
        <Avatar name={person.name} photoUrl={person.photos[0]?.url} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-lg font-bold text-[var(--text)]">
              {person.name}
              {person.age !== null && (
                <span className="font-semibold text-[var(--dim)]">
                  , {person.age}
                </span>
              )}
            </h4>
            {isDeal && (
              <span className="rounded-full bg-[var(--pink-accent)] px-2.5 py-1 text-xs font-bold text-[var(--accent-ink)]">
                ✦ Deal
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-[var(--surface)] px-2.5 py-1 text-xs font-bold text-[var(--dim)]">
              0% specific
            </span>
            <OutOfBlueBadge />
          </div>
          {person.location.trim() && (
            <p className="mt-1 text-sm text-[var(--dim)]">
              ⌖ {person.location}
              {person.availableTimes.trim()
                ? ` · ◷ Available ${person.availableTimes}`
                : ""}
            </p>
          )}
        </div>
      </div>
      <p className="mt-2 text-sm leading-snug text-[var(--text)]">
        {person.outOfBlueCategory
          ? `You both touch ${person.outOfBlueCategory} — just not the same specific thing. That's the ripple, not a cover.`
          : "No specific cover either way, and no shared category either — different areas entirely. That's why it's out of the blue."}
      </p>
      {plannedDate && isDeal && !status && (
        <p className="mt-1 text-sm font-semibold text-[var(--text)]" role="status">
          ✓ Already a Deal — your {plannedDate.ideaText} date is in Dates,
          with its plan.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={btnAccept}
          onClick={() => void pushDeal()}
          disabled={pushing}
          aria-label={
            isDeal
              ? `Out of the Blue Deal with ${person.name} — already a Deal, run the plan for its date again`
              : `Try the Out of the Blue Deal with ${person.name} — a 2 percent surprise, make a Deal and write its date plan with your saved Meta AI key`
          }
        >
          <span className="inline-flex items-center justify-center gap-2">
            <TinyWave />
            {pushing
              ? "Making the surprise…"
              : isDeal
                ? "Out of the Blue Deal — plan its date"
                : "Try the Out of the Blue Deal"}
          </span>
        </button>
        <button
          type="button"
          className={btnGhost}
          onClick={() => onOpenPerson(person.id)}
          aria-label={`Open ${person.name}'s page — everything in one place`}
        >
          Open page ›
        </button>
        {isDeal && (
          <button
            type="button"
            className={btnGhost}
            onClick={() => undoDeal.mutate()}
            disabled={undoDeal.isPending}
            aria-label={`Undo the Deal with ${person.name}`}
          >
            Undo Deal
          </button>
        )}
      </div>
      {status && (
        <p className="mt-2 text-sm font-semibold text-[var(--text)]" role="status">
          {status}
        </p>
      )}
      {err && (
        <p className="mt-2 text-sm text-[var(--danger)]" role="alert">
          {err}
        </p>
      )}
    </article>
  );
}

// ---------- "I am" + the pride Same sex matching mode ----------
//
// Matching is heterosexual by default (2026-11-02, superseding the
// earlier items-only rule): with the user's "I am" (man / woman)
// set, Matches and Potential show only people of the opposite sex.
// The pride Same sex button flips that: ON shows only people of
// the same sex. The toggle is per-profile and OFF by default. A
// member with no stated gender never passes the filter while the
// user's gender is set — gender is stated, never guessed from a
// name. With no user gender set, no gender filtering applies.
type Gender = "man" | "woman" | "";

const PRIDE_GRADIENT =
  "linear-gradient(90deg,#e40303,#ff8c00,#ffed00,#008026,#24408e,#732982)";

function genderPassesMode(
  personGender: Gender,
  myGender: Gender,
  sameSex: boolean,
): boolean {
  if (!myGender) return true;
  if (!personGender) return false;
  return sameSex ? personGender === myGender : personGender !== myGender;
}

// Who the current mode shows, as a plural label ("men" / "women").
function shownGenderLabel(
  myGender: Gender,
  sameSex: boolean,
): "men" | "women" | null {
  if (!myGender) return null;
  const shown = sameSex
    ? myGender
    : myGender === "man"
      ? "woman"
      : "man";
  return shown === "man" ? "men" : "women";
}

// The pride Same sex toggle itself — presentational, used by the
// profile/member forms (local state). The matching-mode setting
// lives ONLY in the profile area (Edit profile / Join / member
// forms): there is no mode box in Matches (Erin, 2026-11-04 —
// the old Matches mode banner was removed at her direction).
function SameSexToggle({
  on,
  onToggle,
  disabled = false,
}: {
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={
        on
          ? "Same sex matching is on — tap to switch back to heterosexual matching"
          : "Same sex — tap to switch to same-sex matching (heterosexual matching is the default)"
      }
      onClick={onToggle}
      disabled={disabled}
      className="block w-full overflow-hidden rounded-2xl border-2 border-[var(--border)] bg-[var(--surface-alt)] text-left shadow-sm transition active:scale-[0.99] disabled:opacity-60"
    >
      <span
        aria-hidden
        className="block h-2 w-full"
        style={{ background: PRIDE_GRADIENT }}
      />
      <span className="flex items-center justify-between gap-3 px-3 py-2">
        <span className="font-display text-base text-[var(--text)]">
          Same sex
        </span>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            on
              ? "bg-[var(--pink-accent)] text-[var(--accent-ink)]"
              : "border border-[var(--border)] text-[var(--dim)]"
          }`}
        >
          {on ? "ON · same-sex matching" : "OFF"}
        </span>
      </span>
      <span className="block px-3 pb-2.5 text-xs text-[var(--dim)]">
        {on
          ? "Your Matches and Potential show only people of the same sex as you."
          : "Off is the default: heterosexual matching — the opposite sex only."}
      </span>
    </button>
  );
}

// "I am" (man / woman) + the pride Same sex toggle, as one block
// for the profile and member forms. subject is "I am" for your own
// profile / Join, "They are" when you record someone else.
function GenderFields({
  subject,
  gender,
  setGender,
  sameSex,
  setSameSex,
}: {
  subject: string;
  gender: Gender;
  setGender: (g: Gender) => void;
  sameSex: boolean;
  setSameSex: (v: boolean) => void;
}) {
  return (
    <div>
      <span className={labelCls}>{subject}</span>
      <div className="flex gap-2" role="group" aria-label={`${subject} — man or woman`}>
        {(["man", "woman"] as const).map((g) => (
          <button
            key={g}
            type="button"
            aria-pressed={gender === g}
            aria-label={`${subject} a ${g}`}
            onClick={() => setGender(gender === g ? "" : g)}
            className={`flex-1 rounded-full px-4 py-2.5 text-base font-bold transition active:scale-[0.98] ${
              gender === g
                ? "bg-[var(--accent)] text-[#fffaf0]"
                : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
            }`}
          >
            {g === "man" ? "Man" : "Woman"}
          </button>
        ))}
      </div>
      <div className="mt-3">
        <SameSexToggle on={sameSex} onToggle={() => setSameSex(!sameSex)} />
      </div>
    </div>
  );
}

// The ONE-LINE match reason — the whole "why" at a glance, on the
// bubble view and on every member card. On the simple List
// calculation it names the actual Want a Provide covers (theirs
// covering yours, or yours covering theirs) — never a trait and
// never a paragraph of reasoning. Derived from the same scored
// data the server returns; nothing new is stored.
function matchReasonFor(person: Person, _listItems: ListItem[]): string {
  const cover = person.needCovers[0];
  const mine = person.coveredByMe[0];
  // Both directions count — show both when both are real.
  if (cover && mine) {
    const extraA = person.coverCount - 1;
    const extraB = person.coveredByMeCount - 1;
    return `Covers: ${cover.needText}${extraA > 0 ? ` +${extraA} more` : ""} · You cover: ${mine.giftTitle}${extraB > 0 ? ` +${extraB} more` : ""}`;
  }
  if (cover) {
    const extra = person.coverCount - 1;
    return `Covers: ${cover.needText}${extra > 0 ? ` +${extra} more` : ""}`;
  }
  if (mine) {
    return `You cover: ${mine.giftTitle} for them`;
  }
  if (person.matchPercent !== null && person.matchPercent > 0) {
    return `${person.matchPercent}% of Wants covered`;
  }
  return "No List match yet";
}

// Dealbreaker is background only (2026-11-03): not a main
// section and not a red alarm — a small, quiet note that appears
// only when a member's dealbreaker actually clashes with your
// List. The word itself stays clear for the judges; the display
// stays subtle.
function DealbreakerWarning({
  hits,
  name,
}: {
  hits: string[];
  name: string;
}) {
  if (hits.length === 0) return null;
  return (
    <p className="rounded-xl bg-[var(--surface-alt)] px-2.5 py-1.5 text-xs font-medium text-[var(--dim)]">
      Background · Dealbreaker: {name}&apos;s “{hits.join(" · ")}” crosses
      your List.
    </p>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-display text-xl text-[var(--text)]">{children}</h2>
  );
}

// A Profile Edit extra that starts closed (2026-11-02 declutter):
// just its short title shows as a toggle; the whole section
// opens only when tapped. The profile form and the List editor
// never use this — they stay open.
function CollapsedSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section aria-label={title}>
      <button
        type="button"
        className="surface-3d flex w-full items-center justify-between gap-3 rounded-[28px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left"
        aria-expanded={open}
        aria-label={`${title} — ${open ? "hide" : "show"}`}
        onClick={() => setOpen((v) => !v)}
      >
        <SectionTitle>{title}</SectionTitle>
        <span aria-hidden className="text-xl font-bold text-[var(--dim)]">
          {open ? "▾" : "›"}
        </span>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </section>
  );
}

const inputCls =
  "w-full rounded-[20px] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-base text-[var(--text)] placeholder:text-[var(--dim)]";
const labelCls = "block text-sm font-semibold text-[var(--text)] mb-1";
const btnPrimary =
  "rounded-full bg-gradient-to-b from-[#fffdf7] via-[#fffaf0] to-[#f0d9ab] px-5 py-2.5 text-base font-bold text-[var(--accent-ink)] shadow-[0_6px_16px_rgba(101,78,32,0.45),inset_0_1px_0_rgba(255,255,255,0.9)] disabled:opacity-50 active:scale-[0.98] transition";
const btnGhost =
  "rounded-full border border-[var(--border)] bg-gradient-to-b from-[#f7e7c3] to-[#eed9ae] px-4 py-2 text-sm font-semibold text-[var(--text)] shadow-[0_3px_10px_rgba(101,78,32,0.35),inset_0_1px_0_rgba(255,255,255,0.6)] disabled:opacity-50 active:scale-[0.98] transition";
const btnDanger =
  "rounded-full border border-[var(--danger)] px-4 py-2 text-sm font-semibold text-[var(--danger)] disabled:opacity-50";
// Match decision buttons (2026-11-02): Accept / Decline on every
// match card, sized big for 45+ — full text-lg labels, tall tap
// targets, never icon-only.
const btnAccept =
  "min-h-[56px] flex-1 rounded-full bg-gradient-to-b from-[#ffd7ec] to-[#fdb9de] px-5 py-3 text-lg font-bold text-[var(--accent-ink)] shadow-[0_8px_20px_rgba(101,78,32,0.5),inset_0_1px_0_rgba(255,255,255,0.28)] disabled:opacity-50 active:scale-[0.98] transition";
const btnDecline =
  "min-h-[56px] flex-1 rounded-full border-2 border-[var(--danger)] bg-[var(--surface)] px-5 py-3 text-lg font-bold text-[var(--danger)] shadow-[0_3px_10px_rgba(101,78,32,0.35)] disabled:opacity-50 active:scale-[0.98] transition";
// Mark-date-completed button (2026-11-02): the last step of the
// flow, sized big and readable like Accept / Decline — full-width,
// tall tap target, text-lg label, never icon-only.
const btnComplete =
  "min-h-[56px] w-full rounded-full bg-gradient-to-b from-[#ffd7ec] to-[#fdb9de] px-5 py-3 text-lg font-bold text-[var(--accent-ink)] shadow-[0_8px_20px_rgba(101,78,32,0.5),inset_0_1px_0_rgba(255,255,255,0.28)] disabled:opacity-50 active:scale-[0.98] transition";
const btnUndoComplete =
  "min-h-[56px] w-full rounded-full border-2 border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-lg font-bold text-[var(--text)] disabled:opacity-50 active:scale-[0.98] transition";

function AgeInput({
  value,
  onChange,
  label,
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  hint?: string;
}) {
  return (
    <div>
      <input
        aria-label={label}
        className={inputCls}
        inputMode="numeric"
        value={value}
        placeholder="Age (18–99)"
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
      />
      {hint && <p className="mt-1 text-xs text-[var(--dim)]">{hint}</p>}
    </div>
  );
}

// Membership is 18 to 99 inclusive (2026-11-02, Erin — the
// upper limit is 99, not 69): an age outside that range parses
// to null, and the Join / Add / Edit forms say so plainly
// instead of saving it. Blank stays null — an unknown age is
// honest, never invented.
function parseAge(s: string): number | null {
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) && n >= 18 && n <= 99 ? n : null;
}

function ContactSelect({
  value,
  onChange,
  label,
}: {
  value: ContactPref;
  onChange: (v: ContactPref) => void;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      className={inputCls}
      value={value}
      onChange={(e) => onChange(e.target.value as ContactPref)}
    >
      {(Object.keys(CONTACT_LABELS) as ContactPref[]).map((k) => (
        <option key={k} value={k}>
          {CONTACT_LABELS[k]}
        </option>
      ))}
    </select>
  );
}

// The 21+ spot collections (bars, night clubs, exotic venues
// and alcohol spots — SPOT_21PLUS_GROUP_LABELS) stay
// hidden behind a "21+ spots hidden — I'm 21+, show" link, and
// the link is enforced BY AGE, not by the tap alone: the hidden
// spots only appear when the recorded age for the person whose
// spot this is (subjectAge, or both ages for a date picker) is
// 21 or older. Under 21 or unknown age, tapping the link shows
// the 21+ message and the spots stay hidden.

function SpotSelect({
  id,
  value,
  onChange,
  firstOptionLabel,
  ariaLabel,
  gate21 = false,
  both21 = false,
  gateDetail = "",
  subjectAge = null,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  firstOptionLabel: string;
  ariaLabel?: string;
  // Date-spot pickers pass gate21: the 21+ collections (bars,
  // night clubs, exotic / adults-only and alcohol venues) then
  // show only when both21 — both people on this date are 21 or
  // older. Otherwise those groups are hidden entirely and the
  // gate note below offers a non-bar spot instead.
  gate21?: boolean;
  both21?: boolean;
  gateDetail?: string;
  // Non-date pickers (Join, Add someone, Edit member — a person's
  // own usual spot) pass the recorded age of the person whose
  // spot this is. The "21+ spots hidden — I'm 21+, show" link is
  // enforced by that age: the 21+ collections only appear when
  // subjectAge is 21 or older. Under 21 or no age on record, the
  // tap shows the 21+ message and the spots stay hidden.
  subjectAge?: number | null;
}) {
  const [show21, setShow21] = useState(false);
  const [triedShow, setTriedShow] = useState(false);
  const valueIs21 = is21PlusSpot(value);
  const subject21 =
    subjectAge !== null && subjectAge !== undefined && subjectAge >= 21;
  // Which mode's age rule unlocks the 21+ collections here: both
  // ages for a date picker, the subject's own recorded age for a
  // usual-spot picker. A saved 21+ value still shows for a 21+
  // subject (the picker never hides their own saved choice).
  const ageUnlocks = gate21 ? both21 : subject21;
  const show21Groups = ageUnlocks && (gate21 || show21 || valueIs21);
  return (
    <div>
      <select
        id={id}
        aria-label={ariaLabel}
        className={inputCls}
        value={valueIs21 && !show21Groups ? "" : value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{firstOptionLabel}</option>
        {SPOT_GROUPS.map((group) => {
          const is21Group = SPOT_21PLUS_GROUP_LABELS.has(group.label);
          if (is21Group && !show21Groups) return null;
          const spots = group.spots.filter(
            (s) => !(!show21Groups && is21PlusSpot(s)),
          );
          if (spots.length === 0) return null;
          return (
            <optgroup key={group.label} label={group.label}>
              {spots.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>
      {gate21 ? (
        both21 ? (
          <p className="mt-1 text-xs text-[var(--dim)]">
            ✓ Both 21+ — bars and exotic places can show for this date
          </p>
        ) : (
          <div className="mt-2 rounded-2xl bg-[var(--surface)] px-3 py-2">
            <p className="text-sm font-bold text-[var(--text)]">
              {AGE_21_MESSAGE}
            </p>
            <p className="mt-0.5 text-xs text-[var(--dim)]">
              Bars, night clubs, exotic places and alcohol venues are
              hidden for this date — both people need to be 21 or
              older
              {gateDetail ? ` (${gateDetail})` : ""}. An age that
              isn&apos;t on record counts as not 21 for these spots.
            </p>
            <button
              type="button"
              className="mt-1.5 text-sm font-semibold text-[var(--text)] underline"
              onClick={() => onChange(NON_BAR_ALTERNATIVE_SPOT)}
              aria-label={`Use ${NON_BAR_ALTERNATIVE_SPOT} as the date spot instead of a bar or exotic place`}
            >
              Try a non-bar spot instead: {NON_BAR_ALTERNATIVE_SPOT}
            </button>
          </div>
        )
      ) : show21Groups ? (
        <p className="mt-1 text-xs text-[var(--dim)]">
          ✓ 21+ spots shown
          {show21 && (
            <button
              type="button"
              className="ml-2 font-semibold underline"
              onClick={() => setShow21(false)}
            >
              Hide
            </button>
          )}
        </p>
      ) : (
        <>
          <button
            type="button"
            className="mt-1 text-xs font-semibold text-[var(--dim)] underline"
            onClick={() => {
              if (subject21) {
                setShow21(true);
              } else {
                setTriedShow(true);
              }
            }}
          >
            21+ spots hidden — I&apos;m 21+, show
          </button>
          {(triedShow || valueIs21) && !subject21 && (
            <div className="mt-2 rounded-2xl bg-[var(--surface)] px-3 py-2">
              <p className="text-sm font-bold text-[var(--text)]">
                {AGE_21_MESSAGE}
              </p>
              <p className="mt-0.5 text-xs text-[var(--dim)]">
                Bars, night clubs, exotic places and alcohol venues
                only show when the age on record is 21 or older.{" "}
                {subjectAge === null || subjectAge === undefined
                  ? "No age is on record here yet — enter an age of 21 or older above and they can show."
                  : "The age on record here is under 21, so they stay hidden."}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ListDifference() {
  return (
    <section className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-sm">
      <h2 className="font-display text-xl leading-tight text-[var(--text)]">
        Not coffee. Not small talk. Something real.
      </h2>
      <p className="mt-0.5 text-sm text-[var(--dim)]">
        Meet to do a List item — that&apos;s the match.
      </p>
    </section>
  );
}

// ---------- the header present icon ----------
//
// The List Dating mark in the top circle, reproducing the gold
// emblem Erin picked and approved (2026-11-02, from her photo):
// a pale champagne-gold circular disc with a raised rim; inside
// it a flat black present, front-on — a lid band over a square
// body; a small gold bow of two loops sitting on top of the
// present; and the bow's ribbon sweeping down as ONE large,
// thick cream-gold check mark across the present — its short arm
// drapes over the lid's left side, it comes to a sharp point at
// the bottom centre of the box, and its long arm rises past the
// box's top-right corner, ending in a point over the gold disc.
// The check is drawn as a filled ribbon (not a stroked line) so
// it keeps the sharp bottom point and the pointed tip of the
// original at header size. Inline SVG so it stays crisp.

function PresentIcon({ className = "h-11 w-11" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id="ld-gold-disc" cx="42%" cy="34%" r="80%">
          <stop offset="0%" stopColor="#f8edc9" />
          <stop offset="55%" stopColor="#eed9a0" />
          <stop offset="100%" stopColor="#dfc07e" />
        </radialGradient>
        <linearGradient id="ld-gold-ribbon" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#d9bd7c" />
          <stop offset="45%" stopColor="#f3e3ae" />
          <stop offset="100%" stopColor="#e8d194" />
        </linearGradient>
      </defs>
      {/* champagne-gold disc with its raised rim */}
      <circle cx="24" cy="24" r="23" fill="url(#ld-gold-disc)" />
      <circle
        cx="24"
        cy="24"
        r="22.2"
        fill="none"
        stroke="#c9a959"
        strokeWidth="1.6"
      />
      <circle
        cx="24"
        cy="24"
        r="19.9"
        fill="none"
        stroke="#cfa958"
        strokeOpacity="0.55"
        strokeWidth="0.8"
      />
      {/* black present, flat and front-on: lid band, then body */}
      <rect x="14.6" y="20" width="18.8" height="4.1" fill="#202024" />
      <rect x="15.6" y="24.1" width="16.8" height="13.4" fill="#202024" />
      {/* small gold bow on top of the present — two loops + knot */}
      <path
        d="M23.6 19.1c-2.8-3.9-6.7-4.5-7.4-2.2-.6 2.1 2.4 3.3 5.6 2.8.8-.1 1.4-.3 1.8-.6Z"
        fill="url(#ld-gold-ribbon)"
        stroke="#b08d3e"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
      <path
        d="M24.4 19.1c2.8-3.9 6.7-4.5 7.4-2.2.6 2.1-2.4 3.3-5.6 2.8-.8-.1-1.4-.3-1.8-.6Z"
        fill="url(#ld-gold-ribbon)"
        stroke="#b08d3e"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="19" r="1.15" fill="#e8d194" stroke="#b08d3e" strokeWidth="0.5" />
      {/* the ribbon as one large check across the present:
          short arm down from the bow, sharp point at the bottom
          centre of the box, long arm rising to a point over the
          disc at the top right */}
      <path
        d="M39.2 12.6 24.3 36.4 15.9 18.9l3.4.6 5.5 12.7L35.7 15.3Z"
        fill="url(#ld-gold-ribbon)"
        stroke="#b08d3e"
        strokeWidth="0.45"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------- the core flow, step by step ----------
//
// The whole point of the app, in four steps: 1 · My List — things
// you want or need. 2 · My Provides — things you can provide.
// 3 · Matches — people matched on those lists. 4 · First date —
// meet to do one real List item. Every step's button goes straight
// to the place that step is done; status is read from the live
// state, nothing new is stored.
//
// Since 2026-11-02 the steps are NOT a permanent panel at the top,
// and since 2026-11-04 they are not shown by default anywhere —
// not on Matches, not on Dates, and not on Profile. They live
// ONLY in a pop-up help box (StartHerePopup below) that appears
// only when the user taps "Show the start-here box" — the first
// item at the very top of the hamburger (☰) menu, its only home
// (moved out of the Help page on 2026-11-04). It can be Xed out /
// hidden, and then it disappears until that menu button asks for
// it again (a localStorage flag on this device only — no server
// state, no profile data).

const START_HERE_HIDDEN_KEY = "list-dating:start-here-hidden:v1";

function setStartHereHidden(hidden: boolean) {
  try {
    if (hidden) {
      window.localStorage.setItem(START_HERE_HIDDEN_KEY, "1");
    } else {
      window.localStorage.removeItem(START_HERE_HIDDEN_KEY);
    }
  } catch {
    // Storage unavailable (private mode etc.) — the box still
    // closes for this visit; it just may reappear next time.
  }
}

function CoreFlowSteps({
  state,
  onEditList,
  onEditProvides,
  onGoMatches,
  onGoDates,
  onClose,
}: {
  state: State;
  onEditList: () => void;
  onEditProvides: () => void;
  onGoMatches: () => void;
  onGoDates: () => void;
  // When rendered inside the start-here pop-up, closing hides the
  // box (persisted) — a step tap closes it too, then does its jump.
  onClose?: () => void;
}) {
  const visible = state.people.filter(
    (p) =>
      !p.blocked &&
      p.matchDecision !== "declined" &&
      genderPassesMode(p.gender, state.profile.gender, state.profile.sameSex),
  );
  const matchCount = visible.filter((p) => matchStatusFor(p) === "match").length;
  const potentialCount = visible.filter(
    (p) => matchStatusFor(p) === "potential",
  ).length;
  // Only Wants count toward the List step — dealbreakers are
  // background and Desires never count.
  const listCount = state.listItems.filter(
    (i) => i.kind === "must" || i.kind === "nice",
  ).length;
  const providesCount = state.profile.provides.length;
  const dateCount = state.dates.length;
  const steps: {
    n: number;
    title: string;
    caption: string;
    status: string;
    done: boolean;
    actionLabel: string;
    ariaLabel: string;
    onAction: () => void;
  }[] = [
    {
      n: 1,
      title: "My List",
      caption: "Things you want or need.",
      status: listCount > 0 ? `${listCount} on your List` : "Nothing yet",
      done: listCount > 0,
      actionLabel: "Edit List",
      ariaLabel: "Step 1 — edit My List",
      onAction: onEditList,
    },
    {
      n: 2,
      title: "My Provides",
      caption: "Things you can provide for someone.",
      status:
        providesCount > 0 ? `${providesCount} listed` : "Nothing yet",
      done: providesCount > 0,
      actionLabel: "Edit Provides",
      ariaLabel: "Step 2 — edit My Provides",
      onAction: onEditProvides,
    },
    {
      n: 3,
      title: "Matches",
      caption: "People matched on those lists.",
      status:
        matchCount > 0 || potentialCount > 0
          ? `${matchCount} match${matchCount === 1 ? "" : "es"} · ${potentialCount} potential`
          : "No matches yet",
      done: matchCount > 0 || potentialCount > 0,
      actionLabel: "See Matches",
      ariaLabel: "Step 3 — see Matches from my lists",
      onAction: onGoMatches,
    },
    {
      n: 4,
      title: "First date",
      caption: "Meet to do one real List item.",
      status:
        dateCount > 0
          ? `${dateCount} date${dateCount === 1 ? "" : "s"} set up`
          : "No date yet",
      done: dateCount > 0,
      actionLabel: dateCount > 0 ? "See Dates" : "Plan a date",
      ariaLabel:
        dateCount > 0
          ? "Step 4 — see my Dates"
          : "Step 4 — plan a first date from a Match",
      onAction: dateCount > 0 ? onGoDates : onGoMatches,
    },
  ];
  return (
    <section
      aria-label="Start here — the core flow in four steps"
      className="overflow-hidden rounded-[28px] border-2 border-[var(--pink-accent)] bg-[var(--surface)] shadow-sm"
    >
      <div className="flex items-center justify-between gap-3 bg-[var(--pink-accent)] px-4 py-2.5">
        <h2 className="font-display text-lg text-[var(--accent-ink)]">
          Start here
        </h2>
        <p className="text-sm font-bold text-[var(--accent-ink)]">
          List → Provides → Matches → Date
        </p>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close start here help"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0a2748]/10 text-base font-bold text-[var(--accent-ink)] transition active:scale-[0.95]"
          >
            ✕
          </button>
        )}
      </div>
      <ol className="relative grid grid-cols-4 gap-1 px-2 py-4">
        <span
          aria-hidden
          className="absolute left-[14%] right-[14%] top-10 border-t-[3px] border-dotted border-[var(--border)]"
        />
        {steps.map((s) => (
          <li key={s.n} className="relative">
            <button
              type="button"
              className="flex w-full flex-col items-center gap-1.5 text-center transition active:scale-[0.97]"
              onClick={() => {
                onClose?.();
                s.onAction();
              }}
              aria-label={s.ariaLabel}
            >
              <span
                aria-hidden
                className={`flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold shadow-sm ring-4 ring-[var(--surface)] ${
                  s.done
                    ? "bg-[var(--pink-accent)] text-[var(--accent-ink)]"
                    : "bg-[var(--surface-alt)] text-[var(--text)]"
                }`}
              >
                {s.done ? "✓" : s.n}
              </span>
              <span className="text-xs font-bold leading-tight text-[var(--text)]">
                {s.title}
              </span>
              <span className="text-xs font-semibold leading-tight text-[var(--dim)]">
                {s.status}
              </span>
              <span className="rounded-full bg-[var(--surface-alt)] px-2.5 py-1 text-xs font-bold text-[var(--accent)]">
                {s.actionLabel}
              </span>
            </button>
          </li>
        ))}
      </ol>
      {onClose && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] px-4 py-3">
          <p className="text-xs font-semibold text-[var(--dim)]">
            Bring it back any time from Help in the ☰ menu.
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Hide start here — don't show it every time"
            className="rounded-full bg-[var(--surface-alt)] px-3.5 py-1.5 text-xs font-bold text-[var(--text)] transition active:scale-[0.97]"
          >
            Hide
          </button>
        </div>
      )}
    </section>
  );
}

// The start-here pop-up: the four steps as a small help demo
// over the Profile view, not a permanent panel and never shown
// by default. It stays closed on every page — Matches, Dates
// and Profile — until the "Show the start-here box" button at
// the top of the hamburger menu asks for it via startHereSignal.
// Once shown, it disappears again when closed (X, Hide, a
// backdrop tap, Escape, or tapping a step).
function StartHerePopup({
  state,
  startHereSignal,
  onEditList,
  onEditProvides,
  onGoMatches,
  onGoDates,
}: {
  state: State;
  startHereSignal: number;
  onEditList: () => void;
  onEditProvides: () => void;
  onGoMatches: () => void;
  onGoDates: () => void;
}) {
  // Closed by default on every visit — the steps never appear
  // on Profile (or any page) until the hamburger-menu button
  // asks for them.
  const [open, setOpen] = useState<boolean>(false);

  // The hamburger menu asked for the box: clear the hide and
  // reopen, even if this view was already mounted when the
  // signal landed.
  useEffect(() => {
    if (startHereSignal > 0) {
      setStartHereHidden(false);
      setOpen(true);
    }
  }, [startHereSignal]);

  const hide = () => {
    setStartHereHidden(true);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open ]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Start here — how to start"
    >
      <button
        type="button"
        className="absolute inset-0 h-full w-full bg-black/60"
        onClick={hide}
        aria-label="Dismiss start here help"
      />
      <div className="relative max-h-[85vh] w-full max-w-3xl overflow-y-auto">
        <CoreFlowSteps
          state={state}
          onEditList={onEditList}
          onEditProvides={onEditProvides}
          onGoMatches={onGoMatches}
          onGoDates={onGoDates}
          onClose={hide}
        />
      </div>
    </div>
  );
}

// No StepBanner any more (Erin's direction, 2026-11-04): the
// slim Step 3 / Step 4 markers that sat permanently at the top
// of Matches and Dates are removed. The four steps live only
// in the start-here help pop-up, shown only when Help is
// activated from the hamburger menu.

// ---------- Provide list: what someone can cover ----------
//
// Two-sided matching made visible. Every profile — the user's and
// each member's — can list what they can provide: a category, the
// specific thing, and the most they'll spend covering it. The server
// matches a member's Provides against the user's Needs (List items),
// and the user's Provides against a member's wishlist, so a Need on
// one side can meet cover on the other.

function ProvideFields({
  prefix,
  category,
  setCategory,
  title,
  setTitle,
  maxSpend,
  setMaxSpend,
  note,
  setNote,
}: {
  prefix: string;
  category: string;
  setCategory: (v: string) => void;
  title: string;
  setTitle: (v: string) => void;
  maxSpend: string;
  setMaxSpend: (v: string) => void;
  note: string;
  setNote: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls} htmlFor={`${prefix}-provide-category`}>
          Category — what kind of cover is this?
        </label>
        <select
          id={`${prefix}-provide-category`}
          className={inputCls}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Pick a category…</option>
          {PROVIDE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls} htmlFor={`${prefix}-provide-title`}>
          What can be provided?
        </label>
        <input
          id={`${prefix}-provide-title`}
          className={inputCls}
          value={title}
          maxLength={120}
          placeholder="e.g. Windshield wipers — buy & fit them"
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div>
        <label className={labelCls} htmlFor={`${prefix}-provide-spend`}>
          Most you&apos;ll spend covering it ($) — optional
        </label>
        <input
          id={`${prefix}-provide-spend`}
          className={inputCls}
          inputMode="decimal"
          value={maxSpend}
          placeholder="e.g. 100"
          onChange={(e) => setMaxSpend(e.target.value)}
        />
      </div>
      <div>
        <label className={labelCls} htmlFor={`${prefix}-provide-note`}>
          Note (optional)
        </label>
        <input
          id={`${prefix}-provide-note`}
          className={inputCls}
          value={note}
          maxLength={200}
          placeholder="e.g. Weekends are best — I have the tools"
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </div>
  );
}

function provideLine(p: Provide): string {
  const spend =
    p.maxSpendCents !== null && p.maxSpendCents > 0
      ? `up to ${fmtBudget(p.maxSpendCents)}`
      : "no set budget";
  return `${p.title} · ${spend}`;
}

// Editor for Provides that are already saved (the user's own, in
// Profile / The List, or a member's, in their Edit form): add and
// remove take effect right away.
function ProvideEditor({
  ownerType,
  personId,
  provides,
  prefix,
  heading,
}: {
  ownerType: "profile" | "person";
  personId: number | null;
  provides: Provide[];
  prefix: string;
  heading: string;
}) {
  const invalidate = useInvalidate();
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [maxSpend, setMaxSpend] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");

  const remove = useMutation({
    mutationFn: (id: number) => api.deleteProvide({ id }),
    onSuccess: invalidate,
  });

  const add = useMutation({
    mutationFn: () =>
      api.addProvide({
        ownerType,
        personId,
        category,
        title,
        maxSpendCents: parseBudgetToCents(maxSpend),
        note,
      }),
    onSuccess: () => {
      invalidate();
      setCategory("");
      setTitle("");
      setMaxSpend("");
      setNote("");
    },
  });

  // Independent 3 cap (Erin's correction, 2026-11-02): Provides
  // are capped at 3 on their own — Wants never limit Provides.
  const providesFull = provides.length >= 3;
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-bold text-[var(--text)]">{heading}</h4>
      <p className="text-sm text-[var(--dim)]">
        Wants and Provides are each capped at 3, independently —{" "}
        {provides.length} of 3 Provides. One side does not limit the
        other.
      </p>
      {provides.length === 0 ? (
        <p className="text-sm text-[var(--dim)]">Nothing listed yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {provides.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--surface-alt)] px-3 py-2"
            >
              <span className="text-sm text-[var(--text)]">
                <span className="font-semibold">{p.category || "Other"}</span>
                {" — "}
                {provideLine(p)}
                {p.note && <span className="text-[var(--dim)]"> · {p.note}</span>}
              </span>
              <button
                type="button"
                className="shrink-0 text-sm font-semibold text-[var(--danger)]"
                aria-label={`Remove provide ${p.title}`}
                onClick={() => remove.mutate(p.id)}
                disabled={remove.isPending}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {/* The editor is ALWAYS here to add (Erin's direction,
          2026-11-02) — at the cap the fields stay on screen and
          only the Add button is disabled, with the Full note
          above them. */}
      {providesFull && (
        <p className="text-sm font-semibold text-[var(--dim)]">
          Full · 3 max — Wants and Provides are capped at 3 each,
          independently.
        </p>
      )}
          <ProvideFields
            prefix={prefix}
            category={category}
            setCategory={setCategory}
            title={title}
            setTitle={setTitle}
            maxSpend={maxSpend}
            setMaxSpend={setMaxSpend}
            note={note}
            setNote={setNote}
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              className={btnGhost}
              disabled={providesFull || add.isPending || !title.trim() || !category}
              onClick={() => {
                const wErr = wordingErrorFor(category, title, note);
                if (wErr) {
                  setMsg(wErr);
                  return;
                }
                setMsg("");
                add.mutate();
              }}
            >
              Add to the Provide list
            </button>
            {msg && <span className="text-sm font-semibold text-[var(--text)]">{msg}</span>}
          </div>
    </div>
  );
}

// Staged editor for forms where the person doesn't exist yet (Join,
// Add a member): entries are held locally and saved right after the
// person is created.
function StagedProvideEditor({
  staged,
  setStaged,
  prefix,
  label,
}: {
  staged: StagedProvide[];
  setStaged: (v: StagedProvide[]) => void;
  prefix: string;
  label: string;
}) {
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [maxSpend, setMaxSpend] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  // Independent 3 cap (Erin's correction, 2026-11-02): staged
  // Provides are capped at 3 on their own — staged Wants never
  // limit them.
  const stagedFull = staged.length >= 3;
  return (
    <fieldset className="space-y-3 rounded-3xl border border-[var(--border)] p-3">
      <legend className="px-1 text-sm font-bold text-[var(--text)]">{label}</legend>
      <p className="text-sm text-[var(--dim)]">
        Wants and Provides are each capped at 3, independently —{" "}
        {staged.length} of 3 Provides. One side does not limit the
        other.
      </p>
      {staged.length > 0 && (
        <ul className="space-y-1.5">
          {staged.map((s, i) => (
            <li
              key={`${s.title}-${i}`}
              className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--surface-alt)] px-3 py-2"
            >
              <span className="text-sm text-[var(--text)]">
                <span className="font-semibold">{s.category || "Other"}</span>
                {" — "}
                {s.title}
                {parseBudgetToCents(s.maxSpend) !== null &&
                  ` · up to ${fmtBudget(parseBudgetToCents(s.maxSpend))}`}
                {s.note && <span className="text-[var(--dim)]"> · {s.note}</span>}
              </span>
              <button
                type="button"
                className="shrink-0 text-sm font-semibold text-[var(--danger)]"
                aria-label={`Remove staged provide ${s.title}`}
                onClick={() => setStaged(staged.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {stagedFull && (
        <p className="text-sm font-semibold text-[var(--dim)]">
          Full · 3 max — Wants and Provides are capped at 3 each,
          independently.
        </p>
      )}
          <ProvideFields
            prefix={prefix}
            category={category}
            setCategory={setCategory}
            title={title}
            setTitle={setTitle}
            maxSpend={maxSpend}
            setMaxSpend={setMaxSpend}
            note={note}
            setNote={setNote}
          />
          <button
            type="button"
            className={btnGhost}
            disabled={stagedFull || !title.trim() || !category}
            onClick={() => {
              const wErr = wordingErrorFor(category, title, note);
              if (wErr) {
                setMsg(wErr);
                return;
              }
              setMsg("");
              setStaged([...staged, { category, title: title.trim(), maxSpend, note: note.trim() }]);
              setCategory("");
              setTitle("");
              setMaxSpend("");
              setNote("");
            }}
          >
            Add this Provide
          </button>
      {msg && <p className="text-sm text-[var(--danger)]">{msg}</p>}
    </fieldset>
  );
}

async function saveStagedProvides(
  staged: StagedProvide[],
  ownerType: "profile" | "person",
  personId: number | null,
): Promise<void> {
  for (const s of staged) {
    await api.addProvide({
      ownerType,
      personId,
      category: s.category,
      title: s.title,
      maxSpendCents: parseBudgetToCents(s.maxSpend),
      note: s.note,
    });
  }
}

// The Want/Need fields — the mirror of ProvideFields (Erin's
// direction, 2026-11-02): the FIRST box is the same category
// scroll-down as Provide's — the same PROVIDE_CATEGORIES list,
// the same "Pick a category…" dropdown — then what is wanted /
// needed, occasion and price note. Every Want/Need editor (Join,
// Add someone, Edit member, Profile Edit) renders this first,
// and the Want/Need section itself sits ABOVE the Provide
// section in each of those forms.
function WantFields({
  prefix,
  category,
  setCategory,
  title,
  setTitle,
  occasion,
  setOccasion,
  priceNote,
  setPriceNote,
}: {
  prefix: string;
  category: string;
  setCategory: (v: string) => void;
  title: string;
  setTitle: (v: string) => void;
  occasion: string;
  setOccasion: (v: string) => void;
  priceNote: string;
  setPriceNote: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls} htmlFor={`${prefix}-want-category`}>
          Category — what kind of want / need is this?
        </label>
        <select
          id={`${prefix}-want-category`}
          className={inputCls}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Pick a category…</option>
          {PROVIDE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls} htmlFor={`${prefix}-want-title`}>
          What is wanted / needed?
        </label>
        <input
          id={`${prefix}-want-title`}
          className={inputCls}
          value={title}
          maxLength={120}
          placeholder="e.g. Learn to surf — a surfing lesson"
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div>
        <label className={labelCls} htmlFor={`${prefix}-want-occasion`}>
          Occasion (optional)
        </label>
        <input
          id={`${prefix}-want-occasion`}
          className={inputCls}
          value={occasion}
          maxLength={80}
          placeholder="e.g. First date, Birthday"
          onChange={(e) => setOccasion(e.target.value)}
        />
      </div>
      <div>
        <label className={labelCls} htmlFor={`${prefix}-want-price`}>
          Price note (optional)
        </label>
        <input
          id={`${prefix}-want-price`}
          className={inputCls}
          value={priceNote}
          maxLength={80}
          placeholder="e.g. about $50"
          onChange={(e) => setPriceNote(e.target.value)}
        />
      </div>
    </div>
  );
}

// Staged editor for a member's Want/Need list, in the same forms
// that stage Provides (Join, Add someone): entries are held
// locally and saved as that member's OWN Want entries (their
// scored List items) right after the person is created, so
// nobody ends up Provide-only. Wants are never saved as gift
// entries — Desires / Gifts are a separate store (2026-11-04).
// It sits ABOVE the Provide editor in those forms.
function StagedWantEditor({
  staged,
  setStaged,
  prefix,
  label,
}: {
  staged: StagedWant[];
  setStaged: (v: StagedWant[]) => void;
  prefix: string;
  label: string;
}) {
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [occasion, setOccasion] = useState("");
  const [priceNote, setPriceNote] = useState("");
  const [msg, setMsg] = useState("");
  return (
    <fieldset className="space-y-3 rounded-3xl border border-[var(--border)] p-3">
      <legend className="px-1 text-sm font-bold text-[var(--text)]">{label}</legend>
      {staged.length > 0 && (
        <ul className="space-y-1.5">
          {staged.map((s, i) => (
            <li
              key={`${s.title}-${i}`}
              className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--surface-alt)] px-3 py-2"
            >
              <span className="text-sm text-[var(--text)]">
                <span className="font-semibold">{s.category || "Other"}</span>
                {" — "}
                {s.title}
                {s.occasion && <span className="text-[var(--dim)]"> · {s.occasion}</span>}
                {s.priceNote && <span className="text-[var(--dim)]"> · {s.priceNote}</span>}
              </span>
              <button
                type="button"
                className="shrink-0 text-sm font-semibold text-[var(--danger)]"
                aria-label={`Remove staged want ${s.title}`}
                onClick={() => setStaged(staged.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {staged.length >= 3 && (
        <p className="text-sm font-semibold text-[var(--dim)]">
          Full · 3 max — Wants and Provides are capped at 3 each, independently.
        </p>
      )}
          <WantFields
            prefix={prefix}
            category={category}
            setCategory={setCategory}
            title={title}
            setTitle={setTitle}
            occasion={occasion}
            setOccasion={setOccasion}
            priceNote={priceNote}
            setPriceNote={setPriceNote}
          />
          <button
            type="button"
            className={btnGhost}
            disabled={staged.length >= 3 || !title.trim() || !category}
            onClick={() => {
              const wErr = wordingErrorFor(category, title, occasion, priceNote);
              if (wErr) {
                setMsg(wErr);
                return;
              }
              setMsg("");
              setStaged([
                ...staged,
                {
                  category,
                  title: title.trim(),
                  occasion: occasion.trim(),
                  priceNote: priceNote.trim(),
                },
              ]);
              setCategory("");
              setTitle("");
              setOccasion("");
              setPriceNote("");
            }}
          >
            Add this Want
          </button>
      {msg && <p className="text-sm text-[var(--danger)]">{msg}</p>}
    </fieldset>
  );
}

async function saveStagedWants(
  staged: StagedWant[],
  personId: number,
): Promise<void> {
  for (const s of staged) {
    // A new member's Wants are THEIR OWN scored List items
    // (kind "must", tied to them) — never gift entries:
    // Desires / Gifts are a separate store from Wants
    // (2026-11-04 separation).
    await api.addListItem({
      kind: "must",
      text: s.title,
      category: s.category,
      personId,
      occasion: s.occasion,
      priceNote: s.priceNote,
      link: "",
    });
  }
}

// Saved-Wants editor for a member who already exists (their Edit
// form): lists that member's OWN Want/Need entries — their scored
// List items tied to them (person.wants), NOT their Desires /
// Gifts (2026-11-04 separation: Desires are the gift-kind rows,
// a different store, and are never Wants). Add and remove take
// effect right away. It sits ABOVE the Provide editor in the
// Edit form, and its first box is the same category dropdown as
// Provide's, so both sides can always be filled the same way.
function MemberWantEditor({ person }: { person: Person }) {
  const invalidate = useInvalidate();
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [occasion, setOccasion] = useState("");
  const [priceNote, setPriceNote] = useState("");
  const [msg, setMsg] = useState("");
  const mine = person.wants;
  const add = useMutation({
    mutationFn: () =>
      api.addListItem({
        kind: "must",
        text: title,
        category,
        personId: person.id,
        occasion,
        priceNote,
        link: "",
      }),
    onSuccess: () => {
      setCategory("");
      setTitle("");
      setOccasion("");
      setPriceNote("");
      setMsg("Added ✓");
      invalidate();
    },
    onError: (e) => setMsg(errText(e, "Couldn't add that — try again.")),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.deleteListItem({ id }),
    onSuccess: invalidate,
  });
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-bold text-[var(--text)]">
        What {person.name} wants / needs
      </h4>
      <p className="text-xs text-[var(--dim)]">
        Their Wants only — Desires / Gifts are a separate list,
        never Wants.
      </p>
      {mine.length === 0 ? (
        <p className="text-sm text-[var(--dim)]">
          No wants listed yet — add what {person.name} wants or needs, so a
          Provide can cover it.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {mine.map((w) => (
            <li
              key={w.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--surface-alt)] px-3 py-2"
            >
              <span className="text-sm text-[var(--text)]">
                <span className="font-semibold">{w.category || "Other"}</span>
                {" — "}
                {w.text}
                {w.occasion && <span className="text-[var(--dim)]"> · {w.occasion}</span>}
                {w.priceNote && <span className="text-[var(--dim)]"> · {w.priceNote}</span>}
              </span>
              <button
                type="button"
                className="shrink-0 text-sm font-semibold text-[var(--danger)]"
                aria-label={`Remove want ${w.text}`}
                onClick={() => remove.mutate(w.id)}
                disabled={remove.isPending}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {mine.length >= 3 && (
        <p className="text-sm font-semibold text-[var(--dim)]">
          Full · 3 max — Wants and Provides are capped at 3 each, independently.
        </p>
      )}
          <WantFields
            prefix={`edit-${person.id}`}
            category={category}
            setCategory={setCategory}
            title={title}
            setTitle={setTitle}
            occasion={occasion}
            setOccasion={setOccasion}
            priceNote={priceNote}
            setPriceNote={setPriceNote}
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              className={btnGhost}
              disabled={mine.length >= 3 || add.isPending || !title.trim() || !category}
              onClick={() => {
                const wErr = wordingErrorFor(category, title, occasion, priceNote);
                if (wErr) {
                  setMsg(wErr);
                  return;
                }
                setMsg("");
                add.mutate();
              }}
            >
              Add to the Want list
            </button>
            {msg && <span className="text-sm font-semibold text-[var(--text)]">{msg}</span>}
          </div>
    </div>
  );
}

// Saved-Desires editor for a member (their Edit form): lists
// THAT member's own Desires / Gifts only — the gift-kind List
// entries tied to them — with add and remove taking effect
// right away. Desires are a SEPARATE store from Wants
// (2026-11-04): this editor writes gift entries, the Want
// editor above writes their scored Want entries, and the two
// are never mixed. Nobody else's desires are listed here.
function MemberDesireEditor({
  person,
  gifts,
}: {
  person: Person;
  gifts: Gift[];
}) {
  const invalidate = useInvalidate();
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [occasion, setOccasion] = useState("");
  const [priceNote, setPriceNote] = useState("");
  const [msg, setMsg] = useState("");
  const mine = gifts.filter((g) => g.personId === person.id);
  const add = useMutation({
    mutationFn: () =>
      api.addListItem({
        kind: "gift",
        text: title,
        category,
        personId: person.id,
        occasion,
        priceNote,
        link: "",
        giftStatus: "idea",
      }),
    onSuccess: () => {
      setCategory("");
      setTitle("");
      setOccasion("");
      setPriceNote("");
      setMsg("Added ✓");
      invalidate();
    },
    onError: (e) => setMsg(errText(e, "Couldn't add that — try again.")),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.deleteGift({ id }),
    onSuccess: invalidate,
  });
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-bold text-[var(--text)]">
        🎁 {person.name}&apos;s Desires / Gifts
      </h4>

      {mine.length === 0 ? (
        <p className="text-sm text-[var(--dim)]">
          No desires listed yet.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {mine.map((g) => (
            <li
              key={g.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--surface-alt)] px-3 py-2"
            >
              <span className="text-sm text-[var(--text)]">
                <span className="font-semibold">{g.category || "Other"}</span>
                {" — "}
                {g.title}
                {g.occasion && <span className="text-[var(--dim)]"> · {g.occasion}</span>}
                {g.priceNote && <span className="text-[var(--dim)]"> · {g.priceNote}</span>}
              </span>
              <button
                type="button"
                className="shrink-0 text-sm font-semibold text-[var(--danger)]"
                aria-label={`Remove desire ${g.title}`}
                onClick={() => remove.mutate(g.id)}
                disabled={remove.isPending}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {mine.length >= 3 && (
        <p className="text-sm font-semibold text-[var(--dim)]">
          Full · 3 max.
        </p>
      )}
      <WantFields
        prefix={`edit-desires-${person.id}`}
        category={category}
        setCategory={setCategory}
        title={title}
        setTitle={setTitle}
        occasion={occasion}
        setOccasion={setOccasion}
        priceNote={priceNote}
        setPriceNote={setPriceNote}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          className={btnGhost}
          disabled={mine.length >= 3 || add.isPending || !title.trim() || !category}
          onClick={() => {
            const wErr = wordingErrorFor(category, title, occasion, priceNote);
            if (wErr) {
              setMsg(wErr);
              return;
            }
            setMsg("");
            add.mutate();
          }}
        >
          Add a desire
        </button>
        {msg && <span className="text-sm font-semibold text-[var(--text)]">{msg}</span>}
      </div>
    </div>
  );
}

// The two-sided match box on a member card: their cover for my
// Needs, and my cover for their wishlist — budgets shown. Every
// Provide shows on the card — nothing is sealed anywhere (the
// wishlist unlock paywall is killed until later, 2026-11-02).
function ProvideMatchBox({ person }: { person: Person }) {
  if (
    person.provides.length === 0 &&
    person.coverCount === 0 &&
    person.coveredByMeCount === 0
  ) {
    return null;
  }
  const shownProvides = person.provides;
  return (
    <div className="mt-3 rounded-3xl bg-[var(--surface-alt)] p-3">
      <h4 className="text-sm font-bold text-[var(--text)]">
        What they can do for you
      </h4>
      {person.provides.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--dim)]">
            What {person.name} can provide
          </p>
          <ul className="mt-1 space-y-1">
            {shownProvides.map((p) => (
              <li key={p.id} className="text-sm text-[var(--text)]">
                <span className="font-semibold">{p.category || "Other"}</span>
                {" — "}
                {provideLine(p)}
                {p.note && <span className="text-[var(--dim)]"> · {p.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {person.coverCount > 0 ? (
        <div className="mt-2">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--dim)]">
            Covers your Wants
          </p>
          <ul className="mt-1 space-y-1">
            {person.needCovers.map((c) => (
              <li key={`${c.listItemId}-${c.provideId}`} className="text-sm text-[var(--text)]">
                ✓ <span className="font-semibold">{c.needText}</span> — covered by{" "}
                {c.provideTitle}
                {c.maxSpendCents !== null && c.maxSpendCents > 0
                  ? `, up to ${fmtBudget(c.maxSpendCents)}`
                  : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        person.provides.length > 0 && (
          <p className="mt-2 text-sm text-[var(--dim)]">
            Nothing lines up with your List yet.
          </p>
        )
      )}
      {person.coveredByMeCount > 0 && (
        <div className="mt-2">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--dim)]">
            You cover for {person.name}
          </p>
          <ul className="mt-1 space-y-1">
            {person.coveredByMe.map((c) => (
              <li key={`${c.giftId}-${c.provideId}`} className="text-sm text-[var(--text)]">
                ✓ Their wishlist: <span className="font-semibold">{c.giftTitle}</span>{" "}
                — you cover it with {c.provideTitle}
                {c.maxSpendCents !== null && c.maxSpendCents > 0
                  ? `, up to ${fmtBudget(c.maxSpendCents)}`
                  : ""}
                {c.budgetFit === true && " · within your budget"}
                {c.budgetFit === false && " · above your stated max"}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function fuzzyMatchText(itemText: string, qualities: string[]): boolean {
  const item = itemText.trim().toLowerCase();
  if (!item) return false;
  return qualities.some((q) => {
    const qn = q.trim().toLowerCase();
    return qn !== "" && (qn === item || qn.includes(item) || item.includes(qn));
  });
}

// ---------- a proposed date: the List item IS the date idea ----------

// ---------- safety check-in (on a confirmed date card) ----------
//
// The timed check-in for a confirmed meetup: pick a length, it runs
// quietly, then ends automatically. The date is told it is on —
// starting posts a notice in their Chat thread, ending early posts
// an "all good" note — so it is transparent, never secret tracking.
// No live location is shared; it is a timer only. It sits with the
// app's other safety features (block / report in Help → Safety).

function SafetyCheckinPanel({
  date,
  checkins,
}: {
  date: DateIdea;
  checkins: SafetyCheckin[];
}) {
  const invalidate = useInvalidate();
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState(120);
  const [err, setErr] = useState("");
  const [, setTick] = useState(0);
  const active = checkins.find((c) => c.status === "active") ?? null;
  const past = checkins.filter((c) => c.status !== "active");
  const latestPast = past[past.length - 1] ?? null;

  // Keep the "ends at / time left" line honest while it runs.
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, [active]);

  const start = useMutation({
    mutationFn: () =>
      api.startSafetyCheckin({ dateId: date.id, durationMinutes: minutes }),
    onSuccess: () => {
      setErr("");
      setOpen(false);
      invalidate();
    },
    onError: (e) =>
      setErr(errText(e, "Couldn't start the check-in — try again.")),
  });
  const end = useMutation({
    mutationFn: (id: number) => api.endSafetyCheckin({ id }),
    onSuccess: () => {
      setErr("");
      invalidate();
    },
    onError: (e) =>
      setErr(errText(e, "Couldn't end the check-in — try again.")),
  });

  if (active) {
    return (
      <div className="mt-2 rounded-2xl bg-[var(--surface-alt)] p-3">
        <p className="text-sm font-bold text-[var(--text)]">
          🛡 On · ends {fmtDateTime(active.endsAt)} ({timeLeft(active.endsAt)})
        </p>
        <button
          type="button"
          className={`${btnPrimary} mt-2`}
          onClick={() => end.mutate(active.id)}
          disabled={end.isPending}
          aria-label={`End the safety check-in for ${date.ideaText} with ${date.personName} early`}
        >
          {end.isPending ? "Ending…" : "End early"}
        </button>
        {err && (
          <p className="mt-1 text-sm text-[var(--danger)]" role="alert">
            {err}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2">
      {!open ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={btnGhost}
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-label={`Start a safety check-in for ${date.ideaText} with ${date.personName}`}
          >
            🛡 Safety check-in
          </button>
          {latestPast && (
            <span className="text-xs text-[var(--dim)]">
              Last one: {safetyDurationLabel(latestPast.durationMinutes)} ·{" "}
              {latestPast.status === "ended_early"
                ? "ended early"
                : "ended on its own"}
            </span>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-[var(--surface-alt)] p-3">
          <p className="text-sm font-bold text-[var(--text)]">
            🛡 Safety check-in
          </p>
          <div
            className="mt-2 flex flex-wrap gap-2"
            role="radiogroup"
            aria-label="Check-in length"
          >
            {SAFETY_CHECKIN_OPTIONS.map((o) => (
              <button
                key={o.minutes}
                type="button"
                role="radio"
                aria-checked={minutes === o.minutes}
                className={
                  minutes === o.minutes
                    ? "rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[#fffaf0]"
                    : btnGhost
                }
                onClick={() => setMinutes(o.minutes)}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={btnPrimary}
              onClick={() => start.mutate()}
              disabled={start.isPending}
            >
              {start.isPending ? "Starting…" : "Start check-in"}
            </button>
            <button
              type="button"
              className={btnGhost}
              onClick={() => setOpen(false)}
              disabled={start.isPending}
            >
              Not now
            </button>
          </div>
          {err && (
            <p className="mt-1 text-sm text-[var(--danger)]" role="alert">
              {err}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- mark date completed ----------
//
// The last step of the flow: Match on List -> Accept match ->
// Arrange a real List date -> Mark date completed. One big,
// readable button on every ACCEPTED date (DateCard in Dates and
// on member cards, and the date box at the top of its Chat
// thread). Tapping it records the completion time server-side,
// the card shows "✓ Completed" with that time, and a short note
// lands in the member's Chat thread. No voice check, no camera
// check, no proof photo, no location tracking — just a tap.
// A completed date shows the undo button instead, so a mistaken
// tap can be marked not completed again.

function DateCompletionControl({ date }: { date: DateIdea }) {
  const invalidate = useInvalidate();
  const setCompleted = useMutation({
    mutationFn: (completed: boolean) =>
      api.setDateCompleted({ id: date.id, completed }),
    onSuccess: invalidate,
  });

  if (date.status !== "accepted") return null;

  if (date.completedAt) {
    return (
      <div className="mt-2 rounded-3xl border-2 border-[var(--pink-accent)] bg-[var(--surface-alt)] px-4 py-3">
        <p className="text-lg font-bold text-[var(--text)]" role="status">
          ✓ Completed
        </p>
        <p className="mt-0.5 text-base font-semibold text-[var(--text)]">
          Completed {fmtDateTime(date.completedAt)}
        </p>
        <div className="mt-2">
          <button
            type="button"
            className={btnUndoComplete}
            onClick={() => setCompleted.mutate(false)}
            disabled={setCompleted.isPending}
            aria-label={`Mark the date ${date.ideaText} with ${date.personName} not completed`}
          >
            {setCompleted.isPending
              ? "Undoing…"
              : "Mark not completed"}
          </button>
        </div>
        {setCompleted.isError && (
          <p className="mt-1 text-sm text-[var(--danger)]" role="alert">
            Couldn&apos;t undo that — try again.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        className={btnComplete}
        onClick={() => setCompleted.mutate(true)}
        disabled={setCompleted.isPending}
        aria-label={`Mark the date ${date.ideaText} with ${date.personName} completed`}
      >
        {setCompleted.isPending ? "Marking…" : "✓ Mark date completed"}
      </button>
      {setCompleted.isError && (
        <p className="mt-1 text-sm text-[var(--danger)]" role="alert">
          Couldn&apos;t mark that completed — try again.
        </p>
      )}
    </div>
  );
}

// ---------- generated date plan: hibiscus, picture & spot map ----------
//
// A small, elegant red hibiscus — Hawai'i's flower, in the island
// red of the app's coral token with a gold stamen and one pink
// leaf (pink replaced every green accent on 2026-11-02, at Erin's
// direction — the pink arrow colour she likes). It is a drawn
// motif, not a photo, and it stays small (under 40px) so the
// plan text keeps the stage at 45+ sizes. Gold / sand / white /
// pink around it match the deep ocean palette; the flower
// itself stays red, the leaf carries the pink accent.
function HibiscusAccent({ size = 38 }: { size?: number }) {
  const petals = [0, 72, 144, 216, 288];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
      className="shrink-0 drop-shadow-[0_2px_5px_rgba(101,78,32,0.45)]"
    >
      <path
        d="M11 39 C4 35 2.5 26 7 20.5 C12.5 23.5 14.5 30 13.5 36.5 C13 39.5 12 39.8 11 39 Z"
        fill="#fdb9de"
      />
      {petals.map((a) => (
        <path
          key={a}
          d="M24 25.5 C17.5 16.5 18.5 7.5 24 5.5 C29.5 7.5 30.5 16.5 24 25.5 Z"
          fill="#cf2233"
          stroke="#8f1226"
          strokeWidth="0.8"
          transform={`rotate(${a} 24 24)`}
        />
      ))}
      <circle cx="24" cy="24" r="3.1" fill="#a3122a" />
      <path
        d="M24.5 23.5 C28 19 31 16 35.5 13.5"
        fill="none"
        stroke="#e6d3a1"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="35.5" cy="13.5" r="2" fill="#e6d3a1" />
      <circle cx="32.8" cy="16.6" r="1.35" fill="#e6d3a1" />
    </svg>
  );
}

// The generated date view: Meta AI's plan (or the List-based plan)
// on the upgraded island surface, with the red hibiscus, the
// plan's picture — actual photographs of the real location /
// stores when the app has them (labelled "Actual photo"), a
// generated image only as the labelled fallback — and a
// small map pinning ONLY the planned spot — reusing the shared
// O'ahu map component in its "date" kind (the map stays for date
// plans even while Hype itself is killed until later). Coordinates
// come only from the app's spot list (spotCoords /
// findSpotInText): a spot with no real coordinates shows as text
// only, never a fake pin, and nothing here is live GPS. The
// picture is optional — the plan text shows fully without it.
function DatePlanPanel({
  date,
  spotBlocked = false,
  spotBlockReason = "",
  personPhotoUrl,
}: {
  date: DateIdea;
  // 21+ gate: this date's saved spot is a bar / exotic / alcohol
  // venue and the pair is not both 21+, so the spot is not pinned
  // or shown as this date's spot — a non-bar spot is offered
  // instead. The plan text itself is untouched.
  spotBlocked?: boolean;
  spotBlockReason?: string;
  // The other person's first profile photo (2026-11-03, Erin):
  // shown at the top of the plan, next to their name, in
  // addition to — never replacing — the actual location photos
  // below. Undefined / empty when that person has no profile
  // photo yet (e.g. Leilani): then no person photo is shown and
  // the plan renders exactly as before.
  personPhotoUrl?: string;
}) {
  const invalidate = useInvalidate();
  const [planErr, setPlanErr] = useState("");
  const planMut = useMutation({
    mutationFn: () => api.generateDatePlan({ dateId: date.id }),
    onSuccess: () => {
      setPlanErr("");
      invalidate();
    },
    onError: () => setPlanErr("Couldn't write the date plan — try again."),
  });
  const hasPlan = date.plan.trim() !== "";
  // Real-location check on the pin (2026-11-03): a Lululemon /
  // Sephora shopping plan is pinned ONLY at its verified
  // locations — Waikiki / Kalakaua Avenue or Ala Moana Center.
  // A saved spot like Hale'iwa (where neither store exists) is
  // never pinned for that plan; the checked spot named in the
  // plan itself wins.
  const isShoppingPlan = /lululemon|sephora/i.test(
    `${date.ideaText} ${date.plan}`,
  );
  const verifiedShoppingSpots = new Set([
    "Kalakaua Avenue — Waikiki",
    "Ala Moana Center",
    "Waikiki",
  ]);
  const spotFromDate =
    !spotBlocked && date.spot.trim() && spotCoords(date.spot)
      ? date.spot.trim()
      : null;
  const planSpot = findSpotInText(date.plan);
  const pinnedSpot = isShoppingPlan
    ? planSpot && verifiedShoppingSpots.has(planSpot)
      ? planSpot
      : spotFromDate && verifiedShoppingSpots.has(spotFromDate)
        ? spotFromDate
        : null
    : (spotFromDate ??
      (planSpot && !(spotBlocked && is21PlusSpot(planSpot)) ? planSpot : null));
  const textOnlySpot =
    !pinnedSpot &&
    date.spot.trim() &&
    !spotBlocked &&
    !(isShoppingPlan && !verifiedShoppingSpots.has(date.spot.trim()))
      ? date.spot.trim()
      : null;
  // Mall directory (2026-11-03, Erin): a plan that names
  // Lululemon at Ala Moana Center (Koa's date) also shows where
  // the store sits inside the mall — floor, wing and neighbours
  // from the directory — under the actual photos.
  const showAlaMoanaLuluDirectory =
    /lululemon/i.test(`${date.ideaText} ${date.plan}`) &&
    /ala moana/i.test(`${date.ideaText} ${date.plan}`);
  // Haleiwa Beach Park info (2026-11-03, Erin): a plan that
  // names Haleiwa Beach Park (Leilani's Yoga date) also shows
  // the park's full name, operator and address under its
  // actual photos.
  const showHaleiwaBeachParkInfo =
    /haleiwa beach park/i.test(`${date.ideaText} ${date.plan} ${date.spot}`);
  return (
    <section
      aria-label={`Date plan for ${date.ideaText} with ${date.personName}`}
      className="date-plan-surface mt-3 rounded-[28px] p-4"
    >
      <div className="mb-3 flex items-center gap-3">
        {personPhotoUrl ? (
          <Avatar
            name={date.personName}
            photoUrl={personPhotoUrl}
            size="lg"
          />
        ) : null}
        <p className="min-w-0 truncate text-lg font-bold leading-snug text-[var(--text)]">
          {date.personName}
        </p>
      </div>
      <div className="flex items-center gap-2.5">
        <HibiscusAccent />
        <h4 className="text-base font-bold text-[var(--text)]">
          ✦ Your date plan
        </h4>
        {hasPlan && (
          <span className="ml-auto shrink-0 rounded-full bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--dim)]">
            {date.planSource === "meta-ai"
              ? "Written by Meta AI"
              : "Written from your List"}
          </span>
        )}
      </div>
      {hasPlan ? (
        <>
          <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed text-[var(--text)]">
            {date.plan}
          </p>
          {date.planImageSource === "actual" &&
          date.planPhotoKeys.length > 0 ? (
            <div className="mt-3 space-y-3">
              {date.planPhotoKeys.map((key) => {
                const photo = ACTUAL_PLAN_PHOTOS[key];
                if (!photo) return null;
                return (
                  <figure key={key} className="relative">
                    <img
                      src={photo.src}
                      alt={`Actual photo — ${photo.caption}`}
                      className="aspect-[4/3] w-full rounded-3xl object-cover ring-1 ring-[var(--gold)]"
                    />
                    <span className="absolute left-3 top-3 rounded-full bg-[var(--pink-accent)] px-2.5 py-1 text-xs font-bold text-[var(--accent-ink)]">
                      📷 Actual photo
                    </span>
                    <figcaption className="mt-1.5 text-sm font-semibold text-[var(--text)]">
                      Actual photo — {photo.caption}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          ) : date.planImageUrl ? (
            <figure className="relative mt-3">
              <img
                src={date.planImageUrl}
                alt={`Generated image for this date plan${pinnedSpot ? ` — ${pinnedSpot}` : ` — ${date.ideaText}`}`}
                className="aspect-[4/3] w-full rounded-3xl object-cover ring-1 ring-[var(--gold)]"
              />
              <span className="absolute left-3 top-3 rounded-full bg-[var(--surface)] px-2.5 py-1 text-xs font-bold text-[var(--text)]">
                ✦ Generated image
              </span>
              <figcaption className="mt-1.5 text-sm font-semibold text-[var(--text)]">
                Generated image — an illustration, not a photo of the
                actual place. No actual photo of this spot is in the
                app yet, so a generated one stands in.
              </figcaption>
            </figure>
          ) : null}
          {showAlaMoanaLuluDirectory ? (
            <div
              className="mt-3 rounded-2xl bg-[var(--surface)] px-3 py-2.5 ring-1 ring-[var(--border)]"
              aria-label="Mall directory — Lululemon at Ala Moana Center"
            >
              <p className="text-sm font-bold text-[var(--text)]">
                🧭 Mall directory — Lululemon
              </p>
              <p className="mt-0.5 text-sm font-semibold text-[var(--text)]">
                {ALA_MOANA_LULULEMON_DIRECTORY.where}
              </p>
              <p className="text-sm text-[var(--dim)]">
                {ALA_MOANA_LULULEMON_DIRECTORY.address} ·{" "}
                {ALA_MOANA_LULULEMON_DIRECTORY.phone}
              </p>
            </div>
          ) : null}
          {showHaleiwaBeachParkInfo ? (
            <div
              className="mt-3 rounded-2xl bg-[var(--surface)] px-3 py-2.5 ring-1 ring-[var(--border)]"
              aria-label="Park — Haleiwa Beach Park"
            >
              <p className="text-sm font-bold text-[var(--text)]">
                🧭 Park — {HALEIWA_BEACH_PARK_INFO.name}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-[var(--text)]">
                {HALEIWA_BEACH_PARK_INFO.note}
              </p>
              <p className="text-sm text-[var(--dim)]">
                {HALEIWA_BEACH_PARK_INFO.address} ·{" "}
                {HALEIWA_BEACH_PARK_INFO.operator}
              </p>
            </div>
          ) : null}
          {pinnedSpot ? (
            <div className="mt-3">
              <OahuHypeMap
                entries={[{ spot: pinnedSpot, who: "This date", kind: "date" }]}
                title="Where you'll meet"
                height={180}
              />
            </div>
          ) : textOnlySpot ? (
            <p className="mt-2 text-sm font-semibold text-[var(--text)]">
              📍 {textOnlySpot}
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-1 text-sm text-[var(--dim)]">
          No plan yet — push Plan the date and the plan writes itself
          automatically with your saved Meta AI key. No extra steps.
        </p>
      )}
      {planMut.isPending && (
        <p
          className="mt-2 text-sm font-semibold text-[var(--text)]"
          role="status"
        >
          Using your saved Meta AI key — writing your date plan and its photo…
        </p>
      )}
      {spotBlocked && (
        <div className="mt-3 rounded-2xl bg-[var(--surface)] px-3 py-2">
          <p className="text-sm font-bold text-[var(--text)]">
            {AGE_21_MESSAGE}
          </p>
          <p className="mt-0.5 text-xs text-[var(--dim)]">
            This date&apos;s saved spot is a bar, exotic place or
            alcohol venue, and {spotBlockReason || "both people need to be 21 or older"},
            so it isn&apos;t shown as this date&apos;s spot. A non-bar
            spot to use instead: {NON_BAR_ALTERNATIVE_SPOTS.join(", ")}.
            Refreshing the plan writes it around a non-bar spot.
          </p>
        </div>
      )}
      <button
        type="button"
        className={`${btnGhost} mt-3`}
        onClick={() => planMut.mutate()}
        disabled={planMut.isPending}
        aria-label={`Write the date plan for ${date.ideaText} with ${date.personName}`}
      >
        {planMut.isPending
          ? "Writing your date plan…"
          : hasPlan
            ? "Refresh date plan"
            : "✦ Plan the date"}
      </button>
      {planErr && (
        <p className="mt-1 text-sm text-[var(--danger)]" role="alert">
          {planErr}
        </p>
      )}
    </section>
  );
}

// A date card is the date — the List item, the person, the day +
// time — plus its generated date plan (DatePlanPanel above). No
// "proposed by" line, no spot/note recap. How dates work lives
// in Help.
function DateCard({
  date,
  showPerson = false,
  onMessage,
  checkins = [],
  myAge = null,
  personAge = null,
  personPhotoUrl,
  gifts = [],
}: {
  date: DateIdea;
  myName: string;
  showPerson?: boolean;
  onMessage?: (personId: number) => void;
  checkins?: SafetyCheckin[];
  // The full Desires store (gift-kind List entries): the date
  // card shows this person's desires and your own General
  // desires together (Erin's direction, 2026-11-04).
  gifts?: Gift[];
  // Ages for the 21+ spot gate on this date's saved spot. When
  // either age is missing the caller passes null and the gate
  // treats it as unknown — never 21.
  myAge?: number | null;
  personAge?: number | null;
  // The other person's first profile photo, forwarded to the
  // date plan so it shows at the top of the plan next to their
  // name. Undefined when they have no photo yet.
  personPhotoUrl?: string;
}) {
  const invalidate = useInvalidate();
  const respond = useMutation({
    mutationFn: (response: "accepted" | "declined") =>
      api.respondDate({ id: date.id, response }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: () => api.deleteDate({ id: date.id }),
    onSuccess: invalidate,
  });
  const spotBlocked =
    is21PlusSpot(date.spot) && !bothAges21Plus(myAge, personAge);
  const spotBlockReason = spotBlocked
    ? age21BlockReason(myAge, personAge, date.personName)
    : "";
  const isCompleted = date.status === "accepted" && date.completedAt !== null;
  const badgeCls = isCompleted
    ? "bg-[var(--pink-accent)] text-[var(--accent-ink)]"
    : date.status === "accepted"
      ? "bg-[var(--pink-accent)] text-[var(--accent-ink)]"
      : date.status === "proposed"
        ? "bg-[var(--gold)] text-white"
        : "bg-[var(--surface-alt)] text-[var(--dim)]";
  return (
    <article className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-bold leading-snug text-[var(--text)]">
            ✦ {date.ideaText}
          </p>
          {showPerson && (
            <p className="mt-0.5 text-base text-[var(--text)]">
              {date.personName}
            </p>
          )}
          <p className="mt-0.5 text-base font-semibold text-[var(--text)]">
            ◷ {date.meetAt ? fmtDateTime(date.meetAt) : "No time set"}
          </p>
          {date.status === "accepted" && !isCompleted && (
            <p className="mt-0.5 text-base font-bold text-[var(--pink-light)]">
              Deal
              {date.spot && !spotBlocked ? ` · 📍 ${date.spot}` : ""}
            </p>
          )}
          {isCompleted && date.completedAt && (
            <p className="mt-0.5 text-base font-bold text-[var(--pink-light)]">
              ✓ Completed {fmtDateTime(date.completedAt)}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${badgeCls}`}
        >
          {isCompleted ? "✓ Completed" : DATE_STATUS_LABELS[date.status]}
        </span>
      </div>
      {(date.plan.trim() !== "" || date.status !== "declined") && (
        <DatePlanPanel
          date={date}
          spotBlocked={spotBlocked}
          spotBlockReason={spotBlockReason}
          personPhotoUrl={personPhotoUrl}
        />
      )}
      {/* Desires show with the date too (Erin's direction,
          2026-11-04): theirs and yours, on the date card —
          never on a profile preview, never scored. */}
      <DesiresWithPerson
        gifts={gifts}
        personId={date.personId}
        personName={date.personName}
      />
      <DateCompletionControl date={date} />
      {date.status === "accepted" && (
        <SafetyCheckinPanel date={date} checkins={checkins} />
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {date.status === "accepted" && onMessage && (
          <button
            type="button"
            className={btnPrimary}
            onClick={() => onMessage(date.personId)}
            aria-label={`Chat with ${date.personName}`}
          >
            ✉ Chat
          </button>
        )}
        {date.status === "proposed" &&
          (date.direction === "in" ? (
            <>
              <button
                type="button"
                className={btnPrimary}
                onClick={() => respond.mutate("accepted")}
                disabled={respond.isPending}
                aria-label={`Deal — set the date ${date.ideaText} with ${date.personName}`}
              >
                Deal
              </button>
              <button
                type="button"
                className={btnGhost}
                onClick={() => respond.mutate("declined")}
                disabled={respond.isPending}
                aria-label={`Decline the date ${date.ideaText} with ${date.personName}`}
              >
                Decline
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={btnPrimary}
                onClick={() => respond.mutate("accepted")}
                disabled={respond.isPending}
                aria-label={`Deal — ${date.personName} said yes to ${date.ideaText}`}
              >
                Deal
              </button>
              <button
                type="button"
                className={btnGhost}
                onClick={() => respond.mutate("declined")}
                disabled={respond.isPending}
                aria-label={`${date.personName} passed on ${date.ideaText}`}
              >
                Passed
              </button>
            </>
          ))}
        <button
          type="button"
          className={btnGhost}
          onClick={() => remove.mutate()}
          disabled={remove.isPending}
          aria-label={`Remove date ${date.ideaText} with ${date.personName}`}
        >
          Remove
        </button>
      </div>
    </article>
  );
}

// ---------- match decision: Deal / decline ----------
//
// Matching is NOT instant choosing (2026-11-02). Every match card
// carries these two big controls: Deal keeps the match (marked
// Deal — Erin's direction: accepting a member is a Deal, never
// "Accept"; the stored decision value stays "accepted" — no
// date is forced, but the Deal DOES open Chat with that person
// right away, even before a date is planned — Deal-only Chat
// rule, 2026-11-04), Decline
// removes the person from Matches and from matching with the
// user's profile. Declining never deletes or blocks them: the
// Matches tab keeps a "Declined" list at the bottom where anyone
// can be brought back with one tap.

function MatchDecisionControls({
  person,
  onPlanDate,
  planPending = false,
}: {
  person: Person;
  // Plan the date (2026-11-03, Erin's direction): this button now
  // runs the whole flow by itself — it creates the date from the
  // List item that lines up and writes its plan automatically
  // with the saved Meta AI key (server-side only), with a
  // generating state while it runs. No manual key entry, no
  // separate plan-writing tap, no extra confirmation.
  // Making a Deal on a match starts no date by itself (it does
  // open Chat with that person right away) — this button is only
  // offered inside the Deal box, as the next step.
  onPlanDate?: () => void;
  // True while the automatic date + plan generation is running,
  // so the button shows its generating state.
  planPending?: boolean;
}) {
  const invalidate = useInvalidate();
  const [confirmingDecline, setConfirmingDecline] = useState(false);
  const decide = useMutation({
    mutationFn: (decision: "none" | "accepted" | "declined") =>
      api.setMatchDecision({ personId: person.id, decision }),
    onSuccess: () => {
      setConfirmingDecline(false);
      invalidate();
    },
  });

  if (person.blocked) return null;

  if (person.matchDecision === "declined") {
    return (
      <div className="mt-3 rounded-3xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3">
        <p className="text-base font-bold text-[var(--text)]" role="status">
          ✕ You declined this match
        </p>
        <p className="mt-0.5 text-sm text-[var(--dim)]">
          {person.name} is out of your Matches and no longer matches with
          you. Nothing was deleted.
        </p>
        <div className="mt-2">
          <button
            type="button"
            className={btnAccept}
            onClick={() => decide.mutate("none")}
            disabled={decide.isPending}
            aria-label={`Bring ${person.name} back into my Matches`}
          >
            Bring back to Matches
          </button>
        </div>
        {decide.isError && (
          <p className="mt-1 text-sm text-[var(--danger)]" role="alert">
            Couldn&apos;t save that — try again.
          </p>
        )}
      </div>
    );
  }

  if (person.matchDecision === "accepted") {
    return (
      <div className="mt-3 rounded-3xl border-2 border-[var(--pink-accent)] bg-[var(--surface-alt)] px-4 py-3">
        <p className="text-base font-bold text-[var(--text)]" role="status">
          ✦ Deal — you and {person.name}
        </p>
        <p className="mt-0.5 text-sm text-[var(--dim)]">
          Changed your mind? You can still take them out of your Matches.
        </p>
        {!confirmingDecline ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {onPlanDate && (
              <button
                type="button"
                className={btnPrimary}
                onClick={onPlanDate}
                disabled={planPending}
                aria-label={`Plan the date with ${person.name} — creates the date and writes its plan automatically with your saved Meta AI key`}
              >
                {planPending
                  ? "Writing your date plan…"
                  : "✦ Plan the date"}
              </button>
            )}
            <button
              type="button"
              className={btnDecline}
              onClick={() => setConfirmingDecline(true)}
              aria-label={`Decline ${person.name} and remove them from my Matches`}
            >
              ✕ Decline — remove from Matches
            </button>
            <button
              type="button"
              className={btnGhost}
              onClick={() => decide.mutate("none")}
              disabled={decide.isPending}
              aria-label={`Undo the Deal with ${person.name}`}
            >
              Undo Deal
            </button>
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            <p className="text-base font-semibold text-[var(--text)]">
              Remove {person.name} from your Matches? They stop matching
              with you. Nothing is deleted — you can bring them back from
              the Declined list at the bottom of Matches.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={btnDecline}
                onClick={() => decide.mutate("declined")}
                disabled={decide.isPending}
                aria-label={`Yes, remove ${person.name} from my Matches`}
              >
                {decide.isPending ? "Removing…" : "Yes — remove them"}
              </button>
              <button
                type="button"
                className={btnGhost}
                onClick={() => setConfirmingDecline(false)}
              >
                Keep the match
              </button>
            </div>
          </div>
        )}
        {decide.isError && (
          <p className="mt-1 text-sm text-[var(--danger)]" role="alert">
            Couldn&apos;t save that — try again.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3">
      {!confirmingDecline ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={btnAccept}
            onClick={() => decide.mutate("accepted")}
            disabled={decide.isPending}
            aria-label={`Deal — make a Deal with ${person.name}`}
          >
            Deal
          </button>
          <button
            type="button"
            className={btnDecline}
            onClick={() => setConfirmingDecline(true)}
            aria-label={`Decline ${person.name} and remove them from my Matches`}
          >
            ✕ Decline
          </button>
        </div>
      ) : (
        <div className="space-y-2 rounded-3xl border-2 border-[var(--danger)] bg-[var(--surface-alt)] px-4 py-3">
          <p className="text-base font-semibold text-[var(--text)]">
            Remove {person.name} from your Matches? They stop matching
            with you — even if their List still lines up with yours.
            Nothing is deleted and no date or chat starts. You can bring
            them back any time from the Declined list at the bottom of
            Matches.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnDecline}
              onClick={() => decide.mutate("declined")}
              disabled={decide.isPending}
              aria-label={`Yes, remove ${person.name} from my Matches`}
            >
              {decide.isPending ? "Removing…" : "Yes — remove them"}
            </button>
            <button
              type="button"
              className={btnGhost}
              onClick={() => setConfirmingDecline(false)}
            >
              Keep them
            </button>
          </div>
        </div>
      )}
      {decide.isError && (
        <p className="mt-1 text-sm text-[var(--danger)]" role="alert">
          Couldn&apos;t save that — try again.
        </p>
      )}
    </div>
  );
}

// ---------- person card with safety + detail ----------

function PersonCard({
  person,
  listItems,
  gifts,
  dates,
  checkins = [],
  myQualities,
  myName,
  myAge = null,
  myAvailableTimes,
  onEdit,
  onMessage,
  onOpenPlace,
  defaultOpen = false,
  startArranging = false,
  autoPlanStamp = 0,
  desiresOnlyTheirs = false,
}: {
  person: Person;
  listItems: ListItem[];
  gifts: Gift[];
  dates: DateIdea[];
  checkins?: SafetyCheckin[];
  myQualities: string[];
  myName: string;
  // The user's own age, for the 21+ date-spot gate: a bar /
  // exotic / alcohol spot is only offered for a date with this
  // person when BOTH ages are 21+ (unknown age = not 21 here).
  myAge?: number | null;
  myAvailableTimes: string;
  onEdit: (p: Person) => void;
  onMessage: (p: Person) => void;
  onOpenPlace?: (p: Person) => void;
  defaultOpen?: boolean;
  startArranging?: boolean;
  // When this stamp changes to a new non-zero value, the card
  // runs Plan the date automatically once (used by the match
  // bubbles' Plan the date button, which mounts this card).
  autoPlanStamp?: number;
  // True only when this card is embedded on the member's own
  // profile page: there the desires box shows ONLY that
  // member's desires — nobody else's desires are included in
  // their profile (Erin's direction, 2026-11-04).
  desiresOnlyTheirs?: boolean;
}) {
  const invalidate = useInvalidate();
  const [open, setOpen] = useState(defaultOpen);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState(REPORT_REASONS[0] ?? "Other");
  const [note, setNote] = useState("");
  const [reportErr, setReportErr] = useState("");
  const [arranging, setArranging] = useState(startArranging);
  const [direction, setDirection] = useState<DateDirection>("out");
  const [ideaId, setIdeaId] = useState("");
  const [dateDay, setDateDay] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [dateSpot, setDateSpot] = useState("");
  const [dateNote, setDateNote] = useState("");
  const [dateMsg, setDateMsg] = useState("");
  // Plan the date, automatically (2026-11-03): one push creates
  // the date AND writes its plan with the saved Meta AI key —
  // `planning` drives the generating state, `planStatus` is the
  // status line shown while it runs and when the plan is ready,
  // and `plannedDateId` lets the card scroll to the finished
  // plan once the refreshed state lands.
  const [planning, setPlanning] = useState(false);
  const [planStatus, setPlanStatus] = useState("");
  const [plannedDateId, setPlannedDateId] = useState<number | null>(null);
  const plannerRef = useRef<HTMLDivElement | null>(null);
  const datesRef = useRef<HTMLDivElement | null>(null);

  const block = useMutation({
    mutationFn: (blocked: boolean) => api.setBlocked({ personId: person.id, blocked }),
    onSuccess: invalidate,
  });
  const report = useMutation({
    mutationFn: () =>
      api.reportPerson({ personId: person.id, reason, note }),
    onSuccess: () => {
      setReporting(false);
      invalidate();
    },
  });
  const check = useMutation({
    mutationFn: (args: { listItemId: number; present: boolean }) =>
      api.setPersonCheck({ personId: person.id, ...args }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: () => api.deletePerson({ id: person.id }),
    onSuccess: invalidate,
  });
  // The old propose-then-separately-write-the-plan flow is gone:
  // creating a date and generating its plan are now ONE action —
  // createDateAndPlan below (defined once the date ideas are
  // computed) chains proposeDate straight into generateDatePlan,
  // which uses the saved Meta AI key server-side only.
  const [noteErr, setNoteErr] = useState("");
  const noteMut = useMutation({
    mutationFn: () => api.generateMatchNote({ personId: person.id }),
    onSuccess: () => {
      setNoteErr("");
      invalidate();
    },
    onError: () => setNoteErr("Couldn't write the match note — try again."),
  });

  const checkMap = new Map(person.checks.map((c) => [c.listItemId, c.present]));
  const fuzzyPresent = (item: ListItem): boolean =>
    fuzzyMatchText(item.text, person.qualities);
  const presentOf = (item: ListItem): boolean =>
    checkMap.get(item.id) ?? fuzzyPresent(item);

  const ideaItems = listItems.filter((i) => i.kind === "must" || i.kind === "nice");
  // Date ideas (planner fix, 2026-11-02): trait matches AND Provide
  // covers, both ways. A cover is offered as a cover — labelled with
  // the Provide that covers it — never as if it were a trait the
  // person has:
  // - their Provide covering one of my scored List items (Koa's
  //   Lululemon cover) is a date idea even when nothing is checked
  //   for that item;
  // - my Provide covering a want on their wishlist (my Surfing
  //   lesson, up to $50, covering Alex's learn-to-surf want) is a
  //   date idea too — its option id is that wishlist entry's id.
  // Covers show in both directions: whoever proposes, a covered
  // item is a real thing the two of you can go and do.
  type PlannerIdea = { id: number; label: string };
  const ideas: PlannerIdea[] = [];
  const seenIdeaIds = new Set<number>();
  const pushIdea = (id: number, label: string) => {
    if (seenIdeaIds.has(id)) return;
    seenIdeaIds.add(id);
    ideas.push({ id, label });
  };
  const traitItems =
    direction === "out"
      ? ideaItems.filter((i) => presentOf(i))
      : ideaItems.filter((i) => fuzzyMatchText(i.text, myQualities));
  for (const i of traitItems) pushIdea(i.id, `${i.text}`);
  for (const c of person.needCovers) {
    const item = ideaItems.find((i) => i.id === c.listItemId);
    if (!item) continue;
    const budget = fmtBudget(c.maxSpendCents);
    pushIdea(
      item.id,
      `${item.text} — ${person.name} covers this: ${c.provideTitle}${budget ? ` (up to ${budget})` : ""}`,
    );
  }
  for (const c of person.coveredByMe) {
    const budget = fmtBudget(c.maxSpendCents);
    pushIdea(
      c.giftId,
      `${c.giftTitle} — ${person.name}'s want, you cover this: ${c.provideTitle}${budget ? ` (up to ${budget})` : ""}`,
    );
  }

  // ---------- Plan the date — automatic (2026-11-03) ----------
  //
  // Erin's direction: pushing Plan the Date activates the saved
  // Meta AI key by itself — no manual key entry, no separate
  // plan-writing tap, no extra confirmation. One push:
  // pick the List item that lines up (a Provide cover first —
  // that is the match — then any other date idea), create the
  // date, and immediately generate its plan with the saved key
  // (generateDatePlan reads the key server-side only; the key
  // never reaches the client). A status line narrates the run
  // and the finished plan shows on the date below. If a date for
  // that item already exists, no duplicate is created: its plan
  // is generated (or, if it already has one, simply shown). If
  // nothing lines up yet, the push is not a dead end — a plain
  // reason shows instead.
  const pickAutoIdeaId = (): number | null => {
    const cover = person.needCovers[0];
    if (cover) return cover.listItemId;
    const mine = person.coveredByMe[0];
    if (mine) return mine.giftId;
    const first = ideas[0];
    return first ? first.id : null;
  };

  const readyStatus = (source: "meta-ai" | "list", hasImage?: boolean) =>
    source === "meta-ai"
      ? `✓ Date plan ready — written by Meta AI with your saved key${hasImage ? ", with its photo" : ""}. It's on the date below.`
      : "✓ Date plan ready — written from your List. It's on the date below.";

  const createDateAndPlan = async (args: {
    direction: DateDirection;
    listItemId: number;
    meetAt: string | null;
    spot: string;
    note: string;
  }): Promise<boolean> => {
    setPlanStatus(
      "Using your saved Meta AI key — creating your date and writing its plan… no extra steps.",
    );
    try {
      const created = await api.proposeDate({
        personId: person.id,
        direction: args.direction,
        listItemId: args.listItemId,
        meetAt: args.meetAt,
        spot: args.spot,
        note: args.note,
      });
      setPlannedDateId(created.id);
      setPlanStatus(
        "Date created — writing your date plan and its photo with your saved Meta AI key…",
      );
      const planRes = await api.generateDatePlan({ dateId: created.id });
      setPlanStatus(readyStatus(planRes.source, !!planRes.imageUrl || planRes.imageSource === "actual"));
      invalidate();
      return true;
    } catch (e) {
      setPlanStatus("");
      setDateMsg(errText(e, "Couldn't plan that date — try again."));
      return false;
    }
  };

  const runAutoPlan = async () => {
    if (planning) return;
    setDateMsg("");
    plannerRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    const chosenId = pickAutoIdeaId();
    if (chosenId === null) {
      // No ideas is not a dead end: say plainly why, and what
      // would make a plan possible.
      setPlanStatus(
        `No date to plan yet — nothing lines up with ${person.name} yet: no Provide cover either way and nothing checked on the List. Add a Provide that covers a List item, or check one under “Check against my List”, and Plan the date will write the plan automatically.`,
      );
      return;
    }
    if (!person.canContact) {
      setPlanStatus(
        `Can't plan this date yet — chat is closed for ${person.name}, so a date can't be proposed to them.`,
      );
      return;
    }
    const existing = dates.find(
      (d) => d.listItemId === chosenId && d.status !== "declined",
    );
    // Already fully ready only when the date has BOTH its plan
    // and its photo — a plan without a photo still gets its one
    // generateDatePlan call, so a push always ends with the plan
    // and the photo (the server reuses the current plan and only
    // makes the missing picture).
    if (
      existing &&
      existing.plan.trim() !== "" &&
      (existing.planImageUrl ||
        (existing.planImageSource === "actual" &&
          existing.planPhotoKeys.length > 0))
    ) {
      setPlannedDateId(existing.id);
      setPlanStatus("✓ Date plan already ready — it's on the date below.");
      return;
    }
    setPlanning(true);
    try {
      if (existing) {
        setPlannedDateId(existing.id);
        setPlanStatus(
          "Using your saved Meta AI key — writing your date plan and its photo… no extra steps.",
        );
        const planRes = await api.generateDatePlan({
          dateId: existing.id,
        });
        setPlanStatus(readyStatus(planRes.source, !!planRes.imageUrl || planRes.imageSource === "actual"));
        invalidate();
      } else {
        await createDateAndPlan({
          direction: "out",
          listItemId: chosenId,
          meetAt: null,
          spot: "",
          note: "",
        });
      }
    } catch (e) {
      setPlanStatus(errText(e, "Couldn't plan that date — try again."));
    } finally {
      setPlanning(false);
    }
  };

  // The manual planner form's submit is the same one-push flow:
  // it creates the date with the picked item / day / time / spot
  // and generates the plan straight away — no second tap.
  const submitPlannerForm = async () => {
    if (planning || !ideaId) return;
    setPlanning(true);
    try {
      const ok = await createDateAndPlan({
        direction,
        listItemId: Number(ideaId),
        meetAt:
          dateDay && dateTime
            ? new Date(`${dateDay}T${dateTime}`).toISOString()
            : null,
        spot: dateSpot,
        note: dateNote,
      });
      if (ok) {
        setArranging(false);
        setIdeaId("");
        setDateDay("");
        setDateTime("");
        setDateSpot("");
        setDateNote("");
      }
    } finally {
      setPlanning(false);
    }
  };

  // Scroll to the planner when it opens, and to the finished
  // plan once the refreshed state shows it.
  useEffect(() => {
    if (arranging) {
      plannerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [arranging]);

  useEffect(() => {
    if (plannedDateId === null) return;
    const planned = dates.find((d) => d.id === plannedDateId);
    if (planned && planned.plan.trim() !== "") {
      datesRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [dates, plannedDateId]);

  // Match bubbles: their Plan the date button mounts this card
  // with a fresh stamp — run the automatic flow once per stamp.
  const lastAutoStampRef = useRef(0);
  useEffect(() => {
    if (!autoPlanStamp) return;
    if (lastAutoStampRef.current === autoPlanStamp) return;
    lastAutoStampRef.current = autoPlanStamp;
    void runAutoPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlanStamp]);

  // The one simple story of this card, in one line: the actual
  // List item that lines up — what they cover or what they match.
  // No reasoning paragraph on the card; the long match note lives
  // behind "Check against my List" with the rest of the details.
  const matchReason = matchReasonFor(person, listItems);

  return (
    <article className="surface-3d rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-4">
      <PhotoGallery photos={person.photos} name={person.name} />
      <div className="flex items-start gap-3">
        <Avatar name={person.name} photoUrl={person.photos[0]?.url} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-[var(--text)]">
              {person.name}
              {person.age !== null && (
                <span className="font-semibold text-[var(--dim)]">, {person.age}</span>
              )}
            </h3>
            {person.source === "joined" && (
              <span className="rounded-full bg-[var(--pink)] px-2 py-0.5 text-xs font-bold text-black">
                Joined Discover
              </span>
            )}
            <MatchStatusBadge person={person} />
            {person.matchDecision === "accepted" && (
              <span className="rounded-full bg-[var(--pink-accent)] px-2.5 py-1 text-xs font-bold text-[var(--accent-ink)]">
                ✦ Deal
              </span>
            )}
            {person.location.trim() && (
              <span className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-xs font-semibold text-[var(--text)]">
                ⌖ {person.location}
              </span>
            )}
            {person.availableTimes.trim() && (
              <span className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-xs font-semibold text-[var(--text)]">
                ◷ Available {person.availableTimes}
              </span>
            )}
            {person.promoCode && (
              <span className="rounded-full bg-[var(--gold)] px-2.5 py-1 text-xs font-bold text-white">
                Promo {person.promoCode}
              </span>
            )}
          </div>
          {person.bio && (
            <div className="mt-2 rounded-2xl bg-[var(--surface-alt)] px-3 py-2">
              <p className="text-xs font-bold text-[var(--dim)]">About</p>
              <p className="whitespace-pre-wrap font-display text-base leading-snug text-[var(--text)]">
                {person.bio}
              </p>
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <MatchBadge percent={person.matchPercent} />
            {person.coverCount > 0 && (
              <span className="rounded-full bg-[var(--gold)] px-2.5 py-1 text-xs font-bold text-white">
                Covers {person.coverCount} of your Wants
                {person.coverBudgetCents > 0 &&
                  ` · up to ${fmtBudget(person.coverBudgetCents)}`}
              </span>
            )}
            {person.coveredByMeCount > 0 && (
              <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs font-bold text-[#fffaf0]">
                You cover {person.coveredByMeCount} for them
              </span>
            )}
          </div>
          {person.spot && (
            <p className="mt-2 text-sm text-[var(--dim)]">Usually around: {publicSpotLabel(person.spot)}</p>
          )}
        </div>
      </div>

      {listItems.length > 0 && (
        <div className="mt-3 rounded-3xl bg-[var(--surface-alt)] px-4 py-3">
          <p className="text-xs font-bold text-[var(--dim)]">
            Why you match
          </p>
          <p className="mt-0.5 font-display text-lg leading-snug text-[var(--pink-light)]">
            ✦ {matchReason}
          </p>
        </div>
      )}

      <MatchDecisionControls
        person={person}
        onPlanDate={() => void runAutoPlan()}
        planPending={planning}
      />

      {planStatus && !arranging && (
        <p
          className="mt-3 rounded-2xl bg-[var(--surface-alt)] px-3 py-2 text-sm font-semibold text-[var(--text)]"
          role="status"
        >
          {planStatus}
        </p>
      )}

      <div className="mt-3">
        <DealbreakerWarning hits={person.dealbreakersHit} name={person.name} />
      </div>

      {/* Desires pop up with the match (Erin's direction,
          2026-11-04): this person's desires and your own
          General desires, together on the match card — never
          on a profile preview, never scored. On the member's
          own profile page (desiresOnlyTheirs) only THEIR
          desires show — nobody else's are included there. */}
      <DesiresWithPerson
        gifts={gifts}
        personId={person.id}
        personName={person.name}
        onlyTheirs={desiresOnlyTheirs}
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={btnGhost}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide details" : "Check against my List"}
        </button>
        {/* No Chat button on this card (Erin's direction,
            2026-11-04): this card renders on the Matches /
            Discover side — Chat lives only in the Chat section,
            and it opens once a Deal is hit. No "Chat closed"
            text here either. Existing chats and dates are
            untouched. */}
        {person.blocked && (
          <span className="self-center text-xs font-medium text-[var(--dim)]">
            Blocked
          </span>
        )}
        {onOpenPlace && (
          <button
            type="button"
            className={btnGhost}
            onClick={() => onOpenPlace(person)}
            aria-label={`Open ${person.name}'s page — everything in one place`}
          >
            One place ›
          </button>
        )}
        <button type="button" className={btnGhost} onClick={() => onEdit(person)}>
          Edit
        </button>
        {!person.blocked && (
          <button
            type="button"
            className={btnGhost}
            aria-expanded={arranging}
            onClick={() => setArranging((v) => !v)}
          >
            {arranging ? "Close date planner" : "✦ Plan a date from the List"}
          </button>
        )}
      </div>
      {arranging && !person.blocked && (
        <div ref={plannerRef} className="scroll-mt-32">
        <form
          className="mt-3 space-y-3 rounded-3xl bg-[var(--surface-alt)] p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const wErr = wordingErrorFor(dateNote);
            if (wErr) {
              setDateMsg(wErr);
              return;
            }
            // 21+ gate (client mirror of the server rule): a bar,
            // exotic or alcohol spot can never be proposed for a
            // pair that is not both 21+ — unknown age counts as
            // not 21, and no age is ever guessed.
            if (
              is21PlusSpot(dateSpot) &&
              !bothAges21Plus(myAge, person.age)
            ) {
              setDateMsg(
                `${AGE_21_MESSAGE} — ${age21BlockReason(myAge, person.age, person.name)}. Try a non-bar spot instead: ${NON_BAR_ALTERNATIVE_SPOT}.`,
              );
              return;
            }
            setDateMsg("");
            void submitPlannerForm();
          }}
        >
          <p className="font-display text-base text-[var(--text)]">
            ✦ First date
          </p>
          <p className="text-sm text-[var(--dim)]">
            Plan the date and its plan is written automatically with
            your saved Meta AI key — no extra steps.
          </p>
          <div>
            <span className={labelCls}>Who&apos;s asking?</span>
            <div className="flex gap-2">
              <button
                type="button"
                aria-pressed={direction === "out"}
                className={
                  direction === "out"
                    ? "rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[#fffaf0]"
                    : btnGhost
                }
                onClick={() => {
                  setDirection("out");
                  setIdeaId("");
                }}
              >
                Me → {person.name}
              </button>
              <button
                type="button"
                aria-pressed={direction === "in"}
                className={
                  direction === "in"
                    ? "rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[#fffaf0]"
                    : btnGhost
                }
                onClick={() => {
                  setDirection("in");
                  setIdeaId("");
                }}
              >
                {person.name} → me
              </button>
            </div>
          </div>
          {direction === "out" && !person.canContact && (
            <p className="text-sm font-medium text-[var(--danger)]">
              Chat closed for {person.name}.
            </p>
          )}
          {ideas.length === 0 ? (
            <p className="text-sm text-[var(--dim)]">
              {direction === "out"
                ? `Nothing checked or covered yet — use “Check against my List”, or add a Provide that covers a List item.`
                : "No date idea yet — nothing you fulfill, and no Provide cover either way."}
            </p>
          ) : (
            <>
              <div>
                <label
                  className={labelCls}
                  htmlFor={`date-idea-${person.id}`}
                >
                  List item
                </label>
                <select
                  id={`date-idea-${person.id}`}
                  className={inputCls}
                  value={ideaId}
                  onChange={(e) => setIdeaId(e.target.value)}
                  required
                >
                  <option value="">Pick a List item…</option>
                  {ideas.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.label}
                    </option>
                  ))}
                </select>
              </div>
              {(person.availableTimes.trim() || myAvailableTimes.trim()) && (
                <div className="flex flex-wrap gap-1.5">
                  {person.availableTimes.trim() && (
                    <span className="rounded-full bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--text)]">
                      ◷ {person.name}: {person.availableTimes}
                    </span>
                  )}
                  {myAvailableTimes.trim() && (
                    <span className="rounded-full bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--text)]">
                      ◷ You: {myAvailableTimes}
                    </span>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    className={labelCls}
                    htmlFor={`date-day-${person.id}`}
                  >
                    Day
                  </label>
                  <input
                    id={`date-day-${person.id}`}
                    type="date"
                    className={inputCls}
                    value={dateDay}
                    onChange={(e) => setDateDay(e.target.value)}
                  />
                </div>
                <div>
                  <label
                    className={labelCls}
                    htmlFor={`date-time-${person.id}`}
                  >
                    Time
                  </label>
                  <input
                    id={`date-time-${person.id}`}
                    type="time"
                    className={inputCls}
                    value={dateTime}
                    onChange={(e) => setDateTime(e.target.value)}
                  />
                </div>
              </div>
              {((dateDay && !dateTime) || (!dateDay && dateTime)) && (
                <p className="text-xs text-[var(--dim)]">Day + time, both.</p>
              )}
              <div>
                <label
                  className={labelCls}
                  htmlFor={`date-spot-${person.id}`}
                >
                  Where (optional)
                </label>
                <SpotSelect
                  id={`date-spot-${person.id}`}
                  value={dateSpot}
                  onChange={setDateSpot}
                  firstOptionLabel="Decide together"
                  gate21
                  both21={bothAges21Plus(myAge, person.age)}
                  gateDetail={age21BlockReason(myAge, person.age, person.name)}
                />
              </div>
              <div>
                <label
                  className={labelCls}
                  htmlFor={`date-note-${person.id}`}
                >
                  Note (optional)
                </label>
                <input
                  id={`date-note-${person.id}`}
                  className={inputCls}
                  value={dateNote}
                  maxLength={200}
                  placeholder="e.g. Saturday at the museum, then we choose the present together"
                  onChange={(e) => setDateNote(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className={btnPrimary}
                disabled={
                  planning ||
                  !ideaId ||
                  !dateDay !== !dateTime ||
                  (direction === "out" && !person.canContact)
                }
                aria-label={`Plan the date with ${person.name} — creates the date and writes its plan automatically with your saved Meta AI key`}
              >
                {planning
                  ? "Writing your date plan…"
                  : "✦ Plan the date"}
              </button>
              {!ideaId && (
                <p className="text-sm text-[var(--dim)]">
                  Pick a List item above first — then Plan the date
                  creates the date and writes its plan automatically
                  with your saved Meta AI key. No extra tap after.
                </p>
              )}
              {planStatus && (
                <p
                  className="text-sm font-semibold text-[var(--text)]"
                  role="status"
                >
                  {planStatus}
                </p>
              )}
            </>
          )}
          {dateMsg && <p className="text-sm text-[var(--danger)]">{dateMsg}</p>}
        </form>
        </div>
      )}

      {dates.length > 0 && (
        <div ref={datesRef} className="mt-3 scroll-mt-32 space-y-2">
          <h4 className="text-sm font-bold text-[var(--text)]">
            Dates with {person.name}
          </h4>
          {dates.map((d) => (
            <DateCard
              key={d.id}
              date={d}
              myName={myName}
              myAge={myAge}
              personAge={person.age}
              personPhotoUrl={person.photos[0]?.url}
              gifts={gifts}
              onMessage={() => onMessage(person)}
              checkins={checkins.filter((c) => c.dateId === d.id)}
            />
          ))}
        </div>
      )}

      {open && (
        <div className="mt-4 space-y-4 border-t border-[var(--border)] pt-4">
          {/* The long match note and the full Provide breakdown live
              here, behind the details toggle — the card itself only
              shows the one-line reason. */}
          <div className="rounded-3xl bg-[var(--surface-alt)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-bold text-[var(--text)]">
                ✦ Why you two match
              </h4>
              {person.matchNote && (
                <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-xs font-semibold text-[var(--dim)]">
                  {person.matchNoteSource === "meta-ai"
                    ? "Written by Meta AI"
                    : "Written from your List"}
                </span>
              )}
            </div>
            {person.matchNote ? (
              <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text)]">
                {person.matchNote}
              </p>
            ) : (
              <p className="mt-1 text-sm text-[var(--dim)]">
                No note yet.
              </p>
            )}
            <button
              type="button"
              className={`${btnGhost} mt-2`}
              onClick={() => noteMut.mutate()}
              disabled={noteMut.isPending}
            >
              {noteMut.isPending
                ? "Writing…"
                : person.matchNote
                  ? "Refresh match note"
                  : "✦ Write a match note"}
            </button>
            {noteErr && (
              <p className="mt-1 text-sm text-[var(--danger)]">{noteErr}</p>
            )}
          </div>
          <ProvideMatchBox person={person} />
          {listItems.length === 0 ? (
            <p className="text-sm text-[var(--dim)]">
              Your List is empty — add items in Profile.
            </p>
          ) : (
            <>
              {/* Flat Wants — one list, no Must / Nice sections.
                  The % comes only from the Provide covers marked
                  here; the checkboxes record traits for date
                  ideas and never change the %. */}
              {(() => {
                const wants = listItems.filter(
                  (i) => i.kind === "must" || i.kind === "nice",
                );
                if (wants.length === 0) return null;
                return (
                  <div>
                    <h4 className="text-sm font-bold text-[var(--text)]">
                      Wants
                    </h4>
                    <ul className="mt-1.5 space-y-1.5">
                      {wants.map((item) => {
                        const present = presentOf(item);
                        const cover = person.needCovers.find(
                          (c) => c.listItemId === item.id,
                        );
                        return (
                          <li key={item.id}>
                            <label className="flex items-center gap-2.5 text-sm text-[var(--text)]">
                              <input
                                type="checkbox"
                                className="h-5 w-5 accent-[var(--accent)]"
                                checked={present}
                                aria-label={`${item.text} is true for ${person.name}`}
                                onChange={(e) =>
                                  check.mutate({
                                    listItemId: item.id,
                                    present: e.target.checked,
                                  })
                                }
                              />
                              <span className={present ? "font-semibold" : ""}>
                                {item.text}
                              </span>
                              {cover && (
                                <span className="font-semibold text-[var(--pink-light)]">
                                  · covered by {cover.provideTitle}
                                </span>
                              )}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })()}
              {/* No dealbreaker subsection here, ever: dealbreakers
                  are background only and surface on this card solely
                  as the quiet DealbreakerWarning above, rendered
                  only when one actually clashes (hits.length > 0). */}
            </>
          )}

          <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
            {person.blocked ? (
              <button
                type="button"
                className={btnGhost}
                onClick={() => block.mutate(false)}
                disabled={block.isPending}
              >
                Unblock {person.name}
              </button>
            ) : (
              <button
                type="button"
                className={btnDanger}
                onClick={() => block.mutate(true)}
                disabled={block.isPending}
              >
                Block {person.name}
              </button>
            )}
            <button
              type="button"
              className={btnDanger}
              onClick={() => setReporting((v) => !v)}
              aria-expanded={reporting}
            >
              Report
            </button>
            <button
              type="button"
              className={btnGhost}
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
            >
              Remove
            </button>
          </div>

          {reporting && (
            <div className="space-y-2 rounded-2xl bg-[var(--surface-alt)] p-3">
              <label className={labelCls} htmlFor={`report-reason-${person.id}`}>
                Why are you reporting {person.name}?
              </label>
              <select
                id={`report-reason-${person.id}`}
                className={inputCls}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                {REPORT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <label className={labelCls} htmlFor={`report-note-${person.id}`}>
                Anything else? (optional)
              </label>
              <textarea
                id={`report-note-${person.id}`}
                className={inputCls}
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button
                type="button"
                className={btnDanger}
                onClick={() => {
                  const wErr = wordingErrorFor(note);
                  if (wErr) {
                    setReportErr(wErr);
                    return;
                  }
                  setReportErr("");
                  report.mutate();
                }}
                disabled={report.isPending}
              >
                Send report &amp; block
              </button>
              {reportErr && (
                <p className="text-sm text-[var(--danger)]" role="alert">{reportErr}</p>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// ---------- match bubbles ----------
//
// When you match with somebody, they show up as a little bubble
// with their photo. Tap the bubble and, right away — no hunting, no
// confusion — you see who they are and how you matched: name,
// photo, match %, and the short one-line match reason. There is NO
// Chat button in this view (Erin's direction, 2026-11-04): chat
// opens once a Deal is hit, and lives only in the Chat section. The
// Deal box's Plan the date button opens their card with the date
// planner already open, so the List item that matched becomes the
// date.

function MatchBubble({
  person,
  selected,
  onSelect,
}: {
  person: Person;
  selected: boolean;
  onSelect: () => void;
}) {
  const photoUrl = person.photos[0]?.url;
  const pct =
    person.matchPercent !== null ? `${person.matchPercent}%` : null;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${person.name}${pct ? `, ${pct} match` : ""} — see how you matched${person.dealbreakersHit.length > 0 ? " (dealbreaker warning)" : ""}`}
      className="flex w-[84px] shrink-0 snap-start flex-col items-center gap-1.5 rounded-3xl px-1 py-2 transition active:scale-[0.97]"
    >
      <span
        className={`relative block rounded-full p-[3px] shadow-[0_6px_14px_rgba(101,78,32,0.45)] ${
          selected
            ? "ring-[3px] ring-[var(--pink-accent)]"
            : "ring-2 ring-[var(--border)]"
        }`}
      >
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={`Photo of ${person.name}`}
            className="block h-[76px] w-[76px] rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-[var(--accent)] text-xl font-bold text-[#fffaf0]"
          >
            {initials(person.name)}
          </span>
        )}
        {pct && (
          <span className="absolute -bottom-1 -right-1 rounded-full bg-[var(--pink-accent)] px-2 py-1 text-xs font-bold leading-tight text-[var(--accent-ink)] ring-2 ring-[var(--surface)]">
            {pct}
          </span>
        )}
        {person.dealbreakersHit.length > 0 && (
          <span
            aria-hidden
            className="absolute -left-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--danger-bg)] text-xs font-bold leading-none text-white ring-2 ring-[var(--surface)]"
          >
            !
          </span>
        )}
        {person.unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--danger-bg)] px-1.5 text-xs font-bold leading-none text-white ring-2 ring-[var(--surface)]">
            {person.unreadCount}
          </span>
        )}
      </span>
      <span className="line-clamp-2 min-h-8 w-full text-center text-xs font-semibold leading-tight text-[var(--text)]">
        {person.name}
      </span>
    </button>
  );
}

function MatchBubbles({
  people,
  listItems,
  gifts,
  dates,
  checkins,
  myQualities,
  myName,
  myAge = null,
  myAvailableTimes,
  onEdit,
  onMessage,
  onOpenPerson,
}: {
  people: Person[];
  listItems: ListItem[];
  gifts: Gift[];
  dates: DateIdea[];
  checkins: SafetyCheckin[];
  myQualities: string[];
  myName: string;
  myAge?: number | null;
  myAvailableTimes: string;
  onEdit: (p: Person) => void;
  onMessage: (p: Person) => void;
  onOpenPerson: (personId: number) => void;
}) {
  // Matches first, then Potential — best match at the front.
  const shown = useMemo(() => {
    const rank = (p: Person) =>
      matchStatusFor(p) === "match" ? 0 : 1;
    return [...people].sort(
      (a, b) =>
        rank(a) - rank(b) ||
        (b.matchPercent ?? -1) - (a.matchPercent ?? -1) ||
        b.coverCount - a.coverCount ||
        b.id - a.id,
    );
  }, [people]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [plannerFor, setPlannerFor] = useState<number | null>(null);
  // Plan the date from the bubbles' Deal box runs automatically:
  // a fresh stamp mounts the person's card and tells it to create
  // the date and generate its plan in one push.
  const [autoPlanStamp, setAutoPlanStamp] = useState(0);
  const selected =
    shown.find((p) => p.id === selectedId) ?? shown[0] ?? null;

  if (shown.length === 0 || !selected) return null;
  const reason = matchReasonFor(selected, listItems);
  // With no 50%+ Match in the bubbles, this section is Potential
  // — say so briefly. The hidden-not-deleted explanation for
  // people outside the current mode lives in Help (Matching /
  // pride Same sex section), not on this card.
  const hasMatch = shown.some((p) => matchStatusFor(p) === "match");

  return (
    <section
      aria-label="Your matches — tap a bubble"
      className="surface-3d rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-4"
    >
      <h3 className="font-display text-lg text-[var(--text)]">
        {hasMatch ? "Matches" : "Potential"}
      </h3>
      {!hasMatch && (
        <p className="mt-1 text-sm text-[var(--dim)]">
          No 50%+ match yet.
        </p>
      )}
      <div
        className="-mx-1 mt-2 flex snap-x gap-1 overflow-x-auto px-1 pb-1"
        role="group"
        aria-label="Match bubbles"
      >
        {shown.map((p) => (
          <MatchBubble
            key={p.id}
            person={p}
            selected={p.id === selected.id}
            onSelect={() => {
              setSelectedId(p.id);
              setPlannerFor(null);
              setAutoPlanStamp(0);
            }}
          />
        ))}
      </div>

      <div
        className="mt-2 border-t border-[var(--border)] pt-3"
        aria-live="polite"
      >
        {/* Full gallery, not just the first photo: the big photo
            with every thumbnail under it — tap a thumbnail to
            switch the big photo. */}
        <PhotoGallery
          key={selected.id}
          photos={selected.photos}
          name={selected.name}
        />
        <div className="flex items-start gap-3">
          {selected.photos.length === 0 && (
            <Avatar name={selected.name} size="lg" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-display text-2xl text-[var(--text)]">
                {selected.name}
                {selected.age !== null && (
                  <span className="font-semibold text-[var(--dim)]">
                    , {selected.age}
                  </span>
                )}
              </h4>
              <MatchStatusBadge person={selected} />
              {selected.matchDecision === "accepted" && (
                <span className="rounded-full bg-[var(--pink-accent)] px-2.5 py-1 text-xs font-bold text-[var(--accent-ink)]">
                  ✦ Deal
                </span>
              )}
              <MatchBadge percent={selected.matchPercent} />
            </div>
            <div className="mt-2 rounded-2xl bg-[var(--surface-alt)] px-3 py-2">
              <p className="text-xs font-bold text-[var(--dim)]">
                Why you match
              </p>
              <p className="font-display text-lg leading-snug text-[var(--pink-light)]">
                ✦ {reason}
              </p>
            </div>
            {(selected.location.trim() || selected.availableTimes.trim()) && (
              <p className="mt-1 text-sm text-[var(--dim)]">
                {[
                  selected.location.trim()
                    ? `⌖ ${selected.location}`
                    : "",
                  selected.availableTimes.trim()
                    ? `◷ Available ${selected.availableTimes}`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            {selected.spot.trim() && (
              <p className="mt-1 text-sm text-[var(--dim)]">
                Usually around: {publicSpotLabel(selected.spot)}
              </p>
            )}
          </div>
        </div>

        {/* Their bio shows right here in Matches too (Erin's
            direction, 2026-11-04) — and in full on their profile
            page via Open page. */}
        {selected.bio && (
          <div className="mt-3 rounded-2xl bg-[var(--surface-alt)] px-3 py-2">
            <p className="text-xs font-bold text-[var(--dim)]">About</p>
            <p className="whitespace-pre-wrap font-display text-base leading-snug text-[var(--text)]">
              {selected.bio}
            </p>
          </div>
        )}

        {selected.dealbreakersHit.length > 0 && (
          <div className="mt-3">
            <DealbreakerWarning
              hits={selected.dealbreakersHit}
              name={selected.name}
            />
          </div>
        )}

        <MatchDecisionControls
          person={selected}
          onPlanDate={() => {
            setPlannerFor(selected.id);
            setAutoPlanStamp(Date.now());
          }}
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {/* No Chat button on the Matches side (Erin's direction,
              2026-11-04): chat opens once a Deal is hit — that's
              it. There is no Chat button next to Open page here
              and no chat access from Matches; Chat lives only in
              the Chat section. Existing chats and dates are
              untouched. */}
          <button
            type="button"
            className={btnGhost}
            onClick={() => onOpenPerson(selected.id)}
            aria-label={`Open ${selected.name}'s page — everything in one place`}
          >
            Open page ›
          </button>
          {/* One Plan the date button only (Erin's direction,
              2026-11-04): the "✦ Plan the date" button inside the
              Deal box above is the single planner entry point on
              this card — it mounts the planner below with a fresh
              auto-plan stamp. The duplicate "Date — plan it from
              the List" button that used to sit here is removed. */}
        </div>

        {plannerFor === selected.id && (
          <div className="mt-3">
            <PersonCard
              key={`bubble-planner-${selected.id}`}
              person={selected}
              listItems={listItems}
              gifts={gifts}
              dates={dates.filter((d) => d.personId === selected.id)}
              checkins={checkins}
              myQualities={myQualities}
              myName={myName}
              myAge={myAge}
              myAvailableTimes={myAvailableTimes}
              onEdit={onEdit}
              onMessage={onMessage}
              startArranging
              autoPlanStamp={autoPlanStamp}
            />
          </div>
        )}
      </div>
    </section>
  );
}

// ---------- person edit form ----------

function PersonEditForm({
  person,
  gifts = [],
  onDone,
}: {
  person: Person;
  gifts?: Gift[];
  onDone: () => void;
}) {
  const invalidate = useInvalidate();
  const [name, setName] = useState(person.name);
  const [age, setAge] = useState(person.age !== null ? String(person.age) : "");
  const [bio, setBio] = useState(person.bio);
  const [location, setLocation] = useState(person.location);
  const [availableTimes, setAvailableTimes] = useState(person.availableTimes);
  const [gender, setGender] = useState<Gender>(person.gender);
  const [sameSex, setSameSex] = useState(person.sameSex);
  const [spot, setSpot] = useState(person.spot);
  const [contactPref, setContactPref] = useState<ContactPref>(person.contactPref);
  const [wordErr, setWordErr] = useState("");

  const save = useMutation({
    mutationFn: () =>
      api.updatePerson({
        id: person.id,
        name,
        age: parseAge(age),
        bio,
        location,
        availableTimes,
        gender,
        sameSex,
        // No qualities section any more — matching is the List.
        // Pass the stored value through so saving never wipes it.
        qualities: person.qualities,
        spot,
        contactPref,
        // Hype is killed until later — always saved cleared.
        hypeOn: false,
        hypeSpot: "",
        hypeMode: "",
        hypeNote: "",
        hypePlan: null,
      }),
    onSuccess: () => {
      invalidate();
      onDone();
    },
  });

  return (
    <form
      className="space-y-3 rounded-[28px] border-2 border-[var(--accent)] bg-[var(--surface)] p-4"
      onSubmit={(e) => {
        e.preventDefault();
        // Membership is 18 to 99: a typed age outside the range
        // is refused plainly instead of silently clearing to
        // unknown; a blank age stays unknown.
        if (age.trim() !== "" && parseAge(age) === null) {
          setWordErr(
            "Please enter an age between 18 and 99, or leave age blank if it isn't known.",
          );
          return;
        }
        const wErr = wordingErrorFor(name, bio, location, availableTimes);
        if (wErr) {
          setWordErr(wErr);
          return;
        }
        setWordErr("");
        save.mutate();
      }}
    >
      <h3 className="font-display text-lg text-[var(--text)]">Edit {person.name}</h3>
      <div>
        <label className={labelCls} htmlFor="edit-name">
          Name
        </label>
        <input
          id="edit-name"
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <AgeInput label="Edit age" value={age} onChange={setAge} />
      <GenderFields
        subject="They are"
        gender={gender}
        setGender={setGender}
        sameSex={sameSex}
        setSameSex={setSameSex}
      />
      <div>
        <label className={labelCls} htmlFor="edit-bio">
          Bio
        </label>
        <textarea
          id="edit-bio"
          className={inputCls}
          rows={3}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
      </div>
      <div>
        <label className={labelCls} htmlFor="edit-location">
          Location
        </label>
        <input
          id="edit-location"
          className={inputCls}
          value={location}
          maxLength={120}
          placeholder="e.g. North Shore"
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>
      <div>
        <label className={labelCls} htmlFor="edit-available-times">
          Times available
        </label>
        <input
          id="edit-available-times"
          className={inputCls}
          value={availableTimes}
          maxLength={200}
          placeholder="e.g. Saturday mornings, weekday evenings after 5"
          onChange={(e) => setAvailableTimes(e.target.value)}
        />
      </div>
      <PhotoManager
        photos={person.photos}
        target="person"
        personId={person.id}
        label={`Photos of ${person.name}`}
      />
      <div>
        <label className={labelCls} htmlFor="edit-spot">
          Usually around
        </label>
        <SpotSelect
          id="edit-spot"
          value={spot}
          onChange={setSpot}
          firstOptionLabel="No regular spot"
          subjectAge={parseAge(age)}
        />
      </div>
      <div>
        <span className={labelCls}>Who can contact them</span>
        <ContactSelect
          label="Their contact preference"
          value={contactPref}
          onChange={setContactPref}
        />
      </div>
      <div className="rounded-3xl border border-[var(--border)] p-3">
        <MemberWantEditor person={person} />
        <p className="mt-2 text-xs text-[var(--dim)]">Saves right away.</p>
      </div>
      <div className="rounded-3xl border border-[var(--border)] p-3">
        <ProvideEditor
          ownerType="person"
          personId={person.id}
          provides={person.provides}
          prefix={`edit-${person.id}`}
          heading={`What ${person.name} can provide`}
        />
        <p className="mt-2 text-xs text-[var(--dim)]">Saves right away.</p>
      </div>
      <div className="rounded-3xl border border-[var(--border)] p-3">
        <MemberDesireEditor person={person} gifts={gifts} />
        <p className="mt-2 text-xs text-[var(--dim)]">Saves right away.</p>
      </div>
      <div className="flex gap-2">
        <button type="submit" className={btnPrimary} disabled={save.isPending || !name.trim()}>
          Save changes
        </button>
        <button type="button" className={btnGhost} onClick={onDone}>
          Cancel
        </button>
      </div>
      {wordErr && (
        <p className="text-sm text-[var(--danger)]" role="alert">{wordErr}</p>
      )}
      {save.isError && (
        <p className="text-sm text-[var(--danger)]">{errText(save.error, "Couldn't save — try again.")}</p>
      )}
    </form>
  );
}

function JoinForm({ onJoined }: { onJoined: (joinedName: string) => void }) {
  const invalidate = useInvalidate();
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [availableTimes, setAvailableTimes] = useState("");
  const [gender, setGender] = useState<Gender>("");
  const [sameSex, setSameSex] = useState(false);
  const [spot, setSpot] = useState("");
  const [contactPref, setContactPref] = useState<ContactPref>("matches_only");
  const [promoCode, setPromoCode] = useState("");
  const [staged, setStaged] = useState<StagedPhoto[]>([]);
  const [stagedProvides, setStagedProvides] = useState<StagedProvide[]>([]);
  const [stagedWants, setStagedWants] = useState<StagedWant[]>([]);
  const [ageError, setAgeError] = useState("");
  const [wordErr, setWordErr] = useState("");

  const join = useMutation({
    mutationFn: async () => {
      const parsedAge = parseAge(age);
      if (parsedAge === null) {
        throw new Error("join: age is required — members are 18 to 99");
      }
      const res = await api.joinDiscover({
        name,
        age: parsedAge,
        bio,
        location,
        availableTimes,
        gender,
        sameSex,
        qualities: [],
        spot,
        contactPref,
        // Hype is killed until later — always joined cleared.
        hypeOn: false,
        hypeSpot: "",
        hypeMode: "",
        hypeNote: "",
        hypePlan: null,
        promoCode,
      });
      await uploadStaged(staged, "person", res.id);
      // Wants and Provides each save under their own independent
      // 3 cap — neither side limits the other.
      await saveStagedWants(stagedWants, res.id);
      await saveStagedProvides(stagedProvides, "person", res.id);
      return res;
    },
    onSuccess: () => {
      invalidate();
      onJoined(name.trim());
    },
  });

  return (
    <form
      className="space-y-3 rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (parseAge(age) === null) {
          setAgeError(
            "Please enter your age — members are 18 to 99, and age is required to join.",
          );
          return;
        }
        setAgeError("");
        const wErr = wordingErrorFor(
          name,
          bio,
          location,
          availableTimes,
          stagedProvides.flatMap((s) => [s.title, s.note]),
          stagedWants.flatMap((s) => [s.category, s.title, s.occasion, s.priceNote]),
        );
        if (wErr) {
          setWordErr(wErr);
          return;
        }
        setWordErr("");
        join.mutate();
      }}
    >
      <h3 className="font-display text-lg text-[var(--text)]">Join — create a new profile</h3>
      <p className="text-sm text-[var(--dim)]">
        This is how a new person joins the app: fill this in and it
        creates their profile. They&apos;ll show in Discover as a Match
        or Potential based on the List. No location tracking.
      </p>
      <div>
        <label className={labelCls} htmlFor="join-promo">
          Promo code (if a member shared one with you)
        </label>
        <input
          id="join-promo"
          className={inputCls}
          value={promoCode}
          onChange={(e) => setPromoCode(e.target.value)}
          placeholder="e.g. SECRET-1234"
          autoCapitalize="characters"
          autoComplete="off"
        />
        <p className="mt-1 text-xs text-[var(--dim)]">
          A valid promo code joins you as a member right away — no code, no
          worries, you can still join below.
        </p>
      </div>
      <div>
        <label className={labelCls} htmlFor="join-name">
          Your name
        </label>
        <input
          id="join-name"
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="First name or nickname"
        />
      </div>
      <AgeInput
        label="Join age"
        value={age}
        onChange={(v) => {
          setAge(v);
          setAgeError("");
        }}
        hint="Members are 18 to 99 — your age is required to join."
      />
      {ageError && (
        <p className="text-sm font-semibold text-[var(--danger)]" role="alert">
          {ageError}
        </p>
      )}
      <GenderFields
        subject="I am"
        gender={gender}
        setGender={setGender}
        sameSex={sameSex}
        setSameSex={setSameSex}
      />
      <div>
        <label className={labelCls} htmlFor="join-bio">
          Bio
        </label>
        <textarea
          id="join-bio"
          className={inputCls}
          rows={3}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="What should someone on the List know about you?"
        />
      </div>
      <div>
        <label className={labelCls} htmlFor="join-location">
          Location
        </label>
        <input
          id="join-location"
          className={inputCls}
          value={location}
          maxLength={120}
          placeholder="e.g. North Shore, O'ahu"
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>
      <div>
        <label className={labelCls} htmlFor="join-available-times">
          Times you&apos;re available
        </label>
        <input
          id="join-available-times"
          className={inputCls}
          value={availableTimes}
          maxLength={200}
          placeholder="e.g. Saturday mornings, weekday evenings after 5"
          onChange={(e) => setAvailableTimes(e.target.value)}
        />
        <p className="mt-1 text-xs text-[var(--dim)]">
          Shows on your profile, so a date can be set for a day and a
          time you&apos;re free.
        </p>
      </div>
      <StagedWantEditor
        staged={stagedWants}
        setStaged={setStagedWants}
        prefix="join"
        label="What you want / need"
      />
      <StagedProvideEditor
        staged={stagedProvides}
        setStaged={setStagedProvides}
        prefix="join"
        label="What you can provide"
      />
      <StagedPhotoPicker staged={staged} setStaged={setStaged} label="Your photos" />
      <div>
        <label className={labelCls} htmlFor="join-spot">
          Usually around
        </label>
        <SpotSelect
          id="join-spot"
          value={spot}
          onChange={setSpot}
          firstOptionLabel="No regular spot"
          subjectAge={parseAge(age)}
        />
      </div>
      <div>
        <span className={labelCls}>Who can contact you</span>
        <ContactSelect
          label="Join contact preference"
          value={contactPref}
          onChange={setContactPref}
        />
      </div>
      <button type="submit" className={btnPrimary} disabled={join.isPending || !name.trim()}>
        Join as a member
      </button>
      {wordErr && (
        <p className="text-sm text-[var(--danger)]" role="alert">{wordErr}</p>
      )}
      {join.isError && (
        <p className="text-sm text-[var(--danger)]">
          {errText(
            join.error,
            "Couldn't join — check your age is entered (members are 18 to 99), and if you entered a promo code, check it's still valid, then try again.",
          )}
        </p>
      )}
    </form>
  );
}

// ---------- Discover tab ----------

// Island areas for Discover search/filtering. A person's area is
// worked out from the free-text location they typed (and their
// usual spot) — "North Shore", "Haleiwa" and "Pipeline" all land
// in North Shore, so area filtering works by part of the island,
// not just one broad location word.
const ISLAND_AREAS: { id: string; label: string; keywords: string[] }[] = [
  {
    id: "north-shore",
    label: "North Shore",
    keywords: ["north shore", "haleiwa", "waialua", "sunset beach", "pipeline", "waimea", "turtle bay", "pupukea", "sharks cove", "shark's cove", "ehukai", "mokuleia", "kahuku", "laie", "dillingham"],
  },
  {
    id: "honolulu-waikiki",
    label: "Honolulu & Waikiki",
    keywords: ["honolulu", "waikiki", "ala moana", "downtown", "chinatown", "kakaako", "kaka'ako", "kahala", "diamond head", "manoa", "ward"],
  },
  {
    id: "windward",
    label: "Windward",
    keywords: ["windward", "kailua", "kaneohe", "waimanalo", "lanikai", "kualoa"],
  },
  {
    id: "central",
    label: "Central O'ahu",
    keywords: ["central", "mililani", "wahiawa", "pearl city", "pearlridge", "aiea", "waipahu", "moanalua"],
  },
  {
    id: "leeward",
    label: "Leeward / West",
    keywords: ["leeward", "kapolei", "ewa", "waianae", "ko olina", "makaha", "nanakuli", "maili", "west side"],
  },
  {
    id: "east",
    label: "East O'ahu",
    keywords: ["east oahu", "east o'ahu", "hawaii kai", "maunalua", "sandy beach", "makapuu", "makapu'u", "hanauma", "koko head"],
  },
  {
    id: "other-islands",
    label: "Other Islands",
    keywords: ["maui", "kauai", "big island", "lanai", "molokai", "kona", "hilo", "wailea", "hanalei", "poipu", "lahaina"],
  },
];

function areaOfPerson(person: Person): string | null {
  const hay = `${person.location} ${person.spot}`
    .toLowerCase()
    .replace(/’/g, "'");
  for (const area of ISLAND_AREAS) {
    if (area.keywords.some((k) => hay.includes(k))) return area.id;
  }
  return null;
}

function sortDiscover(people: Person[]): Person[] {
  return [...people].sort((a, b) => {
    // Matches first, then Potential.
    const rank = (p: Person) =>
      matchStatusFor(p) === "match" ? 0 : matchStatusFor(p) === "potential" ? 1 : 2;
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (a.sameSpot !== b.sameSpot) return a.sameSpot ? -1 : 1;
    // Two-sided cover counts in Discover order: a member who can
    // cover your Needs ranks ahead on that alone.
    if (b.coverCount !== a.coverCount) return b.coverCount - a.coverCount;
    const am = a.matchPercent ?? -1;
    const bm = b.matchPercent ?? -1;
    if (bm !== am) return bm - am;
    return b.id - a.id;
  });
}

function DiscoverTab({
  state,
  onMessage,
  onOpenPerson,
}: {
  state: State;
  onMessage: (p: Person) => void;
  onOpenPerson: (personId: number) => void;
}) {
  const [showJoin, setShowJoin] = useState(false);
  const [joinedMsg, setJoinedMsg] = useState("");
  const [editing, setEditing] = useState<Person | null>(null);
  const joinRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (showJoin) {
      joinRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [showJoin]);
  // Search & filters: search runs over everyone on the list (added
  // and joined), not just the Discover pool. Filters: island area
  // (from their typed location), age range, and Match/Potential.
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("");
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "match" | "potential">("all");
  const searching =
    query.trim() !== "" ||
    area !== "" ||
    ageMin.trim() !== "" ||
    ageMax.trim() !== "" ||
    statusFilter !== "all";
  const clearSearch = () => {
    setQuery("");
    setArea("");
    setAgeMin("");
    setAgeMax("");
    setStatusFilter("all");
  };
  const matchesSearch = (person: Person): boolean => {
    if (area && areaOfPerson(person) !== area) return false;
    const min = Number.parseInt(ageMin, 10);
    if (Number.isFinite(min) && (person.age === null || person.age < min)) return false;
    const max = Number.parseInt(ageMax, 10);
    if (Number.isFinite(max) && (person.age === null || person.age > max)) return false;
    if (statusFilter !== "all" && matchStatusFor(person) !== statusFilter) return false;
    const q = query.trim().toLowerCase();
    if (q) {
      const hay = [
        person.name,
        person.bio,
        person.location,
        person.availableTimes,
        person.spot,
        ...person.provides.map((pv) => `${pv.title} ${pv.category}`),
        ...person.needCovers.map((c) => c.needText),
      ]
        .join(" ")
        .toLowerCase();
      if (!q.split(/\s+/).every((token) => hay.includes(token))) return false;
    }
    return true;
  };
  const discover = sortDiscover(
    state.people.filter(
      (p) =>
        !p.blocked &&
        (searching ? matchesSearch(p) : p.source === "joined"),
    ),
  );
  return (
    <div className="space-y-4">
      <ListDifference />
      <div className="flex items-center justify-between gap-3">
        <SectionTitle>Discover</SectionTitle>
        <button
          type="button"
          className={btnPrimary}
          onClick={() => setShowJoin((v) => !v)}
          aria-expanded={showJoin}
          aria-label="Join — create a new profile in the app"
        >
          {showJoin ? "Close" : "Join — create a profile"}
        </button>
      </div>

      <section
        className="space-y-3 rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-4"
        aria-label="Search everyone on the list"
      >
        <div>
          <label className={labelCls} htmlFor="discover-search">
            Search everyone on the list
          </label>
          <input
            id="discover-search"
            className={inputCls}
            value={query}
            placeholder="Name, place, or List item — e.g. North Shore, wipers"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div>
          <span className={labelCls}>Island area</span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by island area">
            {[{ id: "", label: "All areas" }, ...ISLAND_AREAS].map((a) => (
              <button
                key={a.id || "all"}
                type="button"
                aria-pressed={area === a.id}
                onClick={() => setArea(a.id)}
                className={
                  area === a.id
                    ? "rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-bold text-[#fffaf0]"
                    : "rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text)]"
                }
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-24">
            <label className={labelCls} htmlFor="discover-age-min">
              Age from
            </label>
            <input
              id="discover-age-min"
              className={inputCls}
              inputMode="numeric"
              value={ageMin}
              placeholder="18"
              onChange={(e) => setAgeMin(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
            />
          </div>
          <div className="w-24">
            <label className={labelCls} htmlFor="discover-age-max">
              Age to
            </label>
            <input
              id="discover-age-max"
              className={inputCls}
              inputMode="numeric"
              value={ageMax}
              placeholder="Any"
              onChange={(e) => setAgeMax(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
            />
          </div>
          <div>
            <span className={labelCls}>Match</span>
            <div className="flex gap-1.5" role="group" aria-label="Filter by match">
              {(
                [
                  { id: "all", label: "All" },
                  { id: "match", label: "Matches" },
                  { id: "potential", label: "Potential" },
                ] as const
              ).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={statusFilter === o.id}
                  onClick={() => setStatusFilter(o.id)}
                  className={
                    statusFilter === o.id
                      ? "rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-bold text-[#fffaf0]"
                      : "rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text)]"
                  }
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {searching && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold text-[var(--text)]" role="status">
              {discover.length} found
            </p>
            <button
              type="button"
              className={btnGhost}
              onClick={clearSearch}
              aria-label="Clear search and filters"
            >
              Clear search
            </button>
          </div>
        )}
      </section>

      {showJoin && (
        <div ref={joinRef}>
          <JoinForm
            onJoined={(joinedName) => {
              setShowJoin(false);
              setJoinedMsg(
                joinedName
                  ? `${joinedName} joined ✓ — their new profile is in Discover below.`
                  : "Joined ✓ — the new profile is in Discover below.",
              );
            }}
          />
        </div>
      )}

      {joinedMsg && !showJoin && (
        <p
          role="status"
          className="rounded-3xl border border-[var(--gold)] bg-[var(--surface-alt)] px-3 py-2 text-sm font-semibold text-[var(--text)]"
        >
          {joinedMsg}
        </p>
      )}

      <MatchBubbles
        people={discover.filter(
          (p) => p.matchDecision !== "declined" && matchStatusFor(p) !== null,
        )}
        listItems={state.listItems}
        gifts={state.gifts}
        dates={state.dates}
        checkins={state.safetyCheckins}
        myQualities={state.profile.qualities}
        myName={state.profile.name}
        myAge={state.profile.age}
        myAvailableTimes={state.profile.availableTimes}
        onEdit={setEditing}
        onMessage={onMessage}
        onOpenPerson={onOpenPerson}
      />

      {editing && (
        <PersonEditForm person={editing} gifts={state.gifts} onDone={() => setEditing(null)} />
      )}

      {discover.length === 0 ? (
        searching ? (
          <div className="rounded-[28px] border border-dashed border-[var(--border)] bg-[var(--surface)] p-6 text-center">
            <p className="font-display text-lg text-[var(--text)]">Nobody matches that search</p>
            <p className="mt-1 text-sm text-[var(--dim)]">Try clearing it.</p>
            <button
              type="button"
              className={`${btnPrimary} mt-3`}
              onClick={clearSearch}
              aria-label="Clear search and filters from empty results"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="rounded-[28px] border border-dashed border-[var(--border)] bg-[var(--surface)] p-6 text-center">
            <p className="font-display text-lg text-[var(--text)]">No one here yet</p>
            <p className="mt-1 text-sm text-[var(--dim)]">
              Join above to start.
            </p>
          </div>
        )
      ) : (
        <div className="space-y-3">
          {discover.map((p) => (
            <PersonCard
              key={p.id}
              person={p}
              listItems={state.listItems}
              gifts={state.gifts}
              dates={state.dates.filter((d) => d.personId === p.id)}
              checkins={state.safetyCheckins}
              myQualities={state.profile.qualities}
              myName={state.profile.name}
              myAge={state.profile.age}
              myAvailableTimes={state.profile.availableTimes}
              onEdit={setEditing}
              onMessage={onMessage}
              onOpenPlace={(p) => onOpenPerson(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PersonPlace({
  state,
  person,
  focusStamp,
  onBack,
  onOpenPerson,
  onGoMatches,
  onGoChat,
}: {
  state: State;
  person: Person;
  focusStamp: number;
  onBack: () => void;
  onOpenPerson: (personId: number) => void;
  onGoMatches: () => void;
  onGoChat: (personId: number) => void;
}) {
  const [editing, setEditing] = useState<Person | null>(null);
  // The person page stays light (Erin's direction, 2026-11-04):
  // About and their List, read-only — no Chat button, no
  // "Check against my List" button and no embedded full card
  // on this page, for any member. The chat box lives ONLY in
  // the Chat section (reached from the bottom Chat tab), and
  // checking a member against your List lives on their
  // Matches / Discover card.
  const topRef = useRef<HTMLDivElement | null>(null);
  const reason = matchReasonFor(person, state.listItems);

  useEffect(() => {
    topRef.current?.scrollIntoView({ block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person.id, focusStamp]);

  return (
    <div className="space-y-4" ref={topRef}>
      <button type="button" className={btnGhost} onClick={onBack}>
        ← Back
      </button>

      <section
        aria-label={`About ${person.name}`}
        className="surface-3d rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-4"
      >
        {/* Full gallery at the top of the Open page: the big photo
            with every thumbnail under it — tap a thumbnail to
            switch the big photo. Before this, the page showed only
            the small round first photo. */}
        <PhotoGallery
          key={person.id}
          photos={person.photos}
          name={person.name}
        />
        <div className="flex items-start gap-3">
          <Avatar name={person.name} photoUrl={person.photos[0]?.url} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl text-[var(--text)]">
                {person.name}
                {person.age !== null && (
                  <span className="font-semibold text-[var(--dim)]">
                    , {person.age}
                  </span>
                )}
              </h2>
              <MatchStatusBadge person={person} />
              <MatchBadge percent={person.matchPercent} />
            </div>
            {state.listItems.length > 0 && (
              <div className="mt-2 rounded-2xl bg-[var(--surface-alt)] px-3 py-2">
                <p className="text-xs font-bold text-[var(--dim)]">
                  Why you match
                </p>
                <p className="font-display text-lg leading-snug text-[var(--pink-light)]">
                  ✦ {reason}
                </p>
              </div>
            )}
            {(person.location.trim() || person.availableTimes.trim()) && (
              <p className="mt-1 text-sm text-[var(--dim)]">
                {[
                  person.location.trim() ? `⌖ ${person.location}` : "",
                  person.availableTimes.trim()
                    ? `◷ Available ${person.availableTimes}`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            {person.spot.trim() && (
              <p className="mt-1 text-sm text-[var(--dim)]">
                Usually around: {publicSpotLabel(person.spot)}
              </p>
            )}
          </div>
        </div>
        {/* Bio gets its own full-width About box on their profile
            (Erin's direction, 2026-11-04: the bio should at least
            be ON their profile, easy to see — before this it was
            one small line squeezed beside the avatar, and the
            Matches bubble view didn't show it at all). */}
        {person.bio && (
          <div className="mt-3 rounded-2xl bg-[var(--surface-alt)] px-3 py-2">
            <p className="text-xs font-bold text-[var(--dim)]">About</p>
            <p className="whitespace-pre-wrap font-display text-base leading-snug text-[var(--text)]">
              {person.bio}
            </p>
          </div>
        )}
        {person.dealbreakersHit.length > 0 && (
          <div className="mt-3">
            <DealbreakerWarning hits={person.dealbreakersHit} name={person.name} />
          </div>
        )}
        {/* No Chat button on the Open Profile (Erin's direction,
            2026-11-04): chat lives only in the Chat section,
            reached from the bottom Chat tab — this page carries
            no Chat button and no "Chat closed" text, for every
            member (Showcase Alex, Showcase Koa, Showcase
            Leilani, and anyone else). */}
      </section>

      {/* Their List ON their profile (Erin's direction,
          2026-11-04): opening their profile shows distinct,
          read-only parts, and ONLY theirs — the same sections
          in the same order as your own profile template:
          1. What they want — from that member's ACTUAL Wants
             (their own scored List items, person.wants), never
             from their Desires / Gifts. Desires are not Wants /
             Needs: before this fix this part read the gift
             store, so a member's Desires were mislabeled as
             their Wants.
          2. What they can provide — their Provides.
          2b. Covers your Wants — THIS member's covers of YOUR
             Wants (person.needCovers), shown only when they
             actually cover something: covers live with the
             person who covers them, there is no central list,
             and a Want nobody covers is never mentioned.
          3. Their own Desires / Gifts — the gift entries tied
             to THIS member only, under their own heading,
             never labeled as Wants. Nobody else's desires are
             on this page: yours are not mixed in here, and no
             other member's either.
          4. Their own Dealbreakers · background — their
             dealbreaker List items (person.dealbreakers), in
             the same bottom place as on your own template;
             "None set." when they have none.
          Showing it changes nothing — editing stays in their
          Edit, and your own List is never touched from here. */}
      <section
        aria-label={`${person.name}'s List`}
        className="surface-3d rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-4"
      >
        <h3 className="font-display text-lg text-[var(--text)]">
          {person.name}&apos;s List
        </h3>
        <h4 className="mt-3 text-sm font-bold text-[var(--text)]">
          What they want
        </h4>
        {person.wants.length === 0 ? (
          <p className="mt-1 text-sm text-[var(--dim)]">
            No Wants on their List yet.
          </p>
        ) : (
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {person.wants.map((w) => (
              <li
                key={w.id}
                className="rounded-full bg-[var(--surface-alt)] px-3 py-1.5 text-sm font-semibold text-[var(--text)]"
              >
                {w.text}
                {w.category ? ` · ${w.category}` : ""}
                {w.priceNote ? ` · ${w.priceNote}` : ""}
              </li>
            ))}
          </ul>
        )}
        <h4 className="mt-4 text-sm font-bold text-[var(--text)]">
          What they can provide
        </h4>
        {person.provides.length === 0 ? (
          <p className="mt-1 text-sm text-[var(--dim)]">
            Nothing listed yet.
          </p>
        ) : (
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {person.provides.map((pv) => (
              <li
                key={pv.id}
                className="rounded-full bg-[var(--surface-alt)] px-3 py-1.5 text-sm font-semibold text-[var(--text)]"
              >
                {pv.title}
                {pv.maxSpendCents !== null && pv.maxSpendCents > 0
                  ? ` · up to ${fmtBudget(pv.maxSpendCents)}`
                  : ""}
              </li>
            ))}
          </ul>
        )}
        {/* Covers live with the person who covers them (Erin's
            direction, 2026-11-04): THIS member's covers of YOUR
            Wants show here, on their own profile — what Showcase
            Alex covers on Alex's, what Showcase Koa covers on
            Koa's, what Showcase Leilani covers on Leilani's.
            There is no central "Who covers what" list, and a
            Want nobody covers is never mentioned anywhere.
            Rendered only when this member actually covers
            something — no empty or "no cover" line here. */}
        {person.needCovers.length > 0 && (
          <>
            <h4 className="mt-4 text-sm font-bold text-[var(--text)]">
              Covers your Wants
            </h4>
            <ul className="mt-1.5 space-y-1.5">
              {person.needCovers.map((c) => (
                <li
                  key={`${c.listItemId}-${c.provideId}`}
                  className="rounded-2xl bg-[var(--surface-alt)] px-3 py-2 text-sm text-[var(--text)]"
                >
                  ✓ <span className="font-semibold">{c.needText}</span>{" "}
                  — covered by {c.provideTitle} ({c.category})
                  {c.maxSpendCents !== null && c.maxSpendCents > 0
                    ? ` — up to ${fmtBudget(c.maxSpendCents)}`
                    : ""}
                </li>
              ))}
            </ul>
          </>
        )}
        {(() => {
          const theirDesires = state.gifts.filter(
            (g) => g.personId === person.id,
          );
          if (theirDesires.length === 0) return null;
          return (
            <>
              <h4 className="mt-4 text-sm font-bold text-[var(--text)]">
                🎁 {person.name}&apos;s Desires / Gifts
              </h4>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {theirDesires.map((g) => (
                  <li
                    key={g.id}
                    className="rounded-full bg-[var(--surface-alt)] px-3 py-1.5 text-sm font-semibold text-[var(--text)]"
                  >
                    🎁 {g.title}
                    {g.category ? ` · ${g.category}` : ""}
                    {g.priceNote ? ` · ${g.priceNote}` : ""}
                  </li>
                ))}
              </ul>
            </>
          );
        })()}
        {/* Dealbreakers — the same place as on your own
            profile template (Erin, 2026-11-04 consistency
            pass): every Open Profile ends its List with this
            member's OWN dealbreakers, background only — never
            scored, and separate from the warning above, which
            is about YOUR dealbreakers they happen to hit.
            Their data is only shown, never changed here. */}
        <h4 className="mt-4 text-sm font-bold text-[var(--dim)]">
          Dealbreakers · background
        </h4>
        {person.dealbreakers.length === 0 ? (
          <p className="mt-1 text-sm text-[var(--dim)]">None set.</p>
        ) : (
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {person.dealbreakers.map((item) => (
              <li
                key={item.id}
                className="rounded-full bg-[var(--surface-alt)] px-3 py-1.5 text-sm font-semibold text-[var(--text)]"
              >
                {item.text}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* No "Check against my List" button on the Open Profile
          (Erin's direction, 2026-11-04): the button and the
          full card it used to open are gone from this page for
          every member — the profile page is About + their List
          (Wants, Provides, Covers your Wants, Desires,
          Dealbreakers) only. Checking a member against your
          List still lives on their Matches / Discover card,
          and chatting lives only in the Chat section. */}

      {editing && (
        <PersonEditForm person={editing} gifts={state.gifts} onDone={() => setEditing(null)} />
      )}
    </div>
  );
}

function PeopleTab({
  state,
  onMessage,
  onOpenPerson,
}: {
  state: State;
  onMessage: (p: Person) => void;
  onOpenPerson: (personId: number) => void;
}) {
  const invalidate = useInvalidate();
  const [editing, setEditing] = useState<Person | null>(null);

  // Declined people are out of Matches entirely (2026-11-02):
  // they no longer match with the user's profile here, and they
  // wait in the Declined list at the bottom, where one tap brings
  // them back. Accepted matches sort to the front of their group.
  const restoreDeclined = useMutation({
    mutationFn: (personId: number) =>
      api.setMatchDecision({ personId, decision: "none" }),
    onSuccess: invalidate,
  });

  // Gender mode filter (2026-11-02): Matches and Potential show
  // only who the current mode allows — the opposite sex in the
  // default heterosexual mode, the same sex when the pride Same
  // sex button is on. Switching the mode re-filters this list at
  // once, because it reads the live saved profile.
  const visible = [
    ...state.people.filter(
      (p) =>
        !p.blocked &&
        p.matchDecision !== "declined" &&
        genderPassesMode(p.gender, state.profile.gender, state.profile.sameSex),
    ),
  ].sort(
    (a, b) =>
      (a.matchDecision === "accepted" ? 0 : 1) -
        (b.matchDecision === "accepted" ? 0 : 1) ||
      (b.matchPercent ?? -1) - (a.matchPercent ?? -1),
  );
  const declinedPeople = state.people.filter(
    (p) => !p.blocked && p.matchDecision === "declined",
  );
  const blocked = state.people.filter((p) => p.blocked);
  const matches = visible.filter((p) => matchStatusFor(p) === "match");
  const potentials = visible.filter(
    (p) => matchStatusFor(p) === "potential",
  );
  // Out of the Blue (2026-11-03): 0% specific, not a Match and
  // not a Potential — these people get their own surprise
  // section below instead of a plain "No match yet" card, so
  // nobody is shown twice and the 2% never reads as a score.
  const outOfBluePeople = visible.filter(
    (p) => matchStatusFor(p) === null && p.outOfBlue,
  );
  const others = visible.filter(
    (p) => matchStatusFor(p) === null && !p.outOfBlue,
  );
  const renderCard = (p: Person) => (
    <PersonCard
      key={p.id}
      person={p}
      listItems={state.listItems}
      gifts={state.gifts}
      dates={state.dates.filter((d) => d.personId === p.id)}
      checkins={state.safetyCheckins}
      myQualities={state.profile.qualities}
      myName={state.profile.name}
      myAge={state.profile.age}
      myAvailableTimes={state.profile.availableTimes}
      onEdit={setEditing}
      onMessage={onMessage}
      onOpenPlace={(p) => onOpenPerson(p.id)}
    />
  );

  return (
    <div className="space-y-4">
      {/* No step banner at the top of Matches (Erin, 2026-11-04):
          the Step 1-2-3-4 steps live only in the Help pop-up,
          activated from the hamburger menu — never as a
          permanent top bar here. */}
      {/* No matching-mode box here (Erin, 2026-11-04): the "I am"
          + pride Same sex setting lives only in Edit profile.
          Matches just shows who the saved mode selects. And no
          "Add someone" button here either (Erin, 2026-11-04):
          that button opened the Join form inside the app, and
          joining belongs on the Join page — the link you give
          somebody — not inside Matches. */}
      <div className="flex items-center justify-between gap-3">
        <SectionTitle>Matches &amp; Potential</SectionTitle>
      </div>
      <div className="flex flex-wrap gap-1.5" aria-label="Match key">
        <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-xs font-bold text-[#fffaf0]">
          ✓ Match · 50%+
        </span>
        <span className="rounded-full border border-[var(--gold)] bg-[var(--surface)] px-2.5 py-1 text-xs font-bold text-[var(--text)]">
          Potential · covers a List item
        </span>
        {outOfBluePeople.length > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--sky)] bg-[var(--surface)] px-2.5 py-1 text-xs font-bold text-[var(--text)]">
            <TinyWave />
            Out of the Blue · 2% surprise
          </span>
        )}
        {(matches.length > 0 || potentials.length > 0) && (
          <span className="rounded-full bg-[var(--surface-alt)] px-2.5 py-1 text-xs font-bold text-[var(--text)]">
            {matches.length} match{matches.length === 1 ? "" : "es"} · {potentials.length} potential
          </span>
        )}
      </div>

      <MatchBubbles
        people={[...matches, ...potentials]}
        listItems={state.listItems}
        gifts={state.gifts}
        dates={state.dates}
        checkins={state.safetyCheckins}
        myQualities={state.profile.qualities}
        myName={state.profile.name}
        myAge={state.profile.age}
        myAvailableTimes={state.profile.availableTimes}
        onEdit={setEditing}
        onMessage={onMessage}
        onOpenPerson={onOpenPerson}
      />

      {/* No central "Who covers what" list on Matches (Erin's
          direction, 2026-11-04): Wants nobody covers are not
          mentioned here at all — no "No cover yet" rows — and a
          cover belongs with the person who covers it: what each
          member covers shows on that member's own Open Profile
          (PersonPlace's "Covers your Wants"), never in one
          combined list here. */}

      {outOfBluePeople.length > 0 && (
        <section
          aria-label="Out of the Blue — 2 percent surprises"
          className="surface-3d rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg text-[var(--text)]">
              Out of the Blue
            </h3>
            <TinyWave />
            <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-xs font-bold text-[#fffaf0]">
              2%
            </span>
          </div>
          <p className="mt-1 text-sm leading-snug text-[var(--text)]">
            This is a surprise. It isn&apos;t based on Match or
            Potential — it&apos;s based on quantum circumstance.
            List Dating has a built-in element of surprise, because
            people love surprises. The tiny wave is its mark: life
            comes in waves, and everything ripples.
          </p>
          <p className="mt-1 text-sm leading-snug text-[var(--dim)]">
            The 2% is not a cover, and it doesn&apos;t change any
            score. Specific covers stay specific — Yoga is only
            covered by Yoga. Push the Deal if you want to try to
            make it happen, and its plan runs like any Plan the
            Date, with your saved Meta AI key.
          </p>
          <div className="mt-3 space-y-3">
            {outOfBluePeople.map((p) => (
              <OutOfBlueCard
                key={p.id}
                person={p}
                dates={state.dates.filter((d) => d.personId === p.id)}
                onOpenPerson={onOpenPerson}
              />
            ))}
          </div>
        </section>
      )}

      {editing && <PersonEditForm person={editing} gifts={state.gifts} onDone={() => setEditing(null)} />}

      {visible.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-[var(--border)] bg-[var(--surface)] p-6 text-center">
          <p className="font-display text-lg text-[var(--text)]">No matches yet</p>
          <p className="mt-1 text-sm text-[var(--dim)]">
            {declinedPeople.length > 0
              ? "Everyone here has been declined — bring someone back from the Declined list below."
              : "Members join through the Join page — the link you give somebody — so new faces show up here once they've joined."}
          </p>
          {state.profile.gender && (
            <p className="mt-1 text-sm text-[var(--dim)]">
              Your matching mode (set in Edit profile) is only showing{" "}
              {shownGenderLabel(state.profile.gender, state.profile.sameSex)} —
              anyone else is hidden by the mode, not deleted. A member
              with no “I am” set shows once it is set on their Edit.
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Matches and Potential live in the bubbles hero above
              only — nobody is shown twice in a row. "Open page" on
              a bubble is the route to that person's full card.
              People with no match yet are not in the bubbles, so
              their cards stay here. */}
          {others.length > 0 && (
            <section aria-label="No match yet">
              <h3 className="font-display text-lg text-[var(--text)]">
                No match yet ({others.length})
              </h3>
              <div className="mt-2 space-y-3">{others.map(renderCard)}</div>
            </section>
          )}
        </>
      )}

      {declinedPeople.length > 0 && (
        <section
          aria-label="Declined matches"
          className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-4"
        >
          <h3 className="font-display text-lg text-[var(--text)]">
            Declined ({declinedPeople.length})
          </h3>
          <p className="mt-1 text-sm text-[var(--dim)]">
            You took these people out of your Matches — they no longer
            match with you. Nothing was deleted. Bring anyone back and
            they match again, just like before.
          </p>
          <ul className="mt-3 space-y-2">
            {declinedPeople.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--surface-alt)] px-3 py-2.5"
              >
                <span className="flex items-center gap-3">
                  <Avatar name={p.name} photoUrl={p.photos[0]?.url} />
                  <span className="text-base font-semibold text-[var(--text)]">
                    {p.name}
                    {p.age !== null && (
                      <span className="font-semibold text-[var(--dim)]">
                        , {p.age}
                      </span>
                    )}
                  </span>
                  <MatchBadge percent={p.matchPercent} />
                </span>
                <button
                  type="button"
                  className={btnPrimary}
                  onClick={() => restoreDeclined.mutate(p.id)}
                  disabled={restoreDeclined.isPending}
                  aria-label={`Bring ${p.name} back into my Matches`}
                >
                  Bring back
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {blocked.length > 0 && (
        <p className="text-sm text-[var(--dim)]">
          {blocked.length} blocked — manage them in Help → Safety.
        </p>
      )}
    </div>
  );
}

// ---------- Chat tab (formerly Messages) ----------
//
// A small chat for one job: staying in contact to fulfill the
// meetup. Chat gate (Deal-only rule, 2026-11-04): a person is
// visible and messageable in Chat only when the server says
// they are chat-eligible — a Deal exists with them (the Deal
// button was hit on their match card, or they have an accepted
// date). A Match or a Potential with no Deal has no chat here
// at all. Inside that gate, threads open only where contact is
// also allowed (a Deal / accepted date establishes contact; a
// contact preference can otherwise narrow an eligible thread,
// never create one). Non-qualifying threads do not appear
// here; their messages are never deleted. The one-tap helpers
// — confirm, on my way, I'm here — keep it fast. No disclaimer
// text lives in this tab: the rule is stated in Help only.

function ThreadView({
  state,
  person,
  onBack,
  onGoMatches,
}: {
  state: State;
  person: Person;
  onBack: () => void;
  onGoMatches?: () => void;
}) {
  const invalidate = useInvalidate();
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState("");
  const [loggingReply, setLoggingReply] = useState(false);
  const [replyDraft, setReplyDraft] = useState("");
  const [replyErr, setReplyErr] = useState("");

  const thread = state.messages.filter((m) => m.personId === person.id);
  const myDates = state.dates.filter((d) => d.personId === person.id);
  const acceptedDate = myDates.find((d) => d.status === "accepted");
  const proposedDate = myDates.find((d) => d.status === "proposed");
  // Orphan thread: a note in this Chat was tied to a date that
  // has since been deleted. The Chat stays exactly as it is —
  // nothing is removed — the header just says there is no date
  // behind it any more and points back to Matches.
  const orphanDateThread =
    !acceptedDate &&
    !proposedDate &&
    thread.some(
      (m) =>
        m.dateId !== null &&
        !state.dates.some((d) => d.id === m.dateId),
    );

  const markRead = useMutation({
    mutationFn: () => api.markThreadRead({ personId: person.id }),
    onSuccess: invalidate,
  });
  useEffect(() => {
    if (person.unreadCount > 0) markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person.id, person.unreadCount]);

  const send = useMutation({
    mutationFn: (args: { body: string; kind: "text" | "quick"; dateId: number | null }) =>
      api.sendMessage({ personId: person.id, ...args }),
    onSuccess: () => {
      setDraft("");
      setErr("");
      invalidate();
    },
    onError: (e) => setErr(errText(e, "Couldn't send — try again.")),
  });
  const receive = useMutation({
    mutationFn: (body: string) => api.receiveMessage({ personId: person.id, body }),
    onSuccess: () => {
      setReplyDraft("");
      setLoggingReply(false);
      invalidate();
    },
  });
  const removeMsg = useMutation({
    mutationFn: (id: number) => api.deleteMessage({ id }),
    onSuccess: invalidate,
  });
  const respond = useMutation({
    mutationFn: (args: { id: number; response: "accepted" | "declined" }) =>
      api.respondDate(args),
    onSuccess: invalidate,
  });

  const sendQuick = (body: string, dateId: number | null) => {
    setErr("");
    send.mutate({ body, kind: "quick", dateId });
  };
  const confirmBody = acceptedDate
    ? `Deal ✦ ${acceptedDate.ideaText}${acceptedDate.meetAt ? ` — ${fmtDateTime(acceptedDate.meetAt)}` : ""}${acceptedDate.spot ? ` at ${acceptedDate.spot}` : ""} — see you there!`
    : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={btnGhost} onClick={onBack}>
          ← All chats
        </button>
        <Avatar name={person.name} photoUrl={person.photos[0]?.url} />
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold text-[var(--text)]">
            {person.name}
            {person.age !== null && (
              <span className="font-semibold text-[var(--dim)]">, {person.age}</span>
            )}
          </h2>
        </div>
        <span className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
          {orphanDateThread &&
            (onGoMatches ? (
              <button
                type="button"
                className="rounded-full border border-[var(--gold)] bg-[var(--surface)] px-2.5 py-1 text-xs font-bold text-[var(--text)]"
                onClick={onGoMatches}
                aria-label={`No date behind this chat — back to Matches to plan one with ${person.name}`}
              >
                No date — back to Matches
              </button>
            ) : (
              <span className="rounded-full border border-[var(--gold)] bg-[var(--surface)] px-2.5 py-1 text-xs font-bold text-[var(--text)]">
                No date — back to Matches
              </span>
            ))}
          <MatchBadge percent={person.matchPercent} />
        </span>
      </div>

      {acceptedDate && (
        <section className="rounded-[28px] border-2 border-[var(--pink-accent)] bg-[var(--surface)] p-3">
          <div className="mb-2 flex items-center gap-3">
            {person.photos[0]?.url ? (
              <Avatar
                name={person.name}
                photoUrl={person.photos[0]?.url}
                size="lg"
              />
            ) : null}
            <p className="min-w-0 truncate text-lg font-bold leading-snug text-[var(--text)]">
              {person.name}
            </p>
          </div>
          <div className="flex items-start justify-between gap-3">
            <p className="font-bold text-[var(--text)]">
              ✦ {acceptedDate.ideaText}
            </p>
            {!acceptedDate.completedAt && (
              <span className="shrink-0 rounded-full bg-[var(--pink-accent)] px-2.5 py-1 text-xs font-bold text-[var(--accent-ink)]">
                Deal
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-[var(--text)]">
            ◷ {acceptedDate.meetAt ? fmtDateTime(acceptedDate.meetAt) : "No time set"}
          </p>
          {acceptedDate.spot &&
            !(
              is21PlusSpot(acceptedDate.spot) &&
              !bothAges21Plus(state.profile.age, person.age)
            ) && (
              <p className="text-sm font-semibold text-[var(--text)]">
                📍 {acceptedDate.spot}
              </p>
            )}
          {acceptedDate.completedAt && (
            <p className="mt-1 text-base font-bold text-[var(--pink-light)]" role="status">
              ✓ Completed {fmtDateTime(acceptedDate.completedAt)}
            </p>
          )}
          {acceptedDate.plan.trim() !== "" && (
            <DatePlanPanel
              date={acceptedDate}
              personPhotoUrl={person.photos[0]?.url}
              spotBlocked={
                is21PlusSpot(acceptedDate.spot) &&
                !bothAges21Plus(state.profile.age, person.age)
              }
              spotBlockReason={
                is21PlusSpot(acceptedDate.spot) &&
                !bothAges21Plus(state.profile.age, person.age)
                  ? age21BlockReason(
                      state.profile.age,
                      person.age,
                      person.name,
                    )
                  : ""
              }
            />
          )}
          <DateCompletionControl date={acceptedDate} />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className={btnPrimary}
              disabled={send.isPending}
              onClick={() => sendQuick(confirmBody, acceptedDate.id)}
            >
              Deal
            </button>
            {MEETUP_ACTIONS.map((a) => (
              <button
                key={a.label}
                type="button"
                className={btnGhost}
                disabled={send.isPending}
                onClick={() => sendQuick(a.body, acceptedDate.id)}
              >
                {a.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {!acceptedDate && proposedDate && (
        <section className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-3">
          <div className="mb-2 flex items-center gap-3">
            {person.photos[0]?.url ? (
              <Avatar
                name={person.name}
                photoUrl={person.photos[0]?.url}
                size="lg"
              />
            ) : null}
            <p className="min-w-0 truncate text-lg font-bold leading-snug text-[var(--text)]">
              {person.name}
            </p>
          </div>
          <p className="font-bold text-[var(--text)]">
            ✦ {proposedDate.ideaText}
          </p>
          <p className="text-sm font-semibold text-[var(--text)]">
            ◷ {proposedDate.meetAt ? fmtDateTime(proposedDate.meetAt) : "No time set"}
          </p>
          {proposedDate.plan.trim() !== "" && (
            <DatePlanPanel
              date={proposedDate}
              personPhotoUrl={person.photos[0]?.url}
              spotBlocked={
                is21PlusSpot(proposedDate.spot) &&
                !bothAges21Plus(state.profile.age, person.age)
              }
              spotBlockReason={
                is21PlusSpot(proposedDate.spot) &&
                !bothAges21Plus(state.profile.age, person.age)
                  ? age21BlockReason(
                      state.profile.age,
                      person.age,
                      person.name,
                    )
                  : ""
              }
            />
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className={btnPrimary}
              disabled={respond.isPending}
              onClick={() =>
                respond.mutate({ id: proposedDate.id, response: "accepted" })
              }
              aria-label={
                proposedDate.direction === "in"
                  ? `Deal — set the date ${proposedDate.ideaText} with ${person.name}`
                  : `Deal — ${person.name} said yes to ${proposedDate.ideaText}`
              }
            >
              Deal
            </button>
            <button
              type="button"
              className={btnGhost}
              disabled={respond.isPending}
              onClick={() =>
                respond.mutate({ id: proposedDate.id, response: "declined" })
              }
              aria-label={
                proposedDate.direction === "in"
                  ? `Decline the date ${proposedDate.ideaText} with ${person.name}`
                  : `${person.name} passed on ${proposedDate.ideaText}`
              }
            >
              {proposedDate.direction === "in" ? "Decline" : "Passed"}
            </button>
          </div>
        </section>
      )}

      <div className="space-y-2" aria-label={`Chat with ${person.name}`}>
        {thread.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-4 text-center text-sm text-[var(--dim)]">
            No chat yet — say hello.
          </p>
        ) : (
          thread.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-[28px] px-3 py-2 ${
                  m.direction === "out"
                    ? "bg-[var(--pink-accent)] text-[var(--accent-ink)]"
                    : "bg-[var(--surface-alt)] text-[var(--text)]"
                }`}
              >
                <p className="whitespace-pre-wrap text-base">{fixBakedUtcUntil(m.body)}</p>
                <p
                  className={`mt-0.5 flex items-center gap-2 text-xs ${
                    m.direction === "out" ? "text-[var(--accent-ink)]" : "text-[var(--dim)]"
                  }`}
                >
                  <span>
                    {m.direction === "out" ? "You" : person.name} ·{" "}
                    {fmtMsgTime(m.createdAt)}
                  </span>
                  <button
                    type="button"
                    aria-label="Remove this chat note"
                    className="font-bold"
                    disabled={removeMsg.isPending}
                    onClick={() => removeMsg.mutate(m.id)}
                  >
                    ✕
                  </button>
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {person.chatEligible && person.canContact ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {QUICK_REPLIES.map((q) => (
              <button
                key={q}
                type="button"
                className={btnGhost}
                disabled={send.isPending}
                onClick={() => sendQuick(q, acceptedDate?.id ?? null)}
              >
                {q}
              </button>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const body = draft.trim();
              if (!body) return;
              const wErr = wordingErrorFor(body);
              if (wErr) {
                setErr(wErr);
                return;
              }
              setErr("");
              send.mutate({ body, kind: "text", dateId: acceptedDate?.id ?? null });
            }}
          >
            <input
              aria-label={`Chat with ${person.name}`}
              className={inputCls}
              value={draft}
              maxLength={500}
              placeholder={`Chat with ${person.name}…`}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button
              type="submit"
              className={btnPrimary}
              disabled={send.isPending || !draft.trim()}
            >
              Send
            </button>
          </form>
          {err && <p className="text-sm text-[var(--danger)]">{err}</p>}
          {send.isPending && (
            <p className="text-sm text-[var(--dim)]">Sending…</p>
          )}
        </div>
      ) : (
        <p className="rounded-3xl bg-[var(--surface-alt)] p-3 text-sm text-[var(--text)]">
          Chat closed.
        </p>
      )}

      {person.chatEligible && (
      <div className="border-t border-[var(--border)] pt-3">
        {!loggingReply ? (
          <button
            type="button"
            className={btnGhost}
            aria-expanded={loggingReply}
            onClick={() => setLoggingReply(true)}
          >
            Heard back from {person.name}? Log their chat
          </button>
        ) : (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              const body = replyDraft.trim();
              if (!body) return;
              const wErr = wordingErrorFor(body);
              if (wErr) {
                setReplyErr(wErr);
                return;
              }
              setReplyErr("");
              receive.mutate(body);
            }}
          >
            <label className={labelCls} htmlFor="log-reply">
              {person.name}&apos;s chat to you
            </label>
            <input
              id="log-reply"
              className={inputCls}
              value={replyDraft}
              maxLength={500}
              placeholder="What did they say?"
              onChange={(e) => setReplyDraft(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className={btnPrimary}
                disabled={receive.isPending || !replyDraft.trim()}
              >
                Add to thread
              </button>
              <button
                type="button"
                className={btnGhost}
                onClick={() => setLoggingReply(false)}
              >
                Cancel
              </button>
            </div>
            {replyErr && (
              <p className="text-sm text-[var(--danger)]" role="alert">{replyErr}</p>
            )}
            {receive.isError && (
              <p className="text-sm text-[var(--danger)]">
                {errText(receive.error, "Couldn't log that — try again.")}
              </p>
            )}
          </form>
        )}
      </div>
      )}
    </div>
  );
}

// One little circle in the Chat "Your chats" box (Erin,
// 2026-11-04): the same bubble look as the Dates circles —
// a round profile photo with the name under it — and tapping
// it opens that person's chat thread, exactly like tapping
// their row in the chat list below. An unread count rides on
// the circle as a small badge, like the date-count badge on
// a Dates circle.
function ChatBubble({
  name,
  photoUrl,
  unreadCount,
  onSelect,
}: {
  name: string;
  photoUrl?: string;
  unreadCount: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Open chat with ${name}${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
      className="flex w-[84px] shrink-0 snap-start flex-col items-center gap-1.5 rounded-3xl px-1 py-2 transition active:scale-[0.97]"
    >
      <span className="relative block rounded-full p-[3px] shadow-[0_6px_14px_rgba(101,78,32,0.45)] ring-2 ring-[var(--border)]">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={`Photo of ${name}`}
            className="block h-[76px] w-[76px] rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-[var(--accent)] text-xl font-bold text-[#fffaf0]"
          >
            {initials(name)}
          </span>
        )}
        {unreadCount > 0 && (
          <span className="absolute -bottom-1 -right-1 rounded-full bg-[var(--danger-bg)] px-2 py-1 text-xs font-bold leading-tight text-white ring-2 ring-[var(--surface)]">
            {unreadCount}
          </span>
        )}
      </span>
      <span className="line-clamp-2 min-h-8 w-full text-center text-xs font-semibold leading-tight text-[var(--text)]">
        {name}
      </span>
    </button>
  );
}

function MessagesTab({
  state,
  focus,
  onGoMatches,
}: {
  state: State;
  focus: { personId: number; stamp: number } | null;
  onGoMatches: () => void;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  useEffect(() => {
    if (focus) setSelectedId(focus.personId);
  }, [focus]);

  // Chat gate: a focused or tapped thread opens only for a
  // chat-eligible person (a Deal exists with them) — anyone
  // else falls back to the list, where they simply do not
  // appear (their messages are never deleted).
  const selected =
    state.people.find(
      (p) => p.id === selectedId && !p.blocked && p.chatEligible,
    ) ?? null;
  if (selected) {
    return (
      <ThreadView
        state={state}
        person={selected}
        onBack={() => setSelectedId(null)}
        onGoMatches={onGoMatches}
      />
    );
  }

  const acceptedIds = new Set(
    state.dates.filter((d) => d.status === "accepted").map((d) => d.personId),
  );
  const threads = state.people
    .filter(
      (p) =>
        !p.blocked &&
        p.chatEligible &&
        (p.lastMessageAt !== null || p.canContact),
    )
    .sort((a, b) => {
      if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount;
      const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : -1;
      const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : -1;
      if (bt !== at) return bt - at;
      return (b.matchPercent ?? -1) - (a.matchPercent ?? -1);
    });

  return (
    <div className="space-y-4">
      <div>
        <SectionTitle>Chat</SectionTitle>
      </div>

      {threads.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-[var(--border)] bg-[var(--surface)] p-6 text-center">
          <p className="font-display text-lg text-[var(--text)]">No chats yet</p>
        </div>
      ) : (
        <>
        {/* "Your chats" box (Erin, 2026-11-04): the same box
            pattern as "Your dates" on Dates — a row of little
            circle profile photos at the top of Chat, one for
            every person you're chatting with. The circles
            themselves are the navigation: tapping one opens
            that person's thread, exactly like tapping their
            row below — no instruction line is shown. Only
            Deal people appear, because `threads` is already
            the Deal-only chat-eligible list. */}
        <section
          aria-label="Your chats"
          className="surface-3d rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-4"
        >
          <h3 className="font-display text-lg text-[var(--text)]">
            Your chats
          </h3>
          <div
            className="-mx-1 mt-2 flex snap-x gap-1 overflow-x-auto px-1 pb-1"
            role="group"
            aria-label="Chat circles"
          >
            {threads.map((p) => (
              <ChatBubble
                key={p.id}
                name={p.name}
                photoUrl={p.photos[0]?.url}
                unreadCount={p.unreadCount}
                onSelect={() => setSelectedId(p.id)}
              />
            ))}
          </div>
        </section>
        <ul className="space-y-2">
          {threads.map((p) => {
            const hasDate = acceptedIds.has(p.id);
            const accepted = state.dates.find(
              (d) => d.personId === p.id && d.status === "accepted",
            );
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  aria-label={`Open chat with ${p.name}${p.unreadCount > 0 ? `, ${p.unreadCount} unread` : ""}`}
                  className="flex w-full items-center gap-3 rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-3 text-left shadow-sm transition active:scale-[0.99]"
                >
                  <Avatar name={p.name} photoUrl={p.photos[0]?.url} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-[var(--text)]">{p.name}</span>
                      {hasDate && (
                        <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs font-bold text-[#fffaf0]">
                          ✦ Deal
                        </span>
                      )}
                      {p.unreadCount > 0 && (
                        <span className="rounded-full bg-[var(--danger-bg)] px-2.5 py-1 text-xs font-bold text-white">
                          {p.unreadCount} new
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-[var(--dim)]">
                      {p.lastMessagePreview
                        ? fixBakedUtcUntil(p.lastMessagePreview)
                        : accepted
                          ? `✦ ${accepted.ideaText}`
                          : "Say hello"}
                    </span>
                  </span>
                  {p.lastMessageAt && (
                    <span className="shrink-0 text-xs text-[var(--dim)]">
                      {fmtMsgTime(p.lastMessageAt)}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        </>
      )}

      {/* No "hidden chats" section and no rule explanation in
          this tab (Erin, 2026-11-04): Chat simply shows the
          chats that exist — the ones a Deal opened. Anyone
          without a Deal does not appear here at all; their
          messages are never deleted, and the chat comes back
          if a Deal is made again. The rule itself is stated
          in Help only. */}
    </div>
  );
}

// ---------- Dates tab ----------

// One little circle in the Dates jump row (Erin, 2026-11-04):
// the same bubble look as the Potential bubbles in Matches —
// a round profile photo with the name under it — but tapping
// it jumps down the Dates page to that person's first date
// card instead of selecting a match.
function DateBubble({
  name,
  photoUrl,
  dateCount,
  selected,
  onSelect,
}: {
  name: string;
  photoUrl?: string;
  dateCount: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`See your date with ${name}`}
      className="flex w-[84px] shrink-0 snap-start flex-col items-center gap-1.5 rounded-3xl px-1 py-2 transition active:scale-[0.97]"
    >
      <span
        className={`relative block rounded-full p-[3px] shadow-[0_6px_14px_rgba(101,78,32,0.45)] ${
          selected
            ? "ring-[3px] ring-[var(--pink-accent)]"
            : "ring-2 ring-[var(--border)]"
        }`}
      >
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={`Photo of ${name}`}
            className="block h-[76px] w-[76px] rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-[var(--accent)] text-xl font-bold text-[#fffaf0]"
          >
            {initials(name)}
          </span>
        )}
        {dateCount > 1 && (
          <span className="absolute -bottom-1 -right-1 rounded-full bg-[var(--pink-accent)] px-2 py-1 text-xs font-bold leading-tight text-[var(--accent-ink)] ring-2 ring-[var(--surface)]">
            {dateCount}
          </span>
        )}
      </span>
      <span className="line-clamp-2 min-h-8 w-full text-center text-xs font-semibold leading-tight text-[var(--text)]">
        {name}
      </span>
    </button>
  );
}

function DatesTab({
  state,
  onMessage,
  onGoMatches,
}: {
  state: State;
  onMessage: (personId: number) => void;
  onGoMatches: () => void;
}) {
  const blockedIds = new Set(
    state.people.filter((p) => p.blocked).map((p) => p.id),
  );
  const visible = [...state.dates]
    .filter((d) => !blockedIds.has(d.personId))
    .sort((a, b) => b.id - a.id);
  const groups: { status: DateStatus; title: string }[] = [
    { status: "proposed", title: "Waiting for an answer" },
    { status: "accepted", title: "Deal" },
    { status: "declined", title: "Passed" },
  ];
  // Circle-row people (Erin, 2026-11-04, order + behaviour
  // corrected the same day): one circle per person who has a
  // date here, in the SAME order as the Matches bubbles —
  // Matches first, then Potential, best % first, then most
  // covers, then newest member — NOT in date order (date order
  // put Koa's newer date ahead of Alex). So with Alex and Koa
  // both at 33% Potential, Alex's circle comes first, exactly
  // as in Matches. A date whose person is no longer in the
  // member list keeps a circle after the known members.
  const datePeople: {
    personId: number;
    name: string;
    photoUrl?: string;
    dateCount: number;
  }[] = [];
  const matchRank = (p: Person) =>
    matchStatusFor(p) === "match" ? 0 : 1;
  const peopleInMatchOrder = [...state.people].sort(
    (a, b) =>
      matchRank(a) - matchRank(b) ||
      (b.matchPercent ?? -1) - (a.matchPercent ?? -1) ||
      b.coverCount - a.coverCount ||
      b.id - a.id,
  );
  for (const p of peopleInMatchOrder) {
    const mine = visible.filter((d) => d.personId === p.id);
    if (mine.length === 0) continue;
    datePeople.push({
      personId: p.id,
      name: p.name,
      photoUrl: p.photos[0]?.url,
      dateCount: mine.length,
    });
  }
  for (const d of visible) {
    if (datePeople.some((e) => e.personId === d.personId)) continue;
    datePeople.push({
      personId: d.personId,
      name: d.personName,
      photoUrl: undefined,
      dateCount: visible.filter((x) => x.personId === d.personId).length,
    });
  }
  // Like the Matches bubbles (Erin, 2026-11-04): tapping a
  // circle SELECTS that person and the view below shows just
  // their date — it does not scroll a long list of every date.
  // The first circle in Matches order is selected by default.
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(
    null,
  );
  const selectedEntry =
    datePeople.find((e) => e.personId === selectedPersonId) ??
    datePeople[0] ??
    null;

  return (
    <div className="space-y-5">
      {/* No step banner at the top of Dates (Erin, 2026-11-04):
          the Step 1-2-3-4 steps live only in the Help pop-up,
          activated from the hamburger menu — never as a
          permanent top bar here. */}
      <div>
        <SectionTitle>Dates</SectionTitle>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-[var(--border)] bg-[var(--surface)] p-6 text-center">
          <p className="font-display text-lg text-[var(--text)]">No dates yet</p>
          <p className="mt-1 text-sm text-[var(--dim)]">
            Plan one from a Match.
          </p>
          <button
            type="button"
            className={`${btnPrimary} mt-3`}
            onClick={onGoMatches}
            aria-label="Go to Matches to plan a first date from the List"
          >
            Find a Match
          </button>
        </div>
      ) : (
        <>
          {/* Circle row (Erin, 2026-11-04): just like the
              Matches bubbles — a row of little circle profile
              photos at the top of Dates, one for every person
              who has a date, in the same order as Matches.
              Tap a circle and just that person's date shows
              below, like tapping a Matches bubble shows that
              person — no scrolling a list of every date. */}
          <section
            aria-label="Your dates"
            className="surface-3d rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <h3 className="font-display text-lg text-[var(--text)]">
              Your dates
            </h3>
            <div
              className="-mx-1 mt-2 flex snap-x gap-1 overflow-x-auto px-1 pb-1"
              role="group"
              aria-label="Date circles"
            >
              {datePeople.map((e) => (
                <DateBubble
                  key={e.personId}
                  name={e.name}
                  photoUrl={e.photoUrl}
                  dateCount={e.dateCount}
                  selected={selectedEntry?.personId === e.personId}
                  onSelect={() => setSelectedPersonId(e.personId)}
                />
              ))}
            </div>
          </section>
          {selectedEntry &&
            groups.map(({ status, title }) => {
          const group = visible.filter(
            (d) => d.personId === selectedEntry.personId && d.status === status,
          );
          if (group.length === 0) return null;
          return (
            <section key={status}>
              <h3 className="mb-2 font-display text-lg text-[var(--text)]">
                {title}
              </h3>
              <div className="space-y-2">
                {group.map((d) => (
                  <div
                    key={d.id}
                    id={`date-card-${d.id}`}
                    className="scroll-mt-24"
                  >
                  <DateCard
                    date={d}
                    myName={state.profile.name}
                    myAge={state.profile.age}
                    personAge={
                      state.people.find((p) => p.id === d.personId)?.age ??
                      null
                    }
                    personPhotoUrl={
                      state.people.find((p) => p.id === d.personId)
                        ?.photos[0]?.url
                    }
                    gifts={state.gifts}
                    showPerson
                    onMessage={onMessage}
                    checkins={state.safetyCheckins.filter(
                      (c) => c.dateId === d.id,
                    )}
                  />
                  </div>
                ))}
              </div>
            </section>
          );
          })}
        </>
      )}
    </div>
  );
}

// ---------- My List & Provides (inside Profile Edit) ----------
//
// FLAT, on the simple List calculation (2026-11-03): My List is
// one flat list of Wants, 3 max — no Must-haves / Nice-to-haves
// sections, no weighting. New Wants are stored with kind "must"
// (the storage kind for a scored Want); rows stored earlier as
// "nice" are Wants too and show in the same flat list. My
// Provides is flat, 3 max, capped independently. Dealbreakers
// are background only: a small quiet editor here, and on member
// cards they surface only as a quiet warning when one clashes.
// Desires ARE edited here, in Profile Edit (Erin's direction,
// 2026-11-04, superseding the 2026-11-03 move to Help): the
// Desires section at the bottom of this editor adds / edits /
// deletes YOUR OWN desires only, up to 3 — everybody else's
// desires are NOT on this list (same-day direction): a member's
// desires live on that member's own profile / Edit, and pop up
// with their match and their dates. Desires never count toward
// a match %, and never show on the finished profile. Covers
// are not part of this editor either (same-day direction,
// updated 2026-11-04): there is no central "Who covers what"
// list — what a member covers shows on that member's own
// Open Profile, and a Want nobody covers is never mentioned.

function ProfileListSection({ state }: { state: State }) {
  const invalidate = useInvalidate();
  const [wantDraft, setWantDraft] = useState("");
  const [wantCat, setWantCat] = useState("");
  const [dealDraft, setDealDraft] = useState("");
  const [listErr, setListErr] = useState("");
  const add = useMutation({
    mutationFn: (args: { kind: ScoredKind; text: string; category: string }) =>
      api.addListItem(args),
    onSuccess: (_, args) => {
      if (args.kind === "dealbreaker") {
        setDealDraft("");
      } else {
        setWantDraft("");
        setWantCat("");
      }
      setListErr("");
      invalidate();
    },
    onError: (e) => setListErr(errText(e, "Couldn't add that — try again.")),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.deleteListItem({ id }),
    onSuccess: invalidate,
  });

  const wants = state.listItems.filter(
    (i) => i.kind === "must" || i.kind === "nice",
  );
  const dealbreakers = state.listItems.filter(
    (i) => i.kind === "dealbreaker",
  );
  const wantsFull = wants.length >= 3;

  const itemRow = (item: ListItem) => (
    <li
      key={item.id}
      className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--surface-alt)] px-3 py-2"
    >
      <span className="text-base text-[var(--text)]">
        {item.category && (
          <span className="font-semibold">{item.category} — </span>
        )}
        {item.text}
      </span>
      <button
        type="button"
        className="text-sm font-semibold text-[var(--danger)]"
        aria-label={`Remove ${item.text}`}
        onClick={() => remove.mutate(item.id)}
        disabled={remove.isPending}
      >
        Remove
      </button>
    </li>
  );

  return (
    <div className="space-y-5">
      <div id="core-my-list" className="scroll-mt-32">
        <SectionTitle>
          <span aria-hidden className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--pink-accent)] align-middle text-sm font-bold text-[var(--accent-ink)]">1</span>
          My List
        </SectionTitle>
      </div>

      <section className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="font-display text-lg text-[var(--text)]">
          Wants
          <span className="ml-2 align-middle text-xs font-sans font-semibold text-[var(--dim)]">
            {wants.length}/3
          </span>
        </h3>
        <p className="mt-1 text-sm text-[var(--dim)]">
          Flat — no sections. Your match % is the share of these a
          person&apos;s Provides cover — and your Provides covering
          their Wants counts the same way.
        </p>
        {wants.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--dim)]">Nothing here yet.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">{wants.map(itemRow)}</ul>
        )}
        {wantsFull && (
          <p className="mt-3 text-sm font-semibold text-[var(--dim)]">
            Full · 3 max
          </p>
        )}
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const text = wantDraft.trim();
            if (!text) return;
            const wErr = wordingErrorFor(text, wantCat);
            if (wErr) {
              setListErr(wErr);
              return;
            }
            setListErr("");
            add.mutate({ kind: "must", text, category: wantCat });
          }}
        >
          <div>
            <label className={labelCls} htmlFor="my-list-category-want">
              Category — what kind of want / need is this?
            </label>
            <select
              id="my-list-category-want"
              className={inputCls}
              value={wantCat}
              onChange={(e) => setWantCat(e.target.value)}
            >
              <option value="">Pick a category…</option>
              {PROVIDE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <input
              aria-label="New Want item"
              className={inputCls}
              value={wantDraft}
              placeholder="e.g. Lululemon"
              onChange={(e) => setWantDraft(e.target.value)}
            />
            <button
              type="submit"
              className={btnGhost}
              disabled={
                wantsFull || add.isPending || !wantDraft.trim() || !wantCat
              }
            >
              Add
            </button>
          </div>
        </form>
      </section>

      {/* Dealbreakers — background only: a small, quiet editor.
          They are not a main section, they never count toward a
          score, and they only surface on a member card as a
          quiet warning when one clashes. */}
      <section className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <h3 className="text-sm font-bold text-[var(--dim)]">
          Dealbreakers · background
        </h3>
        {dealbreakers.length === 0 ? (
          <p className="mt-1 text-sm text-[var(--dim)]">None set.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">{dealbreakers.map(itemRow)}</ul>
        )}
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const text = dealDraft.trim();
            if (!text) return;
            const wErr = wordingErrorFor(text);
            if (wErr) {
              setListErr(wErr);
              return;
            }
            setListErr("");
            add.mutate({ kind: "dealbreaker", text, category: "" });
          }}
        >
          <input
            aria-label="New Dealbreakers item"
            className={inputCls}
            value={dealDraft}
            placeholder="e.g. Cats"
            onChange={(e) => setDealDraft(e.target.value)}
          />
          <button
            type="submit"
            className={btnGhost}
            disabled={add.isPending || !dealDraft.trim()}
          >
            Add
          </button>
        </form>
      </section>

      {listErr && (
        <p className="text-sm font-semibold text-[var(--danger)]" role="alert">
          {listErr}
        </p>
      )}
      {/* Desires editing lives in Profile Edit again (Erin's
          direction, 2026-11-04): the Desires section sits at
          the bottom of this editor. Only YOUR OWN desires are
          edited here — everybody else's desires are NOT on this
          list (Erin's direction, 2026-11-04): theirs live on
          their own profile and pop up with their match / date.
          Desires never count toward a match %. */}
      <section
        id="core-my-provides"
        className="scroll-mt-32 rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-4"
      >
        <h3 className="font-display text-lg text-[var(--text)]">
          <span aria-hidden className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--pink-accent)] align-middle text-sm font-bold text-[var(--accent-ink)]">2</span>
          My Provides
        </h3>
        <div className="mt-3">
          <ProvideEditor
            ownerType="profile"
            personId={null}
            provides={state.profile.provides}
            prefix="list-mine"
            heading="My Provide list"
          />
        </div>
      </section>

      {/* Covers are not edited or listed here (Erin's
          direction, 2026-11-04): there is no central "Who
          covers what" list anywhere — what a member covers
          shows on that member's own Open Profile, and a Want
          nobody covers is never mentioned. Profile Edit keeps
          only your own List, Provides and Desires. */}

      {/* Desires — edited here in Edit profile (Erin's
          direction, 2026-11-04): add / edit / delete YOUR OWN
          desires only, up to 3. Everybody else's desires are
          removed from this list — theirs show on their own
          profile, and pop up with their Matches and Dates —
          never on the finished profile, and never toward a
          match %. */}
      <WishlistSection state={state} />
    </div>
  );
}

// ---------- Who covers what (per person, on their profile) ----------
//
// There is NO central "Who covers what" list anywhere (Erin's
// direction, 2026-11-04, superseding the earlier Matches
// section): a Want nobody covers is never mentioned on the
// Matches page — no "No cover yet" rows — and a cover belongs
// with the person who covers it. What a member covers shows on
// that member's own Open Profile, in their List section's
// "Covers your Wants" (PersonPlace), from the same live
// needCovers derivation on the person shape; nothing is stored.

// ---------- Wishlist entries (on The List) ----------

function GiftForm({
  state,
  gift,
  onDone,
}: {
  state: State;
  gift: Gift | null;
  onDone: () => void;
}) {
  const invalidate = useInvalidate();
  const [category, setCategory] = useState(gift?.category ?? "");
  const [title, setTitle] = useState(gift?.title ?? "");
  const [occasion, setOccasion] = useState(gift?.occasion ?? "");
  const [priceNote, setPriceNote] = useState(gift?.priceNote ?? "");
  const [link, setLink] = useState(gift?.link ?? "");
  const [status, setStatus] = useState<GiftStatus>(gift?.status ?? "idea");
  const [wordErr, setWordErr] = useState("");

  // YOUR desires only (Erin's direction, 2026-11-04): this form
  // lives in YOUR Profile Edit, so it only ever writes your own
  // General desires — there is no "For" picker any more, and
  // nobody else's desires can be added to or kept on this list.
  // A member's own desires are edited on that member's Edit
  // (MemberDesireEditor) and show on their own profile. Cap: up
  // to 3 of your own; the server enforces the same cap per
  // wishlist, and this guard says it before the round-trip.
  const groupCount = state.gifts.filter(
    (g) =>
      (g.personId === null || g.personId === undefined) &&
      g.id !== gift?.id,
  ).length;
  const groupFull = groupCount >= 3;

  const save = useMutation({
    mutationFn: async (): Promise<void> => {
      const pid = null;
      if (gift) {
        await api.updateListItemGift({
          id: gift.id,
          title,
          category,
          personId: pid,
          occasion,
          priceNote,
          link,
          status,
        });
      } else {
        await api.addListItem({
          kind: "gift",
          text: title,
          category,
          personId: pid,
          occasion,
          priceNote,
          link,
          giftStatus: status,
        });
      }
    },
    onSuccess: () => {
      invalidate();
      onDone();
    },
  });

  return (
    <form
      className="space-y-3 border-t border-[var(--border)] pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        const wErr = wordingErrorFor(category, title, occasion, priceNote, link);
        if (wErr) {
          setWordErr(wErr);
          return;
        }
        if (groupFull) {
          setWordErr(
            "Your Desires list is full — 3 max. Remove one first.",
          );
          return;
        }
        setWordErr("");
        save.mutate();
      }}
    >
      <h3 className="font-display text-lg text-[var(--text)]">
        {gift ? "Edit desire" : "Add a desire to your List"}
      </h3>
      <div>
        <label className={labelCls} htmlFor="gift-category">
          Category — what kind of want / need is this?
        </label>
        <select
          id="gift-category"
          className={inputCls}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Pick a category…</option>
          {PROVIDE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls} htmlFor="gift-title">
          Desire
        </label>
        <input
          id="gift-title"
          className={inputCls}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="e.g. A sealed present + a secret outing"
        />
      </div>
      <p className="text-xs text-[var(--dim)]">
        Yours only — {groupCount} of 3{groupFull ? " — full" : ""}.
        Nobody else&apos;s desires are on this list.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls} htmlFor="gift-occasion">
            Occasion
          </label>
          <input
            id="gift-occasion"
            className={inputCls}
            value={occasion}
            onChange={(e) => setOccasion(e.target.value)}
            placeholder="Birthday, just because…"
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="gift-price">
            Price note
          </label>
          <input
            id="gift-price"
            className={inputCls}
            value={priceNote}
            onChange={(e) => setPriceNote(e.target.value)}
            placeholder="Under $25"
          />
        </div>
      </div>
      <div>
        <label className={labelCls} htmlFor="gift-link">
          Link (optional)
        </label>
        <input
          id="gift-link"
          className={inputCls}
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://…"
          inputMode="url"
        />
      </div>
      <div>
        <label className={labelCls} htmlFor="gift-status">
          Status
        </label>
        <select
          id="gift-status"
          className={inputCls}
          value={status}
          onChange={(e) => setStatus(e.target.value as GiftStatus)}
        >
          {(Object.keys(STATUS_LABELS) as GiftStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button type="submit" className={btnPrimary} disabled={save.isPending || !title.trim() || !category}>
          {gift ? "Save entry" : "Add to the List"}
        </button>
        <button type="button" className={btnGhost} onClick={onDone}>
          Cancel
        </button>
      </div>
      {wordErr && (
        <p className="text-sm text-[var(--danger)]" role="alert">{wordErr}</p>
      )}
      {save.isError && (
        <p className="text-sm text-[var(--danger)]">{errText(save.error, "Couldn't save — try again.")}</p>
      )}
    </form>
  );
}

function WishlistSection({ state }: { state: State }) {
  const invalidate = useInvalidate();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Gift | null>(null);
  const setStatus = useMutation({
    mutationFn: (args: { id: number; status: GiftStatus }) => api.setGiftStatus(args),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.deleteListItem({ id }),
    onSuccess: invalidate,
  });

  // ONLY your own desires live on this list (Erin's direction,
  // 2026-11-04: "remove everybody else's desires off of that
  // list inside of the profiles"). Entries tied to a member are
  // THAT member's desires — they are not shown here at all, not
  // even grouped "For …": they show on that member's own
  // profile, and pop up with their match and their dates.
  // Yours = the General entries (no person tied), up to 3.
  const mine = state.gifts.filter(
    (g) => g.personId === null || g.personId === undefined,
  );

  const desireRow = (g: Gift) => (
    <li
      key={g.id}
      className="rounded-2xl bg-[var(--surface-alt)] px-3 py-2"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-[var(--text)]">
            🎁 {g.title}
          </p>
          <p className="text-sm text-[var(--dim)]">
            {g.personName ? `For ${g.personName}` : "General"}
            {g.category && ` · ${g.category}`}
            {g.occasion && ` · ${g.occasion}`}
            {g.priceNote && ` · ${g.priceNote}`}
            {` · ${STATUS_LABELS[g.status]}`}
          </p>
          {g.link && (
            <a
              href={g.link}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-semibold text-[var(--accent)] underline"
            >
              Open link
            </a>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <button
            type="button"
            className="text-sm font-semibold text-[var(--accent)]"
            onClick={() => setEditing(g)}
          >
            Edit
          </button>
          <button
            type="button"
            className="text-sm font-semibold text-[var(--danger)]"
            aria-label={`Delete desire ${g.title}`}
            onClick={() => remove.mutate(g.id)}
            disabled={remove.isPending}
          >
            Delete
          </button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {(Object.keys(STATUS_LABELS) as GiftStatus[])
          .filter((s) => s !== g.status)
          .map((s) => (
            <button
              key={s}
              type="button"
              className={btnGhost}
              onClick={() => setStatus.mutate({ id: g.id, status: s })}
              disabled={setStatus.isPending}
            >
              Mark {STATUS_LABELS[s].toLowerCase()}
            </button>
          ))}
      </div>
    </li>
  );

  return (
    <section className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-lg text-[var(--text)]">Desires</h3>
        <button
          type="button"
          className={btnGhost}
          onClick={() => {
            setEditing(null);
            setShowForm((v) => !v);
          }}
          aria-expanded={showForm}
        >
          {showForm ? "Close" : "Add a desire"}
        </button>
      </div>
      <p className="mt-1 text-sm text-[var(--dim)]">
        Your desires only, edited here in Edit profile — up to 3.
        Everybody else&apos;s desires stay on their own profile —
        they&apos;re not on this list. Yours pop up with your Matches
        and on your Dates — they don&apos;t show on your finished
        profile.
      </p>

{showForm && (
        <GiftForm state={state} gift={null} onDone={() => setShowForm(false)} />
      )}
      {editing && (
        <GiftForm state={state} gift={editing} onDone={() => setEditing(null)} />
      )}

      {mine.length === 0 && !showForm ? (
        <p className="mt-3 text-sm text-[var(--dim)]">
          No desires yet — add one above and it joins your List here.
        </p>
      ) : (
        <div className="mt-3">
          <h4 className="text-sm font-bold text-[var(--text)]">
            Your desires
            <span className="ml-2 text-xs font-semibold text-[var(--dim)]">
              {mine.length}/3
            </span>
          </h4>
          <ul className="mt-1.5 space-y-1.5">{mine.map(desireRow)}</ul>
        </div>
      )}
    </section>
  );
}

// ---------- Profile + Safety tab ----------

// ---------- promo codes ----------

function PromoCodesSection({
  codes,
  bare = false,
}: {
  codes: PromoCode[];
  bare?: boolean;
}) {
  const invalidate = useInvalidate();
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [copyFailedId, setCopyFailedId] = useState<number | null>(null);
  const [wordErr, setWordErr] = useState("");

  const create = useMutation({
    mutationFn: () => {
      const parsed = Number(maxUses);
      return api.createPromoCode({
        code,
        label,
        maxUses:
          maxUses.trim() === "" || !Number.isFinite(parsed) || parsed < 1
            ? null
            : Math.floor(parsed),
      });
    },
    onSuccess: () => {
      setCode("");
      setLabel("");
      setMaxUses("");
      invalidate();
    },
  });
  const toggle = useMutation({
    mutationFn: (args: { id: number; active: boolean }) =>
      api.setPromoCodeActive(args),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.deletePromoCode({ id }),
    onSuccess: invalidate,
  });

  const copyInvite = async (c: PromoCode) => {
    const text = `Join me on List Dating™ (listdating.com) — whatever's on the list. Use promo code ${c.code} to become a member.`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(c.id);
      setCopyFailedId(null);
    } catch {
      setCopiedId(null);
      setCopyFailedId(c.id);
    }
  };

  return (
    <section>
      {!bare && <SectionTitle>Promo codes</SectionTitle>}

      <form
        className="mt-3 space-y-3 rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const wErr = wordingErrorFor(code, label);
          if (wErr) {
            setWordErr(wErr);
            return;
          }
          setWordErr("");
          create.mutate();
        }}
      >
        <div>
          <label className={labelCls} htmlFor="promo-code">
            Code (leave blank and we&apos;ll make one)
          </label>
          <input
            id="promo-code"
            className={inputCls}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. NORTHSHORE"
            autoCapitalize="characters"
            autoComplete="off"
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="promo-label">
            Who&apos;s it for? (just for you)
          </label>
          <input
            id="promo-label"
            className={inputCls}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. First circle of members"
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="promo-max">
            Max joins (blank = no limit)
          </label>
          <input
            id="promo-max"
            className={inputCls}
            type="number"
            min={1}
            inputMode="numeric"
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            placeholder="No limit"
          />
        </div>
        <button type="submit" className={btnPrimary} disabled={create.isPending}>
          Create promo code
        </button>
        {wordErr && (
          <p className="text-sm text-[var(--danger)]" role="alert">{wordErr}</p>
        )}
        {create.isError && (
          <p className="text-sm text-[var(--danger)]">
            {errText(create.error, "Couldn't create that code — it may already exist, or be too short. Try another.")}
          </p>
        )}
      </form>

      {codes.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--dim)]">No codes yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {codes.map((c) => {
            const usedUp = c.maxUses !== null && c.uses >= c.maxUses;
            return (
              <li
                key={c.id}
                className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-lg font-bold tracking-wide text-[var(--text)]">
                    {c.code}
                  </span>
                  {!c.active ? (
                    <span className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-xs font-bold text-[var(--dim)]">
                      Paused
                    </span>
                  ) : usedUp ? (
                    <span className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-xs font-bold text-[var(--dim)]">
                      Used up
                    </span>
                  ) : (
                    <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs font-bold text-[#fffaf0]">
                      Active
                    </span>
                  )}
                </div>
                {c.label && (
                  <p className="mt-1 text-sm text-[var(--text)]">{c.label}</p>
                )}
                <p className="mt-1 text-sm text-[var(--dim)]">
                  {c.maxUses === null
                    ? `${c.uses} ${c.uses === 1 ? "member" : "members"} joined with this code · no limit`
                    : `${c.uses} of ${c.maxUses} joins used`}
                  {" · "}created {new Date(c.createdAt).toLocaleDateString()}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={btnPrimary}
                    onClick={() => copyInvite(c)}
                  >
                    {copiedId === c.id ? "Invite copied ✓" : "Copy invite"}
                  </button>
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => toggle.mutate({ id: c.id, active: !c.active })}
                    disabled={toggle.isPending}
                  >
                    {c.active ? "Pause code" : "Reactivate"}
                  </button>
                  <button
                    type="button"
                    className={btnDanger}
                    onClick={() => remove.mutate(c.id)}
                    disabled={remove.isPending}
                  >
                    Delete
                  </button>
                </div>
                {copyFailedId === c.id && (
                  <p className="mt-2 text-sm text-[var(--danger)]">
                    Copy failed — code: {c.code}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ---------- Meta AI: key + connection ----------

type MetaAiStatus = "none" | "saved_unverified" | "accepted" | "rejected";

function MetaAiSection({
  status,
  statusMessage,
  checkedAt,
  bare = false,
}: {
  status: MetaAiStatus;
  statusMessage: string;
  checkedAt: string | null;
  bare?: boolean;
}) {
  const invalidate = useInvalidate();
  const [key, setKey] = useState("");
  const [msg, setMsg] = useState("");
  const hasKey = status !== "none";

  const save = useMutation({
    mutationFn: () => api.saveMetaKey({ apiKey: key }),
    onSuccess: (r) => {
      setKey("");
      setMsg(r.message);
      invalidate();
    },
    onError: () => setMsg("Couldn't save the key — try again."),
  });
  const disconnect = useMutation({
    mutationFn: () => api.saveMetaKey({ apiKey: "" }),
    onSuccess: (r) => {
      setMsg(r.message);
      invalidate();
    },
    onError: () => setMsg("Couldn't remove the key — try again."),
  });
  const test = useMutation({
    mutationFn: () => api.testMetaConnection({}),
    onSuccess: (r) => setMsg(r.message),
    onError: () => setMsg("Couldn't run the connection test — try again."),
  });
  const [wonderMsg, setWonderMsg] = useState("");
  const [wonderResult, setWonderResult] = useState<{
    wonderListed: boolean;
    wonderModel: string | null;
    testAttempted: boolean;
    testSucceeded: boolean;
  } | null>(null);
  const wonder = useMutation({
    mutationFn: () => api.checkWonderAvailability({}),
    onSuccess: (r) => {
      setWonderResult({
        wonderListed: r.wonderListed,
        wonderModel: r.wonderModel,
        testAttempted: r.testAttempted,
        testSucceeded: r.testSucceeded,
      });
      setWonderMsg(r.message);
    },
    onError: () => setWonderMsg("Couldn't run the Wonder check — try again."),
  });

  const statusLine =
    status === "accepted"
      ? "✦ Meta AI on"
      : status === "rejected"
        ? "Key saved — not accepted"
        : status === "saved_unverified"
          ? "Key saved — not verified"
          : "No key saved";

  return (
    <section>
      {!bare && <SectionTitle>Meta AI</SectionTitle>}
      <div className="mt-3 space-y-3 rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="text-sm font-semibold text-[var(--text)]">{statusLine}</p>
        {hasKey && statusMessage && (
          <p className="text-xs text-[var(--dim)]">
            Last check{checkedAt ? ` · ${new Date(checkedAt).toLocaleString()}` : ""}: {statusMessage}
          </p>
        )}
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (key.trim()) save.mutate();
          }}
        >
          <label className={labelCls} htmlFor="meta-api-key">
            Meta AI API key (Meta Model API)
          </label>
          <input
            id="meta-api-key"
            type="password"
            className={inputCls}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={
              hasKey ? "Paste a new key to replace the saved one" : "Paste your key"
            }
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className={btnPrimary}
              disabled={save.isPending || !key.trim()}
            >
              {save.isPending ? "Saving & testing…" : hasKey ? "Save new key" : "Save key"}
            </button>
            {hasKey && (
              <>
                <button
                  type="button"
                  className={btnGhost}
                  onClick={() => test.mutate()}
                  disabled={test.isPending}
                >
                  {test.isPending ? "Testing…" : "Test connection"}
                </button>
                <button
                  type="button"
                  className={btnDanger}
                  onClick={() => disconnect.mutate()}
                  disabled={disconnect.isPending}
                >
                  Remove key
                </button>
              </>
            )}
          </div>
        </form>
        {msg && <p className="text-sm text-[var(--text)]">{msg}</p>}
        {hasKey && (
          <div className="space-y-2 border-t border-[var(--border)] pt-3">
            <p className="text-sm font-semibold text-[var(--text)]">
              Wonder check
            </p>
            <button
              type="button"
              className={btnGhost}
              onClick={() => wonder.mutate()}
              disabled={wonder.isPending}
              aria-label="Check Wonder availability"
            >
              {wonder.isPending ? "Checking Wonder…" : "Check Wonder"}
            </button>
            {wonderResult && (
              <p className="text-sm text-[var(--text)]">
                {wonderResult.wonderListed
                  ? `Wonder listed: ${wonderResult.wonderModel ?? ""} · Test call: ${
                      wonderResult.testSucceeded
                        ? "succeeded ✓"
                        : wonderResult.testAttempted
                          ? "did not succeed"
                          : "not tried"
                    }`
                  : "Wonder listed: no · Test call: not tried"}
              </p>
            )}
            {wonderMsg && (
              <p className="text-sm text-[var(--text)]">{wonderMsg}</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ---------- Spark vs Wonder + Private vs Public comparisons ----------
//
// One section, two comparisons Erin asked to see in the app:
// 1) Spark vs Wonder — for each test person already in the app,
//    the SAME match-note prompt and the SAME date-plan prompt run
//    on Spark (muse-spark-1.3, the default) and on Wonder
//    (muse-wonder-1.0), and both versions sit side by side.
//    Running a comparison uses the saved key server-side only and
//    changes nothing else: Spark stays the default writer.
// 2) Private app vs public website — a plain report of what each
//    one can and cannot do, and why the same live test can only
//    run here.

type ModelComparison = State["modelComparisons"][number];

function modelStatusLabel(status: string, modelLabel: string): string {
  if (status === "meta-ai") return `Written by Meta AI — ${modelLabel}`;
  if (status === "list") return "List fallback — this model didn't write this one";
  return "Not run yet";
}

function SideBySidePair({
  sparkTitle,
  wonderTitle,
  sparkText,
  wonderText,
  sparkStatus,
  wonderStatus,
  datePlan = false,
}: {
  sparkTitle: string;
  wonderTitle: string;
  sparkText: string;
  wonderText: string;
  sparkStatus: string;
  wonderStatus: string;
  // Date-plan pairs only: Spark (the app's default writer) gets
  // the upgraded island date-plan surface and the red hibiscus
  // accent, matching the generated date plan card. Wonder stays
  // plain — comparison only, never the default.
  datePlan?: boolean;
}) {
  const bothRun = sparkText.trim() !== "" && wonderText.trim() !== "";
  const identical = bothRun && sparkText.trim() === wonderText.trim();
  return (
    <div>
      <div className="grid gap-3 md:grid-cols-2">
        <div
          className={
            datePlan
              ? "date-plan-surface rounded-3xl p-3"
              : "rounded-3xl bg-[var(--surface-alt)] p-3"
          }
        >
          <p className="flex items-center gap-2 text-sm font-bold text-[var(--text)]">
            {datePlan && <HibiscusAccent size={26} />}
            {sparkTitle}
          </p>
          <p className="mt-0.5 text-xs text-[var(--dim)]">
            {modelStatusLabel(sparkStatus, "Spark")}
          </p>
          {sparkText.trim() ? (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text)]">
              {sparkText}
            </p>
          ) : (
            <p className="mt-2 text-sm text-[var(--dim)]">Not run yet.</p>
          )}
        </div>
        <div className="rounded-3xl bg-[var(--surface-alt)] p-3">
          <p className="text-sm font-bold text-[var(--text)]">{wonderTitle}</p>
          <p className="mt-0.5 text-xs text-[var(--dim)]">
            {modelStatusLabel(wonderStatus, "Wonder")}
          </p>
          {wonderText.trim() ? (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text)]">
              {wonderText}
            </p>
          ) : (
            <p className="mt-2 text-sm text-[var(--dim)]">Not run yet.</p>
          )}
        </div>
      </div>
      {bothRun && (
        <p className="mt-2 text-xs font-semibold text-[var(--dim)]">
          {identical
            ? "Same words both times — no difference on this one."
            : "Different words — Spark and Wonder wrote this differently."}
        </p>
      )}
    </div>
  );
}

function ModelComparisonSection({
  state,
  bare = false,
}: {
  state: State;
  bare?: boolean;
}) {
  const invalidate = useInvalidate();
  const testPeople = state.people.filter((p) => p.name.startsWith("Test — "));
  const byPerson = new Map<number, ModelComparison>(
    state.modelComparisons.map((c) => [c.personId, c]),
  );
  const [running, setRunning] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [runErr, setRunErr] = useState("");
  const hasKey = state.profile.metaAiStatus !== "none";
  const allCompared =
    testPeople.length > 0 &&
    testPeople.every((p) => {
      const c = byPerson.get(p.id);
      return (
        !!c &&
        c.sparkMatchNote.trim() !== "" &&
        c.wonderMatchNote.trim() !== "" &&
        c.sparkDatePlan.trim() !== "" &&
        c.wonderDatePlan.trim() !== ""
      );
    });
  const sparkModel =
    state.modelComparisons[0]?.sparkModel ?? "muse-spark-1.3";
  const wonderModel =
    state.modelComparisons[0]?.wonderModel ?? "muse-wonder-1.0";

  const runForPerson = async (person: Person) => {
    setProgress(`${person.name}…`);
    await api.compareMatchNote({ personId: person.id });
    await api.compareDatePlan({ personId: person.id });
  };

  const runOne = async (person: Person) => {
    if (running) return;
    setRunErr("");
    setRunning(person.name);
    try {
      await runForPerson(person);
      setProgress(`Done — ${person.name}.`);
    } catch {
      setRunErr(`Couldn't finish ${person.name} — try again.`);
    } finally {
      setRunning(null);
      invalidate();
    }
  };

  const runAll = async () => {
    if (running || testPeople.length === 0) return;
    setRunErr("");
    setRunning("all");
    try {
      for (const person of testPeople) {
        await runForPerson(person);
        invalidate();
      }
      setProgress("Done.");
    } catch {
      setRunErr("Stopped partway — try again.");
    } finally {
      setRunning(null);
      invalidate();
    }
  };

  return (
    <section aria-label="Spark versus Wonder comparison">
      {!bare && <SectionTitle>Spark vs Wonder</SectionTitle>}
      <p className="mt-1 text-sm text-[var(--dim)]">
        Same people · same List · two models.
      </p>
      <div className="mt-3 space-y-4 rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-4">
        {!hasKey && (
          <p className="text-sm text-[var(--text)]">No key saved.</p>
        )}
        {testPeople.length === 0 ? (
          <p className="text-sm text-[var(--text)]">No test people.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={btnPrimary}
                onClick={() => void runAll()}
                disabled={running !== null || !hasKey}
                aria-label="Run the Spark versus Wonder comparison for all test people"
              >
                {running === "all" ? "Running…" : "Run all"}
              </button>
              <span className="text-xs text-[var(--dim)]">
                {testPeople.length} test people
              </span>
            </div>
            {progress && (
              <p className="text-sm text-[var(--text)]" role="status">
                {progress}
              </p>
            )}
            {runErr && (
              <p className="text-sm text-[var(--danger)]" role="alert">
                {runErr}
              </p>
            )}
            {testPeople.map((person) => {
              const c = byPerson.get(person.id);
              const firstName = person.name.replace(/^Test — /, "");
              // Stale run: a percent written inside a stored note
              // no longer matches this person's current percent
              // (their List changed since the run). The stored
              // words are never edited — the row is just labelled
              // old, and Re-run is the fresh step.
              const storedPercents = [c?.sparkMatchNote, c?.wonderMatchNote]
                .flatMap((t) =>
                  [...(t ?? "").matchAll(/(\d{1,3})\s*%/g)].map((m) =>
                    Number(m[1]),
                  ),
                )
                .filter((n) => Number.isFinite(n));
              const staleRun =
                !!c &&
                person.matchPercent !== null &&
                storedPercents.some((pct) => pct !== person.matchPercent);
              return (
                <article
                  key={person.id}
                  className="space-y-4 rounded-3xl border border-[var(--border)] p-3"
                  aria-label={`Spark versus Wonder for ${person.name}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-display text-lg text-[var(--text)]">
                      {person.name}
                      {person.matchPercent !== null && (
                        <span className="ml-2 text-sm font-semibold text-[var(--dim)]">
                          {person.matchPercent}% match
                        </span>
                      )}
                      {staleRun && (
                        <span className="ml-2 rounded-full border border-[var(--gold)] bg-[var(--surface)] px-2.5 py-1 text-xs font-bold text-[var(--text)]">
                          Old run — re-run
                        </span>
                      )}
                    </h4>
                    <button
                      type="button"
                      className={btnGhost}
                      onClick={() => void runOne(person)}
                      disabled={running !== null || !hasKey}
                      aria-label={`Run Spark versus Wonder comparison for ${person.name}`}
                    >
                      {running === person.name
                        ? "Running…"
                        : c
                          ? `Re-run for ${firstName}`
                          : `Run for ${firstName}`}
                    </button>
                  </div>

                  <div>
                    <h5 className="text-sm font-bold text-[var(--text)]">
                      Match note
                    </h5>
                    <div className="mt-2">
                      <SideBySidePair
                        sparkTitle={`Spark · ${c?.sparkModel ?? sparkModel}`}
                        wonderTitle={`Wonder · ${c?.wonderModel ?? wonderModel}`}
                        sparkText={c?.sparkMatchNote ?? ""}
                        wonderText={c?.wonderMatchNote ?? ""}
                        sparkStatus={c?.sparkMatchNoteStatus ?? ""}
                        wonderStatus={c?.wonderMatchNoteStatus ?? ""}
                      />
                    </div>
                  </div>

                  <div>
                    <h5 className="text-sm font-bold text-[var(--text)]">
                      Date plan
                      {c?.dateIdeaText ? ` · ${c.dateIdeaText}` : ""}
                    </h5>
                    <div className="mt-2">
                      <SideBySidePair
                        sparkTitle={`Spark · ${c?.sparkModel ?? sparkModel}`}
                        wonderTitle={`Wonder · ${c?.wonderModel ?? wonderModel}`}
                        sparkText={c?.sparkDatePlan ?? ""}
                        wonderText={c?.wonderDatePlan ?? ""}
                        sparkStatus={c?.sparkDatePlanStatus ?? ""}
                        wonderStatus={c?.wonderDatePlanStatus ?? ""}
                        datePlan
                      />
                    </div>
                  </div>
                  {c && (
                    <p className="text-xs text-[var(--dim)]">
                      Last run {new Date(c.updatedAt).toLocaleString()} · saved
                      here so you can re-read both without running it again.
                    </p>
                  )}
                </article>
              );
            })}
          </>
        )}
      </div>

      <div className="mt-5">
        <SectionTitle>Private app vs public website</SectionTitle>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-4">
            <h4 className="font-display text-lg text-[var(--text)]">
              This app
            </h4>
            <ul className="mt-2 space-y-1 text-sm text-[var(--text)]">
              <li>✓ Live matching</li>
              <li>✓ People saved</li>
              <li>✓ Meta AI on your key</li>
              <li>{allCompared ? "✓ Test saved above" : "✓ Test runs here"}</li>
            </ul>
          </div>
          <div className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-4">
            <h4 className="font-display text-lg text-[var(--text)]">
              Public website — listdating.com
            </h4>
            <ul className="mt-2 space-y-1 text-sm text-[var(--text)]">
              <li>Demo only</li>
              <li>Sample people</li>
              <li>Nothing saved</li>
              <li>No live AI</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- Desires with a match / a date (display only) ----------
//
// Desires pop up WITH the match and WITH the date (Erin's
// direction, 2026-11-04, superseding the same-day "back on
// finished profiles" pass): when a match pops up — and again
// on that person's dates — both desire lists show together:
// the other person's desires (their gift-kind entries on The
// List) and your own General desires. Desires do NOT show on
// YOUR finished Profile preview at all; on a member's own
// profile page only THAT member's desires show, as their List
// (same-day direction) — never everybody's mixed together.
// They are a SEPARATE store from Wants / Needs and Provides
// (gift-kind List entries), never mixed in even when the same
// words appear on both sides, and they never count toward a
// match %. Editing your own lives in Edit profile (the Desires
// section there — yours only, up to 3); a member's desires are
// edited on that member's Edit.
function DesiresWithPerson({
  gifts,
  personId,
  personName,
  onlyTheirs = false,
}: {
  gifts: Gift[];
  personId: number;
  personName: string;
  // On a member's own profile page (Erin's direction,
  // 2026-11-04): ONLY that member's desires show there —
  // each profile carries its own person's desires, and nobody
  // else's (not yours, not another member's) is included.
  // The match card and the date card keep the default: both
  // sides pop up together there.
  onlyTheirs?: boolean;
}) {
  const theirs = gifts.filter((g) => g.personId === personId);
  const mine = onlyTheirs
    ? []
    : gifts.filter(
        (g) => g.personId === null || g.personId === undefined,
      );
  if (theirs.length === 0 && mine.length === 0) return null;
  const line = (g: Gift) =>
    `${g.title}${g.category ? ` (${g.category})` : ""} · ${STATUS_LABELS[g.status]}`;
  return (
    <div
      className="mt-3 rounded-3xl bg-[var(--surface-alt)] px-4 py-3"
      aria-label={
        onlyTheirs
          ? `Desires — ${personName}'s only`
          : `Desires — yours and ${personName}'s`
      }
    >
      <p className="text-xs font-bold text-[var(--dim)]">
        🎁 Desires
      </p>
      {theirs.length > 0 && (
        <p className="mt-1 text-sm text-[var(--text)]">
          <span className="font-semibold">{personName}&apos;s desires:</span>{" "}
          {theirs.map(line).join(" · ")}
        </p>
      )}
      {mine.length > 0 && (
        <p className="mt-1 text-sm text-[var(--text)]">
          <span className="font-semibold">Your desires:</span>{" "}
          {mine.map(line).join(" · ")}
        </p>
      )}
    </div>
  );
}

// ---------- Finished profile (the ad members see) ----------
//
// The finished profile is NOT the editor. Clean display only:
// photo, name, age, location, times, bio, My List Wants, My
// Provides and Dealbreakers background — no Desires here at
// all (Erin's direction, 2026-11-04: Desires are edited in
// Edit profile and pop up with Matches and Dates instead), no
// internal tools, no inputs, no private settings and no map
// panel. Editing lives in the separate Edit view; the
// internal tools live in Help → Tools. This view is what you
// check after you edit.

function FinishedProfileView({
  state,
  onEdit,
  justSaved,
  onGoMatches,
  onGoDates,
  startHereSignal,
}: {
  state: State;
  onEdit: (anchor?: string) => void;
  justSaved: boolean;
  onGoMatches: () => void;
  onGoDates: () => void;
  startHereSignal: number;
}) {
  const p = state.profile;
  const displayName = p.name.trim() || "You";
  const scored = state.listItems.filter((i) => i.kind !== "gift");
  // Finished Profile layout: photo, name, age, location, times,
  // Usually around, bio, My List Wants, My Provides, Dealbreakers
  // background — then the app footer. NO Safety box here either (Erin's
  // direction, 2026-11-04): Safety lives in the Help area.
  // NO Desires section here (Erin's direction, 2026-11-04):
  // Desires are edited in Edit profile and show with Matches
  // and Dates, never on this preview.
  const dealbreakers = scored.filter((i) => i.kind === "dealbreaker");
  return (
    <div className="space-y-5">
      {/* The core flow steps are a pop-up help box over this view
          (StartHerePopup) — not a permanent panel and never shown
          by default on Profile, Matches or Dates. It appears only
          when the start-here box is requested from the top of the
          hamburger menu; you X / Hide it and it disappears again.
          The preview of the profile itself is the landing view
          below it. */}
      <StartHerePopup
        state={state}
        startHereSignal={startHereSignal}
        onEditList={() => onEdit("core-my-list")}
        onEditProvides={() => onEdit("core-my-provides")}
        onGoMatches={onGoMatches}
        onGoDates={onGoDates}
      />
      <div>
        <SectionTitle>Preview profile</SectionTitle>
      </div>

      {justSaved && (
        <p
          role="status"
          className="rounded-3xl border border-[var(--gold)] bg-[var(--surface-alt)] px-3 py-2 text-sm font-semibold text-[var(--text)]"
        >
          Saved ✓
        </p>
      )}

      <article className="overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <div className="p-4 pb-0">
          {p.photos.length > 0 ? (
            <PhotoGallery photos={p.photos} name={displayName} />
          ) : (
            <div className="mb-3 flex h-40 items-center justify-center rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface-alt)] px-4 text-center">
              <p className="text-sm text-[var(--dim)]">
                No photos yet — add one in Edit.
              </p>
            </div>
          )}
        </div>
        <div className="p-4 pt-1">
          <div className="flex items-start gap-3">
            <Avatar name={displayName} size="lg" photoUrl={p.photos[0]?.url} />
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-3xl text-[var(--text)]">
                {displayName}
                {p.age !== null && (
                  <span className="font-semibold text-[var(--dim)]">, {p.age}</span>
                )}
              </h3>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {p.location.trim() && (
                  <span className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-xs font-semibold text-[var(--text)]">
                    ⌖ {p.location}
                  </span>
                )}
                {p.availableTimes.trim() && (
                  <span className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-xs font-semibold text-[var(--text)]">
                    ◷ Available {p.availableTimes}
                  </span>
                )}
              </div>
              {/* Usually around — same place and style as on a
                  member's Open Profile (Erin, 2026-11-04): right
                  under the location / times line, above About,
                  as a plain "Usually around: …" line. */}
              {(p.spot ?? "").trim() && (
                <p className="mt-1 text-sm text-[var(--dim)]">
                  Usually around: {publicSpotLabel(p.spot)}
                </p>
              )}
            </div>
          </div>
          {p.bio ? (
            <div className="mt-3 rounded-3xl bg-[var(--surface-alt)] px-4 py-3">
              <p className="text-xs font-bold text-[var(--dim)]">About me</p>
              <p className="mt-1 whitespace-pre-wrap font-display text-lg leading-snug text-[var(--text)]">
                {p.bio}
              </p>
            </div>
          ) : null}
          {/* Clean demo view: no map panel on the finished
              profile — the only map in the app is the small
              planned-spot map on a generated date plan. */}
        </div>
      </article>

      <section className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-4" aria-label="Your List as members see it">
        <h3 className="font-display text-lg text-[var(--text)]">
          <span aria-hidden className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--pink-accent)] align-middle text-sm font-bold text-[var(--accent-ink)]">1</span>
          My List
        </h3>
        {scored.filter((i) => i.kind !== "dealbreaker").length === 0 ? (
          <p className="mt-2 text-sm text-[var(--dim)]">Nothing on your List yet.</p>
        ) : (
          <div className="mt-3">
            {/* Flat Wants — one list, no Must / Nice sections,
                and no Desires mixed in here: Desires never show
                on the finished profile at all (edited in Edit
                profile; shown with Matches and Dates). */}
            {(() => {
              const wants = scored.filter(
                (i) => i.kind === "must" || i.kind === "nice",
              );
              if (wants.length === 0) return null;
              return (
                <div>
                  <h4 className="text-sm font-bold text-[var(--text)]">Wants</h4>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {wants.map((item) => (
                      <li
                        key={item.id}
                        className="rounded-full bg-[var(--surface-alt)] px-3 py-1.5 text-sm font-semibold text-[var(--text)]"
                      >
                        {item.category ? `${item.category} — ` : ""}
                        {item.text}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}
          </div>
        )}
      </section>

      <section className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-4" aria-label="What you can provide as members see it">
        <h3 className="font-display text-lg text-[var(--text)]">
          <span aria-hidden className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--pink-accent)] align-middle text-sm font-bold text-[var(--accent-ink)]">2</span>
          My Provides
        </h3>
        {p.provides.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--dim)]">Nothing listed yet.</p>
        ) : (
          <>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {p.provides.map((pv) => (
                <li key={pv.id} className="rounded-full bg-[var(--surface-alt)] px-3 py-1.5 text-sm font-semibold text-[var(--text)]">
                  {pv.title}
                  {pv.maxSpendCents !== null && pv.maxSpendCents > 0
                    ? ` · up to ${fmtBudget(pv.maxSpendCents)}`
                    : ""}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* NO Desires on the finished profile (Erin's direction,
          2026-11-04): Desires are edited in Edit profile and
          they pop up with Matches and on Dates — the profile
          preview stays clean, with no other people's names on
          it. */}

      {/* Dealbreakers — background only, shown quietly here so
          the finished profile is complete: they never count
          toward a score and surface on a member's card only as
          a quiet warning when one clashes. Editable in Profile
          Edit. */}
      <section className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3" aria-label="Your dealbreakers, background only">
        <h3 className="text-sm font-bold text-[var(--dim)]">
          Dealbreakers · background
        </h3>
        {dealbreakers.length === 0 ? (
          <p className="mt-1 text-sm text-[var(--dim)]">None set.</p>
        ) : (
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {dealbreakers.map((item) => (
              <li
                key={item.id}
                className="rounded-full bg-[var(--surface-alt)] px-3 py-1.5 text-sm font-semibold text-[var(--text)]"
              >
                {item.text}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Edit profile lives at the BOTTOM of the preview now
          (Erin, 2026-11-04): moved down from beside the
          "Preview profile" title to underneath the
          Dealbreakers list — same button, same Edit profile. */}
      <div>
        <button
          type="button"
          className={btnPrimary}
          onClick={() => onEdit()}
          aria-label="Edit my profile"
        >
          Edit profile
        </button>
      </div>
    </div>
  );
}

// Safety lives in HELP (Erin's direction, 2026-11-04,
// superseding the 2026-11-03 "on the finished Profile" pass):
// the Safety box — blocked members, reports and safety
// check-ins — sits in the Help area as its own Safety area,
// NOT in the main Profile view and not in anybody's profile
// view. Same box, same controls (Unblock, End early), new home.
function SafetySection({ state }: { state: State }) {
  const invalidate = useInvalidate();
  const unblock = useMutation({
    mutationFn: (personId: number) => api.setBlocked({ personId, blocked: false }),
    onSuccess: invalidate,
  });
  const endCheckin = useMutation({
    mutationFn: (id: number) => api.endSafetyCheckin({ id }),
    onSuccess: invalidate,
  });
  const [showSafetyHistory, setShowSafetyHistory] = useState(false);
  const blocked = state.people.filter((x) => x.blocked);
  return (
    <section>
      <SectionTitle>Safety</SectionTitle>
      <div className="mt-3 space-y-4 rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-4">
        <div>
          <h3 className="font-bold text-[var(--text)]">Blocked members</h3>
          {blocked.length === 0 ? (
            <p className="mt-1 text-sm text-[var(--dim)]">Nobody blocked.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {blocked.map((x) => (
                <li
                  key={x.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--surface-alt)] px-3 py-2"
                >
                  <span className="font-semibold text-[var(--text)]">{x.name}</span>
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => unblock.mutate(x.id)}
                    disabled={unblock.isPending}
                  >
                    Unblock
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="font-bold text-[var(--text)]">Reports you&apos;ve filed</h3>
          {state.reports.length === 0 ? (
            <p className="mt-1 text-sm text-[var(--dim)]">No reports filed.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {state.reports.map((r) => (
                <li key={r.id} className="rounded-2xl bg-[var(--surface-alt)] px-3 py-2">
                  <p className="text-sm font-semibold text-[var(--text)]">
                    {r.personName} — {r.reason}
                  </p>
                  {r.note && <p className="text-sm text-[var(--dim)]">{r.note}</p>}
                  <p className="text-xs text-[var(--dim)]">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 text-left"
            aria-expanded={showSafetyHistory}
            aria-label={`Safety check-ins — ${showSafetyHistory ? "hide" : "show"} history`}
            onClick={() => setShowSafetyHistory((v) => !v)}
          >
            <span className="font-bold text-[var(--text)]">Safety check-ins</span>
            <span aria-hidden className="text-lg font-bold text-[var(--dim)]">
              {showSafetyHistory ? "▾" : "›"}
            </span>
          </button>
          {showSafetyHistory &&
            (state.safetyCheckins.length === 0 ? (
              <p className="mt-1 text-sm text-[var(--dim)]">No check-ins yet.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {[...state.safetyCheckins]
                  .sort((a, b) => b.id - a.id)
                  .slice(0, 5)
                  .map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--surface-alt)] px-3 py-2"
                    >
                      <span className="text-sm text-[var(--text)]">
                        🛡 <span className="font-semibold">{c.ideaText}</span>{" "}
                        with {c.personName} ·{" "}
                        {safetyDurationLabel(c.durationMinutes)} ·{" "}
                        {c.status === "active"
                          ? `on — ends ${fmtDateTime(c.endsAt)} (${timeLeft(c.endsAt)})`
                          : c.status === "ended_early"
                            ? "ended early — all good"
                            : "ended on its own"}
                      </span>
                      {c.status === "active" && (
                        <button
                          type="button"
                          className={btnGhost}
                          onClick={() => endCheckin.mutate(c.id)}
                          disabled={endCheckin.isPending}
                          aria-label={`End the safety check-in for ${c.ideaText} with ${c.personName} early`}
                        >
                          End early
                        </button>
                      )}
                    </li>
                  ))}
              </ul>
            ))}
        </div>
      </div>
    </section>
  );
}

function ProfileTab({
  state,
  onGoMatches,
  onGoDates,
  startHereSignal,
}: {
  state: State;
  onGoMatches: () => void;
  onGoDates: () => void;
  startHereSignal: number;
}) {
  const invalidate = useInvalidate();
  const [mode, setMode] = useState<"finished" | "edit">("finished");
  const [justSaved, setJustSaved] = useState(false);
  // Where a core-flow step button wants to land inside Edit
  // ("core-my-list" / "core-my-provides"); scrolled to once Edit
  // has rendered.
  const [pendingAnchor, setPendingAnchor] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "edit" || !pendingAnchor) return;
    const t = setTimeout(() => {
      document
        .getElementById(pendingAnchor)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      setPendingAnchor(null);
    }, 80);
    return () => clearTimeout(t);
  }, [mode, pendingAnchor]);
  const p = state.profile;
  const [name, setName] = useState(p.name);
  const [age, setAge] = useState(p.age !== null ? String(p.age) : "");
  const [bio, setBio] = useState(p.bio);
  const [location, setLocation] = useState(p.location);
  const [availableTimes, setAvailableTimes] = useState(p.availableTimes);
  const [spot, setSpot] = useState(p.spot ?? "");
  const [gender, setGender] = useState<Gender>(p.gender);
  const [sameSex, setSameSex] = useState(p.sameSex);
  const [discoverable, setDiscoverable] = useState(p.discoverable);
  const [contactPref, setContactPref] = useState<ContactPref>(p.contactPref);
  const [saved, setSaved] = useState(false);
  const [wordErr, setWordErr] = useState("");

  useEffect(() => {
    setName(p.name);
    setAge(p.age !== null ? String(p.age) : "");
    setBio(p.bio);
    setLocation(p.location);
    setAvailableTimes(p.availableTimes);
    setSpot(p.spot ?? "");
    setGender(p.gender);
    setSameSex(p.sameSex);
    setDiscoverable(p.discoverable);
    setContactPref(p.contactPref);
    // Only resync when the saved profile identity changes wholesale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.name, p.age, p.bio, p.location, p.availableTimes, p.spot, p.gender, p.sameSex, p.discoverable, p.contactPref]);

  const save = useMutation({
    mutationFn: () =>
      api.saveProfile({
        name,
        age: parseAge(age),
        bio,
        location,
        availableTimes,
        spot,
        gender,
        sameSex,
        // No qualities section any more — matching is the List.
        // Pass the stored value through so saving never wipes it.
        qualities: p.qualities,
        // No "looking for a mate" field any more — matching is the
        // List. Pass the stored value through so saving never wipes it.
        lookingFor: p.lookingFor,
        discoverable,
        contactPref,
      }),
    onSuccess: () => {
      setSaved(true);
      setJustSaved(true);
      invalidate();
      setMode("finished");
    },
  });

  if (mode === "finished") {
    return (
      <div className="space-y-6">
        <FinishedProfileView
          state={state}
          justSaved={justSaved}
          startHereSignal={startHereSignal}
          onGoMatches={onGoMatches}
          onGoDates={onGoDates}
          onEdit={(anchor) => {
            setJustSaved(false);
            setSaved(false);
            setPendingAnchor(anchor ?? null);
            setMode("edit");
          }}
        />
        {/* NO Safety box on the profile view (Erin's
            direction, 2026-11-04): the Safety box — blocked
            members, reports, safety check-ins — lives in the
            Help area now, not in anybody's profile view. */}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-[var(--gold)] bg-[var(--surface-alt)] px-4 py-3">
        <div>
          <p className="font-bold text-[var(--text)]">Editing your profile</p>
          <p className="text-sm text-[var(--dim)]">Save to see it finished.</p>
        </div>
        <button
          type="button"
          className={btnPrimary}
          onClick={() => setMode("finished")}
          aria-label="View my finished profile"
        >
          View finished profile
        </button>
      </div>
      <section>
        <SectionTitle>Edit — My Profile</SectionTitle>
        <form
          className="mt-3 space-y-3 rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const wErr = wordingErrorFor(name, bio, location, availableTimes);
            if (wErr) {
              setWordErr(wErr);
              return;
            }
            setWordErr("");
            setSaved(false);
            save.mutate();
          }}
        >
          <div className="flex items-center gap-3">
            <Avatar name={name || "You"} size="lg" photoUrl={p.photos[0]?.url} />
            <div className="flex-1">
              <label className={labelCls} htmlFor="my-name">
                Name
              </label>
              <input
                id="my-name"
                className={inputCls}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name or nickname"
              />
            </div>
          </div>
          {p.photos.length > 0 && <PhotoGallery photos={p.photos} name={name || "You"} />}
          <PhotoManager photos={p.photos} target="profile" personId={null} label="My photos" />
          <AgeInput label="My age" value={age} onChange={setAge} />
          <GenderFields
            subject="I am"
            gender={gender}
            setGender={setGender}
            sameSex={sameSex}
            setSameSex={setSameSex}
          />
          <p className="-mt-1 text-xs text-[var(--dim)]">
            Matching is heterosexual by default: with “I am” set,
            Matches show the opposite sex. The pride Same sex button
            switches you to same-sex matching. This setting lives
            here, in Edit profile — Matches just shows who it
            selects.
          </p>
          <div>
            <label className={labelCls} htmlFor="my-bio">
              Bio
            </label>
            <textarea
              id="my-bio"
              className={inputCls}
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Your world, your adventures, what makes you you…"
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="my-location">
              Location
            </label>
            <input
              id="my-location"
              className={inputCls}
              value={location}
              maxLength={120}
              placeholder="e.g. North Shore, O'ahu — type it your way"
              onChange={(e) => setLocation(e.target.value)}
            />
            <p className="mt-1 text-xs text-[var(--dim)]">Shows on your profile.</p>
          </div>
          <div>
            <label className={labelCls} htmlFor="my-available-times">
              Times I&apos;m available
            </label>
            <input
              id="my-available-times"
              className={inputCls}
              value={availableTimes}
              maxLength={200}
              placeholder="e.g. Weekday evenings, Saturday afternoons"
              onChange={(e) => setAvailableTimes(e.target.value)}
            />
            <p className="mt-1 text-xs text-[var(--dim)]">Shown so dates fit your time.</p>
          </div>
          <div>
            <label className={labelCls} htmlFor="my-spot">
              Usually around
            </label>
            <SpotSelect
              id="my-spot"
              value={spot}
              onChange={setSpot}
              firstOptionLabel="No regular spot"
              subjectAge={parseAge(age)}
            />
          </div>
          <label className="flex items-center gap-3 text-base font-semibold text-[var(--text)]">
            <input
              type="checkbox"
              className="h-6 w-6 accent-[var(--accent)]"
              checked={discoverable}
              onChange={(e) => setDiscoverable(e.target.checked)}
            />
            Show me in Discover
          </label>
          <div>
            <span className={labelCls}>Who can contact me</span>
            <ContactSelect
              label="My contact preference"
              value={contactPref}
              onChange={setContactPref}
            />
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" className={btnPrimary} disabled={save.isPending}>
              Save my profile
            </button>
            {saved && (
              <span className="text-sm font-semibold text-[var(--accent)]">Saved ✓</span>
            )}
          </div>
          {wordErr && (
            <p className="text-sm text-[var(--danger)]" role="alert">{wordErr}</p>
          )}
          {save.isError && (
            <p className="text-sm text-[var(--danger)]">{errText(save.error, "Couldn't save — try again.")}</p>
          )}
        </form>
      </section>

      {/* Hype is killed until later (2026-11-02): no Hype
          controls or listings anywhere in the app for now. */}

      <ProfileListSection state={state} />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-[var(--gold)] bg-[var(--surface-alt)] px-4 py-3">
        <p className="text-sm font-semibold text-[var(--text)]">
          Done editing your List or Provides?
        </p>
        <button
          type="button"
          className={btnPrimary}
          onClick={() => setMode("finished")}
          aria-label="View my finished profile after editing the List"
        >
          View finished profile
        </button>
      </div>

      {/* Internal tools are NOT in Profile Edit (Erin's
          direction, 2026-11-03): Promo codes, Meta AI and
          Spark vs Wonder live in Help → Tools. Desires ARE
          edited here (2026-11-04) — the Desires section of
          the List editor above. Safety lives in Help now
          (2026-11-04) — not on any profile view. */}
    </div>
  );
}

// ---------- Help (the one place how-to explanations live) ----------
//
// Visual-first rule for the whole app: screens show photos,
// bubbles, step markers and short captions only. Every longer
// explanation lives HERE, in this one Help section, opened from
// the ? button in the header — never as paragraphs inline.

function HelpSection({
  state,
  onBack,
}: {
  state: State;
  onBack: () => void;
}) {
  const blocks: { title: string; lines: string[] }[] = [
    {
      title: "Landing & Join",
      lines: [
        "Landing — the first screen: the gold seal, List Dating™, and two buttons.",
        "Join — create a profile from the landing page, then Enter the app to your Profile.",
        "Already a member? Enter the app goes straight to Profile.",
      ],
    },
    {
      title: "The 4 steps",
      lines: [
        "1 · My List — your Wants, flat, 3 max. No sections, nothing counts double.",
        "2 · My Provides — things you can provide for someone, with a max spend if you set one.",
        "3 · Matches — people matched on those two lists.",
        "4 · First date — meet to do one real List item. Not coffee, not small talk.",
        "These steps are not shown on Matches, Dates or Profile. They live only in the start-here help box, which appears only when you tap “Show the start-here box” at the very top of the ☰ hamburger menu. X it or tap Hide and it disappears again.",
      ],
    },
    {
      title: "Matching",
      lines: [
        "Matching is heterosexual by default: set “I am” (man / woman) in Edit profile, and Matches and Potential show only people of the opposite sex to you.",
        "Push the pride Same sex button in Edit profile and your matching switches to same-sex only: Matches and Potential then show only people of the same sex as you. Push it again (in Edit profile) to switch back. The setting lives only in Edit profile — there is no mode box in Matches — and switching re-filters Matches and Potential right away.",
        "People outside your current mode are hidden, not deleted: they stay in the bank — their profile, matches, dates and chats are kept exactly as they were. Switching between heterosexual mode and Same sex mode only changes who is shown in Matches and Potential; it never deletes matches, dates, or chats. Switch modes and anyone who passes that mode shows again.",
        "New members set their own “I am” in Join, and you can set it for someone on their Edit. A member with no “I am” set does not show in Matches or Potential until it is set — gender is always stated, never guessed from a name.",
        "Meta AI match notes and date plans use a person's stated gender when one is set, and neutral language when none is set — a name alone never sets a gender.",
        "The match % is simple, and it runs both ways: your Wants covered by their Provides ÷ your Wants, and their Wants covered by your Provides ÷ their Wants — whichever direction is higher is the %. One measure only: the two directions are never added together, the same item never counts twice, and nothing is double-weighted. Covering 1 of 3 Wants is 33%, 2 of 3 is 67% — a Provide cover counts in full either way, traits and qualities never add to the %.",
        "Matching is not choosing. On every match card you decide: Deal keeps them in your Matches (marked Deal) — it does not start a date, but it does open a chat with them right away. Decline takes them out of your Matches so they no longer match with you, even if their List still lines up with yours.",
        "Declining deletes nothing and blocks nobody. Declined people wait in the Declined list at the bottom of Matches — tap Bring back and they match again, exactly as before. You can also decline someone after making a Deal with them.",
        "Match = 50% or more covered in either direction — they provide for your Wants, or you provide for theirs; both are matches. Potential = under 50% both ways, but at least one List item can happen via a Provide cover either way.",
        "Out of the Blue is the built-in surprise, marked with a little tiny wave: a person at 0% specific — no Provide covers a Want either way, so they are NOT a Match and NOT a Potential — can still show in Matches as a 2% out-of-the-blue option. The 2% is not a cover and never changes any score: specific covers stay specific, Yoga is only covered by Yoga. It is not based on Match or Potential — it is based on quantum circumstance. People love surprises.",
        "Push “Try the Out of the Blue Deal” and you choose the surprise: it makes a Deal, creates a date from an uncovered Want, and runs that date's plan with your saved Meta AI key, exactly like a normal Plan the Date. Leilani is the example: 0% specific, but an out-of-the-blue surprise with a Yoga date at Haleiwa Beach Park.",
        "A member's Provides can cover your Wants, and yours can cover their wishlist — budgets included.",
        "Dealbreaker is background only: it is not a section and never changes the score — a quiet warning shows only when a member's dealbreaker clashes with your List.",
        "Desires never count toward the % and never change a score.",
        "The List is short on purpose — 3 Wants max — so one cover moves the score a lot: 1 of 3 is 33%, 2 of 3 is 67%.",
      ],
    },
    {
      title: "Dates & Chat",
      lines: [
        "Push “Plan the date” on a Deal and the date is created and its plan is written automatically with your saved Meta AI key — no key entry, no extra tap, no confirmation. The plan is written from both full profiles — bios, Wants and Provides with their caps and notes — and it states the concrete island activity solution right in the plan, with a photo of the date. A status line shows while it writes, and the plan shows on the date when it's done.",
        "The List item is the date. Pick a day and a time inside both sides' availability.",
        "Chats only open for dates that were Deals / accepted dates: hit Deal on a match card and a chat with that person opens right away — even before the date is planned or scheduled. A Match or a Potential with no Deal has no chat at all.",
        "A chat is never deleted: if a Deal ends, the chat leaves the Chat list, and making a Deal again brings it back with everything still in it.",
        "After it happens, tap “✓ Mark date completed” on the date card in Dates or in its Chat thread. That records the time, shows “✓ Completed” on the date, and posts a short note in Chat. No voice check, no camera check, no proof photo, no location tracking — just the tap.",
        "Tapped it by mistake? Tap “Mark not completed” on the same date and it goes back to a regular date, with a short undo note in Chat too.",
        "In Chat, log a message they sent you outside the app with “Log their message” so the thread stays complete.",
      ],
    },
    {
      title: "Ages & 21+ spots",
      lines: [
        "List Dating is for members 18 to 99. Join and Edit member keep ages inside 18 to 99 — an age under 18 or over 99 can't be saved, and the form says why.",
        "Bars, night clubs, exotic places and alcohol venues are 21+ only: the nightclub & dance club spots, the speakeasies & hidden bars, and the pole dancing spots.",
        "Strip clubs are not part of List Dating at all — not listed, not suggested, and never named in a date plan. The nightclub option is generic: Matches and Provides never show a specific venue upfront — a specific nightclub venue is revealed only inside a date plan, when you push Plan the Date and Meta AI writes the plan.",
        "In every spot picker those spots sit behind a “21+ spots hidden — I'm 21+, show” link, and the link is checked against the age on record: they only show when that age is 21 or older. Under 21, or no age on record, they stay hidden and the picker says so — tapping the link never overrides the age on record.",
        "A 21+ spot only shows as a date spot when BOTH people on that date are 21 or older (21 to 99 for those spots). If either person is under 21, or their age isn't on record, those spots stay hidden for that date and a non-bar spot is offered instead — an age is never guessed.",
        "Everywhere else — beaches, museums, malls, hikes, music — stays open to every member 18 to 99.",
      ],
    },
    {
      title: "Wishlists",
      lines: [
        "Wishlist entries live on the List as Desires — what someone wants or needs, each with the same category as a Provide.",
        "Desires are separate from Wants — they never count toward a match %.",
        "Desires do not count toward the match calculation and never change a score — the % is Wants covered by Provides only.",
        "Every Desire on a wishlist is visible — nothing is sealed, and a Provide whose title really matches it can cover it.",
        "Your desires are edited in Edit profile, in the Desires section — yours only, up to 3. Nobody else's desires are on that list: a member's desires are theirs, edited on their Edit and shown on their own profile. Help only explains Desires; the list itself is never edited here.",
        "Desires never show on your finished profile. On a member's profile page you see only that member's own List — their Wants / Desires and their Provides, with their bio and the places they're usually around. When a match pops up, your Desires and theirs pop up with that match — and they show again on the date, so both sides see them there.",
      ],
    },
    {
      title: "Three and three",
      lines: [
        "Your List is flat Wants: 3 max total, no Must-haves / Nice-to-haves sections and no double weighting — every Want counts the same. Provides are 3 max too, capped independently — one side does not limit the other, so 1 Want with 3 Provides, or no Wants with 3 Provides, are both fine. Desires are separate: up to 3 of your own, edited in Edit profile and never counted in a match %; each member has up to 3 of their own on their own profile. Dealbreakers are background only — not a section, never scored.",
        "Matching is your List — what you want — against what someone can Provide, and the other way round. What someone covers shows on their own profile — open their page from Matches to see the Wants of yours they cover. A Want nobody covers is not listed anywhere.",
        "Wants, needs and Provides show on their card and profile; a member's profile shows only their own List and bio, and Desires also pop up with the match and on the date — never on your finished profile preview.",
        "Actions speak louder than words: the point is getting from chatting to actually doing the real List item — accomplishing something worthwhile in the other person's life that you can provide.",
      ],
    },
    {
      title: "Meta AI key",
      lines: [
        "Paste the full key code — the long code that starts with LLM| — not the name you gave the key.",
        "Copy it with Meta's Copy button on dev.meta.ai and paste straight into Help → Tools → Meta AI — don't save it in Notes first; Notes can wrap it and break the copy.",
        "It must be a Meta Model API key in the same team/account that holds your hackathon credits.",
        "Saving tests the key right away. It is stored only in this app's private database and never shown again.",
        "Spark writes the match notes and date plans — like a North Shore local: no rush-hour drives across the island, plans built around the real List item (a morning surf or hike, not a default dinner), and only real O'ahu spots from the app's own list.",
        "A written date plan shows on its date card with a red hibiscus, a picture, and a small map pinning the planned spot — a picked spot only, never live tracking. The picture is an actual photo of the real place when the app has one (shopping at Ala Moana Center or in Waikiki shows real photos of Ala Moana Center, Lululemon and Sephora, labelled “Actual photo”); only when no actual photo of a spot exists does a generated image stand in, labelled “Generated image”. A Lululemon plan at Ala Moana Center also shows the mall directory — the store is on Level 2, near the Ewa Wing, between Uniqlo and Coach. If the spot has no map pin, it shows as text.",
        "Check Wonder only tests whether Wonder answers on the same key — nothing switches.",
        "Spark vs Wonder (in Help → Tools) sends the same prompt to both models for each test person and shows both match notes and both date plans side by side. Spark stays the default either way.",
      ],
    },
    {
      title: "Private app vs public website",
      lines: [
        "This private app is live: real matching on your List, your people and test people saved, and Meta AI writing on your saved key.",
        "The public website (listdating.com) is a static landing page with a clickable demo: invented sample people, nothing saved, no live Meta AI.",
        "That's why the Spark vs Wonder live test can only run here — the website has no saved List, saved people, or live AI to run it on.",
      ],
    },
    {
      title: "Safety",
      lines: [
        "Meet in a public place and tell a friend where you'll be.",
        "For a confirmed date, start a safety check-in on its card: pick a length, it runs quietly and ends on its own. Your date is told it's on in Chat — no live location is ever shared, just a timer.",
        "Block or report anyone who crosses a line — one tap on their card. Reporting also blocks them and saves the report in Help → Safety, in the Safety area of this Help.",
        "If anyone makes you feel unsafe in person, leave and contact local help.",
      ],
    },
    {
      title: "Keep it clean",
      lines: [
        "List Dating is for meeting up to do something real from the List — not for hookups.",
        "Sexual or vulgar wording isn't allowed in Lists, profiles, Provides or Chat, and anything with it in can't be saved.",
        "Drug wording isn't allowed either — drug words, drug abbreviations and drug references can't be saved in Lists, profiles, Provides or Chat. The warning you see matches what was typed: a drug word gets the drug warning, a hookup or vulgar word gets the hookup warning.",
      ],
    },
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" className={btnGhost} onClick={onBack}>
          ← Back
        </button>
        <SectionTitle>Help — how it works</SectionTitle>
      </div>
      {blocks.map((b) => (
        <section
          key={b.title}
          className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm"
          aria-label={`Help — ${b.title}`}
        >
          <h3 className="font-display text-lg text-[var(--text)]">{b.title}</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-[var(--text)]">
            {b.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </section>
      ))}

      {/* The Safety area in Help (Erin's direction,
          2026-11-04): the Safety box — blocked members,
          reports you've filed, safety check-ins — lives HERE,
          in the Help area, NOT in the main Profile view and
          not in anybody's profile view. */}
      <SafetySection state={state} />

      {/* Tools — the background / settings home: the internal
          tools (Promo codes, Meta AI, Spark vs Wonder) live
          HERE, in Help. Desires are NOT edited here (Erin's
          direction, 2026-11-04): the actual Desires list —
          adding and removing items — lives in Edit profile;
          Help carries only the instructions above, never the
          list items themselves. */}
      <section id="tools" className="scroll-mt-32 space-y-4" aria-label="Tools — settings">
        <SectionTitle>Tools</SectionTitle>
        <p className="text-sm text-[var(--dim)]">
          The behind-the-scenes tools live here. Desires are
          edited in Edit profile — Help only explains them.
        </p>
        <CollapsedSection title="Promo codes">
          <PromoCodesSection codes={state.promoCodes} bare />
        </CollapsedSection>
        <CollapsedSection title="Meta AI">
          <MetaAiSection
            status={state.profile.metaAiStatus}
            statusMessage={state.profile.metaAiStatusMessage}
            checkedAt={state.profile.metaAiCheckedAt}
            bare
          />
        </CollapsedSection>
        <CollapsedSection title="Spark vs Wonder">
          <ModelComparisonSection state={state} bare />
        </CollapsedSection>
      </section>
    </div>
  );
}

// ---------- landing page (the entry, added 2026-11-02) ----------
//
// The first thing anyone sees when they open List Dating: the
// gold present seal, the name, and "whatever's on the list".
// Two ways in, nothing else:
//   · Join — opens the SAME Join form the app already has
//     (JoinForm below, unchanged: no login/password step, no new
//     invitation rule, promo code stays exactly as it was). A
//     successful join stays on the landing page with a joined
//     message and the Enter button right there.
//   · Enter the app — for existing members; goes straight to
//     Profile, where the app has always opened.
// The landing page shows on every fresh open of the app (no
// flag is stored), and it renders before the app shell, so the
// bottom menu and tabs only appear once someone enters.

function LandingPage({ onEnter }: { onEnter: () => void }) {
  const [showJoin, setShowJoin] = useState(false);
  const [joinedMsg, setJoinedMsg] = useState("");
  const joinRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (showJoin) {
      joinRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [showJoin]);

  return (
    <div className="min-h-screen text-[var(--text)]">
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 pb-10 pt-safe">
        <section
          className="surface-3d mt-6 rounded-[32px] border border-[var(--border)] px-5 py-8 text-center sm:px-8"
          aria-label="List Dating — welcome"
        >
          <span
            aria-hidden
            className="seal-glow mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-full ring-4 ring-[#c9a959]"
          >
            <PresentIcon className="h-28 w-28" />
          </span>
          <h1 className="font-display mt-5 text-5xl leading-none text-[var(--text)]">
            List Dating™
          </h1>
          <p className="mt-2 text-xl font-semibold text-[var(--gold)]">
            whatever&apos;s on the list
          </p>
          <p className="mx-auto mt-4 max-w-md text-base text-[var(--text)]">
            Not coffee. Not small talk. Something real.
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-[var(--dim)]">
            Meet to do a List item — that&apos;s the match.
          </p>

          <div className="mx-auto mt-7 flex max-w-md flex-col gap-3">
            <button
              type="button"
              className="min-h-[56px] w-full rounded-full bg-gradient-to-b from-[#ffd7ec] to-[#fdb9de] px-5 py-3 text-lg font-bold text-[var(--accent-ink)] shadow-[0_8px_20px_rgba(101,78,32,0.5),inset_0_1px_0_rgba(255,255,255,0.28)] transition active:scale-[0.98]"
              onClick={() => setShowJoin((v) => !v)}
              aria-expanded={showJoin}
              aria-label="Join — create a new profile in the app"
            >
              {showJoin ? "Close the Join form" : "Join — create a profile"}
            </button>
            <button
              type="button"
              className="min-h-[56px] w-full rounded-full bg-gradient-to-b from-[#fffdf7] via-[#fffaf0] to-[#f0d9ab] px-5 py-3 text-lg font-bold text-[var(--accent-ink)] shadow-[0_6px_16px_rgba(101,78,32,0.45),inset_0_1px_0_rgba(255,255,255,0.9)] transition active:scale-[0.98]"
              onClick={onEnter}
              aria-label="Enter the app — go to your Profile"
            >
              Enter the app
            </button>
            <p className="text-xs text-[var(--dim)]">
              Already a member? Enter the app goes to your Profile.
            </p>
          </div>
        </section>

        {joinedMsg && !showJoin && (
          <p
            role="status"
            className="surface-3d mt-4 rounded-3xl border border-[var(--gold)] px-4 py-3 text-center text-base font-semibold text-[var(--text)]"
          >
            {joinedMsg}
          </p>
        )}

        {showJoin && (
          <div ref={joinRef} className="mt-4">
            <JoinForm
              onJoined={(joinedName) => {
                setShowJoin(false);
                setJoinedMsg(
                  joinedName
                    ? `${joinedName} joined ✓ — welcome to List Dating™. Enter the app to see the new profile.`
                    : "Joined ✓ — welcome to List Dating™. Enter the app to see the new profile.",
                );
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          </div>
        )}

        <footer className="mt-auto pt-8 text-center text-xs text-[var(--dim)]">
          <span className="block">whatever&apos;s on the list · O&apos;ahu Hawaii</span>
          <span className="block">© 2026 All rights reserved, listdating.com</span>
        </footer>
      </main>
    </div>
  );
}

// ---------- app shell ----------

type Tab =
  | "discover"
  | "people"
  | "dates"
  | "messages"
  | "profile";

const TABS: { id: Tab; label: string; icon: string }[] = [
  // Core flow only, in step order: Profile holds Steps 1–2 (My
  // List, My Provides), Matches is Step 3, Dates is Step 4, then
  // Chat. Discover was taken out of the menu 2026-11-02 at the
  // user's direction — its screen stays in this file, so
  // re-adding its entry here brings it back.
  { id: "profile", label: "Profile", icon: "○" },
  { id: "people", label: "Matches", icon: "◎" },
  { id: "dates", label: "Dates", icon: "✦" },
  { id: "messages", label: "Chat", icon: "✉" },
];

export function App() {
  // Landing page first (2026-11-02): the app opens on the
  // landing page; "Enter the app" (or a finished Join) brings
  // the member into the shell, landing on Profile as before.
  const [entered, setEntered] = useState(false);
  const [tab, setTab] = useState<Tab>("profile");
  const [showHelp, setShowHelp] = useState(false);
  // Bumped by the "Show the start-here box" control at the top
  // of the hamburger menu: the start-here pop-up on Profile
  // clears its hide flag and reopens.
  const [startHereSignal, setStartHereSignal] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [threadFocus, setThreadFocus] = useState<{
    personId: number;
    stamp: number;
  } | null>(null);
  // One place per person: when set, that person's page (who they
  // are, how you matched, Hype, Date, Chat — together)
  // replaces the tab content until Back. Not a tab.
  const [placePersonId, setPlacePersonId] = useState<number | null>(null);
  const [placeFocus, setPlaceFocus] = useState<{
    personId: number;
    stamp: number;
  } | null>(null);
  const state = useQuery({
    queryKey: ["state"],
    queryFn: () => api.getState({}),
  });
  const pendingDates = useMemo(
    () => state.data?.dates.filter((d) => d.status === "proposed").length ?? 0,
    [state.data],
  );
  const unreadTotal = useMemo(
    () =>
      state.data?.people.reduce(
        (sum, x) => sum + (x.blocked || !x.chatEligible ? 0 : x.unreadCount),
        0,
      ) ?? 0,
    [state.data],
  );
  const reopenStartHere = () => {
    setStartHereHidden(false);
    setShowHelp(false);
    setPlacePersonId(null);
    setTab("profile");
    setStartHereSignal(Date.now());
    window.scrollTo({ top: 0 });
  };
  const openThread = (personId: number) => {
    setThreadFocus({ personId, stamp: Date.now() });
    setTab("messages");
  };
  const openPerson = (personId: number, focusChat = false) => {
    setPlacePersonId(personId);
    if (focusChat) setPlaceFocus({ personId, stamp: Date.now() });
  };
  const placePerson =
    state.data?.people.find(
      (p) => p.id === placePersonId && !p.blocked,
    ) ?? null;

  if (!entered) {
    return (
      <LandingPage
        onEnter={() => {
          setPlacePersonId(null);
          setShowHelp(false);
          setTab("profile");
          setEntered(true);
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="sticky top-0 z-20 bg-[var(--bg)]/95 pt-safe backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center px-4 pb-2 pt-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="seal-glow flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-[#c9a959]"
            >
              <PresentIcon />
            </span>
            <div>
              <h1 className="font-display text-[26px] leading-none text-[var(--text)]">
                List Dating™
              </h1>
              <p className="mt-1 text-xs font-semibold text-[var(--dim)]">
                whatever&apos;s on the list
              </p>
            </div>
          </div>
          <button
            type="button"
            className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--surface)] font-display text-lg font-bold text-[var(--text)] transition active:scale-[0.95]"
            onClick={() => setShowMenu(true)}
            aria-label="Menu — Help"
            aria-expanded={showMenu}
          >
            ☰
          </button>
        </div>
      </header>

      {showMenu && state.data && (
        <div className="fixed inset-0 z-40" role="dialog" aria-label="Menu">
          <button
            type="button"
            className="absolute inset-0 h-full w-full bg-black/60"
            onClick={() => setShowMenu(false)}
            aria-label="Close menu"
          />
          <div className="absolute inset-y-0 right-0 w-full max-w-sm overflow-y-auto bg-[var(--bg)] p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl text-[var(--text)]">Menu</h2>
              <button
                type="button"
                className={btnGhost}
                onClick={() => setShowMenu(false)}
                aria-label="Close menu"
              >
                Close ✕
              </button>
            </div>
            <div className="space-y-5">
              {/* First item in the hamburger menu (Erin's
                  direction, 2026-11-04): the start-here box
                  lives here, at the very top of the ☰ menu —
                  its only home. Tapping it closes the menu and
                  reopens the Start here pop-up on Profile. */}
              <button
                type="button"
                className={btnPrimary}
                onClick={() => {
                  setShowMenu(false);
                  reopenStartHere();
                }}
                aria-label="Show the start here help box again"
              >
                Show the start-here box
              </button>
              {/* No payments in the app (Erin's direction,
                  2026-11-02): the wishlist unlock paywall is
                  killed until later, like Hype — there is no
                  unlock panel, no price and no checkout here.
                  Every wishlist entry is simply visible. */}
              <button
                type="button"
                className={btnPrimary}
                onClick={() => {
                  setShowMenu(false);
                  setPlacePersonId(null);
                  setShowHelp(true);
                  window.scrollTo({ top: 0 });
                }}
              >
                Help — how it works
              </button>
              <button
                type="button"
                className={btnGhost}
                aria-label="Tools — settings in Help"
                onClick={() => {
                  setShowMenu(false);
                  setPlacePersonId(null);
                  setShowHelp(true);
                  setTimeout(() => {
                    document
                      .getElementById("tools")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }, 120);
                }}
              >
                Tools — settings
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-3xl px-4 pb-10 pt-4">
        {state.data && showHelp && (
          <HelpSection
            state={state.data}
            onBack={() => setShowHelp(false)}
          />
        )}
        {state.isPending && <p className="py-10 text-center text-[var(--dim)]">Loading…</p>}
        {state.isError && (
          <div className="py-10 text-center">
            <p className="font-semibold">Couldn&apos;t load your List.</p>
            <button type="button" className={btnPrimary} onClick={() => state.refetch()}>
              Try again
            </button>
          </div>
        )}
        {state.data && !showHelp && placePerson && (
          <PersonPlace
            state={state.data}
            person={placePerson}
            focusStamp={
              placeFocus?.personId === placePerson.id ? placeFocus.stamp : 0
            }
            onBack={() => setPlacePersonId(null)}
            onOpenPerson={(id) => openPerson(id, true)}
            onGoMatches={() => {
              setPlacePersonId(null);
              setTab("people");
            }}
            onGoChat={(id) => {
              setPlacePersonId(null);
              openThread(id);
            }}
          />
        )}
        {state.data && !showHelp && !placePerson && tab === "discover" && (
          <DiscoverTab
            state={state.data}
            onMessage={(p) => openThread(p.id)}
            onOpenPerson={(id) => openPerson(id)}
          />
        )}
        {state.data && !showHelp && !placePerson && tab === "people" && (
          <PeopleTab
            state={state.data}
            onMessage={(p) => openThread(p.id)}
            onOpenPerson={(id) => openPerson(id)}
          />
        )}
        {state.data && !showHelp && !placePerson && tab === "dates" && (
          <DatesTab
            state={state.data}
            onMessage={openThread}
            onGoMatches={() => setTab("people")}
          />
        )}
        {state.data && !showHelp && !placePerson && tab === "messages" && (
          <MessagesTab
            state={state.data}
            focus={threadFocus}
            onGoMatches={() => setTab("people")}
          />
        )}
        {state.data && !showHelp && !placePerson && tab === "profile" && (
          <ProfileTab
            state={state.data}
            startHereSignal={startHereSignal}
            onGoMatches={() => setTab("people")}
            onGoDates={() => setTab("dates")}
          />
        )}
      </main>

      <footer className="mx-auto max-w-3xl px-4 pb-32 text-center text-xs text-[var(--dim)]">
        <span className="block">whatever&apos;s on the list · O&apos;ahu Hawaii</span>
        <span className="block">© 2026 All rights reserved, listdating.com</span>
      </footer>

      {/* Bottom menu — always visible, thumb-friendly, like the
          Tinder bottom nav. This is the only menu; there is no
          top menu bar. */}
      <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <nav
          aria-label="Main"
          className="mx-auto flex max-w-3xl gap-1 rounded-full border border-[var(--border)] bg-[linear-gradient(180deg,#fffaf0,#f7e7c3)] p-1.5 shadow-[0_12px_30px_rgba(101,78,32,0.6),inset_0_1px_0_rgba(255,255,255,0.6)]"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-current={tab === t.id ? "page" : undefined}
              onClick={() => {
                setPlacePersonId(null);
                setShowHelp(false);
                setTab(t.id);
              }}
              className={`flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center rounded-full px-0 py-2 text-xs font-bold tracking-tight transition sm:text-sm ${
                tab === t.id
                  ? "bg-[linear-gradient(180deg,#ffd7ec,#fdb9de)] text-[var(--accent-ink)] shadow-[0_4px_12px_rgba(101,78,32,0.5),inset_0_1px_0_rgba(255,255,255,0.28)]"
                  : "text-[var(--nav-ink)]"
              }`}
            >
              <span aria-hidden className="text-base leading-none">
                {t.icon}
              </span>
              <span className="whitespace-nowrap">{t.label}</span>
              {t.id === "dates" && pendingDates > 0 && (
                <span className="sr-only">
                  {pendingDates} dates waiting for an answer
                </span>
              )}
              {t.id === "messages" && unreadTotal > 0 && (
                <span className="mt-0.5 max-w-full truncate rounded-full bg-[var(--danger-bg)] px-2 py-0.5 text-xs font-bold leading-tight text-white">
                  {unreadTotal} unread
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

