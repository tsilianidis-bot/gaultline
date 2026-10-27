import { defineConfig } from "vitest/config";
import base from "./vitest.config";

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ["client/src/lib/introAnalytics.test.ts"],
    environment: "node",
  },
});
