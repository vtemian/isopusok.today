import { handleVote } from "./vote";

export interface Env {
  DB: D1Database;
  SALT: string;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === "POST" && url.pathname === "/api/vote") {
      return handleVote(req, env);
    }

    if (req.method === "GET" && url.pathname === "/") {
      return new Response("isopusok.today — under construction", {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    return new Response("not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
