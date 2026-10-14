# Security, Compliance & Devvit Content Policy Review

This document summarizes the compliance audit of the **Reddit Photo Gallery** application against Reddit Developer Platform Rules, Reddit Content Policy, and Devvit platform constraints.

## 1. Media & Content Policy Compliance

- **No Media Hosting / Re-hosting:** The app strictly references direct Reddit image CDN links (`i.redd.it`, `preview.redd.it`). No image binary blobs are downloaded, cached, or re-hosted on any third-party infrastructure.
- **Strict SFW Enforcement:** Posts marked NSFW (`post.nsfw === true`) are automatically skipped at ingest time in `postCapture.ts` and purged if marked NSFW later by `reconcile.ts`.
- **Immediate Deletion Handling:** Post deletion triggers (`onPostDelete`) instantly purge items from the Redis database, timeline indexes, topic sets, places hierarchy, and search token sets.
- **Background Reconciliation:** A scheduled reconcile job periodically validates posts against the Reddit API and purges any deleted or removed posts.
- **Moderator Control:** Post menu actions (`Hide from Gallery`, `Unhide`) and moderator API endpoints allow moderators to immediately hide any item from public views.

## 2. Privacy & Data Handling

- **Zero External Databases:** The application uses no external servers, APIs, or databases. All data is stored within Devvit's isolated Redis instance.
- **No Personal Identifiable Information (PII):** The app only indexes public post metadata (post ID, author username, subreddit, title, created timestamp, Reddit image URL, dimensions) and user favorites.
- **Scoped User Data:** User favorites are keyed by individual Reddit usernames (`gallery:fav:${username}`) and can only be accessed or modified by that authenticated user.

## 3. Platform Limitations & Permissions

- **devvit.json Configuration:**
  - Uses only required triggers (`onPostCreate`, `onPostDelete`).
  - Strict input validation on all forms and menu items.
  - Safe navigation via `navigateTo` from `@devvit/web/client` instead of disallowed `window.location`.
  - User notifications via `showToast` instead of disallowed `window.alert`.
- **Attribution:**
  - Clear author credit (`u/{author}`) and subreddit context (`r/{subreddit}`) displayed on every photo card and modal view.
  - Direct permalink back to the original Reddit post.
  - CC BY 4.0 attribution for the bundled GeoNames geographic dataset included in `src/server/data/gazetteer.ts`.
