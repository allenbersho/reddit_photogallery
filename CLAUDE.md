# CLAUDE.md — Project Rules for the AI Coding Assistant

(If you use Cursor, Copilot, Windsurf or another tool, copy this file to that tool's rules
file, e.g. AGENTS.md or .cursor/rules. Keep the content identical.)

## What we are building

A **Reddit-native Devvit Web app** called **Reddit Photo Gallery** (working name).
A subreddit (science, engineering or art community) installs it. Members get an
iPhone-Photos-style gallery of that community's image posts, browsable by **time**
(year > month > day > all) and by **place** (country > region > city), with topic filters
(Science / Engineering / Art).

Read these before doing anything:

- docs/PRD.md — what to build and what NOT to build
- docs/ARCHITECTURE.md — how it is structured
- docs/TASKS.md — the ordered task list; work on ONE task at a time

## Hard constraints (never violate)

1. **Platform:** Devvit Web only (client + server + devvit.json). Not Blocks. Not a standalone website.
2. **No scraping.** Only use Devvit's built-in Reddit API client, triggers and scheduler.
   Never call the public Reddit JSON endpoints, never use a separate OAuth app or API keys.
3. **No external servers, databases, or paid services.** Storage is Devvit Redis only.
   Any external HTTP call needs Reddit domain approval, so do not add one without asking me.
4. **Media:** display only images hosted on Reddit. Store metadata and links only, never copies of images.
5. **No localStorage for anything important.** It is cleared on every app update. Use Redis.
6. **The server runtime does not support ES module output.** Follow the Devvit docs for build settings;
   do not change build output formats on a guess.
7. **Do not invent Devvit APIs.** If unsure, read the official docs at https://developers.reddit.com/docs
   (and the example templates) and tell me what you found. If the docs and your memory disagree, the docs win.
8. **Backend calls do not work in a plain local browser.** Test with `devvit playtest` on the test subreddit.
9. **Privacy and policy:** respect deletions (removed/deleted posts must disappear from the gallery),
   exclude NSFW posts, always link back to the original Reddit post and credit the author.
10. **Free to run:** do not add anything that creates cost.

## Tech stack

- Devvit Web, TypeScript (strict mode)
- Client: React + Vite, mobile-first, virtualized grid
- Server: Devvit server endpoints, triggers, scheduler
- Storage: Devvit Redis
- Place data: a bundled free gazetteer (GeoNames-style cities list, with attribution)
- Tests: Vitest
- Lint/format: ESLint + Prettier
- Do not add new dependencies without asking me and explaining why.

## Folder conventions

- src/client — UI (views: Timeline, Places, Filters, Detail)
- src/server — endpoints, triggers, scheduler jobs, Redis access layer
- src/shared — types and constants used by both sides
- docs — PRD, architecture, tasks, decisions

## How to work (important)

1. Before coding a task, **restate it in 3–5 lines and list the files you will touch**. Wait for my OK on anything big.
2. Make **small, reviewable changes**. One task per session. No drive-by refactors.
3. After coding: run typecheck, lint and tests, then tell me what passed/failed.
4. Explain how to verify the change in playtest (what I should click and what I should see).
5. Update docs/TASKS.md (tick the box, add notes) and, if a design decision changed, add it to docs/ARCHITECTURE.md under "Decision log".
6. If something is ambiguous, **ask one clear question** instead of guessing.
7. If a bug persists after two attempts, stop, summarize what you tried, and propose a different approach.

## Code quality rules

- Clear names, small functions, comments only where the "why" is not obvious.
- All Redis access goes through one data-access module, never scattered across handlers.
- Validate all input on every server endpoint. Never trust the client.
- Handle loading, empty, and error states in every view.
- Keep accessibility in mind: alt text, tap targets, contrast.

## Definition of done (per task)

- Works in playtest on desktop and on mobile width
- Types, lint and tests pass
- TASKS.md updated
- No new warnings, no secrets, no TODOs left silently
