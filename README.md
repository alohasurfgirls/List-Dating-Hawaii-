# List Dating™ — whatever's on the list

**Not coffee. Not small talk. Something real.**

List Dating™ is a dating app built around The List. **The List IS the date
idea:** two people meet to do something on the list, instead of coffee,
small talk, and endless chatting. Either person can arrange a date by
fulfilling the other person's list — both ways.

Built by **Erin Wright, founder and builder, working with Muse Spark**.
Erin is a real person — she is *not* a Showcase persona (see below).
Website / domain: listdating.com. The app name is List Dating™.

> **Code on display only.** This repo holds the actual List Dating app
> code for review. It does not run the working app and it does not make
> Meta AI calls — the working app is the version shown in the demo video.

## How it works

- **My List (Wants / Needs) + My Provides.** Each member lists what they
  want or need, and what they can provide, by category, with a maximum
  spend (cap) on each Provide. The demo set uses **3 Wants + 3 Provides**
  per person. Desires / gift ideas are stored separately and never count
  toward a match %.
- **Two-sided, specific matching.** A Want/Need is matched against the
  other person's Provides, in both directions. Cards show a match %,
  what specifically covers what, and — where one applies — a dealbreaker
  warning that names whose dealbreaker it is.
- **Out of the Blue.** A person at 0% on specific covers can appear as a
  2% “Out of the Blue” option, marked with a small sky-blue wave — a
  surprise from quantum circumstance, not a cover.
- **Plan the Date — one push on a Deal.** One push creates the date and
  immediately generates its plan + photo with Meta AI, using **both
  members' full profiles and bios** — Wants, Provides with caps, and
  bios — not bio alone.
- **Real O'ahu spots only.** Plans use only real, checked O'ahu
  locations from the app's spot registry (for example, there is no
  Lululemon in Hale'iwa). Date-plan photos are **actual real-life
  photos of the actual location / store first**; a generated image is
  only a fallback and is labelled as generated.
- **Deal-only chat.** Only gender-mode-passing Matches / Potentials or
  Deal holders are chat-eligible; the chat box lives in the Chat tab.
  Ineligible threads are hidden, not deleted. Switching between the
  default heterosexual mode and the per-profile Same sex mode never
  deletes matches, dates, or chats — Matches only filters by mode.
- **Mark completed.** Every accepted date can be marked completed:
  the completion time is recorded, a Completed badge shows, and a short
  note posts to Chat. No voice/camera gate, no proof photo, no location
  tracking.
- **Safety check-in.** A timed check-in (30 minutes – 4 hours, confirmed
  dates only) with a transparent note in Chat. It ends automatically.
  **No live GPS tracking.**

## Look & layout

- North Shore sand main surface, cards in warm cream, bright sky blue
  as a highlight accent only, light chat-bubble pink accent, and the
  gold present seal as the official app icon.
- **Bottom-only menu:** Profile · Matches · Dates · Chat. No top menu.
- Visual-first: big photos and bubbles, short captions, how-to kept in
  a separate Help section.

## MVP scope

- **No app payment charges and no paywall** in the MVP / demo.
- **Pop Off is completely removed.** **Hype is paused** and can return
  later.
- Content filters keep the app not-for-hookups: full vulgar words and
  hookup / drug shorthand are blocked wherever the filter runs, with a
  friendly “please reword” message.

## Tech

- TypeScript, React client (`client/src/`), server actions
  (`server/src/actions.ts`), Drizzle schema + migrations (`drizzle/`).
- Meta AI (Spark by default, Wonder comparison-only) writes match notes
  and date plans **server-side** in the working app.
- **The saved Meta AI key is never in this repo** — not in code, not in
  a comment, not in a file. In the working app it is entered by the
  founder and held server-side only.

## People in the demo

- **Erin** — real. Founder and builder.
- **Showcase Alex** (Waikiki, 42), **Showcase Koa** (Papailoa, 57), and
  **Showcase Leilani** (22, code name only) — **Showcase personas are
  illustrative, not real people.** Their sample photo payloads are
  intentionally omitted from this repo (see
  `server/src/SAMPLE-PHOTOS-NOT-INCLUDED.md`).

## Never in this repo

The saved Meta AI key · any API key or secret · the live database ·
real photos of people · real personal data · private notes.

© 2026 All rights reserved, listdating.com
