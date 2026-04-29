import type { Env } from "./worker";

const ROLLING_WINDOW_SECONDS = 24 * 60 * 60;
const HISTORY_WINDOW_SECONDS = 30 * 24 * 60 * 60;

export interface DayBucket {
  date: string;
  yes: number;
  no: number;
}

export interface Stats {
  rolling24h: { yes: number; no: number };
  days: DayBucket[];
}

export async function loadStats(env: Env): Promise<Stats> {
  const now = Math.floor(Date.now() / 1000);
  const rollingCutoff = now - ROLLING_WINDOW_SECONDS;
  const historyCutoff = now - HISTORY_WINDOW_SECONDS;

  const rolling = await env.DB
    .prepare(
      "SELECT COALESCE(SUM(verdict), 0) AS yes, COALESCE(SUM(1 - verdict), 0) AS no FROM votes WHERE ts > ?"
    )
    .bind(rollingCutoff)
    .first<{ yes: number; no: number }>();

  const days = await env.DB
    .prepare(
      `SELECT date(ts, 'unixepoch') AS date,
              COALESCE(SUM(verdict), 0) AS yes,
              COALESCE(SUM(1 - verdict), 0) AS no
       FROM votes
       WHERE ts > ?
       GROUP BY date
       ORDER BY date DESC`
    )
    .bind(historyCutoff)
    .all<DayBucket>();

  return {
    rolling24h: { yes: rolling?.yes ?? 0, no: rolling?.no ?? 0 },
    days: days.results,
  };
}

export async function handleStats(_req: Request, env: Env): Promise<Response> {
  const stats = await loadStats(env);
  return new Response(JSON.stringify(stats), {
    headers: { "content-type": "application/json" },
  });
}
