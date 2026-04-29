import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("migration", () => {
  it("creates the votes table with expected columns", async () => {
    const result = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='votes'"
    ).all();
    expect(result.results.length).toBe(1);

    const cols = await env.DB.prepare("PRAGMA table_info(votes)").all();
    const names = cols.results.map((r: any) => r.name);
    expect(names).toEqual(
      expect.arrayContaining(["id", "ts", "verdict", "identity_hash", "ua_family"])
    );
  });

  it("rejects votes with verdict outside {0, 1}", async () => {
    const insert = env.DB.prepare(
      "INSERT INTO votes (ts, verdict, identity_hash) VALUES (?, ?, ?)"
    ).bind(1700000000, 2, "abc");
    await expect(insert.run()).rejects.toThrow();
  });
});
