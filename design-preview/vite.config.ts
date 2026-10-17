import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  root: import.meta.dirname,
  envDir: false,
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "../client/src") },
  },
  server: {
    host: "0.0.0.0",
    port: 4173,
    strictPort: true,
    allowedHosts: [".manus.computer", "localhost", "127.0.0.1"],
    fs: {
      allow: [path.resolve(import.meta.dirname, "..")],
      deny: ["**/.env", "**/.env.*", "**/.git/**"],
    },
  },
  build: { outDir: "../.design-preview-dist", emptyOutDir: true },
});
