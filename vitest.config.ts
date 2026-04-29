import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";
import path from "node:path";

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations(path.resolve(__dirname, "migrations"));
  return {
    test: {
      setupFiles: ["./tests/setup.ts"],
      poolOptions: {
        workers: {
          singleWorker: true,
          wrangler: { configPath: "./wrangler.toml" },
          miniflare: {
            d1Databases: ["DB"],
            bindings: {
              SALT: "test-salt-do-not-use-in-prod",
              TEST_MIGRATIONS: migrations,
            },
          },
        },
      },
    },
  };
});
