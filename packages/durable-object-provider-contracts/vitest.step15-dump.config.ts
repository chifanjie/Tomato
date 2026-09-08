import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    setupFiles: [
      "./test/vitest-rpc-heartbeat.ts",
      "./test/step15-dump-formal-plan.setup.ts",
    ],
  },
});
