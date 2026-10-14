# Reddit Photo Gallery

An iOS-Photos-style interactive timeline and places gallery for image-focused Reddit communities (Science, Engineering, Art, Photography, and Space). 

Instead of letting community images get lost in the endless feed scroll, **Reddit Photo Gallery** transforms community submissions into an organized, discoverable visual archive organized by **time** (Years > Months > Days > All) and **place** (Country > Region > City / Science Hubs).

---

## Key Features

- **Intuitive Timeline with 4 Zoom Levels:**
  - **Years:** Cover photo cards with annual post counters; tap any year to drill into its months.
  - **Months:** Monthly cards with photo counts and covers; tap any month to drill into its days.
  - **Days:** Clean chronological sections with sticky date headers (e.g. *Wednesday, October 14, 2026*).
  - **All Photos:** Dense, smooth, infinite-scrolling photo grid with skeleton loading placeholders.
- **Interactive Scrubber Bar:** Quick horizontal pill scrubber to jump between years and months instantly.
- **Places & Geographic Exploration:**
  - Multi-level geographic drill-down: **Country → Region → City / Science Hub**.
  - Dedicated **Unplaced Photos** bucket for contributions awaiting location tags.
  - Location tagging form accessible right from the post menu (**Tag Location**).
- **Topic Filters:** One-tap filtering for **Science**, **Engineering**, **Art**, or **All**, with customizable flair mappings.
- **Instant Search:** Debounced title and keyword search with multi-token intersection and suggested chips (`#telescope`, `#quantum`, `#robotics`, `#sculpture`, `#cern`).
- **High-Res Detail Modal:** Full-bleed image preview, author credit (`u/{author}`), subreddit badge, capture date, location badge, and direct "View on Reddit" link.
- **Personal Favorites:** Bookmark photos to your personal collection, persisted in Devvit Redis.
- **100% Reddit-Native & SFW:**
  - Zero external image hosting — directly displays Reddit CDN links (`i.redd.it`, `preview.redd.it`).
  - NSFW posts are strictly excluded from capture.
  - Instant post deletion synchronization via `onPostDelete` triggers and background reconciliation jobs.
  - Moderator **Hide from Gallery** and **Unhide in Gallery** post actions.

---

## Tech Stack

- **Platform:** Reddit Devvit Web (`@devvit/web`, `@devvit/start`)
- **Frontend (`src/client`):** React 19, Tailwind CSS 4, Vite
- **Backend (`src/server`):** Node.js serverless runtime, Hono
- **Shared (`src/shared`):** Strict TypeScript types, contracts, and date utilities
- **Database:** Devvit Redis (sorted set timeline indexes, topic sets, geo hierarchies, search token inverted indexes)
- **Quality & Testing:** TypeScript (strict composite project), Vitest (123 automated tests), ESLint 10, Prettier

---

## Prerequisites

Before running or deploying the app:

1. **Node.js:** Ensure you have **Node.js >= 24.0.0** installed.
2. **Reddit Developer Account:** Ensure you are logged into Reddit and have access to the [Reddit Developer Portal](https://developers.reddit.com).
3. **Devvit CLI:** Installed locally via dependencies (`npx devvit`) or globally (`npm install -g devvit`).

---

## Step-by-Step: How to Test Locally in Playtest

Follow these steps to run the app live in a test subreddit:

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up a Private Test Subreddit
1. On [Reddit](https://www.reddit.com), create a new community (e.g. `r/photogallery_test`).
2. Set the community type to **Private** (or Restricted with under 200 members).
3. **Important Setting:** Go to your test subreddit's **Mod Tools** → **Safety** / **Content Controls** → turn **OFF** the **Reputation Filter** *(Devvit playtest requires this to be disabled so automated test actions aren't blocked)*.

### 3. Log In to Devvit
```bash
npx devvit login
```
*(A browser window will open — click **Allow** to authorize the Devvit CLI for your Reddit account).*

### 4. Register the App on Reddit (One-Time Step)
Before running playtest for the first time, register your app name on Reddit by running:
```bash
npx devvit upload
```
- Press **Enter** when prompted to open `https://developers.reddit.com/new` in your browser.
- Confirm your app name (e.g. `reddit-photo-gallery`). *(If the name is taken globally on Reddit, choose a unique name like `reddit-photo-gallery-app` and update the `"name"` in `devvit.json` and `package.json`)*.
- Click **Create App**. The terminal will upload version `0.0.1`.

### 5. Start Playtest
```bash
npx devvit playtest r/<your_test_subreddit>
```
*(Example: `npx devvit playtest r/photogallery_test`)*

The Devvit CLI will build the app, install it onto your test subreddit, and begin streaming logs in your terminal. Keep this terminal window open.

### 6. Create the Gallery Post
1. Open your test subreddit in your browser: `https://www.reddit.com/r/<your_test_subreddit>`
2. Open the subreddit moderation menu (`...` menu at the top or in mod tools) and click **Create Gallery Post**.
3. A new interactive post will be generated on your subreddit!

### 7. Interact & Verify
- **Inline Feed Card:** The post displays an inline preview card (`splash.html`) with community title, preview image, and photo counter. Click **Open Gallery** to expand into the full view (`game.html`).
- **Timeline & Zoom:** Test the scrubber, topic pills, and zoom levels (**Years**, **Months**, **Days**, **All**).
- **Places & Search:** Explore geographic drill-downs and test title keyword search.
- **Favorites & Detail View:** Tap any photo to inspect high-res image and toggle favorite.
- **Auto-Ingestion:** Submit a normal image post in your test subreddit with flair `Science` or `Art`. The app's `onPostCreate` trigger will automatically capture and index it into the gallery!

---

## Step-by-Step: How to Deploy and Install in Any Community

When you are ready to install the gallery into an active subreddit:

### 1. Build and Upload a Release
Run pre-flight checks and upload the version:
```bash
npm run deploy
```
*(This automatically runs `npm run test:types && npm run lint && devvit upload`)*

### 2. Install the App onto Your Subreddit
Run the install command with the subreddit you moderate:
```bash
npx devvit install reddit-photo-gallery r/<community_name>
```

### 3. Configure Topic Flairs
1. In the community, go to **Mod Tools** → **Devvit Apps** → **Reddit Photo Gallery** settings.
2. Customize the flair keyword mappings to match your community:
   - **Science Flairs:** e.g. `astronomy, physics, biology, chemistry, space`
   - **Engineering Flairs:** e.g. `robotics, civil, tech, code, hardware`
   - **Art Flairs:** e.g. `photography, painting, sculpture, 3d, design`
   - **Location Flairs:** e.g. `location, shot in, taken in`

### 4. Backfill Existing Community Photos
The app includes a background scheduler (`/internal/scheduler/backfill`) that automatically runs every 15 minutes, paging through past community submissions (25 posts per batch) and indexing existing image posts into the gallery.

### 5. Create & Pin the Showcase Post
As a moderator, click the subreddit `...` menu and click **Create Gallery Post**. Pin this post as an announcement so community members can explore the visual gallery anytime!

---

## Publishing to the Reddit App Directory

To make the app publicly installable by any moderator on Reddit:

```bash
npm run launch
```
*(Or `npx devvit publish`)*

This submits your app version and assets for Reddit Developer Platform review.

---

## Available Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Run Devvit playtest in watch mode (`devvit playtest`) |
| `npm run test:types` | Typecheck TypeScript across all composite projects (`tsc --build`) |
| `npm run lint` | Run ESLint across `src/` |
| `npm test` | Run all 123 Vitest unit, benchmark, and compliance tests |
| `npm run build` | Build Vite production bundles for client and server |
| `npm run deploy` | Run tests, lint, and upload version to Reddit (`devvit upload`) |
| `npm run launch` | Upload and submit for Reddit App Directory review (`devvit publish`) |
| `npm run prettier` | Auto-format codebase with Prettier |

---

## Attribution & Licenses

- **Code License:** BSD-3-Clause
- **Geographic Data:** Includes city, region, country, and coordinate datasets from [GeoNames](http://www.geonames.org) licensed under the **Creative Commons Attribution 4.0 International License (CC BY 4.0)**.
