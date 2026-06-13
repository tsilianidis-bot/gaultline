/**
 * Blog domain router
 * Handles public blog listing/reading and admin CRUD for posts.
 * Extracted from server/routers.ts for maintainability.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import {
  getBlogPosts, getBlogPostBySlug, getBlogPostById,
  createBlogPost, updateBlogPost, deleteBlogPost,
  getBlogCategories, incrementBlogPostViewCount,
} from "../db";

export const blogRouter = router({
  // Public: list published posts
  list: publicProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(50).default(20),
      offset: z.number().int().min(0).default(0),
      category: z.string().optional(),
    }))
    .query(async ({ input }) => {
      try {
        return await getBlogPosts({ publishedOnly: true, ...input });
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch posts", cause: err });
      }
    }),

  // Public: get single post by slug
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        const post = await getBlogPostBySlug(input.slug);
        if (!post || !post.published) throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });
        return post;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch post", cause: err });
      }
    }),

  // Public: get categories
  getCategories: publicProcedure.query(async () => {
    try {
      return await getBlogCategories();
    } catch (err) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch categories", cause: err });
    }
  }),

  // Admin: list all posts (including drafts)
  adminList: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    try {
      return await getBlogPosts({ publishedOnly: false, limit: 100 });
    } catch (err) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch posts", cause: err });
    }
  }),

  // Admin: get single post by id (for editing)
  adminGetById: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const post = await getBlogPostById(input.id);
      if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });
      return post;
    }),

  // Admin: create post
  create: protectedProcedure
    .input(z.object({
      slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
      title: z.string().min(1).max(300),
      subtitle: z.string().max(400).optional(),
      content: z.string().min(1),
      author: z.string().max(100).default("FAULTLINE"),
      category: z.string().max(80).default("Macro Intelligence"),
      tags: z.string().max(500).optional(),
      published: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      try {
        const id = await createBlogPost({
          ...input,
          published: input.published ? 1 : 0,
          publishedAt: input.published ? new Date() : null,
        });
        return { id };
      } catch (err: any) {
        if (err?.code === "ER_DUP_ENTRY") throw new TRPCError({ code: "CONFLICT", message: "A post with this slug already exists" });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create post", cause: err });
      }
    }),

  // Admin: update post
  update: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/).optional(),
      title: z.string().min(1).max(300).optional(),
      subtitle: z.string().max(400).optional(),
      content: z.string().min(1).optional(),
      author: z.string().max(100).optional(),
      category: z.string().max(80).optional(),
      tags: z.string().max(500).optional(),
      published: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      try {
        const { id, published, ...rest } = input;
        const existing = await getBlogPostById(id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });
        const updateData: Record<string, unknown> = { ...rest };
        if (published !== undefined) {
          updateData.published = published ? 1 : 0;
          if (published && !existing.publishedAt) updateData.publishedAt = new Date();
        }
        await updateBlogPost(id, updateData as any);
        return { success: true };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update post", cause: err });
      }
    }),

  // Admin: delete post
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      try {
        await deleteBlogPost(input.id);
        return { success: true };
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to delete post", cause: err });
      }
    }),

  // Public: increment view count when a post is opened
  incrementViewCount: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .mutation(async ({ input }) => {
      try {
        await incrementBlogPostViewCount(input.slug);
        return { success: true };
      } catch {
        // Non-critical — don't throw, just swallow
        return { success: false };
      }
    }),
});
