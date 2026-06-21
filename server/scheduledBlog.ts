import type { Request, Response } from "express";
import { eq, and } from "drizzle-orm";
import { getDb } from "./db";
import { blogPosts } from "../drizzle/schema";
import { sdk } from "./_core/sdk";

/**
 * POST /api/scheduled/publish-blog
 * Called by the daily AGENT cron to publish a new blog post.
 * Auth: isCron === true (Manus heartbeat / agent cron)
 *
 * Body: { title, subtitle, content, slug, category, tags, contentClass? }
 *
 * Duplicate prevention:
 *   1. Slug collision → returns 409 with existingSlug (no suffix appending)
 *   2. Title collision on the SAME calendar day → returns 409 with existingId
 *      (prevents accidental republication of the same daily briefing)
 *   3. Title collision on a DIFFERENT day → allowed (same template title is
 *      legitimate for recurring intel records, e.g. "Pressure Index Holds Elevated…")
 */
export async function handleScheduledPublishBlog(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) {
      return res.status(403).json({ error: "cron-only endpoint" });
    }

    const { title, subtitle, content, slug, category, tags, contentClass } = req.body as {
      title?: string;
      subtitle?: string;
      content?: string;
      slug?: string;
      category?: string;
      tags?: string;
      contentClass?: "evergreen" | "intel_record" | "test";
    };

    if (!title || !content || !slug) {
      return res.status(400).json({ error: "title, content, and slug are required" });
    }

    // Sanitize slug — lowercase, alphanumeric + hyphens only
    const safeSlug = slug
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    const db = await getDb();
    if (!db) return res.status(503).json({ error: "database unavailable" });

    // ── Guard 1: slug uniqueness ─────────────────────────────────
    const existingBySlug = await db.select({ id: blogPosts.id, slug: blogPosts.slug })
      .from(blogPosts)
      .where(eq(blogPosts.slug, safeSlug))
      .limit(1);

    if (existingBySlug.length > 0) {
      return res.status(409).json({
        ok: false,
        error: "duplicate-slug",
        existingId: existingBySlug[0].id,
        existingSlug: existingBySlug[0].slug,
        message: "A post with this slug already exists. Use a unique slug or update the existing post.",
      });
    }

    // ── Guard 2: same-day title uniqueness ───────────────────────
    // Prevents the slug-collision handler from creating duplicate daily briefings.
    // Different days with the same title template are allowed (recurring intel records).
    const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const existingByTitleToday = await db.select({ id: blogPosts.id, slug: blogPosts.slug })
      .from(blogPosts)
      .where(
        and(
          eq(blogPosts.title, title),
          // MySQL DATE() comparison: publishedAt on same calendar day
          // Using raw SQL fragment via template literal is safe here (no user input)
        )
      )
      .limit(10);

    // Filter to same-day matches in application code (avoids raw SQL)
    const sameDayMatches = existingByTitleToday.filter(async () => {
      // Re-query with date filter
      return false; // placeholder — real check below
    });

    // Perform the same-day check with a direct query
    const sameDayCheck = await db.select({ id: blogPosts.id, slug: blogPosts.slug, publishedAt: blogPosts.publishedAt })
      .from(blogPosts)
      .where(eq(blogPosts.title, title))
      .limit(20);

    const sameDayDuplicate = sameDayCheck.find(p => {
      if (!p.publishedAt) return false;
      const postDate = new Date(p.publishedAt).toISOString().split("T")[0];
      return postDate === todayStr;
    });

    if (sameDayDuplicate) {
      return res.status(409).json({
        ok: false,
        error: "duplicate-title-same-day",
        existingId: sameDayDuplicate.id,
        existingSlug: sameDayDuplicate.slug,
        message: `A post with this exact title was already published today (${todayStr}). This is a duplicate daily briefing.`,
      });
    }

    // ── Insert new post ──────────────────────────────────────────
    await db.insert(blogPosts).values({
      slug: safeSlug,
      title,
      subtitle: subtitle ?? null,
      content,
      author: "FAULTLINE Intelligence",
      category: category ?? "Macro Intelligence",
      tags: tags ?? null,
      published: 1,
      publishedAt: new Date(),
      contentClass: contentClass ?? "intel_record",
    });

    console.log(`[ScheduledBlog] Published: "${title}" at /blog/${safeSlug} (class: ${contentClass ?? "intel_record"})`);
    return res.json({ ok: true, slug: safeSlug, contentClass: contentClass ?? "intel_record" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[ScheduledBlog] Error:", message);
    return res.status(500).json({
      error: message,
      stack,
      context: { url: req.url, taskUid: (req as any).taskUid },
      timestamp: new Date().toISOString(),
    });
  }
}
