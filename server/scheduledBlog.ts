import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { blogPosts } from "../drizzle/schema";
import { sdk } from "./_core/sdk";

/**
 * POST /api/scheduled/publish-blog
 * Called by the daily AGENT cron to publish a new blog post.
 * Auth: isCron === true (Manus heartbeat / agent cron)
 *
 * Body: { title, subtitle, content, slug, category, tags }
 */
export async function handleScheduledPublishBlog(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) {
      return res.status(403).json({ error: "cron-only endpoint" });
    }

    const { title, subtitle, content, slug, category, tags } = req.body as {
      title?: string;
      subtitle?: string;
      content?: string;
      slug?: string;
      category?: string;
      tags?: string;
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

    // Check for duplicate slug
    const existing = await db.select().from(blogPosts)
      .where(eq(blogPosts.slug, safeSlug))
      .limit(1);

    if (existing.length > 0) {
      // Append timestamp suffix to avoid collision
      const suffix = Date.now().toString(36);
      const uniqueSlug = `${safeSlug}-${suffix}`;
      await db.insert(blogPosts).values({
        slug: uniqueSlug,
        title,
        subtitle: subtitle ?? null,
        content,
        author: "FAULTLINE Intelligence",
        category: category ?? "Macro Intelligence",
        tags: tags ?? null,
        published: 1,
        publishedAt: new Date(),
      });
      return res.json({ ok: true, slug: uniqueSlug, note: "slug collision — suffix appended" });
    }

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
    });

    console.log(`[ScheduledBlog] Published: "${title}" at /blog/${safeSlug}`);
    return res.json({ ok: true, slug: safeSlug });
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
