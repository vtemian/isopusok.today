import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("worker harness", () => {
  it("serves the placeholder page", async () => {
    const res = await SELF.fetch("https://example.com/");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("under construction");
  });

  it("has the SALT binding wired", () => {
    expect(env.SALT).toBe("test-salt-do-not-use-in-prod");
  });
});
