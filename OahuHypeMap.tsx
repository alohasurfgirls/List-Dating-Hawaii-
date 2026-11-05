// O'ahu Hype map — when Hype is on, the chosen spot lights up on a
// real map of O'ahu. O'ahu only, by the user's direction: spots from
// the other-island collection and spots with no fixed place ("The
// Mall", "Somewhere else on Oahu", "Hiking Trails"…) have no pin and
// are listed honestly as not on the map. This is the picked spot,
// never live GPS tracking.
//
// Rendering follows the artifact maps guidance: Meta's map control
// (hatch-maps.js / hatch-maps.css, copied into src/assets — the CSS
// is bundled, the JS is inlined as text and injected as a classic
// script because the client build ships exactly one JS bundle)
// mounted through the bundled map_helpers (mountMap checks
// capability and routes fatal errors to the same fallback). When the control is
// unavailable the section degrades to the place list on its own.
// Coordinates were resolved through Meta's places graph at build
// time — the retained payload is client/src/research/places.json;
// generic area spots (e.g. "Speakeasy — Chinatown, Honolulu") pin
// their named area, activity spots pin the place they name.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { mapsDirectionsUrl, mapsSearchUrl, mountMap } from "./map_helpers.mjs";
// The MapLibre control styles ship with the map bundle; importing
// them here folds them into the app stylesheet.
import "./assets/hatch-maps.css";
// The map runtime ships as inlined text (the CVM client build
// allows exactly one JS bundle) and is injected as a classic script
// at runtime — it sets window.HatchMaps, exactly as if it had been
// loaded from its own file.
import hatchMapsCode from "./assets/hatch-maps.txt";

export type HypeMapEntry = {
  /** The exact spot string from SPOT_GROUPS. */
  spot: string;
  /** Whose spot it is — "You" for the user's own spot. */
  who: string;
  you?: boolean;
  /** "hype" (default) or "date" — a planned date's spot (date plan view only). */
  kind?: "hype" | "date";
  /** The member's people.id, when this entry is a member's. */
  personId?: number;
};

type LatLng = { lat: number; lng: number };

// Places-graph anchors (see client/src/research/places.json).
const A = {
  sunsetBeach: { lat: 21.670849, lng: -158.045733 },
  ehukai: { lat: 21.66499, lng: -158.050783 },
  waimeaBay: { lat: 21.639711, lng: -158.063247 },
  haleiwa: { lat: 21.586899, lng: -158.107001 },
  // Haleiwa Beach Park, 62-449 Kamehameha Hwy, Haleiwa, HI
  // 96712 — geocoded from that full address (2026-11-03).
  haleiwaBeachPark: { lat: 21.59928, lng: -158.10329 },
  turtleBay: { lat: 21.701801, lng: -157.995947 },
  puaena: { lat: 21.602397, lng: -158.105191 },
  sharksCove: { lat: 21.654729, lng: -158.065004 },
  waikiki: { lat: 21.276217, lng: -157.827092 },
  kailuaBeach: { lat: 21.397416, lng: -157.727212 },
  lanikai: { lat: 21.393078, lng: -157.715618 },
  alaMoanaBeach: { lat: 21.290073, lng: -157.85261 },
  alaMoanaCenter: { lat: 21.291102, lng: -157.84347 },
  sandyBeach: { lat: 21.284015, lng: -157.675716 },
  makapuu: { lat: 21.313075, lng: -157.660584 },
  windwardMall: { lat: 21.418939, lng: -157.806226 },
  pearlridge: { lat: 21.3854, lng: -157.941695 },
  kaMakana: { lat: 21.33366, lng: -158.051985 },
  kahalaMall: { lat: 21.277194, lng: -157.786251 },
  intlMarket: { lat: 21.278967, lng: -157.826282 },
  royalHawaiian: { lat: 21.279376, lng: -157.829739 },
  ward16: { lat: 21.294404, lng: -157.853418 },
  kapolei16: { lat: 21.333733, lng: -158.083488 },
  mililani14: { lat: 21.452413, lng: -158.005964 },
  doleCannery: { lat: 21.31588, lng: -157.870712 },
  regalWindward: { lat: 21.419141, lng: -157.805158 },
  pearlHighlands: { lat: 21.3963, lng: -157.975722 },
  homa: { lat: 21.303791, lng: -157.848704 },
  bishop: { lat: 21.332884, lng: -157.870576 },
  shangriLa: { lat: 21.257092, lng: -157.795005 },
  capitolModern: { lat: 21.308786, lng: -157.858352 },
  spalding: { lat: 21.31844, lng: -157.83683 },
  iolani: { lat: 21.306761, lng: -157.858748 },
  queenEmma: { lat: 21.335822, lng: -157.839471 },
  waikikiAquarium: { lat: 21.265825, lng: -157.8215 },
  honoluluZoo: { lat: 21.271097, lng: -157.821475 },
  kapiolaniPark: { lat: 21.266735, lng: -157.818754 },
  diamondHead: { lat: 21.263796, lng: -157.8041 },
  chinatown: { lat: 21.311788, lng: -157.863625 },
  kakaako: { lat: 21.298145, lng: -157.860995 },
  manoaFalls: { lat: 21.342028, lng: -157.799244 },
  tantalus: { lat: 21.31343, lng: -157.822842 },
  keehi: { lat: 21.33202, lng: -157.897105 },
  kaneoheBay: { lat: 21.462779, lng: -157.81028 },
  maunalua: { lat: 21.275006, lng: -157.75 },
  kewalo: { lat: 21.291958, lng: -157.858107 },
  alaWai: { lat: 21.284806, lng: -157.839897 },
  koOlinaMarina: { lat: 21.326801, lng: -158.120868 },
  haleiwaHarbor: { lat: 21.593917, lng: -158.105542 },
  dillingham: { lat: 21.577452, lng: -158.207173 },
  kualoa: { lat: 21.519965, lng: -157.837904 },
  waimanalo: { lat: 21.333342, lng: -157.695098 },
  aliiBeach: { lat: 21.59457, lng: -158.107469 },
  hanauma: { lat: 21.274916, lng: -157.693528 },
  electricBeach: { lat: 21.353094, lng: -158.130416 },
  aieaBowl: { lat: 21.379223, lng: -157.929561 },
  luckyStrike: { lat: 21.290944, lng: -157.841907 },
  blueNote: { lat: 21.27715, lng: -157.827671 },
  hawaiianBrians: { lat: 21.291871, lng: -157.837601 },
  republik: { lat: 21.293598, lng: -157.845281 },
  annaObriens: { lat: 21.294218, lng: -157.824054 },
  waialua: { lat: 21.575278, lng: -158.129444 },
  pearlCity: { lat: 21.4083, lng: -157.967 },
  honoluluDowntown: { lat: 21.303333, lng: -157.857222 },
} satisfies Record<string, LatLng>;

// Every spot string in SPOT_GROUPS (App.tsx) → its O'ahu anchor.
// Spots absent from this table have no pin: the other-island
// collection (O'ahu only) and the few spots that name no fixed
// place. Keep in sync with SPOT_GROUPS when spots are added.
const SPOT_COORDS: Record<string, LatLng> = {
  // North Shore & Beaches
  "Sunset Beach": A.sunsetBeach,
  Pipeline: A.ehukai,
  "Waimea Bay": A.waimeaBay,
  Haleiwa: A.haleiwa,
  "Haleiwa Beach Park": A.haleiwaBeachPark,
  "Turtle Bay": A.turtleBay,
  "Turtle Bay Lobby": A.turtleBay,
  "Puaena Point": A.puaena,
  "Ehukai Beach Park": A.ehukai,
  "Sharks Cove": A.sharksCove,
  Waikiki: A.waikiki,
  "Kailua Beach": A.kailuaBeach,
  "Lanikai Beach": A.lanikai,
  "Ala Moana Beach Park": A.alaMoanaBeach,
  "Sandy Beach": A.sandyBeach,
  "Makapu'u": A.makapuu,
  // Malls & Shopping — O'ahu ("The Mall" names no fixed place)
  "Ala Moana Center": A.alaMoanaCenter,
  "Windward Mall": A.windwardMall,
  "Pearlridge Center": A.pearlridge,
  "Ka Makana Ali'i — Kapolei": A.kaMakana,
  "Kahala Mall": A.kahalaMall,
  "International Market Place — Waikiki": A.intlMarket,
  "Royal Hawaiian Center": A.royalHawaiian,
  // Kalakaua Avenue in Waikiki — the verified home of the
  // Lululemon (2270 Kalakaua Ave) and Sephora (2250 Kalakaua Ave)
  // stores a shopping date plan may name; the pin sits on that
  // Waikiki stretch of the avenue.
  "Kalakaua Avenue — Waikiki": A.royalHawaiian,
  // Movie Theaters — O'ahu
  "Consolidated Theatres — Ward 16": A.ward16,
  "Consolidated Theatres — Kahala 8": A.kahalaMall,
  "Consolidated Theatres — Kapolei 16": A.kapolei16,
  "Consolidated Theatres — Mililani 14": A.mililani14,
  "Regal Dole Cannery — Honolulu": A.doleCannery,
  "Regal Windward — Kaneohe": A.regalWindward,
  "Regal Pearl Highlands — Pearl City": A.pearlHighlands,
  // Art, Museums & Culture — O'ahu
  "Honolulu Museum of Art": A.homa,
  "Bishop Museum": A.bishop,
  "Shangri La Museum": A.shangriLa,
  "Hawaii State Art Museum — Capitol Modern": A.capitolModern,
  "Honolulu Museum of Art — Spalding House": A.spalding,
  "Iolani Palace": A.iolani,
  "Queen Emma Summer Palace": A.queenEmma,
  "Waikiki Aquarium": A.waikikiAquarium,
  // Honolulu, Waikiki & Town ("Somewhere else on Oahu" has no pin)
  "Honolulu Zoo": A.honoluluZoo,
  "Kapiolani Park": A.kapiolaniPark,
  "Diamond Head": A.diamondHead,
  "Chinatown — Honolulu": A.chinatown,
  "Kaka'ako": A.kakaako,
  // Outdoors, Wellness & Adventure ("Hiking Trails", "Yoga in the
  // Park", "Sunrise Walk & Talk" name no fixed place)
  "Diamond Head Trail": A.diamondHead,
  "Manoa Falls": A.manoaFalls,
  "Tantalus Lookout": A.tantalus,
  // Nightlife — Nightclubs & Dance Clubs (generic spots only:
  // a specific venue never pins or shows upfront — it is
  // revealed only inside a date plan. Strip clubs are not in
  // the app at all, so they have no pin and no entry here.)
  "A Nightclub in Honolulu": A.honoluluDowntown,
  "A Dance Club in Waikiki": A.waikiki,
  "Late-Night Lounge — Waikiki": A.waikiki,
  // Ocean Adventures
  "Jet Skiing — Keehi Lagoon, Honolulu": A.keehi,
  "Jet Skiing — Ala Moana & Waikiki Waters": A.alaMoanaBeach,
  "Jet Skiing — Kaneohe Bay": A.kaneoheBay,
  "Jet Skiing — Maunalua Bay, Hawaii Kai": A.maunalua,
  "Sailing — Waikiki Sunset Sail (Kewalo Basin Harbor)": A.kewalo,
  "Sailing — Ala Wai Harbor, Waikiki": A.alaWai,
  "Sailing — Day Sail off Waikiki & Diamond Head": A.kewalo,
  "Sailing — Ko Olina Marina, Kapolei": A.koOlinaMarina,
  "Sailing — Haleiwa Harbor, North Shore": A.haleiwaHarbor,
  "Shark Dive — Haleiwa Harbor, North Shore (Cage Dive)": A.haleiwaHarbor,
  "Shark Dive — Haleiwa, North Shore (Cageless Dive)": A.haleiwaHarbor,
  // "Shark Dive — Pelagic Dive off O'ahu" departs no named harbour.
  // Sky Adventures
  "Skydiving — Kawaihapai / Dillingham Airfield, Waialua": A.dillingham,
  "Skydiving — North Shore, O'ahu": A.dillingham,
  "Parasailing — Waikiki (Kewalo Basin Departure)": A.kewalo,
  "Parasailing — Ala Moana & Waikiki Waters": A.alaMoanaBeach,
  "Parasailing — Maunalua Bay, Hawaii Kai": A.maunalua,
  // Horseback Riding & Ranch — O'ahu
  "Horseback Riding — Turtle Bay Trails, North Shore": A.turtleBay,
  "Horseback Riding — Kualoa Ranch, Kaneohe": A.kualoa,
  "Horseback Riding — Waialua & North Shore Trails": A.waialua,
  "Horseback Riding — Waimanalo, East O'ahu": A.waimanalo,
  "Horseback Riding — Sunset Ride, North Shore": A.sunsetBeach,
  // Surf Contests & Snorkeling — O'ahu
  "Surf Contest — Banzai Pipeline, Ehukai Beach Park": A.ehukai,
  "Surf Contest — Sunset Beach, North Shore": A.sunsetBeach,
  "Surf Contest — Haleiwa Alii Beach Park": A.aliiBeach,
  "Surf Contest — Waimea Bay (The Eddie)": A.waimeaBay,
  "Surf Contest — Ala Moana Bowls, Honolulu": A.alaMoanaBeach,
  "Surf Contest — Queens & Canoes, Waikiki": A.waikiki,
  "Snorkeling — Hanauma Bay, Hawaii Kai": A.hanauma,
  "Snorkeling — Shark's Cove, North Shore": A.sharksCove,
  "Snorkeling — Waikiki Turtle Canyon": A.waikiki,
  "Snorkeling — Kahe Point / Electric Beach, Kapolei": A.electricBeach,
  "Snorkeling — Sans Souci / Queen's Beach, Waikiki": A.waikikiAquarium,
  "Snorkeling — Kaneohe Bay Sandbar": A.kaneoheBay,
  // Speakeasies & Hidden Bars — the pin is the named neighbourhood
  "Speakeasy — Chinatown, Honolulu": A.chinatown,
  "Speakeasy — Downtown Honolulu (Hidden Entrance)": A.honoluluDowntown,
  "Speakeasy — Waikiki (Secret Bar)": A.waikiki,
  "Hidden Cocktail Bar — Kaka'ako, Honolulu": A.kakaako,
  "Speakeasy Night — Honolulu (Ask for the Password)": A.honoluluDowntown,
  // Bowling & Games — O'ahu
  "Bowling — Aiea Bowl, Aiea": A.aieaBowl,
  "Bowling — Lucky Strike Honolulu, Ala Moana": A.luckyStrike,
  "Bowling — Honolulu (League Night)": A.honoluluDowntown,
  "Bowling — Pearl City & Leeward O'ahu": A.pearlCity,
  "Bowling Night — Waikiki / Ala Moana Area": A.alaMoanaCenter,
  // Music — Karaoke, Guitars, Live Music & Open Mic
  "Karaoke — Private Room, Waikiki": A.waikiki,
  "Karaoke — Ala Moana / Honolulu Karaoke Room": A.alaMoanaCenter,
  "Karaoke Night — Chinatown, Honolulu": A.chinatown,
  "Live Music — Blue Note Hawaii, Waikiki": A.blueNote,
  "Live Music — Hawaiian Brian's, Honolulu": A.hawaiianBrians,
  "Live Music — The Republik, Honolulu": A.republik,
  "Guitars — Beach Jam at Ala Moana Beach Park": A.alaMoanaBeach,
  "Guitars — Kapiolani Park, Waikiki": A.kapiolaniPark,
  "Guitars — Sunset Jam, North Shore": A.sunsetBeach,
  "Open Mic Night — Anna O'Brien's, Moiliili": A.annaObriens,
  "Open Mic Night — Hawaiian Brian's, Honolulu": A.hawaiianBrians,
  "Open Mic Night — Honolulu (Singer-Songwriter Night)": A.honoluluDowntown,
  // Running, Walking & Training — O'ahu
  "Running — Ala Moana Beach Park Loop, Honolulu": A.alaMoanaBeach,
  "Running — Kapiolani Park Loop, Waikiki": A.kapiolaniPark,
  "Running — Diamond Head Loop, Honolulu": A.diamondHead,
  "Running — Waikiki Beach Path, Waikiki": A.waikiki,
  "Running — North Shore Path, Haleiwa to Waialua": A.haleiwa,
  "Running — Kailua Beach Path, Kailua": A.kailuaBeach,
  "Running — Sunrise Run, North Shore": A.sunsetBeach,
  "Walking — Ala Moana Beach Park, Honolulu": A.alaMoanaBeach,
  "Walking — Kapiolani Park — Sunset Walk, Waikiki": A.kapiolaniPark,
  "Walking — Waikiki Beach Walk, Waikiki": A.waikiki,
  "Walking — Makapu'u Lighthouse Trail, East O'ahu": A.makapuu,
  "Walking — Manoa Falls Trail Walk, Manoa": A.manoaFalls,
  "Walking — North Shore Stroll, Haleiwa": A.haleiwa,
  "Walking — Beach Walk & Talk, Ala Moana": A.alaMoanaBeach,
  "Training — Outdoor Workout at Ala Moana Beach Park": A.alaMoanaBeach,
  "Training — Outdoor Workout at Kapiolani Park, Waikiki": A.kapiolaniPark,
  "Training — Beach Training, North Shore": A.haleiwa,
  "Training — Sunrise Training, Diamond Head Area": A.diamondHead,
  "Training — Gym Session, Honolulu": A.honoluluDowntown,
  "Training — Gym Session, Waikiki / Ala Moana Area": A.alaMoanaCenter,
  "Training — Gym Session, North Shore / Haleiwa Area": A.haleiwa,
  // Pole Dancing (Adults Only) — generic studio labels pin the area
  "Pole Dancing — Studio Class, Honolulu": A.honoluluDowntown,
  "Pole Dancing — Studio Class, Waikiki / Ala Moana Area": A.alaMoanaCenter,
  "Pole Dancing — Pole Fitness Class, Honolulu": A.honoluluDowntown,
  "Pole Dancing — Private Lesson, Honolulu": A.honoluluDowntown,
  "Pole Dancing — Beginners Class, Honolulu": A.honoluluDowntown,
  "Pole Dancing Night — Studio Showcase, Honolulu": A.honoluluDowntown,
};

/** Coordinates for a Hype spot, or null when it has no O'ahu pin. */
export function spotCoords(spot: string): LatLng | null {
  return SPOT_COORDS[spot.trim()] ?? null;
}

/**
 * The first app spot named in a piece of text (longest names
 * first, so "Lanikai Beach" wins over "Lanikai"), or null when
 * the text names no spot from the app's list. Used by the date
 * plan view: a generated plan can only be pinned when it names
 * a real spot from the list — never a guessed location.
 */
export function findSpotInText(text: string): string | null {
  if (!text.trim()) return null;
  const hay = text.toLowerCase();
  // Verified store addresses (2026-11-03) come FIRST for a
  // shopping plan: a plan that names the real Kalakaua Avenue
  // addresses (Lululemon 2270 / Sephora 2250 Kalakaua Ave,
  // Honolulu) pins the Kalakaua Avenue — Waikiki spot, even when
  // it writes "Kalakaua Ave" rather than the spot's full name —
  // and even when the same plan mentions Hale'iwa to say the
  // stores are NOT there (a negated mention must never win the
  // pin over the verified location).
  if (
    (hay.includes("lululemon") || hay.includes("sephora")) &&
    hay.includes("kalakaua")
  ) {
    return "Kalakaua Avenue — Waikiki";
  }
  const names = Object.keys(SPOT_COORDS).sort((a, b) => b.length - a.length);
  for (const name of names) {
    if (hay.includes(name.toLowerCase())) return name;
  }
  return null;
}

type HatchMapsGlobal = {
  isMetaMapSupported: () => { supported: boolean; reason?: string };
};
type MapHandle = { destroy: () => void; selectPlace: (i: number | null) => void };

let hatchMapsPromise: Promise<boolean> | null = null;
function loadHatchMaps(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  const w = window as unknown as { HatchMaps?: HatchMapsGlobal };
  if (w.HatchMaps) return Promise.resolve(true);
  if (!hatchMapsPromise) {
    hatchMapsPromise = new Promise<boolean>((resolve) => {
      try {
        const script = document.createElement("script");
        script.textContent = hatchMapsCode;
        document.head.appendChild(script);
        resolve(Boolean(w.HatchMaps));
      } catch {
        resolve(false);
      }
    });
  }
  return hatchMapsPromise;
}

export function OahuHypeMap({
  entries,
  title,
  height = 300,
  onViewProfile,
  hideList = false,
  renderPinDetail,
}: {
  entries: HypeMapEntry[];
  title: string;
  height?: number;
  /** Tapping a spot shows whose Hype it is / opens that profile. */
  onViewProfile?: (entry: HypeMapEntry) => void;
  /**
   * Pin mode (Discover): no spot list under the map. The numbered
   * pins themselves are the key — tapping a pin number (on the map,
   * or its number chip under it) shows just that person at that
   * spot, rendered by renderPinDetail.
   */
  hideList?: boolean;
  renderPinDetail?: (entry: HypeMapEntry, index: number) => ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<MapHandle | null>(null);
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  const pinned = useMemo(
    () =>
      entries
        .map((e) => ({ ...e, coords: spotCoords(e.spot) }))
        .filter(
          (e): e is HypeMapEntry & { coords: LatLng } => e.coords !== null,
        ),
    [entries],
  );
  const unpinned = useMemo(
    () => entries.filter((e) => spotCoords(e.spot) === null),
    [entries],
  );
  const signature = pinned
    .map((e) => `${e.who}|${e.kind ?? "hype"}|${e.spot}`)
    .join("~");

  useEffect(() => {
    if (unavailable || pinned.length === 0) return;
    let cancelled = false;
    setSelected(null);
    void loadHatchMaps().then((ok) => {
      if (cancelled) return;
      const el = containerRef.current;
      if (!ok || !el) {
        setUnavailable(true);
        return;
      }
      const dark =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      const places = pinned.map((e) => ({
        label: `${e.who} — ${e.spot}`,
        lat: e.coords.lat,
        lng: e.coords.lng,
        you: Boolean(e.you),
        kind: e.kind ?? "hype",
      }));
      const glow = {
        type: "FeatureCollection" as const,
        features: pinned.map((e) => ({
          type: "Feature" as const,
          properties: {},
          geometry: {
            type: "Point" as const,
            coordinates: [e.coords.lng, e.coords.lat],
          },
        })),
      };
      const handle = mountMap(
        el,
        {
          places,
          baseStyle: dark ? "dark" : "light",
          marker: (
            place: { you?: boolean; kind?: string },
            index: number,
            isSel: boolean,
          ) =>
            `<div class="pin${isSel ? " pin--on" : ""}${place.you ? " pin--you" : ""}">${index + 1}</div>`,
          onSelectPlace: (index: number | null) => setSelected(index),
          overlays: [
            {
              id: "hype-glow",
              data: glow,
              layers: [
                {
                  id: "hype-glow-halo",
                  type: "circle",
                  source: "hype-glow",
                  paint: {
                    "circle-radius": 30,
                    "circle-color": "#ffffff",
                    "circle-opacity": 0.18,
                    "circle-blur": 1,
                  },
                },
                {
                  id: "hype-glow-core",
                  type: "circle",
                  source: "hype-glow",
                  paint: {
                    "circle-radius": 13,
                    "circle-color": "#ffffff",
                    "circle-opacity": 0.3,
                    "circle-stroke-color": "#ffffff",
                    "circle-stroke-width": 1.5,
                  },
                },
              ],
            },
          ],
        },
        () => setUnavailable(true),
      ) as MapHandle | null;
      if (!handle) {
        setUnavailable(true);
        return;
      }
      handleRef.current = handle;
    });
    return () => {
      cancelled = true;
      handleRef.current?.destroy();
      handleRef.current = null;
    };
    // Remount when the set of lit spots changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, unavailable]);

  if (entries.length === 0) return null;

  const selectedEntry =
    selected !== null ? pinned[selected] : undefined;

  return (
    <section
      className="overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--surface)] shadow-sm"
      aria-label={title}
    >
      <div className="px-4 pt-3">
        <h3 className="font-display text-lg text-[var(--text)]">{title}</h3>
        <p className="mt-0.5 text-xs text-[var(--dim)]">
          Tap a pin — picked spots, not live tracking.
        </p>
      </div>
      {!unavailable && pinned.length > 0 && (
        <div
          ref={containerRef}
          className="mt-3 w-full"
          style={{ height }}
          role="img"
          aria-label={`Map of O'ahu with ${pinned.length} spot${pinned.length === 1 ? "" : "s"} lit up`}
        />
      )}
      {unavailable && pinned.length > 0 && (
        <p className="px-4 pt-2 text-xs text-[var(--dim)]">
          {hideList
            ? "Map unavailable here — tap a number below to see who is at that spot."
            : "Map unavailable here — the lit spots are listed below."}
        </p>
      )}
      {hideList && (
        <div className="px-4 py-3">
          {pinned.length > 0 && (
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="Map pin numbers — tap a number to see who is at that spot"
            >
              {pinned.map((e, i) => (
                <button
                  key={`pin-chip-${e.who}-${e.kind ?? "hype"}-${e.spot}-${i}`}
                  type="button"
                  onClick={() => {
                    setSelected(i);
                    handleRef.current?.selectPlace(i);
                  }}
                  aria-pressed={selected === i}
                  aria-label={`Pin ${i + 1} — ${e.who} at ${e.spot}`}
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition active:scale-95 ${
                    e.you
                      ? "bg-[var(--gold)] text-white"
                      : "bg-[var(--accent)] text-[#fffaf0]"
                  } ${selected === i ? "outline-2 outline-offset-2 outline-[var(--accent)]" : ""}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
          {selectedEntry && selected !== null ? (
            <div className="mt-3" aria-live="polite">
              {renderPinDetail ? (
                renderPinDetail(selectedEntry, selected)
              ) : (
                <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-[var(--surface-alt)] px-3 py-2">
                  <span className="min-w-0 flex-1 basis-44">
                    <span className="block text-sm font-bold leading-snug text-[var(--text)]">
                      {selectedEntry.who} —{" "}
                      {selectedEntry.kind === "date" ? "Planned date" : "Hype"}
                    </span>
                    <span className="block text-xs leading-snug text-[var(--dim)]">
                      {selectedEntry.spot}
                    </span>
                  </span>
                  {onViewProfile && (
                    <button
                      type="button"
                      className="shrink-0 rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-bold text-[#fffaf0]"
                      aria-label={`View ${selectedEntry.who} at ${selectedEntry.spot}`}
                      onClick={() => onViewProfile(selectedEntry)}
                    >
                      View ›
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            pinned.length > 0 && (
              <p className="mt-2 text-xs font-semibold text-[var(--dim)]">
                Tap a number on the map — who is at that spot shows here.
              </p>
            )
          )}
          {unpinned.length > 0 && (
            <p className="mt-2 text-xs text-[var(--dim)]">
              Not on the map (no fixed O&apos;ahu spot):{" "}
              {unpinned
                .map((e) => `${e.who} — ${e.spot}`)
                .join(" · ")}
            </p>
          )}
        </div>
      )}
      {!hideList && (
      <ul className="space-y-1.5 px-4 py-3">
        {pinned.map((e, i) => {
          const place = {
            label: e.spot,
            locality: "O'ahu",
            region: "HI",
            lat: e.coords.lat,
            lng: e.coords.lng,
          };
          const searchUrl = mapsSearchUrl(place);
          const directionsUrl = mapsDirectionsUrl(place);
          const isSel = selected === i;
          const kindLabel = e.kind === "date" ? "Planned date" : "Hype";
          return (
            <li
              key={`${e.who}-${e.kind ?? "hype"}-${e.spot}-${i}`}
              ref={(el) => {
                rowRefs.current[i] = el;
              }}
              className={`flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2 ${
                isSel
                  ? "map-selected bg-[var(--surface-alt)] outline-2 outline-[var(--accent)]"
                  : "bg-[var(--surface-alt)]"
              }`}
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 basis-44 items-center gap-2 text-left"
                aria-label={`Show ${e.who} at ${e.spot} on the map`}
                aria-pressed={isSel}
                onClick={() => {
                  setSelected(i);
                  handleRef.current?.selectPlace(i);
                }}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    e.you
                      ? "bg-[var(--gold)] text-white"
                      : "bg-[var(--accent)] text-[#fffaf0]"
                  }`}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold leading-snug text-[var(--text)]">
                    {e.who}
                    {e.you
                      ? e.kind === "date"
                        ? " — planned date"
                        : " — your Hype spot"
                      : ` — ${kindLabel}`}
                  </span>
                  <span className="block text-xs leading-snug text-[var(--dim)]">
                    {e.spot}
                  </span>
                </span>
              </button>
              {onViewProfile && (
                <button
                  type="button"
                  className="shrink-0 rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-bold text-[#fffaf0]"
                  aria-label={
                    e.you
                      ? `View my ${kindLabel}`
                      : `View ${e.who}'s profile — this is ${e.who}'s ${kindLabel}`
                  }
                  onClick={() => onViewProfile(e)}
                >
                  {e.you ? "View ›" : `${e.who} ›`}
                </button>
              )}
              {searchUrl && (
                <a
                  href={searchUrl}
                  target="_blank"
                  rel="noopener"
                  className="shrink-0 text-xs font-semibold text-[var(--accent)] underline"
                  aria-label={`Open ${e.spot} in maps`}
                >
                  Open in maps
                </a>
              )}
              {directionsUrl && (
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener"
                  className="shrink-0 text-xs font-semibold text-[var(--accent)] underline"
                  aria-label={`Directions to ${e.spot}`}
                >
                  Directions
                </a>
              )}
            </li>
          );
        })}
        {unpinned.map((e, i) => {
          const searchUrl = mapsSearchUrl({
            label: e.spot,
            locality: "O'ahu",
            region: "HI",
          });
          const kindLabel = e.kind === "date" ? "Planned date" : "Hype";
          return (
            <li
              key={`unpinned-${e.who}-${e.kind ?? "hype"}-${e.spot}-${i}`}
              className="flex flex-wrap items-center gap-2 rounded-2xl bg-[var(--surface-alt)] px-3 py-2"
            >
              <span className="min-w-0 flex-1 basis-44">
                <span className="block text-sm font-bold leading-snug text-[var(--text)]">
                  {e.who}
                  {e.you
                    ? e.kind === "date"
                      ? " — planned date"
                      : " — your Hype spot"
                    : ` — ${kindLabel}`}
                </span>
                <span className="block text-xs leading-snug text-[var(--dim)]">
                  {e.spot} — not on the O&apos;ahu map (no fixed O&apos;ahu
                  spot)
                </span>
              </span>
              {onViewProfile && (
                <button
                  type="button"
                  className="shrink-0 rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-bold text-[#fffaf0]"
                  aria-label={
                    e.you
                      ? `View my ${kindLabel}`
                      : `View ${e.who}'s profile — this is ${e.who}'s ${kindLabel}`
                  }
                  onClick={() => onViewProfile(e)}
                >
                  {e.you ? "View ›" : `${e.who} ›`}
                </button>
              )}
              {searchUrl && (
                <a
                  href={searchUrl}
                  target="_blank"
                  rel="noopener"
                  className="shrink-0 text-xs font-semibold text-[var(--accent)] underline"
                  aria-label={`Open ${e.spot} in maps`}
                >
                  Open in maps
                </a>
              )}
            </li>
          );
        })}
      </ul>
      )}
    </section>
  );
}
