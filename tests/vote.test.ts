import { env, SELF } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function postVote(opts: {
  verdict: "yes" | "no" | unknown;
  fingerprint?: unknown;
  ip?: string;
}): Promise<Response> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.ip !== undefined) headers["cf-connecting-ip"] = opts.ip;
  else headers["cf-connecting-ip"] = "203.0.113.1";

  const body: Record<string, unknown> = { verdict: opts.verdict };
  if (opts.fingerprint !== undefined) body.fingerprint = opts.fingerprint;

  return SELF.fetch("https://example.com/api/vote", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("POST /api/vote", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM votes").run();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("first vote inserts a row and returns the rolling tally", async () => {
    const res = await postVote({ verdict: "yes", fingerprint: "fp1" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ yes: 1, no: 0 });

    const rows = await env.DB.prepare("SELECT verdict FROM votes").all();
    expect(rows.results.length).toBe(1);
  });

  it("same identity within 24h flips the vote without duplicating", async () => {
    await postVote({ verdict: "yes", fingerprint: "fp1" });
    const res = await postVote({ verdict: "no", fingerprint: "fp1" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ yes: 0, no: 1 });

    const rows = await env.DB.prepare("SELECT verdict FROM votes").all();
    expect(rows.results.length).toBe(1);
    expect((rows.results[0] as { verdict: number }).verdict).toBe(0);
  });

  it("same identity twice with same verdict still leaves one row", async () => {
    await postVote({ verdict: "yes", fingerprint: "fp1" });
    const res = await postVote({ verdict: "yes", fingerprint: "fp1" });
    expect(await res.json()).toEqual({ yes: 1, no: 0 });

    const rows = await env.DB.prepare("SELECT id FROM votes").all();
    expect(rows.results.length).toBe(1);
  });

  it("same identity after 24h inserts a new row", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T00:00:00Z"));
    await postVote({ verdict: "yes", fingerprint: "fp1" });

    vi.setSystemTime(new Date("2026-04-02T01:00:00Z"));
    const res = await postVote({ verdict: "yes", fingerprint: "fp1" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ yes: 1, no: 0 });

    const rows = await env.DB.prepare("SELECT id FROM votes ORDER BY id").all();
    expect(rows.results.length).toBe(2);
  });

  it("different fingerprint same IP counts as separate identities", async () => {
    await postVote({ verdict: "yes", fingerprint: "fp1", ip: "1.2.3.4" });
    const res = await postVote({ verdict: "yes", fingerprint: "fp2", ip: "1.2.3.4" });
    expect(await res.json()).toEqual({ yes: 2, no: 0 });
  });

  it("different IP same fingerprint counts as separate identities", async () => {
    await postVote({ verdict: "yes", fingerprint: "fp1", ip: "1.2.3.4" });
    const res = await postVote({ verdict: "yes", fingerprint: "fp1", ip: "5.6.7.8" });
    expect(await res.json()).toEqual({ yes: 2, no: 0 });
  });

  it("rejects missing fingerprint with 400", async () => {
    const res = await postVote({ verdict: "yes" });
    expect(res.status).toBe(400);
  });

  it("rejects invalid verdict with 400", async () => {
    const res = await postVote({ verdict: "maybe", fingerprint: "fp1" });
    expect(res.status).toBe(400);
  });

  it("rejects empty fingerprint with 400", async () => {
    const res = await postVote({ verdict: "yes", fingerprint: "" });
    expect(res.status).toBe(400);
  });

  it("rejects malformed JSON with 400", async () => {
    const res = await SELF.fetch("https://example.com/api/vote", {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": "1.1.1.1" },
      body: "not-json",
    });
    expect(res.status).toBe(400);
  });
});
