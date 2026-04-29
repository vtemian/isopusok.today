import type { Env } from "./worker";
import { identityHash } from "./identity";
import { loadStats } from "./stats";

const ROLLING_WINDOW_SECONDS = 24 * 60 * 60;

interface VoteBody {
  verdict?: unknown;
  fingerprint?: unknown;
}

export async function handleVote(req: Request, env: Env): Promise<Response> {
  let body: VoteBody;
  try {
    body = (await req.json()) as VoteBody;
  } catch {
    return jsonError("invalid json", 400);
  }

  const verdict = body.verdict === "yes" ? 1 : body.verdict === "no" ? 0 : null;
  if (verdict === null) {
    return jsonError("verdict must be 'yes' or 'no'", 400);
  }
  if (typeof body.fingerprint !== "string" || body.fingerprint.length === 0) {
    return jsonError("fingerprint required", 400);
  }

  const ip = req.headers.get("cf-connecting-ip") ?? "0.0.0.0";
  const id = await identityHash(env.SALT, ip, body.fingerprint);
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - ROLLING_WINDOW_SECONDS;

  const existing = await env.DB
    .prepare(
      "SELECT id FROM votes WHERE identity_hash = ? AND ts > ? ORDER BY ts DESC LIMIT 1"
    )
    .bind(id, cutoff)
    .first<{ id: number }>();

  if (existing) {
    await env.DB
      .prepare("UPDATE votes SET verdict = ?, ts = ? WHERE id = ?")
      .bind(verdict, now, existing.id)
      .run();
  } else {
    await env.DB
      .prepare("INSERT INTO votes (ts, verdict, identity_hash) VALUES (?, ?, ?)")
      .bind(now, verdict, id)
      .run();
  }

  return new Response(JSON.stringify(await loadStats(env)), {
    headers: { "content-type": "application/json" },
  });
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}
