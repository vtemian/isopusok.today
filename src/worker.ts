export interface Env {
  DB: D1Database;
  SALT: string;
}

export default {
  async fetch(_req: Request, _env: Env): Promise<Response> {
    return new Response("isopusok.today — under construction", {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },
} satisfies ExportedHandler<Env>;
