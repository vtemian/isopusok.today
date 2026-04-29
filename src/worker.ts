import { handleVote } from "./vote";
import { handleStats } from "./stats";
import { PAGE_HTML } from "./page";

export interface Env {
  DB: D1Database;
  SALT: string;
}

// Pixel mascot, 16x16, transparent background — same coral block + eyes + smile
// the page draws, sized to be legible at 16/32px favicon scales.
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">\
<rect x="3" y="2" width="10" height="1" fill="#cc785c"/>\
<rect x="2" y="3" width="12" height="9" fill="#cc785c"/>\
<rect x="3" y="12" width="3" height="2" fill="#cc785c"/>\
<rect x="10" y="12" width="3" height="2" fill="#cc785c"/>\
<rect x="3" y="14" width="2" height="1" fill="#cc785c"/>\
<rect x="11" y="14" width="2" height="1" fill="#cc785c"/>\
<rect x="4" y="4" width="2" height="2" fill="#1f1f1e"/>\
<rect x="10" y="4" width="2" height="2" fill="#1f1f1e"/>\
<rect x="5" y="8" width="1" height="1" fill="#1f1f1e"/>\
<rect x="10" y="8" width="1" height="1" fill="#1f1f1e"/>\
<rect x="6" y="9" width="4" height="1" fill="#1f1f1e"/>\
</svg>`;

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

    if (isRead && url.pathname === "/favicon.svg") {
      return new Response(FAVICON_SVG, {
        headers: {
          "content-type": "image/svg+xml",
          "cache-control": "public, max-age=86400",
        },
      });
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
