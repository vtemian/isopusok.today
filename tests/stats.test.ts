import { env, SELF } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface Stats {
  rolling24h: { yes: number; no: number };
  days: { date: string; yes: number; no: number }[];
}

async function getStats(): Promise<{ status: number; body: Stats }> {
  const res = await SELF.fetch("https://example.com/api/stats");
  return { status: res.status, body: (await res.json()) as Stats };
}

async function seed(rows: { ts: number; verdict: 0 | 1; identity?: string }[]) {
  for (const [i, r] of rows.entries()) {
    await env.DB
      .prepare("INSERT INTO votes (ts, verdict, identity_hash) VALUES (?, ?, ?)")
      .bind(r.ts, r.verdict, r.identity ?? `seed-${i}`)
      .run();
  }
}

const tsAt = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

describe("GET /api/stats", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM votes").run();
  });

  afterEach(() => vi.useRealTimers());

  it("empty DB returns zero rolling and empty days", async () => {
    const { status, body } = await getStats();
    expect(status).toBe(200);
    expect(body).toEqual({ rolling24h: { yes: 0, no: 0 }, days: [] });
  });

  it("counts only votes inside the rolling 24h window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-29T12:00:00Z"));
    const now = tsAt("2026-04-29T12:00:00Z");

    await seed([
      { ts: now - 60, verdict: 1 },
      { ts: now - 12 * 3600, verdict: 0 },
      { ts: now - 25 * 3600, verdict: 1 },
    ]);

    const { body } = await getStats();
    expect(body.rolling24h).toEqual({ yes: 1, no: 1 });
  });

  it("buckets by UTC date, most-recent-first", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-29T12:00:00Z"));

    await seed([
      { ts: tsAt("2026-04-29T01:00:00Z"), verdict: 1 },
      { ts: tsAt("2026-04-29T02:00:00Z"), verdict: 1 },
      { ts: tsAt("2026-04-29T03:00:00Z"), verdict: 0 },
      { ts: tsAt("2026-04-28T23:59:59Z"), verdict: 0 },
      { ts: tsAt("2026-04-15T12:00:00Z"), verdict: 1 },
    ]);

    const { body } = await getStats();
    expect(body.days[0]).toEqual({ date: "2026-04-29", yes: 2, no: 1 });
    expect(body.days[1]).toEqual({ date: "2026-04-28", yes: 0, no: 1 });
    expect(body.days[2]).toEqual({ date: "2026-04-15", yes: 1, no: 0 });
  });

  it("excludes days older than 30 days", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-29T12:00:00Z"));

    await seed([
      { ts: tsAt("2026-04-01T12:00:00Z"), verdict: 1 },
      { ts: tsAt("2026-03-01T12:00:00Z"), verdict: 1 },
    ]);

    const { body } = await getStats();
    const dates = body.days.map((d) => d.date);
    expect(dates).toContain("2026-04-01");
    expect(dates).not.toContain("2026-03-01");
  });

  it("POST /api/vote response includes both rolling and days history", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-29T12:00:00Z"));

    const res = await SELF.fetch("https://example.com/api/vote", {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": "1.1.1.1" },
      body: JSON.stringify({ verdict: "yes", fingerprint: "fp" }),
    });
    const body = (await res.json()) as Stats;
    expect(body.rolling24h).toEqual({ yes: 1, no: 0 });
    expect(body.days[0]).toEqual({ date: "2026-04-29", yes: 1, no: 0 });
  });
});
