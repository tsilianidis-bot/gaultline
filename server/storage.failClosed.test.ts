import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  handleStorageCompatRequest,
  STORAGE_UNAVAILABLE_MESSAGE,
} from "./_core/storageProxy";
import { storageGet, storageGetSignedUrl, storagePut } from "./storage";

const root = resolve(import.meta.dirname, "..");

function read(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), "utf8");
}

function walkFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walkFiles(full, acc);
    } else {
      acc.push(full);
    }
  }
  return acc;
}

function mockResponse() {
  const state = {
    statusCode: 0,
    body: "",
    type: "",
    headers: {} as Record<string, string>,
  };
  const res = {
    set(name: string, value: string) {
      state.headers[name] = value;
      return this;
    },
    status(code: number) {
      state.statusCode = code;
      return this;
    },
    type(value: string) {
      state.type = value;
      return this;
    },
    send(body: string) {
      state.body = body;
      return this;
    },
  };
  return { res, state };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("storage helpers fail closed", () => {
  it("storagePut does not call Manus and throws without a backend", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(storagePut("hero.jpg", Buffer.from("x"), "image/jpeg")).rejects.toThrow(
      "Independent object storage is not configured",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("storageGet does not emit /manus-storage/ URLs", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(storageGet("hero.jpg")).rejects.toThrow(
      "Independent object storage is not configured",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("storageGetSignedUrl does not presign via Forge", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(storageGetSignedUrl("hero.jpg")).rejects.toThrow(
      "Independent object storage is not configured",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("storage proxy compatibility route", () => {
  it("returns 404 without fetching Forge even when forge env is present", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { res, state } = mockResponse();

    handleStorageCompatRequest(
      { params: { 0: "faultline_hero_bg_7d6aaf14.jpg" } } as any,
      res as any,
    );

    expect(state.statusCode).toBe(404);
    expect(state.body).toBe(STORAGE_UNAVAILABLE_MESSAGE);
    expect(state.headers["Cache-Control"]).toBe("no-store");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not log or return 502 backend errors", () => {
    const src = read("server/_core/storageProxy.ts");
    expect(src).not.toContain("502");
    expect(src).not.toContain("[StorageProxy] forge error");
    expect(src).not.toContain("v1/storage/presign");
    expect(src).not.toContain("fetch(");
    expect(src).not.toMatch(/https?:\/\/forge\.manus\.im/);
  });
});

describe("product sources no longer hardcode Manus storage", () => {
  it("removes /manus-storage/ asset URLs from client runtime and static shells", () => {
    const productFiles = [
      "client/src/pages/MarketingSite.tsx",
      "client/src/components/ProductExperience.tsx",
      "client/src/components/OnboardingVideoModal.tsx",
      "client/src/hooks/useNarrationAudio.ts",
      "client/index.html",
      "client/public/manifest.json",
      "client/public/sw.js",
      "server/storage.ts",
    ];

    for (const relativePath of productFiles) {
      expect(read(relativePath), relativePath).not.toMatch(/\/manus-storage\//);
      expect(read(relativePath), relativePath).not.toMatch(/https?:\/\/forge\.manus\.im/);
    }
  });

  it("keeps only a fail-closed compatibility route for leftover /manus-storage/ GETs", () => {
    const proxy = read("server/_core/storageProxy.ts");
    const index = read("server/_core/index.ts");
    expect(proxy).toContain('app.get("/manus-storage/*"');
    expect(index).toContain("registerStorageProxy(app)");
    expect(index).not.toMatch(/\/manus-storage\//);
    expect(index).not.toMatch(/https?:\/\/forge\.manus\.im/);
  });

  it("does not restore Manus storage hosts in server runtime sources", () => {
    const serverFiles = walkFiles(resolve(root, "server")).filter(
      file => file.endsWith(".ts") && !file.endsWith(".test.ts"),
    );

    for (const file of serverFiles) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toContain("v1/storage/presign");
      expect(source, file).not.toMatch(/https?:\/\/forge\.manus\.im/);
    }
  });
});
