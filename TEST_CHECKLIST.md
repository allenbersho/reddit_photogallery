# Playtest Verification Checklist — Reddit Photo Gallery

Run this checklist in your private playtest subreddit (`npm run dev` / `devvit playtest`) to verify all gallery features.

---

### Phase 1: Inline Feed View (Splash)
- [ ] **Feed Card Display:** The Reddit feed shows the gallery preview card with community title, preview photo, and total photo counter.
- [ ] **Mode Expansion:** Tapping "Open Gallery" smoothly transitions from the inline feed iframe to expanded full-screen mode (`game.html`).

---

### Phase 2: Navigation & Theming
- [ ] **Theme Switching:** Tap the sun/moon toggle in the top-right navbar. Observe instant switch between dark and light themes across background, cards, text, and modals.
- [ ] **Topic Filtering:** Tap **Science**, **Engineering**, or **Art** in the top navbar. The gallery instantly filters to that topic and updates the active pill style.
- [ ] **All Photos Reset:** Tap **All Photos** to return to the full gallery view.
- [ ] **Bottom TabBar Navigation:** Tap between **Photos**, **Places**, **Favorites**, and **Search**. Navigation is responsive with active indicators.

---

### Phase 3: Timeline & Zoom Levels
- [ ] **Zoom Level "Years":** Switch zoom level to "Years". Verify each year displays a cover photo with year heading (e.g. `2024`, `2025`) and photo count.
- [ ] **Zoom Level "Months":** Tap a year card or select "Months". Verify monthly cards display with cover photos.
- [ ] **Zoom Level "Days":** Tap a month card or select "Days". Verify photos are grouped into date sections with sticky headers (e.g. `Wednesday, October 14, 2024`).
- [ ] **Zoom Level "All":** Switch to "All". Verify smooth continuous photo grid.
- [ ] **Timeline Scrubber:** Tap year or month pills in the scrubber bar. Observe instant time filtering and breadcrumb pill (`Showing: October 2024 [Clear]`).
- [ ] **Infinite Scroll:** Scroll down the photos grid. Verify subsequent pages load automatically without layout shift or UI pauses.

---

### Phase 4: Places View
- [ ] **Country Grid:** Open the "Places" tab. Verify country cards display with flag/globe icon and total photo counts (e.g. United States, Switzerland, France, Japan, United Kingdom).
- [ ] **Unplaced Bucket:** Tap the "Unplaced Photos" card. Verify untagged photos appear in a dedicated grid.
- [ ] **Country Drill-Down:** Tap any country card (e.g. United States). Verify sub-regions (e.g. California, New York) and photos from that country display.
- [ ] **City Drill-Down:** Tap a region/city (e.g. San Francisco or Geneva). Verify city photos display.
- [ ] **Breadcrumb Back Navigation:** Tap "← All Places" or "← Region" to smoothly navigate back up the hierarchy.

---

### Phase 5: Search
- [ ] **Suggestion Chips:** Open the "Search" tab. Tap any suggested tag (e.g. `#telescope`, `#quantum`, `#robot`, `#painting`). Verify search executes immediately.
- [ ] **Keyword Query:** Type a custom keyword (e.g. `nebula` or `bridge`). Verify debounced search queries and match counter badge updates.
- [ ] **Topic Refinement:** Select a topic pill under the search bar to filter search results by topic.
- [ ] **Clear Button:** Tap `✕` in the search bar. Verify search input resets to the empty suggested tags state.

---

### Phase 6: Photo Detail Modal
- [ ] **Modal Presentation:** Tap any photo card in the timeline, places, or search views. Verify the modal opens smoothly with backdrop blur.
- [ ] **Photo Display:** High-resolution image displays with width × height dimensions indicator.
- [ ] **Metadata Credit:** Verify author credit `u/{author}`, subreddit `r/{subreddit}`, post date, capture date, place badge, and topic pill display accurately.
- [ ] **View on Reddit Link:** Tap "View on Reddit". Verify it navigates directly to the original Reddit post URL.
- [ ] **Copy Link:** Tap "Copy Link". Verify post URL is copied to clipboard and a confirmation toast notification appears.
- [ ] **Modal Dismissal:** Tap outside the card on the backdrop or press `Escape`. Modal closes smoothly.

---

### Phase 7: Personal Favorites
- [ ] **Heart Toggle:** Tap the heart button on any photo card or inside the detail modal. Verify heart fills red and TabBar favorites counter badge increments.
- [ ] **Favorites Tab:** Open "Favorites" tab. Verify favorited photos appear in the grid.
- [ ] **Unfavorite:** Tap the heart again to unfavorite. Verify photo is optimistically removed from the favorites grid.

---

### Phase 8: Mod Actions & Location Tagging
- [ ] **Tag Location Post Menu:** On an image post, open the `...` menu and click **Tag Location**. Submit a city and country. Verify post is tagged with the location and appears in Places.
- [ ] **Hide from Gallery Post Menu:** As a moderator, click **Hide from Gallery** on an image post. Verify it is removed from public gallery views.
- [ ] **Unhide from Gallery Post Menu:** As a moderator, click **Unhide from Gallery**. Verify post reappears in public gallery views.
- [ ] **Deletion Handling:** Delete an image post on Reddit. Verify it is automatically purged from the gallery store upon deletion.
- [ ] **NSFW Rejection:** Create a post marked NSFW. Verify it is skipped and never displayed in the gallery.
