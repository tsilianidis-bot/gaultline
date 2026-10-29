/**
 * Owner-operations regression tests for the actual admin tRPC router.
 * These use mocked database helpers only; they never contact a production service.
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminPortal from "../client/src/pages/AdminPortal";
import { appRouter } from "./routers";

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getAllUsers: vi.fn(),
    deleteUser: vi.fn(),
    getAllFeatureFlags: vi.fn(),
    setFeatureFlag: vi.fn(),
  };
});

import { deleteUser, getAllFeatureFlags, getAllUsers, setFeatureFlag } from "./db";

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
    vi.mocked(deleteUser).mockResolvedValue(undefined);
    vi.mocked(setFeatureFlag).mockResolvedValue(undefined);
  });

  it("transpiles the admin portal that consumes runtime diagnostics", () => {
    expect(typeof AdminPortal).toBe("function");
  });

  it("returns users only to an authenticated administrator", async () => {
    await expect(caller(null).admin.getUsers()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller({ id: 2, role: "user" }).admin.getUsers()).rejects.toMatchObject({ code: "FORBIDDEN" });

    const result = await caller({ id: 1, role: "admin" }).admin.getUsers();
    expect(result).toEqual(USERS);
    expect(getAllUsers).toHaveBeenCalledTimes(1);
  });

  it("refuses to delete any administrator account, including a different administrator", async () => {
    vi.mocked(getAllUsers).mockResolvedValue([
      ...USERS,
      { ...USERS[0], id: 3, name: "Second Admin", email: "second-admin@example.com" },
    ] as never);

    await expect(caller({ id: 1, role: "admin" }).admin.removeUser({ userId: 3 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("rejects self-deletion and only deletes an existing non-admin user", async () => {
    const admin = caller({ id: 1, role: "admin" });
    await expect(admin.admin.removeUser({ userId: 1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(admin.admin.removeUser({ userId: 999 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(deleteUser).not.toHaveBeenCalled();

    await expect(admin.admin.removeUser({ userId: 2 })).resolves.toEqual({ success: true });
    expect(deleteUser).toHaveBeenCalledWith(2);
  });

  it("fails closed for unknown feature flags and records the acting administrator for known flags", async () => {
    const admin = caller({ id: 1, role: "admin" });
    await expect(admin.admin.setFeatureFlag({ key: "does_not_exist", enabled: true })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(setFeatureFlag).not.toHaveBeenCalled();

    vi.mocked(getAllFeatureFlags).mockResolvedValue([{ key: "safe_feature", enabled: 1 }] as never);
    await expect(admin.admin.setFeatureFlag({ key: "safe_feature", enabled: false })).resolves.toEqual({ success: true });
    expect(setFeatureFlag).toHaveBeenCalledWith("safe_feature", false, 1);
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
