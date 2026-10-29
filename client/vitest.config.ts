import { defineConfig } from "vitest/config";
import path from "path";

const projectRoot = path.resolve(import.meta.dirname, "..");

export default defineConfig({
  root: projectRoot,
  cacheDir: "/tmp/vite-cache-faultline-client",
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "client", "src"),
      "@shared": path.resolve(projectRoot, "shared"),
      "@assets": path.resolve(projectRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: ["client/src/**/*.test.ts", "client/src/**/*.test.tsx"],
    testTimeout: 30000,
  },
});
