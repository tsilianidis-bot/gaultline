import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LEGACY_CAPABILITY_AUDIT } from "../shared/legacyCapabilityAudit";
import {
  NON_ROUTE_PAGE_MODULES,
  PAGE_TREATMENT_MANIFEST,
  REORGANIZATION_BASELINE_PAGE_SOURCES,
} from "../shared/pageTreatmentManifest";

const appSource = readFileSync(join(process.cwd(), "client/src/App.tsx"), "utf8");

describe("authoritative 158-row page treatment manifest", () => {
  it("covers each immutable-baseline row exactly once", () => {
    expect(REORGANIZATION_BASELINE_PAGE_SOURCES).toHaveLength(158);
    expect(PAGE_TREATMENT_MANIFEST).toHaveLength(158);
    expect(new Set(REORGANIZATION_BASELINE_PAGE_SOURCES).size).toBe(158);
    expect(new Set(PAGE_TREATMENT_MANIFEST.map(entry => entry.source)).size).toBe(158);
    PAGE_TREATMENT_MANIFEST.forEach(entry => {
      expect(existsSync(join(process.cwd(), entry.source)), entry.source).toBe(true);
    });
  });

  it("applies all 36 audited analytical decisions and preserves all 122 non-audited rows", () => {
    const auditedPages = new Set(LEGACY_CAPABILITY_AUDIT.map(entry => entry.page));
    const auditedRows = PAGE_TREATMENT_MANIFEST.filter(entry => auditedPages.has(entry.page));
    const preservedRows = PAGE_TREATMENT_MANIFEST.filter(entry => !auditedPages.has(entry.page));

    expect(auditedRows).toHaveLength(36);
    expect(preservedRows).toHaveLength(122);
    expect(preservedRows.every(entry => entry.treatment === "preserve")).toBe(true);
    LEGACY_CAPABILITY_AUDIT.forEach(audit => {
      expect(auditedRows).toContainEqual(expect.objectContaining({
        page: audit.page,
        treatment: audit.classification,
        destination: audit.destination,
      }));
    });
  });

  it("retains explicit public, support, account, admin, internal, SEO, and mobile coverage", () => {
    const preservedSources = new Set(
      PAGE_TREATMENT_MANIFEST
        .filter(entry => entry.treatment === "preserve")
        .map(entry => entry.source),
    );

    [
      "client/src/pages/MarketingSite.tsx",
      "client/src/pages/Guide.tsx",
      "client/src/pages/UserAccount.tsx",
      "client/src/pages/AdminPortal.tsx",
      "client/src/pages/OwnerSimulation.tsx",
      "client/src/pages/mobile/MobilePulse.tsx",
      "client/src/pages/seo/MarketCrashProbability2026.tsx",
    ].forEach(source => expect(preservedSources.has(source), source).toBe(true));
  });

  it("documents the six non-route implementation modules outside the 158-row scope", () => {
    expect(NON_ROUTE_PAGE_MODULES).toHaveLength(6);
    expect(new Set([...REORGANIZATION_BASELINE_PAGE_SOURCES, ...NON_ROUTE_PAGE_MODULES]).size).toBe(164);
    NON_ROUTE_PAGE_MODULES.forEach(source => {
      expect(existsSync(join(process.cwd(), source)), source).toBe(true);
    });
  });

  it("mounts the included Chat Inbox implementation at its preserved admin route", () => {
    expect(appSource).toContain('lazy(() => import("./pages/admin/ChatInbox"))');
    expect(appSource).toMatch(/<Route path="\/app\/admin\/chat-inbox">[\s\S]*?<ChatInbox \/>[\s\S]*?<\/Route>/);
  });
});
