# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SlashSlack — a self-hosted, realtime Slack-like chat app. npm-workspaces monorepo:
`shared/` (TS types + zod schemas), `server/` (Fastify + socket.io + SQLite/Drizzle),
`client/` (React + Vite + Tailwind). In production the **server serves the built React app,
the REST API, the websocket, and uploaded files from one process / one container**.

## Commands

```bash
npm install                 # install all workspaces
npm run dev                 # builds shared, then runs server + client concurrently
npm run build               # build shared → client → server (order matters)
npm test                    # server unit tests (vitest)
npm run test -w server -- text.test.ts   # run a single test file
npm run test:e2e            # Playwright (first run: npx playwright install chromium)
npm run migrate             # apply DB migrations standalone (also runs automatically on boot)
docker compose up --build   # run the whole app in one container
```

Dev ports are overridable via env (the defaults 3000/5173 may collide with other apps):
`PORT=3300 CLIENT_PORT=5174 API_PORT=3300 npm run dev`. The Vite dev server proxies
`/api`, `/uploads`, `/socket.io` to `API_PORT`. `shared` must be built before client/server
resolve it (`npm run dev` and `npm run build` handle this) — it is consumed as compiled JS,
not source.

## Database migrations — READ BEFORE CHANGING THE SCHEMA

Schema changes go through an ordered, tracked migration system, **not** ad-hoc edits.

- Migrations live in `server/src/db/migrations.ts` as an ordered `MIGRATIONS` array. Each entry
  `{ id, up(db) }` runs exactly once, inside a transaction, and is recorded in the `_migrations`
  table (see `server/src/db/migrate.ts`). They run automatically on every server boot.
- **To change the schema: append a NEW migration with the next `NNNN_name` id. Never edit,
  delete, or reorder existing migrations.** Make `up()` idempotent (`CREATE ... IF NOT EXISTS`;
  use the `addColumn` helper for `ALTER TABLE ADD COLUMN`, since SQLite has no `IF NOT EXISTS`
  for columns).
- Then update `server/src/db/schema.ts` (the Drizzle table definitions) to match, so query
  types stay in sync. schema.ts is the typed query surface; migrations are the source of truth
  for the actual DDL.

## Architecture (the parts that span files)

**Realtime is the backbone.** REST mutations persist + emit a socket.io event; clients apply
that event to the TanStack Query cache. Key conventions:

- Socket auth uses a short-lived token fetched fresh on *every* (re)connect via an `auth`
  callback (`client/src/lib/socket.tsx` → `GET /api/auth/socket` → `server/src/realtime/tokens.ts`).
  Don't make it single-use-without-refetch — that breaks reconnection after a server restart.
- Rooms: each socket joins `user:{id}`, every public `channel:{id}`, private channels/DMs it
  belongs to. Emit helpers are in `server/src/realtime/index.ts` (`emitToChannel`, `emitToDm`,
  `emitToUser`, `broadcast`). Event name constants are shared in `shared/src/index.ts`
  (`SocketEvents`).
- Mutations should also update the local cache directly (don't rely only on the socket echo):
  e.g. `useSendMessage` writes the new message into `["messages", scope]` on success so it shows
  even if the socket is mid-reconnect. The socket handlers in `client/src/lib/socket.tsx` are the
  central place that reconciles `messages`, `thread`, `pins`, `receipts`, `users`, and `channels`
  caches from incoming events.

**Message serialization** is centralized in `server/src/lib/serialize.ts` (`loadMessages`) —
it hydrates author, attachments, link previews, reactions, reply counts, pinned state. Use it
everywhere a `Message` is returned so the shape is consistent.

**Settings & theming.** `app_settings` is a single JSON row. The theme is fully CSS-variable
driven; `GET /api/settings` is public (login screen needs it) and **must never leak SMTP
credentials** — `server/src/routes/settings.ts` strips `smtp` from all public output and
broadcasts via `publicSettings()`. SMTP is admin-only (`/api/settings/smtp`).

**Per-user vs admin.** Channel **order/category** (`user_channel_layout`) and **promoted/favorite**
channels (`user_channel_favorites`) are per-user and override admin defaults — computed in
`server/src/services/channels.ts` `listChannelsForUser`. Admin sets only the *default* order.

**Webhooks** (`server/src/routes/webhooks.ts`): each channel webhook has a dedicated **bot user**
(`users.is_bot`) so incoming messages count as "from someone else" (they bold the channel /
`@channel` notifies). Bot users are excluded from `/api/users`. The incoming `POST
/api/webhooks/:token` is token-authenticated only (no session).

**Auth.** Email + password (argon2), session cookies via `@fastify/secure-session`. The **first
registered user becomes admin**. Registration is open or invite-only based on
`settings.allowRegistration`; invites + invite-only gating live in `server/src/routes/invites.ts`
and `auth.ts`.

**Mentions / notifications.** `<@id>` tokens and `@channel`/`@everyone`/`@here` are parsed in
`server/src/lib/text.ts`; notification fan-out (mention / dm / thread_reply) is in
`server/src/services/messages.ts`. Plain channel messages do NOT notify — only mentions do.

## Conventions

- New REST routes: add a `routes/*.ts` and register it in `server/src/index.ts`. Guard with
  `requireAuth` / `requireAdmin` preHandlers.
- Keep pure, testable logic out of DB/IO modules (see `server/src/lib/text.ts`, covered by
  `text.test.ts`) so it can be unit-tested without a database.
- Client data access goes through hooks in `client/src/lib/queries.ts` (TanStack Query); ephemeral
  UI state (presence, typing) is in the Zustand store `client/src/store.ts`. Zustand selectors must
  return stable references (don't build a new array/object in the selector — it causes infinite
  re-render loops with `useSyncExternalStore`).

## Branches & CI

`master` is the default branch; `develop` is the integration branch. CI + the GHCR Docker publish
(`.github/workflows/`) run on pushes to `master` and on `v*` tags — **nothing runs on `develop`**.
