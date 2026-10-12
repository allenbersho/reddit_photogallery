# Reddit Photo Gallery

A Reddit-native Devvit Web application for image-focused communities (science, engineering, and art). Members can browse image posts via an iPhone-Photos-style gallery organized by **time** (Year > Month > Day > All) and **place** (Country > Region > City), with topic filters and location tagging.

## Tech Stack

- **Platform:** Devvit Web (`@devvit/web`, `@devvit/start`)
- **Frontend (`src/client`):** React 19, Tailwind CSS 4, Vite
- **Backend (`src/server`):** Node.js serverless runtime, Hono
- **Shared (`src/shared`):** Types, constants, and data models
- **Storage:** Devvit Redis
- **Testing & Quality:** TypeScript (strict mode), Vitest, ESLint, Prettier

## Project Structure

```
├── devvit.json            # Devvit app configuration, entry points, triggers, permissions
├── package.json           # Dependencies and project scripts
├── vite.config.ts         # Vite build configuration with Devvit and React plugins
├── tools/                 # Project TypeScript configurations (base, client, server, shared)
├── src/
│   ├── client/            # Webview UI (React, Tailwind CSS, entry points: splash & game)
│   ├── server/            # Backend endpoints, triggers, scheduler, and Redis access layer
│   └── shared/            # Shared types and data contracts
└── docs/                  # PRD, ARCHITECTURE, TASKS specifications
```

## Getting Started

### Prerequisites

- Node.js >= 24.0.0
- Devvit CLI: `npm install -g devvit` or run via `npx devvit`
- A Reddit account with developer access
- A private test subreddit (under 200 members) with the Reputation Filter disabled

### Installation

```bash
npm install
```

### Development & Playtest

1. Log in to Devvit:
   ```bash
   npm run login
   ```
2. Start the development server and launch playtest on your test subreddit:
   ```bash
   npx devvit playtest r/<your_test_subreddit>
   ```
3. Open your test subreddit on Reddit (desktop or mobile app). Use the subreddit moderator menu item (`Create a new post`) to create an interactive gallery post, or open an existing gallery post unit in the feed to verify inline and expanded views.

## Commands

- `npm run test:types`: Verify TypeScript types across all subprojects (`tsc --build`).
- `npm run lint`: Run ESLint on the codebase.
- `npm run test`: Run unit tests with Vitest.
- `npm run prettier`: Format codebase with Prettier.
- `npm run build`: Build production bundles for client and server.
- `npm run dev`: Launch `devvit playtest`.
- `npm run deploy`: Run typecheck, lint, and upload version to Reddit.
