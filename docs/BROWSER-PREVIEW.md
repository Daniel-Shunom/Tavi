# Browser preview setup

The hosted preview gives each visitor a temporary Studio session and a separate read-only OBS overlay link. Sessions last 30 minutes with one optional 15-minute extension. Twitch sign-in is optional.

## Local preview

```sh
npm ci
npm run build:judging
npm run start:judging
```

Open `http://127.0.0.1:44910/judge`. The default memory adapter keeps sessions separate from desktop data. Set `REDIS_URL` to test Redis locally. Keep the private controller link to yourself; share only the read-only overlay link.

## Hosted deployment

Use Node 24 and the repository's `vercel.json`. The API and worker need:

| Variable                           | Purpose                                 |
| ---------------------------------- | --------------------------------------- |
| `UPSTASH_REDIS_URL` or `REDIS_URL` | Shared Redis connection                 |
| `JUDGING_PUBLIC_ORIGIN`            | Public HTTPS origin                     |
| `JUDGING_SECRET`                   | Secret of at least 32 random characters |
| `JUDGING_NAMESPACE`                | Optional separate Redis prefix          |

The commands and variables above retain their existing implementation names. Keep secrets in deployment configuration.

The continuous worker requires a production deployment. Before publishing, verify isolated sessions, OBS access, expiry, reset, worker recovery and Twitch cleanup against the deployed service. Credentials remain in worker memory; reconnect after a worker restart.
