# isopusok.today

A petty community telemetry site for the question *"Is Opus OK today?"*

Two buttons. One vote per identity per rolling 24 hours. 30-day mood heatmap.
Pixel mascot whose face mirrors the verdict.

## Stack

- Cloudflare Workers + D1 (single Worker serves both the HTML and the JSON API)
- Vanilla TypeScript on the server, vanilla HTML/JS on the client
- Vitest with `@cloudflare/vitest-pool-workers` running against an in-memory D1

See [`docs/plans/2026-04-29-isopusok-today-design.md`](docs/plans/2026-04-29-isopusok-today-design.md)
for the full design rationale.

## Running locally

```sh
npm install
cp .dev.vars.example .dev.vars
# edit .dev.vars and set SALT to anything for local dev
npm run migrate:local
npm run dev
```

Then open http://127.0.0.1:8787

## Tests

```sh
npm test           # one shot
npm run test:watch # watch mode
npm run typecheck
```

The test harness applies `migrations/0001_init.sql` to an in-memory D1 before
each test file via `applyD1Migrations`. No mocks anywhere — tests hit a real
(local) D1.

## Deploy

### One-time setup

1. Log into Cloudflare via wrangler:
   ```sh
   npx wrangler login
   ```

2. Create the production D1 database:
   ```sh
   npx wrangler d1 create isopusok
   ```
   Copy the `database_id` from the output into `wrangler.toml` (replacing
   `REPLACE_ME`).

3. Set the production salt:
   ```sh
   openssl rand -hex 32 | npx wrangler secret put SALT
   ```

4. First deploy:
   ```sh
   npx wrangler d1 migrations apply isopusok --remote
   npx wrangler deploy
   ```

5. Bind `isopusok.today` to the Worker in the Cloudflare dashboard
   (Workers & Pages → your worker → Settings → Triggers → Custom Domains).

6. Add the rate-limit rule (see below).

### Rate limit rule

In the Cloudflare dashboard for the `isopusok.today` zone:

- **Security → WAF → Rate limiting rules → Create rule**
- Field: `URI Path` · Operator: `equals` · Value: `/api/vote`
- And: HTTP method `equals` `POST`
- Counting characteristic: IP source address
- Requests: **10** in **1 minute**
- Action: **Block** for **10 seconds**

Free plan allows one rate-limit rule per zone, which is exactly what we need.

### CI deploys

The workflow in `.github/workflows/deploy.yml` runs tests and deploys on every
push to `main`. It needs two repository secrets:

- `CLOUDFLARE_API_TOKEN` — token with `Workers Scripts:Edit` and
  `D1:Edit` permissions on the account
- `CLOUDFLARE_ACCOUNT_ID` — your account ID (visible in the dashboard sidebar)

## Costs

Free tier covers everything realistic:

| Resource          | Free tier      | Expected use                     |
| ----------------- | -------------- | -------------------------------- |
| Workers requests  | 100k/day       | Hundreds/day; spike ≤ 50k/day    |
| D1 storage        | 5 GB           | ~50M votes before hitting cap    |
| D1 row writes     | 100k/day       | One per vote                     |
| Custom domain     | Free           | Already on Cloudflare DNS        |

If we ever blow it: Workers Paid is $5/mo flat. Domain renewal is the only
guaranteed recurring cost (~$30–40/yr for `.today`).

## Privacy

The Worker never stores raw IP or raw fingerprint. It computes
`HMAC_SHA256(SECRET_SALT, ip + ":" + fingerprint)` and stores only the hex
digest. The salt is a Worker secret, not in the repo. A leaked DB doesn't
expose voter IPs unless the salt also leaks.

## Endpoints

- `GET /` — the page
- `GET /api/stats` — `{ rolling24h: { yes, no }, days: [{ date, yes, no }, ...] }`
- `POST /api/vote` — body `{ verdict: "yes" | "no", fingerprint: string }`,
  returns the same shape as `/api/stats`
