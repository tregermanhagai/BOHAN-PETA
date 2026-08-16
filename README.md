# BOHAN-PETA

Digital quiz platform for course cohorts. See `BOHAN-PETA_PRD_SRS.docx` (v2.5) for the full product/system spec this implementation follows.

## Status

**Build slices 1–4 of the section 9.4 plan are done:** teacher auth, cohort CRUD (incl. delete), manual quiz authoring with the Edit/Execution publish lifecycle, quiz-to-cohort assignment (incl. delete), and the full student exam flow — join, paginated exam UI, server-side time enforcement, focus-loss auto-submit with a grace period, scoring, and the review link. All covered by a Playwright suite against the real API.

Not built yet: scores/export view, AI-assisted generation, JSON/Excel import-export. Each has an empty stub module in `apps/api/src/*` — see the comment at the top of each for what it covers.

## Stack

- **apps/api** — NestJS (TypeScript), Prisma ORM → PostgreSQL, JWT auth
- **apps/web** — React + Vite, installable PWA, i18n (Hebrew RTL default / English)
- **apps/api-tests** — Playwright API test suite (no browser needed)
- **packages/shared-types** — TS types shared across all three, mirroring PRD section 5

## Prerequisites

- Node.js 20+ and npm
- Docker Desktop (for local Postgres)

## First-time setup

```bash
npm install
npm run db:up                                    # starts Postgres in Docker
cp apps/api/.env.example apps/api/.env            # then edit JWT_SECRET to a random string
npx prisma generate --schema apps/api/prisma/schema.prisma
npx prisma migrate dev --schema apps/api/prisma/schema.prisma --name init
```

To seed a teacher/admin account: `npm run db:seed` (see `apps/api/prisma/seed.ts`) — prints a generated password once, or set `SEED_ADMIN_PASSWORD` in `apps/api/.env` first to choose your own.

To seed a ready-to-take sample exam under that account (a "Sample Cohort" with a published 3-question quiz assigned to it): `npm run db:seed:sample` — prints the access code to use at `/join`. Safe to re-run; reuses the same cohort/quiz/assignment instead of duplicating them.

## Running locally (PC — QA stage 1)

Two terminals, from the repo root:

```bash
npm run dev:api    # http://localhost:3000
npm run dev:web    # http://localhost:5173
```

Open `http://localhost:5173`, register a teacher account, create a cohort. Students join at `/join` with the access code from a cohort's assignment.

## Running on your phone (Samsung Galaxy S24 FE — QA stage 2)

Both dev servers already bind to your PC's network interface (`--host`), so:

1. Connect the phone to the **same Wi-Fi** as your PC.
2. Find your PC's LAN IP: `ipconfig` on Windows → the IPv4 Address (the dev server also prints this — look for the `Network:` line when `npm run dev:web` starts).
3. On the phone, open `http://<that-ip>:5173` in Chrome.

The web app auto-detects the API host from whatever hostname loaded the page, so no config changes are needed to test on the phone.

## Verifying the API directly

```bash
curl http://localhost:3000/health
```

Should return `{"status":"ok","db":"connected",...}`.

## Running the API test suite

A Playwright suite (`apps/api-tests`) covers `/health`, `/auth/*`, `/cohorts/*`, `/quiz-templates/*`, `/cohorts/:id/assignments/*`, `/assignments/join`, and `/attempts/*` — validation, JWT/ownership isolation, CRUD, publish-lifecycle rules, exam scoring (incl. the all-or-nothing multi-select rule), server-side time-expiry, and delete cascades. No browser install needed; it only uses Playwright's `request` fixture against the raw API.

```bash
npm run test:api       # headless, prints a list report
npm run test:api:ui    # interactive UI mode — inspect each request/response
```

This runs against a **separate** API instance (port 3001) and a **separate** Postgres container (`db_test`, port 5433) — it never touches your dev server or dev data. The first run creates the `db_test` container and applies migrations automatically; every run truncates its tables first so tests start from a clean slate. If you already have `npm run dev:api` running on :3000, that's untouched and keeps running.

## A note on this dev machine

This environment is Windows-on-ARM. Prisma's native query-engine binary can't load inside an arm64 Node.js process, so `apps/api/prisma/schema.prisma` uses `engineType = "client"` (Prisma's Rust-free client) with `@prisma/adapter-pg` driving queries through `pg` instead — see the comment in `apps/api/src/prisma/prisma.service.ts`. This isn't a workaround specific to one machine's quirks so much as where Prisma's architecture is headed anyway (it's the default in Prisma 7); nothing here needs revisiting when moving to an x64 machine or to production.

## Stopping / cleaning the dev environment

`nest start --watch` compiles to a real `dist/` folder and spawns a child `node dist/main.js` process — but doesn't always clean up that child when you stop it (Ctrl+C, closing the terminal, killing the wrong PID). Restart it enough times over a session and orphaned instances pile up, all racing to rewrite the same `dist/` folder — which produces `Cannot find module .../dist/main`, or worse, two live watchers fighting over `dist/` and restarting each other in a loop.

Use these instead of manually hunting down and killing terminals:

```bash
npm run dev:stop   # kills anything bound to the dev ports (3000/5173/3001), plus their watcher chains
npm run dev:clean  # dev:stop, then also wipes dist/ and dist-test/ for a guaranteed-fresh build
```

Prefer `npm run dev:stop` over stopping servers by closing terminal windows — closing a window doesn't reliably kill the process tree it spawned, which is exactly how orphans accumulate. Simplest prevention: run `dev:stop` when you're done for a session rather than leaving servers running indefinitely — nothing can orphan if nothing's left up.

**Why this needs a real script, not a one-liner:** killing by command-line substring (e.g. `*nest.js*start*watch*`) is unreliable — an orphan started via `npm run start:dev` shows up as a bare `npm-cli.js run start:dev` process with no project-identifying text at all, so pattern filters silently miss it. Killing only the process bound to the port isn't enough either — `nest-cli` spawns its child via `shell: true` on Windows, so the watcher (`nest.js`) and its child aren't directly linked by `ParentProcessId` by the time you look, and the still-alive watcher just respawns a replacement the moment you kill its child. `scripts/dev-stop.ps1` combines port-based lookup (for whatever's actually listening, regardless of how it was launched) with a signature sweep for the known wrapper processes (`nest.js`, `vite.js`, the `start:dev` script name) to catch the whole chain in one pass.

## Repo layout

```
apps/
  web/            React + Vite PWA — student + teacher UI
  api/            NestJS backend
    prisma/       schema.prisma — source of truth for the DB schema
    src/modules/  one folder per PRD domain (auth, cohorts, students, quiz-templates, attempts, ...)
  api-tests/      Playwright suite testing the API directly
packages/
  shared-types/   TS types shared between web, api, and api-tests
docs/
  BOHAN-PETA_PRD_SRS.docx   the spec (see repo root — not yet moved here)
```
