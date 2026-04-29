import { env, SELF } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface Cell {
  date: string;
  hour: number;
  yes: number;
  no: number;
}

interface Stats {
  rolling24h: { yes: number; no: number };
  cells: Cell[];
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

  it("empty DB returns zero rolling and empty cells", async () => {
    const { status, body } = await getStats();
    expect(status).toBe(200);
    expect(body).toEqual({ rolling24h: { yes: 0, no: 0 }, cells: [] });
  });

  it("counts only votes inside the rolling 24h window in rolling24h", async () => {
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

  it("groups votes by (UTC date, UTC hour) into cells", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-29T12:00:00Z"));

    await seed([
      { ts: tsAt("2026-04-29T11:30:00Z"), verdict: 1 },
      { ts: tsAt("2026-04-29T11:45:00Z"), verdict: 1 },
      { ts: tsAt("2026-04-29T11:50:00Z"), verdict: 0 },
      { ts: tsAt("2026-04-29T10:15:00Z"), verdict: 1 },
      { ts: tsAt("2026-04-28T23:30:00Z"), verdict: 0 },
    ]);

    const { body } = await getStats();
    const find = (date: string, hour: number) =>
      body.cells.find((c) => c.date === date && c.hour === hour);

    expect(find("2026-04-29", 11)).toEqual({ date: "2026-04-29", hour: 11, yes: 2, no: 1 });
    expect(find("2026-04-29", 10)).toEqual({ date: "2026-04-29", hour: 10, yes: 1, no: 0 });
    expect(find("2026-04-28", 23)).toEqual({ date: "2026-04-28", hour: 23, yes: 0, no: 1 });
  });

  it("orders cells most-recent-first by (date desc, hour desc)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-29T12:00:00Z"));

    await seed([
      { ts: tsAt("2026-04-29T01:00:00Z"), verdict: 1 },
      { ts: tsAt("2026-04-29T11:00:00Z"), verdict: 1 },
      { ts: tsAt("2026-04-28T23:00:00Z"), verdict: 0 },
    ]);

    const { body } = await getStats();
    expect(body.cells.map((c) => `${c.date}T${String(c.hour).padStart(2, "0")}`)).toEqual([
      "2026-04-29T11",
      "2026-04-29T01",
      "2026-04-28T23",
    ]);
  });

  it("excludes votes older than 30 days from cells", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-29T12:00:00Z"));

    await seed([
      { ts: tsAt("2026-04-01T12:00:00Z"), verdict: 1 }, // 28d ago, included
      { ts: tsAt("2026-03-01T12:00:00Z"), verdict: 1 }, // 59d ago, excluded
    ]);

    const { body } = await getStats();
    const dates = body.cells.map((c) => c.date);
    expect(dates).toContain("2026-04-01");
    expect(dates).not.toContain("2026-03-01");
  });

  it("POST /api/vote response includes rolling and cells", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-29T12:30:00Z"));

    const res = await SELF.fetch("https://example.com/api/vote", {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": "1.1.1.1" },
      body: JSON.stringify({ verdict: "yes", fingerprint: "fp" }),
    });
    const body = (await res.json()) as Stats;
    expect(body.rolling24h).toEqual({ yes: 1, no: 0 });
    expect(body.cells[0]).toEqual({ date: "2026-04-29", hour: 12, yes: 1, no: 0 });
  });
});
