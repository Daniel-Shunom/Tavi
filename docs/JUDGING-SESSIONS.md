# Browser judging sessions

Architecture: Vercel frontend and API/WebSockets, a temporary Redis store, and one
Vercel Daemon that reuses the existing companion, reaction rules, and Twitch integration.
The desktop entry point and persistent desktop configuration remain separate.

## Required behavior

- Each visitor gets isolated character state and a separate read-only OBS overlay URL.
- Twitch authorization is optional. Test events remain explicitly labelled simulations.
- Sessions last 30 minutes, warn with five minutes left, and allow one 15-minute extension.
- Reset returns the character to its defaults and disconnects Twitch without extending time.
- Every server operation checks the deadline. Redis state has the same absolute expiry;
  activity and reconnects never renew it. Expiry closes the runtime and drops credentials.
- Twitch credentials remain in worker memory. They are never written to Redis or browser
  storage. A worker restart retains temporary character configuration but requires Twitch
  to be connected again. Tokens are discarded locally and revocation is attempted on reset,
  expiration and graceful shutdown.

## Why Vercel needs more than a static deploy

[Vercel WebSockets](https://vercel.com/docs/functions/websockets) close at the function's
maximum duration, and reconnects can reach another instance. Redis coordinates temporary
state across those instances. [Vercel Daemons](https://vercel.com/docs/daemons) run the
continuous Twitch listeners and server-side cleanup loop. Daemons do not accept inbound
HTTP, so the API and worker communicate through Redis. Daemons run only on production
deployments; local development provides a memory adapter for the same contracts.

## Validation plan

Test isolation, read-only overlay access, wrong/missing credentials, concurrent extension,
reset without renewal, exact expiry boundaries, late work after reset/expiry, worker restart,
Twitch disconnect/revocation, and identical desktop behavior. Exercise two independent
Studio windows and OBS overlay pages in a browser. Document any unverified cloud deployment
checks rather than presenting local adapters as a deployed service.

## Run the local judging preview

```sh
npm ci
npm run build:judging
npm run start:judging
```

Open `http://127.0.0.1:44910/judge`. The local runner defaults to the memory adapter and never
reads or writes desktop configuration. Set `REDIS_URL` to exercise the Redis adapter locally.
The start page creates a private controller link; Setup provides a different, read-only OBS link.
Do not share the controller link. The same renderer and command rules power both pages.

`npm run build` remains the desktop-compatible build. Only `build:judging` enables the hosted
Studio entry screen. The desktop service continues using its existing single-user endpoints.

## Vercel deployment

Use Node 24 and the repository root as the project root. The committed `vercel.json` builds
the judging frontend, routes HTTP and WebSockets to `api/server.ts`, and starts one worker
using `Dockerfile.judging`. Production deployment is required: Vercel Daemons do not run in
preview deployments. Functions fail closed on preview deployments instead of sharing production sessions.

Set these production environment variables for both the Function and Daemon:

| Variable                | Value                                                                          |
| ----------------------- | ------------------------------------------------------------------------------ |
| `UPSTASH_REDIS_URL`     | Hosted TLS Redis TCP URL, supporting Lua and Pub/Sub. Preferred when present.  |
| `REDIS_URL`             | Fallback Redis TCP/TLS URL for direct Redis deployments and local development. |
| `JUDGING_PUBLIC_ORIGIN` | Fixed public HTTPS origin of the judging site.                                 |
| `JUDGING_SECRET`        | At least 32 random characters. Keep stable across deployments.                 |
| `JUDGING_NAMESPACE`     | Optional separate Redis prefix for this project, e.g. `tavi:judging`.          |

The worker uses a renewable singleton lease, waits during rolling deployments, and shuts down
if it cannot renew ownership. A Redis outage does not extend any known session deadline.
Cloud judging uses deterministic rules and does not inherit deployment AI credentials.
Twitch authorization remains optional and user initiated.

Before calling the public preview ready, verify the actual deployed WebSocket rewrite,
Redis atomic transitions/absolute TTLs, worker restart and lease handoff, and Twitch cleanup.
Local memory tests alone do not verify those cloud behaviors.

## Current verified checkpoint

- `npm test -- --maxWorkers=4 --testTimeout=15000`: 607 tests passed, including isolation,
  read-only overlay capabilities, one extension, reset without renewal, stale epoch rejection,
  server expiry, and Twitch revocation/listener cleanup using a fake Twitch gateway.
- Judging production build passed; pinned skills verified (17 skills, 200 files).
- The standard `npm run build` also passed. An isolated standard-service browser check verified
  Studio, transparent overlay, Rive WASM and the actual Foundation artwork without a judging session.
- Changed TypeScript files passed ESLint. The final focused session/API/Twitch run passed 13 tests,
  including unattended removal of local session state as well as credential cleanup.
- Real Chromium check passed for independent sessions, synchronized transparent overlay,
  controller/viewer permissions, extension, reset and responsive layout, without browser errors.
- Real Upstash TLS connection and the complete Redis adapter check passed. Docker engine access
  was denied locally, so remote Vercel Daemon image startup and deployment remain unverified.
- No public judging URL has been deployed yet.

## Cloud setup in progress

Vercel CLI is linked to the existing `tavi` project. The paid Redis Cloud resource remains
connected and unchanged; its Vercel-managed configuration exposes no TLS control, and its current
endpoint fails the TLS handshake. A separate **free** Upstash resource is connected only to
Tavi Production under the `UPSTASH_` prefix, preserving the existing `REDIS_URL`. The free plan
allows 256 MB and 500,000 commands/month; this is suitable for short judging/demo use, not an
unlimited always-on production allowance.

Hosted API and Daemon now prefer `UPSTASH_REDIS_URL`, falling back to `REDIS_URL`; desktop and
local service behavior remains unchanged. The client upgrades non-loopback Redis URLs to TLS.

Downloaded environment files are ignored; credentials must stay there or in Vercel's environment
configuration, never in source control. `JUDGING_PUBLIC_ORIGIN` and a generated sensitive
`JUDGING_SECRET` are configured for Vercel Production. Run the adapter check in its disposable
namespace:

```sh
node --import tsx tools/judging-redis-check.mjs .env.upstash.local
```

This checks Redis-backed worker RPC, full state-schema round trips, session isolation,
read-only access, capacity, atomic extension, reset, stale-write rejection and actual Redis TTL
deletion using a shortened synthetic deadline. It passes against Upstash over TLS. The first run
exposed Lua cjson changing empty JSON objects into arrays; snapshot writes now preserve app JSON
verbatim. This does not replace deployed session/OBS/Twitch verification. No public judging URL
has been deployed yet.

## Production checkpoint ? November 1, 2026

[Open the browser preview](https://tavi-pi.vercel.app/judge). The landing page's hosted preview links open this entry screen; [downloads](https://tavi-pi.vercel.app/download) remain separate.

A real browser check against production passed Studio entry, two isolated sessions, synchronized transparent overlay rendering, view-only overlay access, one-time extension, reset without deadline renewal, responsive layout, and no browser errors. The landing-to-preview path and download page also passed desktop/mobile checks. Redis checks passed the public session metadata schema, state isolation, creation limits across instances, and actual key expiration in a disposable namespace.

Live Twitch account authorization and capture inside OBS still require manual verification. The Redis expiration check uses a shortened synthetic deadline; it is not an unattended 30-minute browser recording.
