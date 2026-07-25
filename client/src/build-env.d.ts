/**
 * Ambient declarations for build-time constants injected by vite.config.ts define block.
 * These are replaced at build time with literal string values via Vite's `define` option.
 * This file must NOT have any import/export statements — it must be a pure ambient declaration file.
 */
declare const __BUILD_COMMIT__: string;
declare const __BUILD_TIME__: string;
