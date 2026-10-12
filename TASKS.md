# TASKS — Reddit Photo Gallery

Rules: work on ONE task at a time, in order. Tick the box when done and add short notes.
Each task ends with: typecheck + lint + tests pass, verified in playtest.

## Milestone 0 — Setup

- [x] 0.1 Create the Devvit Web project from the official React template (scaffolded from official `@devvit/web` React starter with Hono, Tailwind CSS 4, and Vite)
- [ ] 0.2 Create a private test subreddit (under 200 members), turn off the Reputation safety filter, run playtest successfully
- [x] 0.3 Add folder structure (client / server / shared), strict TypeScript, ESLint, Prettier, Vitest (configured composite tsconfigs in tools/, ESLint 10, Prettier, and Vitest starter test)
- [x] 0.4 Initialize git, first commit, .gitignore, README with run instructions (git repo initialized, comprehensive .gitignore added, initial commit created, README documented)

## Milestone 1 — Data capture

- [x] 1.1 Define shared types for gallery items, places and topics (defined in src/shared/types.ts and re-exported in src/shared/index.ts)
- [x] 1.2 Build the Redis data-access module (item store + time index + paging) (implemented src/server/data/galleryStore.ts and validated with 13 unit tests in galleryStore.test.ts)
- [x] 1.3 Post-create trigger: capture image posts, skip NSFW/non-image (registered onPostCreate in devvit.json, implemented SFW image filter and topic inference in postCapture.ts, handled in triggers.ts)
- [x] 1.4 Post-delete / removal handling (registered onPostDelete in devvit.json, cleans up Redis item store and indexes upon post deletion)
- [x] 1.5 Backfill scheduler job (batched, resumable) (implemented src/server/scheduler/backfill.ts with batch size 25, Redis cursor persistence, and devvit.json scheduler task)
- [x] 1.6 Reconcile scheduler job (drop deleted/removed items) (implemented src/server/scheduler/reconcile.ts with batch size 20, post verification against Reddit API, and automatic index purge)
- [x] 1.7 Unit tests for the data-access module and capture logic (38 unit tests across store, post capture, triggers, and scheduler jobs)

## Milestone 2 — Topics and settings

- [ ] 2.1 Moderator settings: topic mapping (flair -> Science/Engineering/Art)
- [ ] 2.2 Topic indexes and filter support in the data layer
- [ ] 2.3 Moderator action: hide / unhide an item

## Milestone 3 — Location

- [ ] 3.1 Bundle a small free gazetteer (cities with country/region/coordinates) with attribution notes
- [ ] 3.2 Place resolver with ambiguity handling and unit tests
- [ ] 3.3 Location capture via flair mapping
- [ ] 3.4 Poster/mod tagging form for location (and optional "taken on" date)
- [ ] 3.5 Place indexes (country/region/city), hierarchy with counts and cover item, "Unplaced" bucket

## Milestone 4 — Internal API

- [ ] 4.1 Timeline page + timeline summary endpoints
- [ ] 4.2 Places hierarchy + items-by-place endpoints
- [ ] 4.3 Item detail + title search endpoints
- [ ] 4.4 Permissions and input validation on every endpoint, with tests

## Milestone 5 — Client UI

- [ ] 5.1 App shell, navigation (Timeline / Places), theme, mobile layout
- [ ] 5.2 Virtualized photo grid with placeholders
- [ ] 5.3 Timeline zoom levels (Years / Months / Days / All) and scrubber
- [ ] 5.4 Places view (hierarchy, covers, counts)
- [ ] 5.5 Topic filter and search
- [ ] 5.6 Detail view with credit and link to the original post
- [ ] 5.7 Loading, empty and error states everywhere
- [ ] 5.8 Favorites

## Milestone 6 — Polish and hardening

- [ ] 6.1 Performance test with a large synthetic dataset (5,000+ items)
- [ ] 6.2 Accessibility pass (alt text, tap targets, contrast)
- [ ] 6.3 Security/policy review against the Devvit Rules and content policy
- [ ] 6.4 Seed test subreddit and run the full manual test checklist

## Milestone 7 — Release

- [ ] 7.1 App listing: name, description, screenshots, GeoNames attribution
- [ ] 7.2 Upload and submit for Reddit review
- [ ] 7.3 Pilot install in one community; collect feedback
- [ ] 7.4 Triage feedback and plan v2
