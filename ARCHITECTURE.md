# ARCHITECTURE — Reddit Photo Gallery (Devvit Web)

> Verify any Devvit-specific detail against https://developers.reddit.com/docs before relying on it.
> This document describes intent; the docs define what is actually possible.

## 1. Overview

```
Reddit event (post created / deleted)
        | trigger
        v
Devvit Server (TypeScript, hosted by Reddit)
   - Post capture handler
   - Place resolver (bundled gazetteer)
   - Scheduler jobs (backfill, reconcile)
   - Redis data-access module
   - Internal API endpoints for the client
        ^
        | fetch calls to internal endpoints
Devvit Web client (React + Vite, inside the interactive post)
   - Timeline view  - Places view  - Filters  - Detail view
        ^
   Reddit user (identity provided by Reddit)
```

## 2. Components

| Component          | Responsibility                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| devvit.json        | App config: entry points, permissions, triggers, scheduler, settings                                      |
| Post capture       | On new post: check image + SFW, extract metadata, store, index                                            |
| Backfill job       | Import older posts in small batches until done; resumable                                                 |
| Reconcile job      | Re-check stored posts; remove deleted/removed/NSFW ones                                                   |
| Place resolver     | Turn a place name into country / region / city / coordinates using bundled data                           |
| Data-access module | The only code that talks to Redis; owns key naming and indexes                                            |
| Internal API       | Read endpoints for the client (timeline, places, detail, search) and write endpoints (tag location, hide) |
| Client             | Four views plus shared components, mobile-first                                                           |
| Mod settings       | Topic mapping, location-flair mapping, hide/unhide                                                        |

## 3. Data model (conceptual fields per gallery item)

- Reddit post ID, permalink, title, author name, subreddit
- Created time (post time) and optional "taken on" date
- Image URL(s) hosted on Reddit, width/height if available, a small preview URL if available
- Topic (Science / Engineering / Art / Other), source of topic (flair rule / mod / default)
- Place: raw text, resolved country, region, city, latitude, longitude, status
  (unknown / poster-tagged / mod-verified)
- Flags: hidden by mod, NSFW, removed
- Timestamps: captured at, last verified at

## 4. Redis index design (conceptual)

- **Item store:** one record per item, keyed by post ID.
- **Time index:** a sorted collection scored by created time (newest first paging),
  plus per-year and per-month counters for fast headers.
- **Topic indexes:** one sorted collection per topic, same scoring.
- **Place indexes:** per country, region and city: a sorted collection of item IDs, plus a
  hierarchy listing with counts and a cover item.
- **Unplaced index:** items with no location.
- **Search index (simple):** title tokens mapped to item IDs.
- **User favorites:** per-user set of item IDs.
- **Job state:** backfill cursor, last reconcile time.
  Rules: keep records small, page everything, never load a whole index into memory,
  and be careful with operations that scan large keyspaces.

## 5. Internal API (endpoint intents, not final paths)

- Get timeline page (filters: topic, year/month, cursor)
- Get timeline summary (counts per year / month for the scrubber)
- Get places hierarchy (country > region > city, with counts and cover)
- Get items for a place (cursor)
- Get item detail
- Search by title keyword
- Tag or change an item's location (poster for own post, moderator for any)
- Hide / unhide an item (moderator only)
- Toggle favorite
  Every endpoint validates input, checks permissions, and returns small paged results.

## 6. Location strategy

1. Prefer **explicit input**: location flair or a short tagging form after submission.
2. Resolve text against the bundled gazetteer; handle ambiguity by asking for country/region.
3. Store status so the UI can show "verified" vs "unverified".
4. No guessing from images and no external geocoder in v1.
5. Attribute the place dataset (GeoNames license) in the app description.

## 7. Client design notes

- Mobile-first, thumb-friendly, dark-mode friendly.
- Timeline zoom levels: Years (one cover per year), Months, Days, All Photos.
- Virtualized grid with placeholders to avoid layout jumps.
- Places view as a hierarchical list with cover photos and counts; a bundled map is optional.
- State that must persist goes to Redis through the server, not localStorage.

## 8. Compliance and safety

- Respect deletion and removal; reconcile on schedule.
- Exclude NSFW. Mod "hide" is always available.
- Always show author credit and a link to the Reddit post.
- No image copies; Reddit-hosted media only.
- Follow the Devvit Rules and content policy before submitting for review.

## 9. Testing strategy

- Unit tests: place resolver, index/pagination logic, input validation, date grouping.
- Integration/manual: `devvit playtest` on a small private test subreddit.
- Seed the test subreddit with 30–50 varied posts, then a larger synthetic set for performance.
- Checklist: mobile width, empty states, deleted post, NSFW post, post without location.

## 10. Deployment

- Develop with playtest, upload a private version, then submit for Reddit review via the CLI.
- Pilot install in one friendly community; collect feedback; iterate.

## 11. Open questions

- Single-community pilot only for v1? (storage is per installation)
- Is a bundled map enough, or is a tile map required?
- Current platform limits for Redis size and request volume (verify in docs).

## 12. Decision log

(Add dated entries here as decisions are made.)
