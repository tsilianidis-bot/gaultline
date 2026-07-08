/**
 * Tests for conversationLogger.ts
 * Validates the core helper functions without hitting the real DB.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────────

// Mock the DB module so no real database is needed
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

// ── Import after mocks ─────────────────────────────────────────────────────────

import { startConversation, logMessage } from "./conversationLogger";

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("conversationLogger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("startConversation", () => {
    it("returns -1 when DB is unavailable", async () => {
      const id = await startConversation({
        sessionId: "test-session-001",
        userTier: "free",
        module: "ask_intelligence",
      });
      expect(id).toBe(-1);
    });

    it("accepts all valid user tiers without throwing", async () => {
      const tiers = ["free", "core", "premium", "founding", "anonymous"] as const;
      for (const tier of tiers) {
        const id = await startConversation({
          sessionId: `session-${tier}`,
          userTier: tier,
          module: "ask_intelligence",
        });
        expect(typeof id).toBe("number");
      }
    });
  });

  describe("logMessage", () => {
    it("resolves without throwing when DB is unavailable", async () => {
      await expect(logMessage({
        conversationId: 1,
        role: "user",
        content: "What is the best AI stock?",
      })).resolves.toBeUndefined();
    });

    it("accepts user and assistant roles without throwing", async () => {
      const roles = ["user", "assistant"] as const;
      for (const role of roles) {
        await expect(logMessage({
          conversationId: 1,
          role,
          content: "Test message",
        })).resolves.toBeUndefined();
      }
    });

    it("accepts optional confidenceScore and responseTimeMs without throwing", async () => {
      await expect(logMessage({
        conversationId: 1,
        role: "assistant",
        content: "NVDA looks strong in the current regime.",
        confidenceScore: 82,
        responseTimeMs: 1450,
      })).resolves.toBeUndefined();
    });
  });
});
