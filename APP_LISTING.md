# Reddit Photo Gallery — App Directory Listing

## App Information

- **App Name:** Reddit Photo Gallery
- **Slug:** `reddit-photo-gallery`
- **Category:** Community & Content / Media & Photos
- **Tagline:** An iOS-Photos-style interactive timeline and places gallery for community image posts.
- **Support / Feedback:** Community subreddit or modmail

---

## Short Description (Feed & Preview)
Transform your community's image posts into an interactive, beautifully organized photo gallery. Browse by Year, Month, Day, or geographic location with topic filters, instant search, and personal favorites.

---

## Full Description

**Reddit Photo Gallery** turns any visual, science, engineering, or art subreddit into a searchable, interactive photo archive inspired by the Apple iOS Photos app. 

Instead of losing striking community images to the endless feed scroll, members can explore photos chronologically, geographically, or by topic with zero external hosting or third-party databases.

### Key Features

1. **Intuitive Timeline with 4 Zoom Levels:**
   - **Years View:** High-level archive with cover photos and yearly post counts. Tap any year to zoom into months.
   - **Months View:** Monthly cards with photo counts and covers. Tap any month to zoom into days.
   - **Days View:** Clean date sections with sticky weekday headers (`Wednesday, October 14, 2026`).
   - **All Photos:** Dense, smooth, infinite-scrolling photo grid with skeleton loading placeholders.
   - **Timeline Scrubber:** Scrollable pill scrubber to jump between years and months instantly.

2. **Places & Geographic Exploration:**
   - Browse photos by Country, Region, and City / Science Hub.
   - Multi-level drill-down with cover cards and count badges.
   - Dedicated "Unplaced Photos" section for community contributions awaiting location tags.
   - Location tagging form accessible directly from post menus (`Tag Location`).

3. **Topic Intelligence:**
   - One-tap topic filter pills: **Science**, **Engineering**, **Art**, and **All**.
   - Subreddit moderators can customize post flair keywords via subreddit app settings.

4. **Lightning-Fast Search:**
   - Debounced title and keyword search with inverted token indexes.
   - Multi-token search intersection (e.g. `telescope cern`).
   - Suggested search chips (`#telescope`, `#quantum`, `#robotics`, `#sculpture`, `#mars`).

5. **Full-Res Detail Modal:**
   - Full photo inspection with dimension indicators (`1920 × 1080`).
   - Prominent author credit (`u/{author}`) and subreddit context.
   - "View on Reddit" button linking directly to the original Reddit post.
   - "Copy Link" with clipboard write and instant toast confirmation.

6. **Personal Favorites:**
   - Tap the heart on any photo in the Timeline, Places, or Search view to bookmark it.
   - Synced to the user's Reddit account in Devvit Redis and viewable on the Favorites tab.

7. **Community Safety & Moderator Control:**
   - **100% SFW:** NSFW posts are strictly excluded at capture time and purged if marked NSFW later.
   - **No Image Re-hosting:** References Reddit-hosted image CDN links (`i.redd.it`, `preview.redd.it`) only.
   - **Deletion Compliance:** Post deletion triggers automatically purge items from the database in real time.
   - **Moderator Actions:** Post menu options to **Hide from Gallery** or **Unhide in Gallery** with moderator validation.

---

## Attribution & Licenses

This application incorporates geographic place names and coordinate datasets from **GeoNames** (http://www.geonames.org) licensed under the **Creative Commons Attribution 4.0 International License (CC BY 4.0)**.

---

## Screenshot Specifications for App Review

1. **Screenshot 1 — Timeline Grid (1920 × 1080 / Desktop & Mobile View):**
   - Shows the dense photo grid in dark mode with topic pills (`All`, `Science`, `Engineering`, `Art`) and timeline scrubber bar.
2. **Screenshot 2 — Timeline Zoom Levels (1920 × 1080):**
   - Shows the Years and Months zoom cards with cover photos and count badges.
3. **Screenshot 3 — Places Hierarchy (1920 × 1080):**
   - Shows geographic drill-down with Country cards, Region lists, and the Unplaced photos bucket.
4. **Screenshot 4 — High-Resolution Detail Modal (1920 × 1080):**
   - Shows expanded photo modal with author credit, date, location tag, View on Reddit button, and favorites heart.
5. **Screenshot 5 — Search & Suggestions (1920 × 1080):**
   - Shows keyword search with suggested topic chips and debounced match count.
