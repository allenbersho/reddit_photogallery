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

- [x] 2.1 Moderator settings: topic mapping (flair -> Science/Engineering/Art) (defined in devvit.json settings.subreddit with defaults, parsed and loaded in src/server/core/topicSettings.ts)
- [x] 2.2 Topic indexes and filter support in the data layer (custom rules passed to deriveTopic in triggers and backfill, Redis topic sets and getTopicCounts in galleryStore.ts)
- [x] 2.3 Moderator action: hide / unhide an item (post-level menu items /mod-hide & /mod-unhide with UI toast response, plus moderator-authenticated API endpoints)

## Milestone 3 — Location

- [x] 3.1 Bundle a small free gazetteer (cities with country/region/coordinates) with attribution notes (curated global cities and scientific landmarks with GeoNames CC BY 4.0 attribution in src/server/data/gazetteer.ts)
- [x] 3.2 Place resolver with ambiguity handling and unit tests (implemented in src/server/core/placeResolver.ts with city/region/country matching, alias resolution, and ambiguity detection; tested with 13 unit tests)
- [x] 3.3 Location capture via flair mapping (automatic location extraction in postCapture.ts marking items as poster-tagged from location flairs)
- [x] 3.4 Poster/mod tagging form for location and optional "taken on" date (tagLocationForm and Tag Location post menu item in devvit.json, handled in forms.ts and menu.ts with author/mod validation)
- [x] 3.5 Place indexes (country/region/city), hierarchy with counts and cover item, "Unplaced" bucket (updateGalleryItemLocation, getPlacesHierarchy, and getPlacesSummary in galleryStore.ts)

## Milestone 4 — Internal API

- [x] 4.1 Timeline page + timeline summary endpoints (implemented GET /api/gallery/timeline with cursor paging, topic/place/year/month filters, mod-hidden protection, and GET /api/gallery/timeline/summary with year/month breakdown and topic metrics)
- [x] 4.2 Places hierarchy + items-by-place endpoints (implemented GET /api/gallery/places, /gallery/places/hierarchy, /gallery/places/summary, /gallery/places/unplaced/items, and /gallery/places/:placeType/:placeKey/items with full paging and input validation)
- [x] 4.3 Item detail + title search endpoints (implemented GET /api/gallery/item/:id with mod-visibility protection and GET /api/gallery/search with title tokenization, inverted index, multi-token intersection, and cursor paging)
- [x] 4.4 Permissions and input validation on every endpoint, with tests (strict type guards, bounds checking on limits/years/months, caller authorization for favorites and mod actions, and 106 automated tests)

## Milestone 5 — Client UI

- [x] 5.1 App shell, navigation (Timeline / Places), theme, mobile layout (implemented dark/light theme, Navbar with topic filter pills, iOS-style TabBar for mobile thumbs, and view router in game.tsx, plus sleek inline feed splash.tsx)
- [x] 5.2 Virtualized photo grid with placeholders (implemented responsive 3-6 col grid, aspect-ratio cards with skeleton shimmer, lazy-load fade-in, IntersectionObserver infinite scroll, and deduplicated paged timeline hook)
- [x] 5.3 Timeline zoom levels (Years / Months / Days / All) and scrubber (implemented timeline scrubber bar with year/month pills, summary hook, day-grouping section headers, and zoom transitions from year cover cards to month cards to days to dense grid)
- [x] 5.4 Places view (hierarchy, covers, counts) (implemented hierarchical drill-down from countries to regions to cities with photo counts, unplaced bucket, breadcrumbs back navigation, and integrated PhotoGrid)
- [x] 5.5 Topic filter and search (implemented debounced keyword title search, topic refinement pills, search suggestion chips, match count badge, and integrated PhotoGrid with pagination)
- [x] 5.6 Detail view with credit and link to the original post (implemented PhotoDetailModal with high-res photo, author credit, date, place badge, navigateTo Reddit link, copy link with showToast, and favorites toggle)
- [x] 5.7 Loading, empty and error states everywhere (implemented shimmer skeletons, graceful error banners with retry triggers, and contextual empty prompts across Timeline, Places, Search, Favorites, and PhotoCard components)
- [x] 5.8 Favorites (implemented FavoritesView with paginated grid, optimistic unfavorite, personal count badge on tab bar, authentication notice for guests, and Redis persistence)

## Milestone 6 — Polish and hardening

- [x] 6.1 Performance test with a large synthetic dataset (5,000+ items) (built automated benchmark suite verifying 5,000 items indexed, sub-30ms cursor pagination across 500 items with 0 duplicates, sub-30ms topic filtering, sub-50ms place hierarchy rollup, sub-40ms single/multi-token search, and clean deletion)
- [ ] 6.2 Accessibility pass (alt text, tap targets, contrast)
- [ ] 6.3 Security/policy review against the Devvit Rules and content policy
- [ ] 6.4 Seed test subreddit and run the full manual test checklist

## Milestone 7 — Release

- [ ] 7.1 App listing: name, description, screenshots, GeoNames attribution
- [ ] 7.2 Upload and submit for Reddit review
- [ ] 7.3 Pilot install in one community; collect feedback
- [ ] 7.4 Triage feedback and plan v2
