import type { Env } from "./worker";

const ROLLING_WINDOW_SECONDS = 24 * 60 * 60;
const HOURLY_WINDOW_SECONDS = 8 * 60 * 60;

export interface HourBucket {
  hour: string; // "YYYY-MM-DDTHH:00:00Z"
  yes: number;
  no: number;
}

export interface Stats {
  rolling24h: { yes: number; no: number };
  hours: HourBucket[];
}

export async function loadStats(env: Env): Promise<Stats> {
  const now = Math.floor(Date.now() / 1000);
  const rollingCutoff = now - ROLLING_WINDOW_SECONDS;
  const hourlyCutoff = now - HOURLY_WINDOW_SECONDS;

  const rolling = await env.DB
    .prepare(
      "SELECT COALESCE(SUM(verdict), 0) AS yes, COALESCE(SUM(1 - verdict), 0) AS no FROM votes WHERE ts > ?"
    )
    .bind(rollingCutoff)
    .first<{ yes: number; no: number }>();

  const hours = await env.DB
    .prepare(
      `SELECT strftime('%Y-%m-%dT%H:00:00Z', ts, 'unixepoch') AS hour,
              COALESCE(SUM(verdict), 0) AS yes,
              COALESCE(SUM(1 - verdict), 0) AS no
       FROM votes
       WHERE ts > ?
       GROUP BY hour
       ORDER BY hour DESC`
    )
    .bind(hourlyCutoff)
    .all<HourBucket>();

  return {
    rolling24h: { yes: rolling?.yes ?? 0, no: rolling?.no ?? 0 },
    hours: hours.results,
  };
}

export async function handleStats(_req: Request, env: Env): Promise<Response> {
  const stats = await loadStats(env);
  return new Response(JSON.stringify(stats), {
    headers: { "content-type": "application/json" },
  });
}
