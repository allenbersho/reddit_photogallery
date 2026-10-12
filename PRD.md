# PRD — Reddit Photo Gallery (Devvit Web)

## 1. Problem

Reddit communities for science, engineering and art post lots of visual content, but the feed
makes it hard to browse. There is no way to look back by _when_ something was posted or by
_where_ it was made or photographed.

## 2. Goal

A Reddit-native app that a subreddit installs, giving members an iPhone-Photos-style gallery of
that community's image posts, browsable by time and place, with topic filters.

## 3. Users

- **Members:** browse, filter, open the original post.
- **Posters:** can tag the location (and optional "taken on" date) of their own post.
- **Moderators:** install the app, configure topics and location flairs, fix or hide entries.

## 4. Scope (v1)

### Must have

1. **Post capture:** new image posts are captured automatically via a trigger; deleted/removed posts are dropped.
2. **Backfill:** a scheduled job imports recent older posts from the subreddit, in small batches.
3. **Timeline view:** grid of photos grouped Year > Month > Day, with zoom levels like iOS Photos
   (Years, Months, Days, All Photos) and a scrubber/jump control.
4. **Places view:** photos grouped Country > Region > City, with counts and a cover photo per group.
5. **Topic filter:** Science, Engineering, Art (derived from flair or moderator mapping).
6. **Detail view:** large image, title, author, date, place, topic, and a link to the original Reddit post.
7. **Location tagging:** poster-supplied place (flair or short form) resolved against a bundled place list;
   each entry has a "verified" status (poster-confirmed vs moderator-confirmed vs unknown).
8. **Moderator settings:** topic mapping, which flairs mean location, ability to hide a post from the gallery.
9. **Gallery post:** an interactive post that opens the gallery.

### Should have

- Keyword search on titles.
- "Unplaced" bucket so posts without a location are still browsable by time.
- Favorites per user (stored in Redis).

### Could have (later)

- Tile-based map (needs external domain approval, so verify first).
- Moderator-approved location suggestions from an external model.
- Cross-community aggregation (storage is per installation, so this is a bigger design).

## 5. Non-goals (do NOT build)

- Scraping or any use of Reddit data outside Devvit's built-in client.
- A separate website, mobile app, or backend server.
- Storing or re-hosting images.
- AI/ML, vector search, LLM calls, or agents in v1.
- Accounts or login (Reddit identity is already provided).
- Anything that costs money.

## 6. Acceptance criteria

- A new image post appears in the gallery within a minute of submission.
- A removed post disappears at the next sync at the latest.
- Timeline scrolling stays smooth with 5,000+ entries (pagination plus virtualization).
- Every photo opens a detail view with a working link to the original post.
- NSFW posts never appear.
- Posts with no location still appear in the timeline and in an "Unplaced" group.
- All views have loading, empty and error states and work at a 360px-wide mobile viewport.
- Moderators can change topic mapping and hide a post without code changes.

## 7. Success metrics (pilot)

- Share of posts with a location (coverage)
- Share of tagged locations that are correct (spot-check sample of 50)
- Gallery opens per week and photos viewed per session
- Zero policy or deletion incidents

## 8. Risks

| Risk                                      | Mitigation                                                      |
| ----------------------------------------- | --------------------------------------------------------------- |
| Low location coverage                     | Make tagging one tap; show "Unplaced"; moderator bulk-fix tools |
| Platform limits (storage, request volume) | Check docs early; keep records small; paginate                  |
| Docs change quickly                       | Always verify against developers.reddit.com                     |
| Map tiles need domain approval            | Start with grouped Places list or a bundled map                 |
| Deleted content lingering                 | Scheduled reconciliation job                                    |
