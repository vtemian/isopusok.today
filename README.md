<h1 align="center">isopusok.today</h1>

<p align="center">
  Live community vote on whether Anthropic's Opus model is having a good day.
</p>

<img width="1000" height="605" alt="Screenshot 2026-04-29 at 5 53 22 PM" src="https://github.com/user-attachments/assets/8ff392c2-fe44-4954-8281-175075fb604b" />


<p align="center">
  <a href="https://isopusok.today">Website</a> &middot;
  <a href="#getting-started">Getting started</a> &middot;
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

---

Two buttons. One verdict per identity per rolling 24 hours. An 8-hour mood
heatmap. A pixel mascot whose face mirrors the verdict.

## Tech stack

| | |
|---|---|
| **Runtime** | Cloudflare Workers |
| **Database** | Cloudflare D1 (SQLite at the edge) |
| **Server** | Vanilla TypeScript |
| **Client** | Vanilla HTML/JS, no bundler |
| **Tests** | Vitest + `@cloudflare/vitest-pool-workers` against in-memory D1 |

The Worker serves both the HTML page and the JSON API.

## Getting started

```sh
make dev
```

That installs deps, creates `.dev.vars`, applies local D1 migrations, and
starts the worker on <http://127.0.0.1:8787>. `make help` lists every target.

```sh
npm test         # one shot
npm run typecheck
```

Tests hit a real (local) D1 — no mocks anywhere.

## Endpoints

| Endpoint | Description |
|---|---|
| `GET /` | The page |
| `GET /api/stats` | `{ rolling24h: { yes, no }, hours: [...] }` |
| `POST /api/vote` | Body `{ verdict: "yes" \| "no", fingerprint: string }` — returns the same shape as `/api/stats` |

## Privacy

The Worker never stores raw IPs or raw fingerprints. It computes
`HMAC_SHA256(SECRET_SALT, ip + ":" + fingerprint)` and stores only the hex
digest. The salt is a Worker secret. A leaked DB doesn't expose voters unless
the salt also leaks.

## Deploying your own

1. `npx wrangler login`
2. `npx wrangler d1 create isopusok` and paste the returned id into
   `wrangler.toml`.
3. `openssl rand -hex 32 | npx wrangler secret put SALT`
4. `npx wrangler d1 migrations apply isopusok --remote`
5. `npx wrangler deploy`

CI auto-deploys on every push to `main` (see
`.github/workflows/deploy.yml`). Required repo secrets:
`CLOUDFLARE_API_TOKEN` (with `Workers Scripts:Edit` + `D1:Edit`) and
`CLOUDFLARE_ACCOUNT_ID`.

A WAF rate-limit rule on `POST /api/vote` (10 req/min per IP, block 10s) is
recommended; the free plan allows one rule per zone.

## License

MIT
