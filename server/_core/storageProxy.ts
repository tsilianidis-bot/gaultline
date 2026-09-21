import type { Express, Request, Response } from "express";

/**
 * Compatibility shim for leftover `/manus-storage/*` requests.
 *
 * Manus Forge object storage is gone. This handler must never call
 * Manus storage hosts, the LLM gateway, or any presign endpoint.
 * Missing optional assets return 404 so product pages keep booting.
 */
export const STORAGE_UNAVAILABLE_MESSAGE = "Storage object not available";

export function handleStorageCompatRequest(_req: Request, res: Response): void {
  res.set("Cache-Control", "no-store");
  res.status(404).type("text/plain").send(STORAGE_UNAVAILABLE_MESSAGE);
}

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", handleStorageCompatRequest);
}
