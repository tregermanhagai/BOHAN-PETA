# Basics — starting and stopping the dev environment

Quick reference for day-to-day work. See `README.md` for first-time setup, phone testing, and troubleshooting details.

## Starting

```bash
npm run db:up      # starts Postgres in Docker (if not already running)
npm run dev:api     # http://localhost:3000
npm run dev:web     # http://localhost:5173
```

`dev:api` and `dev:web` each block their terminal, so run them in two separate terminals.

## Stopping

```bash
npm run dev:stop
```

Stops the API and web dev servers, and anything left listening on their ports (3000, 5173, 3001) — including the watcher processes behind them, not just the process you can see in your terminal. Run this instead of just closing the terminal windows: closing a window doesn't reliably kill everything it spawned, and leftover processes are what cause the `Cannot find module .../dist/main` error or a server that won't rebind on the next start.

**Run `npm run dev:stop` whenever you're done for the session** — it's the simplest way to prevent that class of problem from happening at all.

## Starting clean

If something's acting up (stale build, restarts in a loop, port won't free up):

```bash
npm run dev:clean
```

Same as `dev:stop`, plus wipes `apps/api/dist`, `apps/api/dist-test`, `apps/web/dist`, and `packages/shared-types/dist`, so the next `npm run build` / `npm run dev:api` / `npm run dev:web` starts from a guaranteed-fresh build with no leftover cache.
