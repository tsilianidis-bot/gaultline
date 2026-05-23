/**
 * FAULTLINE structured logger
 * Emits JSON-structured log lines in production, human-readable in dev.
 * Usage: log.info("message", { key: value })
 *        log.warn("message", { key: value })
 *        log.error("message", { key: value, err })
 */

type Level = "debug" | "info" | "warn" | "error";

const IS_PROD = process.env.NODE_ENV === "production";

function emit(level: Level, message: string, meta?: Record<string, unknown>) {
  const ts = new Date().toISOString();
  if (IS_PROD) {
    // Structured JSON for log aggregators (Cloud Run / Stackdriver)
    const entry: Record<string, unknown> = {
      severity: level.toUpperCase(),
      time: ts,
      message,
      ...meta,
    };
    // Promote Error objects to serialisable shape
    if (meta?.err instanceof Error) {
      entry.error = { message: meta.err.message, stack: meta.err.stack };
      delete entry.err;
    }
    process.stdout.write(JSON.stringify(entry) + "\n");
  } else {
    // Human-readable for local dev
    const prefix = `[${ts}] [${level.toUpperCase().padEnd(5)}]`;
    const metaStr = meta ? " " + JSON.stringify(meta) : "";
    const out = `${prefix} ${message}${metaStr}\n`;
    if (level === "error" || level === "warn") {
      process.stderr.write(out);
    } else {
      process.stdout.write(out);
    }
  }
}

export const log = {
  debug: (msg: string, meta?: Record<string, unknown>) => emit("debug", msg, meta),
  info:  (msg: string, meta?: Record<string, unknown>) => emit("info",  msg, meta),
  warn:  (msg: string, meta?: Record<string, unknown>) => emit("warn",  msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit("error", msg, meta),
};
