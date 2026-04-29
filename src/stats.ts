import type { Env } from "./worker";

const ROLLING_WINDOW_SECONDS = 24 * 60 * 60;

export interface Stats {
  rolling24h: { yes: number; no: number };
}

export async function loadStats(env: Env): Promise<Stats> {
  const now = Math.floor(Date.now() / 1000);
  const rollingCutoff = now - ROLLING_WINDOW_SECONDS;

  const rolling = await env.DB
    .prepare(
      "SELECT COALESCE(SUM(verdict), 0) AS yes, COALESCE(SUM(1 - verdict), 0) AS no FROM votes WHERE ts > ?"
    )
    .bind(rollingCutoff)
    .first<{ yes: number; no: number }>();

  return {
    rolling24h: { yes: rolling?.yes ?? 0, no: rolling?.no ?? 0 },
  };
}

export async function handleStats(_req: Request, env: Env): Promise<Response> {
  const stats = await loadStats(env);
  return new Response(JSON.stringify(stats), {
    headers: { "content-type": "application/json" },
  });
}
