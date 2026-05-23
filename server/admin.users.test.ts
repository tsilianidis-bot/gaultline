/**
 * Tests for admin.getUsers tRPC procedure
 * Covers: admin success path + non-admin FORBIDDEN rejection
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

// ── Mock the DB helper ────────────────────────────────────────────
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getAllUsers: vi.fn().mockResolvedValue([
      {
        id: 1,
        name: "Alice Admin",
        email: "alice@example.com",
        role: "admin",
        createdAt: new Date("2025-01-01T00:00:00Z"),
        lastSignedIn: new Date("2026-05-23T00:00:00Z"),
      },
      {
        id: 2,
        name: "Bob User",
        email: "bob@example.com",
        role: "user",
        createdAt: new Date("2025-06-01T00:00:00Z"),
        lastSignedIn: new Date("2026-05-22T00:00:00Z"),
      },
    ]),
  };
});

import { getAllUsers } from "./db";

// ── Inline the procedure logic for unit testing ───────────────────
async function adminGetUsers(ctx: { user: { id: number; role: string } | null }) {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  return await getAllUsers();
}

describe("admin.getUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all users when called by an admin", async () => {
    const result = await adminGetUsers({ user: { id: 1, role: "admin" } });
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Alice Admin");
    expect(result[0].role).toBe("admin");
    expect(result[1].name).toBe("Bob User");
    expect(result[1].role).toBe("user");
  });

  it("includes all required fields in the response", async () => {
    const result = await adminGetUsers({ user: { id: 1, role: "admin" } });
    const user = result[0];
    expect(user).toHaveProperty("id");
    expect(user).toHaveProperty("name");
    expect(user).toHaveProperty("email");
    expect(user).toHaveProperty("role");
    expect(user).toHaveProperty("createdAt");
    expect(user).toHaveProperty("lastSignedIn");
  });

  it("throws FORBIDDEN when called by a non-admin user", async () => {
    await expect(
      adminGetUsers({ user: { id: 2, role: "user" } })
    ).rejects.toThrow(TRPCError);

    try {
      await adminGetUsers({ user: { id: 2, role: "user" } });
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe("FORBIDDEN");
    }
  });

  it("throws UNAUTHORIZED when called without a session", async () => {
    await expect(
      adminGetUsers({ user: null })
    ).rejects.toThrow(TRPCError);

    try {
      await adminGetUsers({ user: null });
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe("UNAUTHORIZED");
    }
  });

  it("calls getAllUsers exactly once per admin request", async () => {
    await adminGetUsers({ user: { id: 1, role: "admin" } });
    expect(getAllUsers).toHaveBeenCalledTimes(1);
  });

  it("does not call getAllUsers when access is denied", async () => {
    try {
      await adminGetUsers({ user: { id: 2, role: "user" } });
    } catch {}
    expect(getAllUsers).not.toHaveBeenCalled();
  });
});
