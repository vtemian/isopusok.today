# isopusok.today — Design

**Date:** 2026-04-29
**Status:** Validated, ready for implementation plan

## Purpose

A petty community telemetry site for the question *"Is Opus OK today?"* Two-button vote (yes / no), live rolling-24h verdict, 30-day mood heatmap. Memeable, fast, free to run.

## Decisions (locked in during brainstorming)

| Topic | Choice |
|---|---|
| Vote window | Rolling 24h for the live verdict; per-UTC-day buckets for history |
| Dedup strategy | IP + browser fingerprint, hashed server-side |
| Stack | Cloudflare Workers + D1 |
| Homepage UX | Verdict + vote buttons + 30-day history |
| Visual style | Terminal-dark + Anthropic coral + pixel-art mascot |
| Domain | `isopusok.today` (already owned) |
| Costs | $0/mo on free tier; only recurring cost is domain renewal |

## Architecture

Single Cloudflare Worker. No frontend/backend split. Vanilla TypeScript, vanilla HTML/JS — no framework.

**Endpoints:**
- `GET /` — HTML page (verdict, buttons, heatmap)
- `POST /api/vote` — `{ verdict: "yes"|"no", fingerprint: "<hex>" }` → updated tallies
- `GET /api/stats` — rolling-24h totals + last 30 daily buckets

**Privacy posture:** raw IP and raw fingerprint are never persisted. The Worker computes
`identity_hash = HMAC_SHA256(SECRET_SALT, ip + ":" + fingerprint)` and stores only the hash.
`SECRET_SALT` is a Worker secret, not in the repo.

## Data model

One table in D1:

```sql
CREATE TABLE votes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ts              INTEGER NOT NULL,         -- unix seconds, UTC
  verdict         INTEGER NOT NULL,         -- 1 = yes, 0 = no
  identity_hash   TEXT NOT NULL,
  ua_family       TEXT
);

CREATE INDEX idx_votes_ts        ON votes(ts);
CREATE INDEX idx_votes_identity  ON votes(identity_hash, ts);
```

Aggregation happens on read. No `daily_aggregates` table yet — premature at this volume.

**Retention:** raw rows kept ~90 days, then deleted by a daily cron. If we later want longer history we add a tiny pre-aggregated archive table.

## Vote logic

On `POST /api/vote`:

1. Compute `identity_hash`.
2. Find the most recent row for that hash.
3. If it exists and `ts > now - 86400` → update its `verdict` and `ts` (allow flip within 24h).
4. Otherwise insert a new row.

This rule means each identity contributes at most one vote to the rolling-24h tally, but can change their mind. History buckets reflect each user's *final* vote per UTC day.

## Stats queries

```sql
-- rolling 24h verdict
SELECT SUM(verdict) AS yes,
       SUM(1 - verdict) AS no
FROM votes
WHERE ts > :now_minus_86400;

-- last 30 UTC days
SELECT date(ts, 'unixepoch') AS day,
       SUM(verdict)          AS yes,
       SUM(1 - verdict)      AS no
FROM votes
WHERE ts > :now_minus_30d
GROUP BY day
ORDER BY day DESC;
```

## Fingerprinting

Hand-rolled, ~30 lines, no library. Inputs hashed client-side with SHA-256:
`UA + language + screen + timezone + hardwareConcurrency + deviceMemory + canvasHash + webglVendorRenderer`.

Stable enough that the same browser on the same device produces the same hash; varied enough that two devices behind the same NAT don't collide. Anti-fraud-grade fingerprinting is explicitly *not* a goal.

## Rate limiting

Two layers:

1. **Per-identity (DB-level):** the upsert rule already caps each identity at one row per 24h.
2. **Per-IP burst (Cloudflare rule):** max 10 requests per IP per minute on `/api/vote`. Stops bots that try to brute-force fingerprint diversity.

No CAPTCHA, no Turnstile, no auth. Easy to add Turnstile as a third layer later if abuse becomes real.

## Visual design

- **Background:** terminal dark, ~`#1f1f1e`
- **Accent:** Anthropic coral, ~`#cc785c`
- **Type:** monospace stack (`Berkeley Mono`, `JetBrains Mono`, `ui-monospace`, `monospace`)
- **Hero:** chunky pixel-art mascot, expression varies with verdict (happy when YES leads, grumpy when NO leads). Native ~32×32 or 48×48, CSS-scaled with `image-rendering: pixelated`.
- **Question framing:** rendered like a shell prompt — `$ is opus ok today?`
- **Buttons:** `[ yes ]` / `[ no ]` with pixel borders.
- **Result bar:** ASCII-style — `██████░░░░ 67%`.
- **History:** single row of 30 pixel squares, GitHub-contribution-graph style. Greenish = good day, reddish = bad day. Hover reveals date + percentage.

## Repo layout

```
isopusok.today/
├── src/
│   ├── worker.ts          # routes + handlers
│   ├── db.ts              # D1 helpers
│   ├── page.html          # served as a string
│   └── fingerprint.js     # client-side
├── migrations/0001_init.sql
├── tests/
├── wrangler.toml
├── Makefile
├── package.json
└── docs/plans/2026-04-29-isopusok-today-design.md
```

## Testing

- **Unit (Vitest + `@cloudflare/vitest-pool-workers`):** real in-memory D1, no mocks. Covers first vote, flip within 24h, new vote after 24h, stats rollup across UTC midnight, input validation.
- **Integration:** `wrangler dev` against a temporary D1, hit real HTTP endpoints.
- **Manual smoke after deploy:** open the site, vote yes, vote no, refresh, confirm flip works.

## Deploy

- `wrangler deploy` from `main`.
- D1 migrations applied via `wrangler d1 migrations apply isopusok` in CI before deploy.
- GitHub Actions: on push to `main` → run tests → apply migrations → deploy.
- No staging env initially. Blast radius is "broken meme site"; YAGNI.

## Build sequence

1. `wrangler.toml` + hello-world Worker → confirm deploy + custom domain end-to-end.
2. D1 binding + `0001_init.sql` migration. `make migrate` works.
3. `POST /api/vote` with TDD (dedup tests first).
4. `GET /api/stats` with TDD (rolling-24h + per-day rollup).
5. Static HTML page from `/`: question, buttons, ASCII result bar, 30-day heatmap.
6. `fingerprint.js`. API works with any string, so `"dev"` is fine until this lands.
7. Cloudflare rate-limit rule on `/api/vote`. Smoke test.
8. Ship.

## Costs

- Cloudflare Workers + D1: $0/mo on free tier (100k req/day, 5GB D1, 100k writes/day).
- Worst-case viral spike still well under free tier; if exceeded, Workers Paid is $5/mo flat.
- Domain: already owned. Renewal ~$30–40/yr.

## Out of scope (intentionally)

- Login / OAuth.
- CAPTCHA / Turnstile (defer until abuse appears).
- Per-model breakdown (Sonnet today? Haiku today?). Maybe later if the meme catches.
- Comments, reasons, "why is Opus dumb today" free-text. Adds moderation surface; not now.
- API keys / public dataset export. Defer until someone asks.
