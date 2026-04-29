import { env, SELF } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface Stats {
  rolling24h: { yes: number; no: number };
  hours: { hour: string; yes: number; no: number }[];
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

  it("empty DB returns zero rolling and empty hours", async () => {
    const { status, body } = await getStats();
    expect(status).toBe(200);
    expect(body).toEqual({ rolling24h: { yes: 0, no: 0 }, hours: [] });
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

  it("buckets the last 8 UTC hours, most recent first", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-29T12:00:00Z"));

    await seed([
      { ts: tsAt("2026-04-29T11:30:00Z"), verdict: 1 },
      { ts: tsAt("2026-04-29T11:45:00Z"), verdict: 1 },
      { ts: tsAt("2026-04-29T11:50:00Z"), verdict: 0 },
      { ts: tsAt("2026-04-29T05:15:00Z"), verdict: 1 }, // ~7h ago, included
      { ts: tsAt("2026-04-29T03:15:00Z"), verdict: 1 }, // ~9h ago, excluded
    ]);

    const { body } = await getStats();
    expect(body.hours[0]).toEqual({ hour: "2026-04-29T11:00:00Z", yes: 2, no: 1 });
    expect(body.hours[1]).toEqual({ hour: "2026-04-29T05:00:00Z", yes: 1, no: 0 });
    expect(body.hours.find((h) => h.hour === "2026-04-29T03:00:00Z")).toBeUndefined();
  });

  it("excludes hourly votes older than 8 hours", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-29T12:00:00Z"));

    await seed([
      { ts: tsAt("2026-04-29T03:30:00Z"), verdict: 1 }, // 8.5h ago
      { ts: tsAt("2026-04-29T05:30:00Z"), verdict: 1 }, // 6.5h ago
    ]);

    const { body } = await getStats();
    const keys = body.hours.map((h) => h.hour);
    expect(keys).not.toContain("2026-04-29T03:00:00Z");
    expect(keys).toContain("2026-04-29T05:00:00Z");
  });

  it("POST /api/vote response includes rolling and hours", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-29T12:30:00Z"));

    const res = await SELF.fetch("https://example.com/api/vote", {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": "1.1.1.1" },
      body: JSON.stringify({ verdict: "yes", fingerprint: "fp" }),
    });
    const body = (await res.json()) as Stats;
    expect(body.rolling24h).toEqual({ yes: 1, no: 0 });
    expect(body.hours[0]).toEqual({ hour: "2026-04-29T12:00:00Z", yes: 1, no: 0 });
  });
});
