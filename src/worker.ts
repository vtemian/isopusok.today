import { handleVote } from "./vote";
import { handleStats } from "./stats";
import { PAGE_HTML } from "./page";

export interface Env {
  DB: D1Database;
  SALT: string;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    // Force HTTPS at the edge. cf-visitor is set by the Cloudflare edge and
    // carries the original client scheme. We only act on it when present so
    // local/test runs (no edge in front) are unaffected.
    const visitor = req.headers.get("cf-visitor");
    if (visitor) {
      try {
        if ((JSON.parse(visitor) as { scheme?: string }).scheme === "http") {
          url.protocol = "https:";
          return Response.redirect(url.toString(), 301);
        }
      } catch { /* malformed header — ignore */ }
    }

    if (req.method === "POST" && url.pathname === "/api/vote") {
      return handleVote(req, env);
    }

    const isRead = req.method === "GET" || req.method === "HEAD";

    if (isRead && url.pathname === "/api/stats") {
      return handleStats(req, env);
    }

    if (isRead && url.pathname === "/") {
      return new Response(PAGE_HTML, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "public, max-age=60",
        },
      });
    }

    return new Response("not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
