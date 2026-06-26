# SlashSlack

A self-hosted, realtime **Slack-like** team chat. React-first, SQLite-backed, single Docker
container. Channels in categories, threads, emoji reactions, direct messages, file uploads, Open
Graph link previews, full-text search, in-app notifications, and a fully theme-token-driven UI
that an admin can rebrand live.

## Features

- 🔐 **Email + password auth** (Argon2, session cookies). The **first** account created becomes the workspace **admin**.
- 💬 **Channels** (public/private) organized into **categories** with custom icons in the sidebar.
- 📌 **Promoted channels** pinned to the top, drag-to-reorder categories & channels (admin).
- 🧵 **Threads**, ✨ **emoji reactions**, ✏️ edit / 🗑️ delete messages.
- 📌 **Pin** messages to a channel and 🔖 **save** any message to a personal list.
- 💬 **Slash commands**: `/shrug`, `/me <action>` (italic), `/gif <url>` (renders inline — no API key needed).
- 👀 **Read receipts** (seen-by avatars) and `@everyone` / `@channel` / `@here` broadcast mentions.
- ⏪ **Pagination** — load older messages on demand (infinite scroll).
- 🛡️ **Rate limiting** + upload file-type allowlist.
- 📨 **Direct messages** — 1:1 and group.
- 📎 **File & image uploads** with auto-generated thumbnails (sharp).
- 🔗 **Open Graph link previews** unfurled asynchronously and pushed live.
- 🔎 **Full-text search** over messages (SQLite FTS5), respecting visibility.
- 🔔 **Notifications** for @mentions, DMs and thread replies, with unread badges.
- 🟢 **Realtime everything** over WebSockets (socket.io): new messages, reactions, typing
  indicators, presence, channel changes and reorders all push to other users instantly.
- 🎨 **Theme tokens**: every color is a CSS variable. Admin edits tokens live, switches presets
  (light / dark / ocean), changes the app name and uploads a logo — all broadcast to everyone.

## Architecture

Monorepo with npm workspaces:

| Workspace | Stack |
|-----------|-------|
| `shared`  | TypeScript types + zod schemas shared by client & server |
| `server`  | Fastify + socket.io + Drizzle ORM + better-sqlite3, argon2, sharp, open-graph-scraper |
| `client`  | React 18 + Vite + TypeScript + Tailwind (CSS-variable theming) + TanStack Query + Zustand |

The server serves the built React app, the REST API, the websocket, and uploaded files — all from
one process / one container. SQLite runs in WAL mode with an FTS5 virtual table for search.

## Run with Docker (recommended)

```bash
cp .env.example .env          # set a strong SESSION_SECRET
docker compose up --build
```

Open <http://localhost:3000>. Data persists in `./data` (SQLite) and `./uploads` (files).

## Local development

```bash
npm install
npm run dev
```

- Client (Vite dev server): <http://localhost:5173> — proxies `/api`, `/uploads`, `/socket.io` to the API.
- Server (Fastify + socket.io): <http://localhost:3000>

`npm run build` builds all workspaces; `npm start` runs the production server (serving `client/dist`).

## How to try it

1. Open the app and **register** — you're now the admin.
2. Open a second browser (or incognito) and register a second user.
3. Post messages, react, reply in threads, start a DM, paste a URL (watch it unfurl), upload an
   image — everything appears live in the other window.
4. As admin, open **⚙️ Admin**: rename the workspace, upload a logo, recolor the theme live,
   create a category, add channels, mark one **promoted**, and drag to reorder.

## Configuration

| Env var | Default | Purpose |
|---------|---------|---------|
| `PORT` | `3000` | HTTP/WebSocket port |
| `SESSION_SECRET` | dev fallback | Encrypts session cookies — **set in production** |
| `DATA_DIR` | `./data` | SQLite database location |
| `UPLOAD_DIR` | `./uploads` | Uploaded files location |
| `PUBLIC_ORIGIN` | `http://localhost:3000` | Public origin |

## Testing

```bash
npm test                 # vitest unit tests (server services)
npm run test:e2e         # Playwright end-to-end (first run: npx playwright install chromium)
```

## Notes / possible extensions

- **GIFs** are keyless: paste any GIF/image URL (or use `/gif <url>`) and it renders inline. Giphy/Tenor
  were intentionally left out because both now require an API key.
- Browser **Web Push** notifications are not enabled by default (in-app + native `Notification`
  toasts are used). The notification model is ready to extend with a push subscription table.
- Other natural next steps: message edit history, presence "away", a curated reaction-GIF picker.
