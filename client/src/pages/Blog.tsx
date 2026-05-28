import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useSEO } from "@/hooks/useSEO";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import {
  CalendarDays, Clock, Rss, Plus, X, Eye, EyeOff,
  ChevronRight, Loader2, Pencil, Trash2, Check
} from "lucide-react";

const CATEGORIES = [
  "Macro Intelligence",
  "Market Analysis",
  "Risk Intelligence",
  "Crypto Intelligence",
  "Platform Updates",
];

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function categoryColor(cat: string) {
  const map: Record<string, string> = {
    "Macro Intelligence": "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    "Market Analysis": "bg-amber-500/10 text-amber-400 border-amber-500/20",
    "Risk Intelligence": "bg-red-500/10 text-red-400 border-red-500/20",
    "Crypto Intelligence": "bg-purple-500/10 text-purple-400 border-purple-500/20",
    "Platform Updates": "bg-green-500/10 text-green-400 border-green-500/20",
  };
  return map[cat] ?? "bg-slate-500/10 text-slate-400 border-slate-500/20";
}

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 100);
}

type PostForm = {
  id?: number;
  slug: string;
  title: string;
  subtitle: string;
  content: string;
  author: string;
  category: string;
  tags: string;
  published: boolean;
};

const EMPTY_FORM: PostForm = {
  slug: "",
  title: "",
  subtitle: "",
  content: "",
  author: "FAULTLINE",
  category: "Macro Intelligence",
  tags: "",
  published: false,
};

function PostModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: PostForm & { id?: number };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<PostForm>(initial ?? EMPTY_FORM);
  const [autoSlug, setAutoSlug] = useState(!initial?.id);

  const createMut = trpc.blog.create.useMutation({
    onSuccess: () => { toast.success("Post created"); onSaved(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.blog.update.useMutation({
    onSuccess: () => { toast.success("Post updated"); onSaved(); },
    onError: (e) => toast.error(e.message),
  });

  const saving = createMut.isPending || updateMut.isPending;

  function setField<K extends keyof PostForm>(k: K, v: PostForm[K]) {
    setForm(f => {
      const next = { ...f, [k]: v };
      if (k === "title" && autoSlug) next.slug = slugify(v as string);
      return next;
    });
  }

  function handleSave(publish: boolean) {
    const payload = { ...form, published: publish };
    if (form.id) {
      updateMut.mutate({ id: form.id, ...payload });
    } else {
      createMut.mutate(payload);
    }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", overflowY: "auto" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          maxWidth: 760, margin: "40px auto", background: "#0a0e1a",
          border: "1px solid rgba(0,212,255,0.15)", borderRadius: 12,
          padding: "28px 32px", position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, color: "#00D4FF", letterSpacing: "0.15em" }}>
            {form.id ? "EDIT BRIEFING" : "NEW BRIEFING"}
          </span>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#6B7280" }}>
            <X size={18} />
          </button>
        </div>

        {/* Title */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "#6B7280", letterSpacing: "0.12em", marginBottom: 6 }}>TITLE *</label>
          <input
            value={form.title}
            onChange={e => setField("title", e.target.value)}
            placeholder="Briefing title..."
            style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "10px 12px", color: "#fff", fontSize: 15, fontFamily: "'IBM Plex Sans',sans-serif", outline: "none", boxSizing: "border-box" }}
          />
        </div>

        {/* Slug */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "flex", justifyContent: "space-between", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "#6B7280", letterSpacing: "0.12em", marginBottom: 6 }}>
            <span>SLUG *</span>
            <button
              onClick={() => setAutoSlug(a => !a)}
              style={{ background: "transparent", border: "none", cursor: "pointer", color: autoSlug ? "#00D4FF" : "#6B7280", fontSize: 10, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: "0.1em" }}
            >
              {autoSlug ? "AUTO ✓" : "MANUAL"}
            </button>
          </label>
          <input
            value={form.slug}
            onChange={e => { setAutoSlug(false); setField("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); }}
            placeholder="url-slug-here"
            style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "10px 12px", color: "#94A3B8", fontSize: 13, fontFamily: "'IBM Plex Mono',monospace", outline: "none", boxSizing: "border-box" }}
          />
        </div>

        {/* Subtitle */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "#6B7280", letterSpacing: "0.12em", marginBottom: 6 }}>SUBTITLE</label>
          <input
            value={form.subtitle}
            onChange={e => setField("subtitle", e.target.value)}
            placeholder="Short description..."
            style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "10px 12px", color: "#fff", fontSize: 14, fontFamily: "'IBM Plex Sans',sans-serif", outline: "none", boxSizing: "border-box" }}
          />
        </div>

        {/* Category + Author row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ display: "block", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "#6B7280", letterSpacing: "0.12em", marginBottom: 6 }}>CATEGORY</label>
            <select
              value={form.category}
              onChange={e => setField("category", e.target.value)}
              style={{ width: "100%", background: "#0d1220", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "10px 12px", color: "#fff", fontSize: 13, fontFamily: "'IBM Plex Mono',monospace", outline: "none", boxSizing: "border-box" }}
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "#6B7280", letterSpacing: "0.12em", marginBottom: 6 }}>AUTHOR</label>
            <input
              value={form.author}
              onChange={e => setField("author", e.target.value)}
              style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "10px 12px", color: "#fff", fontSize: 13, fontFamily: "'IBM Plex Mono',monospace", outline: "none", boxSizing: "border-box" }}
            />
          </div>
        </div>

        {/* Tags */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "#6B7280", letterSpacing: "0.12em", marginBottom: 6 }}>TAGS (comma-separated)</label>
          <input
            value={form.tags}
            onChange={e => setField("tags", e.target.value)}
            placeholder="macro, fed, risk..."
            style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "10px 12px", color: "#94A3B8", fontSize: 13, fontFamily: "'IBM Plex Mono',monospace", outline: "none", boxSizing: "border-box" }}
          />
        </div>

        {/* Content */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "#6B7280", letterSpacing: "0.12em", marginBottom: 6 }}>CONTENT * (Markdown supported)</label>
          <textarea
            value={form.content}
            onChange={e => setField("content", e.target.value)}
            placeholder="Write your briefing in Markdown..."
            rows={14}
            style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "12px", color: "#E2E8F0", fontSize: 13, fontFamily: "'IBM Plex Mono',monospace", outline: "none", resize: "vertical", lineHeight: 1.7, boxSizing: "border-box" }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={() => handleSave(false)}
            disabled={saving || !form.title || !form.slug || !form.content}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "10px 18px", borderRadius: 6, cursor: "pointer",
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              color: "#94A3B8", fontSize: 12, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: "0.1em",
              opacity: (saving || !form.title || !form.slug || !form.content) ? 0.5 : 1,
            }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <EyeOff size={14} />}
            SAVE DRAFT
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving || !form.title || !form.slug || !form.content}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "10px 18px", borderRadius: 6, cursor: "pointer",
              background: "rgba(0,212,255,0.12)", border: "1px solid rgba(0,212,255,0.3)",
              color: "#00D4FF", fontSize: 12, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: "0.1em",
              opacity: (saving || !form.title || !form.slug || !form.content) ? 0.5 : 1,
            }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
            PUBLISH
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Blog() {
  useSEO({
    title: "Intelligence Briefings — Macro Commentary & Market Analysis",
    description:
      "FAULTLINE Intelligence Briefings: institutional macro commentary, market risk analysis, systemic pressure updates, and fault line reports from the FAULTLINE intelligence team.",
    canonical: "/blog",
  });

  const [, navigate] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [activeCategory, setActiveCategory] = useState<string | undefined>(undefined);
  const [showModal, setShowModal] = useState(false);
  const [editPost, setEditPost] = useState<(PostForm & { id: number }) | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const utils = trpc.useUtils();

  // Admin sees all posts (published + drafts); regular users see published only
  const { data: posts = [], isLoading } = isAdmin
    ? trpc.blog.adminList.useQuery()
    : trpc.blog.list.useQuery({ limit: 50, category: activeCategory });

  const filteredPosts = useMemo(() => {
    if (!isAdmin || !activeCategory) return posts;
    return posts.filter((p: any) => p.category === activeCategory);
  }, [posts, activeCategory, isAdmin]);

  const { data: categories = [] } = trpc.blog.getCategories.useQuery();

  const deleteMut = trpc.blog.delete.useMutation({
    onSuccess: () => {
      toast.success("Post deleted");
      utils.blog.list.invalidate();
      utils.blog.adminList.invalidate();
      setConfirmDelete(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const featured = filteredPosts[0] as any;
  const rest = filteredPosts.slice(1) as any[];

  function handleSaved() {
    setShowModal(false);
    setEditPost(null);
    utils.blog.list.invalidate();
    utils.blog.adminList.invalidate();
  }

  function openEdit(post: any) {
    setEditPost({
      id: post.id,
      slug: post.slug,
      title: post.title,
      subtitle: post.subtitle ?? "",
      content: post.content ?? "",
      author: post.author ?? "FAULTLINE",
      category: post.category ?? "Macro Intelligence",
      tags: post.tags ?? "",
      published: Boolean(post.published),
    });
  }

  // Determine the correct blog post link (in-app vs public)
  function blogPostHref(slug: string) {
    // If we're inside the app shell (/app/*), use /app/blog/:slug
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/app")) {
      return `/app/blog/${slug}`;
    }
    return `/blog/${slug}`;
  }

  return (
    <div className="min-h-screen bg-[#080c18] text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#0a0e1a]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="font-['Orbitron'] text-lg font-bold tracking-widest text-white">
            FAULT<span className="text-cyan-400">LINE</span>
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-400 font-['IBM_Plex_Mono']">
              <Rss className="w-3.5 h-3.5 text-cyan-400" />
              INTELLIGENCE BRIEFINGS
            </div>
            {isAdmin && (
              <button
                onClick={() => setShowModal(true)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "7px 14px", borderRadius: 6, cursor: "pointer",
                  background: "rgba(0,212,255,0.12)", border: "1px solid rgba(0,212,255,0.3)",
                  color: "#00D4FF", fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: "0.1em",
                }}
              >
                <Plus size={13} />
                NEW POST
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Page title */}
        <div className="mb-10 flex items-start justify-between">
          <div>
            <h1 className="font-['Orbitron'] text-3xl font-bold tracking-wider text-white mb-2">
              INTELLIGENCE <span className="text-cyan-400">BRIEFINGS</span>
            </h1>
            <p className="text-slate-400 text-sm font-['IBM_Plex_Mono']">
              Macro commentary, market risk analysis, and fault line reports
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowModal(true)}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "10px 20px", borderRadius: 8, cursor: "pointer",
                background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.25)",
                color: "#00D4FF", fontSize: 12, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: "0.12em",
              }}
            >
              <Plus size={15} />
              NEW BRIEFING
            </button>
          )}
        </div>

        {/* Category filter */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            <button
              onClick={() => setActiveCategory(undefined)}
              className={`px-3 py-1 rounded text-xs font-['IBM_Plex_Mono'] border transition-colors ${
                !activeCategory
                  ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
                  : "bg-white/5 text-slate-400 border-white/10 hover:border-white/20"
              }`}
            >
              ALL
            </button>
            {categories.map((cat: string) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat === activeCategory ? undefined : cat)}
                className={`px-3 py-1 rounded text-xs font-['IBM_Plex_Mono'] border transition-colors ${
                  activeCategory === cat
                    ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
                    : "bg-white/5 text-slate-400 border-white/10 hover:border-white/20"
                }`}
              >
                {cat.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-lg bg-white/5 animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && filteredPosts.length === 0 && (
          <div className="text-center py-24 text-slate-500 font-['IBM_Plex_Mono'] text-sm">
            {isAdmin
              ? <span>NO BRIEFINGS YET — <button onClick={() => setShowModal(true)} style={{ color: "#00D4FF", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit" }}>CREATE YOUR FIRST POST →</button></span>
              : "NO BRIEFINGS PUBLISHED YET"
            }
          </div>
        )}

        {!isLoading && featured && (
          <>
            {/* Featured post */}
            <div className="group mb-8 p-6 rounded-lg border border-white/10 bg-white/[0.03] hover:border-cyan-500/30 hover:bg-white/[0.05] transition-all cursor-pointer relative"
              onClick={() => navigate(blogPostHref(featured.slug))}
            >
              {isAdmin && (
                <div style={{ position: "absolute", top: 12, right: 12, display: "flex", gap: 6, zIndex: 2 }} onClick={e => e.stopPropagation()}>
                  {!featured.published && (
                    <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono',monospace", color: "#F59E0B", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 4, padding: "2px 7px", letterSpacing: "0.1em" }}>DRAFT</span>
                  )}
                  <button onClick={() => openEdit(featured)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 5, padding: "4px 8px", cursor: "pointer", color: "#94A3B8" }}>
                    <Pencil size={13} />
                  </button>
                  {confirmDelete === featured.id ? (
                    <button onClick={() => deleteMut.mutate({ id: featured.id })} style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 5, padding: "4px 8px", cursor: "pointer", color: "#EF4444" }}>
                      <Check size={13} />
                    </button>
                  ) : (
                    <button onClick={() => setConfirmDelete(featured.id)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 5, padding: "4px 8px", cursor: "pointer", color: "#94A3B8" }}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs px-2 py-0.5 rounded border font-['IBM_Plex_Mono'] ${categoryColor(featured.category)}`}>
                  {featured.category.toUpperCase()}
                </span>
                <span className="text-xs text-slate-500 font-['IBM_Plex_Mono']">FEATURED</span>
              </div>
              <h2 className="text-xl font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors leading-snug">
                {featured.title}
              </h2>
              {featured.subtitle && (
                <p className="text-slate-400 text-sm mb-4 leading-relaxed">{featured.subtitle}</p>
              )}
              <div className="flex items-center gap-4 text-xs text-slate-500 font-['IBM_Plex_Mono']">
                <span className="flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" />
                  {formatDate(featured.publishedAt)}
                </span>
                <span>{featured.author}</span>
                {(featured.viewCount ?? 0) > 0 && (
                  <span className="flex items-center gap-1 text-slate-500">
                    <Eye className="w-3 h-3" />
                    {(featured.viewCount ?? 0).toLocaleString()}
                  </span>
                )}
                <span className="ml-auto flex items-center gap-1 text-cyan-400 group-hover:gap-2 transition-all">
                  READ BRIEFING <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </div>

            {/* Rest of posts grid */}
            {rest.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rest.map((post: any) => (
                  <div
                    key={post.id}
                    className="group p-5 rounded-lg border border-white/10 bg-white/[0.02] hover:border-cyan-500/30 hover:bg-white/[0.04] transition-all cursor-pointer h-full relative"
                    onClick={() => navigate(blogPostHref(post.slug))}
                  >
                    {isAdmin && (
                      <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 5, zIndex: 2 }} onClick={e => e.stopPropagation()}>
                        {!post.published && (
                          <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono',monospace", color: "#F59E0B", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 4, padding: "2px 6px", letterSpacing: "0.1em" }}>DRAFT</span>
                        )}
                        <button onClick={() => openEdit(post)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, padding: "3px 6px", cursor: "pointer", color: "#94A3B8" }}>
                          <Pencil size={12} />
                        </button>
                        {confirmDelete === post.id ? (
                          <button onClick={() => deleteMut.mutate({ id: post.id })} style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 4, padding: "3px 6px", cursor: "pointer", color: "#EF4444" }}>
                            <Check size={12} />
                          </button>
                        ) : (
                          <button onClick={() => setConfirmDelete(post.id)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, padding: "3px 6px", cursor: "pointer", color: "#94A3B8" }}>
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded border font-['IBM_Plex_Mono'] ${categoryColor(post.category)}`}>
                        {post.category.toUpperCase()}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-white mb-1.5 group-hover:text-cyan-400 transition-colors leading-snug">
                      {post.title}
                    </h3>
                    {post.subtitle && (
                      <p className="text-slate-500 text-xs mb-3 leading-relaxed line-clamp-2">{post.subtitle}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-slate-500 font-['IBM_Plex_Mono'] mt-auto">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        {formatDate(post.publishedAt)}
                      </span>
                      <span>{post.author}</span>
                      {(post.viewCount ?? 0) > 0 && (
                        <span className="flex items-center gap-1 ml-auto">
                          <Eye className="w-3 h-3" />
                          {(post.viewCount ?? 0).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Create / Edit modal */}
      {(showModal || editPost) && (
        <PostModal
          initial={editPost ?? undefined}
          onClose={() => { setShowModal(false); setEditPost(null); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
