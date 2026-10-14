# Deployment, Pilot & Release Guide — Reddit Photo Gallery

This guide details the release procedures for publishing Reddit Photo Gallery to Reddit, running a community pilot, and the v2 roadmap.

---

## 1. Task 7.2: Upload & Submit for Reddit Review

### Pre-Flight Verification
Run all automated checks locally:
```bash
npm run test:types   # Strict composite TypeScript check
npm run lint         # ESLint 10 code quality & hook checks
npm test             # 123 automated Vitest tests (unit, store, performance, compliance)
npm run build        # Vite client & server production bundles
```

### Uploading to Devvit
1. Ensure you are logged into your Reddit Developer account:
   ```bash
   devvit login
   ```
2. Build and upload a version to Reddit:
   ```bash
   npm run deploy
   # Or directly:
   devvit upload
   ```
   This compiles the web assets, packages `devvit.json`, and registers triggers, menu items, and background schedulers in your Reddit developer portal.

3. Submit for Reddit App Review:
   ```bash
   devvit publish
   ```
   Include the application description and screenshot references from [`APP_LISTING.md`](./APP_LISTING.md).

---

## 2. Task 7.3: Pilot Install in One Community

### Installing the App
1. Install the private or published app to the pilot community:
   ```bash
   devvit install reddit-photo-gallery r/<community_name>
   ```
2. **Configure Topic Flairs (Subreddit Settings):**
   - Open subreddit mod tools -> Devvit Apps -> Reddit Photo Gallery settings.
   - Map community post flairs to the 3 main topics:
     - `Science Flairs`: e.g. `astronomy, physics, biology, microscopy`
     - `Engineering Flairs`: e.g. `robotics, civil, electronics, aerospace`
     - `Art Flairs`: e.g. `photography, painting, sculpture, 3d-render`
     - `Location Flairs`: e.g. `location, shot in, taken in, [country]`

3. **Trigger Backfill for Past Community Photos:**
   - The scheduled backfill job (`/internal/scheduler/backfill`) runs every 15 minutes, automatically paging through past community submissions (25 posts per batch) and populating the gallery.

4. **Create the Showcase Post:**
   - As a moderator, click the subreddit `...` menu and select **Create Gallery Post**.
   - Pin or announce the post to community members so they can explore the interactive timeline and places gallery directly from the Reddit feed.

5. **Feedback Collection:**
   - Post an announcement thread asking members to test:
     - Mobile browser / Reddit iOS / Android app experience.
     - Location tagging accuracy (`...` post menu -> **Tag Location**).
     - Timeline scrubber and zoom navigation.

---

## 3. Task 7.4: Triage Feedback & V2 Roadmap

Based on community testing and architectural evaluation, the v2 roadmap includes:

1. **Interactive Vector Map Integration:**
   - Interactive MapLibre / Leaflet vector map with clustered markers and heatmaps for global photography hubs.
2. **EXIF Camera & Sensor Metadata:**
   - Automatic extraction of camera model, lens, shutter speed, aperture, and ISO where embedded in original uploads.
3. **Multi-Image Reddit Gallery Carousels:**
   - Ingest and swipe through multiple images in multi-photo Reddit submissions.
4. **User-Curated Albums:**
   - Allow redditors to create themed public or personal community photo albums (e.g. "Eclipse 2024", "James Webb Deep Field Highlights").
5. **Auto-Tagging Assist:**
   - Optional lightweight vision classification for automatic topic suggestions.
