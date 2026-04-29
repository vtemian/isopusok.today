import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("worker harness", () => {
  it("serves the home page as HTML", async () => {
    const res = await SELF.fetch("https://example.com/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const text = await res.text();
    expect(text).toContain("is opus ok today?");
    expect(text).toContain("vote-yes");
    expect(text).toContain("vote-no");
    expect(text).toContain("heatmap");
  });

  it("returns 404 for unknown routes", async () => {
    const res = await SELF.fetch("https://example.com/nope");
    expect(res.status).toBe(404);
  });

  it("has the SALT binding wired", () => {
    expect(env.SALT).toBe("test-salt-do-not-use-in-prod");
  });
});
