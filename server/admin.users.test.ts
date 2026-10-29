/**
 * Owner-operations regression tests for the actual admin tRPC router.
 * These use mocked database helpers only; they never contact a production service.
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminPortal from "../client/src/pages/AdminPortal";
import { appRouter } from "./routers";

const CORRELATION = "3a8b3e5f-b31c-4b5b-9d52-6a8e1c7f9d21";

const auditStore = vi.hoisted(() => ({
  setFeatureFlag: vi.fn(),
  setUserTier: vi.fn(),
  updateFoundingRequestStatus: vi.fn(),
  removeUser: vi.fn(),
  addStressAnnotation: vi.fn(),
  prepareApprovalEmailAttempt: vi.fn(),
  recordApprovalEmailResult: vi.fn(),
  list: vi.fn(),
}));
const emailAdapter = vi.hoisted(() => ({
  buildApprovalEmail: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getAllUsers: vi.fn(),
    getAllFeatureFlags: vi.fn(),
  };
});

vi.mock("./adminAuditStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./adminAuditStore")>();
  return { ...actual, adminAuditStore: auditStore };
});
vi.mock("./email", () => emailAdapter);

import {
  AdminAuditGuardError,
  AdminAuditNotFoundError,
} from "./adminAuditStore";
import { getAllFeatureFlags, getAllUsers } from "./db";

const USERS = [
  {
    id: 1,
    name: "Alice Admin",
    email: "alice@example.com",
    role: "admin",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    lastSignedIn: new Date("2026-10-01T00:00:00Z"),
  },
  {
    id: 2,
    name: "Bob User",
    email: "bob@example.com",
    role: "user",
    createdAt: new Date("2026-02-01T00:00:00Z"),
    lastSignedIn: new Date("2026-10-02T00:00:00Z"),
  },
];

function caller(user: { id: number; role: "admin" | "user"; isQaSession?: boolean } | null) {
  return appRouter.createCaller({ req: {} as never, res: {} as never, user } as never);
}

describe("admin owner operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAllUsers).mockResolvedValue(USERS as never);
    vi.mocked(getAllFeatureFlags).mockResolvedValue([] as never);
    auditStore.setFeatureFlag.mockResolvedValue(undefined);
    auditStore.setUserTier.mockResolvedValue({ tier: "premium", lifetimeAccess: false });
    auditStore.updateFoundingRequestStatus.mockResolvedValue(undefined);
    auditStore.removeUser.mockResolvedValue(undefined);
    auditStore.addStressAnnotation.mockResolvedValue(undefined);
    auditStore.prepareApprovalEmailAttempt.mockResolvedValue({
      correlationId: CORRELATION,
      recipient: { email: "recipient@example.test", name: "Recipient" },
    });
    auditStore.recordApprovalEmailResult.mockResolvedValue(undefined);
    auditStore.list.mockResolvedValue({ events: [], nextBeforeId: null });
    emailAdapter.buildApprovalEmail.mockReturnValue({ to: "redacted", subject: "Approval", html: "safe fixture" });
    emailAdapter.sendEmail.mockResolvedValue({ success: true });
  });

  it("transpiles the admin portal that consumes runtime diagnostics and reachable audit history", () => {
    expect(typeof AdminPortal).toBe("function");
    const portal = readFileSync("client/src/pages/AdminPortal.tsx", "utf8");
    expect(portal).toContain("getMutationAuditEvents.useQuery");
    expect(portal).toContain('title="Administrative Audit History"');
    expect(portal).toContain("Loading durable audit history");
    expect(portal).toContain("Audit history is unavailable");
    expect(portal).toContain("No durable audit events recorded");
    expect(portal).toContain("NEWER");
    expect(portal).toContain("OLDER");
    expect(portal).toContain("Adapter Accepted");
    expect(portal).toContain("Do Not Retry");
  });

  it("returns users only to an authenticated administrator", async () => {
    await expect(caller(null).admin.getUsers()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller({ id: 2, role: "user" }).admin.getUsers()).rejects.toMatchObject({ code: "FORBIDDEN" });

    const result = await caller({ id: 1, role: "admin" }).admin.getUsers();
    expect(result).toEqual(USERS);
    expect(getAllUsers).toHaveBeenCalledTimes(1);
  });

  it("refuses to delete any administrator account, including a different administrator", async () => {
    auditStore.removeUser.mockRejectedValue(new AdminAuditGuardError(
      "Administrator accounts cannot be removed through this console.",
      "FORBIDDEN",
    ));

    await expect(caller({ id: 1, role: "admin" }).admin.removeUser({ userId: 3 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(auditStore.removeUser).toHaveBeenCalledWith({ actorUserId: 1, userId: 3 });
  });

  it("rejects self-deletion and only deletes an existing non-admin user", async () => {
    const admin = caller({ id: 1, role: "admin" });
    auditStore.removeUser.mockImplementation(async ({ actorUserId, userId }) => {
      if (actorUserId === userId) throw new AdminAuditGuardError("You cannot remove your own account.", "BAD_REQUEST");
      if (userId === 999) throw new AdminAuditNotFoundError("User not found.");
    });
    await expect(admin.admin.removeUser({ userId: 1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(admin.admin.removeUser({ userId: 999 })).rejects.toMatchObject({ code: "NOT_FOUND" });

    await expect(admin.admin.removeUser({ userId: 2 })).resolves.toEqual({ success: true });
    expect(auditStore.removeUser).toHaveBeenLastCalledWith({ actorUserId: 1, userId: 2 });
  });

  it("fails closed for unknown feature flags and records the acting administrator for known flags", async () => {
    const admin = caller({ id: 1, role: "admin" });
    auditStore.setFeatureFlag.mockRejectedValueOnce(new AdminAuditNotFoundError("Feature flag not found."));
    await expect(admin.admin.setFeatureFlag({ key: "does_not_exist", enabled: true })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    await expect(admin.admin.setFeatureFlag({ key: "safe_feature", enabled: false })).resolves.toEqual({ success: true });
    expect(auditStore.setFeatureFlag).toHaveBeenLastCalledWith({
      actorUserId: 1,
      key: "safe_feature",
      enabled: false,
    });
  });

  it("authorizes cursor-paginated audit history before accessing durable storage", async () => {
    await expect(caller(null).admin.setFeatureFlag({ key: "safe_feature", enabled: false })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(caller({ id: 2, role: "user" }).admin.getMutationAuditEvents({ limit: 10 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(auditStore.setFeatureFlag).not.toHaveBeenCalled();
    expect(auditStore.list).not.toHaveBeenCalled();

    const page = {
      events: [{
        id: 9,
        actorUserId: 1,
        action: "FEATURE_FLAG_UPDATED",
        targetType: "feature_flag",
        targetId: null,
        targetKey: "safe_feature",
        correlationId: null,
        before: { enabled: true },
        after: { enabled: false },
        outcome: "SUCCEEDED",
        occurredAt: new Date("2026-10-29T00:00:00.000Z"),
      }],
      nextBeforeId: 8,
    };
    auditStore.list.mockResolvedValueOnce(page);
    await expect(caller({ id: 1, role: "admin" }).admin.getMutationAuditEvents({ limit: 10, beforeId: 20 })).resolves.toEqual(page);
    expect(auditStore.list).toHaveBeenCalledWith({ limit: 10, beforeId: 20 });
  });

  it("records a safe approval attempt before the email adapter and links the result by correlation", async () => {
    const admin = caller({ id: 1, role: "admin" });
    await expect(admin.admin.sendApprovalEmail({
      requestId: 7,
      origin: "https://safe.example.test",
    })).resolves.toEqual({ success: true, correlationId: CORRELATION });

    expect(auditStore.prepareApprovalEmailAttempt).toHaveBeenCalledWith({ actorUserId: 1, requestId: 7 });
    expect(emailAdapter.buildApprovalEmail).toHaveBeenCalledWith({
      name: "Recipient",
      email: "recipient@example.test",
      siteUrl: "https://safe.example.test",
    });
    expect(auditStore.recordApprovalEmailResult).toHaveBeenCalledWith({
      actorUserId: 1,
      requestId: 7,
      correlationId: CORRELATION,
      accepted: true,
    });
    expect(auditStore.prepareApprovalEmailAttempt.mock.invocationCallOrder[0]).toBeLessThan(emailAdapter.sendEmail.mock.invocationCallOrder[0]!);
    expect(emailAdapter.sendEmail.mock.invocationCallOrder[0]).toBeLessThan(auditStore.recordApprovalEmailResult.mock.invocationCallOrder[0]!);
  });

  it("returns an explicit no-retry conflict if the adapter result cannot be durably appended", async () => {
    const admin = caller({ id: 1, role: "admin" });
    auditStore.recordApprovalEmailResult.mockRejectedValueOnce(new Error("audit table unavailable"));

    await expect(admin.admin.sendApprovalEmail({
      requestId: 7,
      origin: "https://safe.example.test",
    })).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("do not retry") });
    expect(emailAdapter.sendEmail).toHaveBeenCalledTimes(1);
    expect(auditStore.recordApprovalEmailResult).toHaveBeenCalledWith(expect.objectContaining({ correlationId: CORRELATION, accepted: true }));
  });

  it("treats an adapter exception after a recorded attempt as ambiguous rather than fabricating rejection", async () => {
    const admin = caller({ id: 1, role: "admin" });
    emailAdapter.sendEmail.mockRejectedValueOnce(new Error("adapter timeout"));

    await expect(admin.admin.sendApprovalEmail({
      requestId: 7,
      origin: "https://safe.example.test",
    })).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining(CORRELATION) });
    expect(auditStore.prepareApprovalEmailAttempt).toHaveBeenCalledWith({ actorUserId: 1, requestId: 7 });
    expect(auditStore.recordApprovalEmailResult).not.toHaveBeenCalled();
  });

  it("limits runtime diagnostics to configuration presence and never exposes a configuration value", async () => {
    await expect(caller({ id: 2, role: "user" }).admin.getRuntimeDiagnostics()).rejects.toMatchObject({ code: "FORBIDDEN" });

    const diagnostics = await caller({ id: 1, role: "admin" }).admin.getRuntimeDiagnostics();
    expect(diagnostics.checksAreConfigurationOnly).toBe(true);
    expect(diagnostics.errorMonitoring).toMatchObject({ provider: "sentry", configured: expect.any(Boolean) });
    expect(diagnostics.configuration).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "DATABASE_URL", configured: expect.any(Boolean) }),
      expect.objectContaining({ key: "SENTRY_DSN", configured: expect.any(Boolean) }),
    ]));
    for (const check of diagnostics.configuration) {
      expect(Object.keys(check).sort()).toEqual(["configured", "key"]);
    }
  });

  it("keeps the admin health view truthful about what it can and cannot verify", () => {
    const portal = readFileSync("client/src/pages/AdminPortal.tsx", "utf8");
    const engineering = readFileSync("client/src/pages/admin/EngineeringDiagnostics.tsx", "utf8");

    expect(portal).toContain("getRuntimeDiagnostics.useQuery");
    expect(portal).toContain("this view does not probe provider health");
    expect(portal).not.toContain('name: "FRED Economic Data", status: "ONLINE"');
    expect(portal).not.toContain('ok: true');
    expect(portal).toContain("linked accounts require a separate tier grant");
    expect(engineering).toContain("does not itself establish that background services are currently running");
  });
});
