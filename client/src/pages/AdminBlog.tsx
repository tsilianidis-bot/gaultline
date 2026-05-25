import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { useSEO } from "@/hooks/useSEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus, Edit2, Trash2, Eye, EyeOff, ArrowLeft, Save, X, FileText, Globe
} from "lucide-react";

useSEO; // imported for side-effect typing

const CATEGORIES = [
  "Macro Intelligence",
  "Market Analysis",
  "Risk Intelligence",
  "Crypto Intelligence",
  "Platform Updates",
];

function slugify(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

type PostForm = {
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
  slug: "", title: "", subtitle: "", content: "",
  author: "FAULTLINE", category: "Macro Intelligence", tags: "", published: false,
};

export default function AdminBlog() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const [editing, setEditing] = useState<number | null>(null); // null = new post, number = editing id
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PostForm>(EMPTY_FORM);
  const [preview, setPreview] = useState(false);

  const utils = trpc.useUtils();

  const { data: posts = [], isLoading } = trpc.blog.adminList.useQuery();

  const createMut = trpc.blog.create.useMutation({
    onSuccess: () => {
      toast.success("Post created");
      utils.blog.adminList.invalidate();
      utils.blog.list.invalidate();
      setShowForm(false);
      setForm(EMPTY_FORM);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = trpc.blog.update.useMutation({
    onSuccess: () => {
      toast.success("Post updated");
      utils.blog.adminList.invalidate();
      utils.blog.list.invalidate();
      setShowForm(false);
      setEditing(null);
      setForm(EMPTY_FORM);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = trpc.blog.delete.useMutation({
    onSuccess: () => {
      toast.success("Post deleted");
      utils.blog.adminList.invalidate();
      utils.blog.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-[#080c18] flex items-center justify-center text-slate-400 font-['IBM_Plex_Mono'] text-sm">
        ACCESS DENIED
      </div>
    );
  }

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setPreview(false);
  }

  function openEdit(post: typeof posts[0]) {
    setEditing(post.id);
    setForm({
      slug: post.slug,
      title: post.title,
      subtitle: post.subtitle ?? "",
      content: "",  // will be fetched
      author: post.author,
      category: post.category,
      tags: post.tags ?? "",
      published: !!post.published,
    });
    setShowForm(true);
    setPreview(false);
  }

  // Fetch full content when editing
  const { data: editPost } = trpc.blog.adminGetById.useQuery(
    { id: editing! },
    { enabled: editing !== null && showForm }
  );

  // Sync content into form when editPost loads
  const prevEditId = useRef<number | null>(null);
  if (editPost && editPost.id !== prevEditId.current) {
    prevEditId.current = editPost.id;
    setForm(f => ({ ...f, content: editPost.content }));
  }

  function handleTitleChange(title: string) {
    setForm(f => ({
      ...f,
      title,
      slug: editing === null ? slugify(title) : f.slug,
    }));
  }

  function handleSubmit() {
    if (!form.title.trim()) return toast.error("Title is required");
    if (!form.slug.trim()) return toast.error("Slug is required");
    if (!form.content.trim()) return toast.error("Content is required");

    if (editing === null) {
      createMut.mutate(form);
    } else {
      updateMut.mutate({ id: editing, ...form });
    }
  }

  function handleDelete(id: number, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    deleteMut.mutate({ id });
  }

  function togglePublish(post: typeof posts[0]) {
    updateMut.mutate({ id: post.id, published: !post.published });
  }

  if (showForm) {
    return (
      <div className="min-h-screen bg-[#080c18] text-white">
        <div className="border-b border-white/5 bg-[#0a0e1a]/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <button
              onClick={() => { setShowForm(false); setEditing(null); setForm(EMPTY_FORM); }}
              className="flex items-center gap-2 text-xs text-slate-400 font-['IBM_Plex_Mono'] hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> BACK TO POSTS
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPreview(!preview)}
                className="flex items-center gap-1 text-xs text-slate-400 font-['IBM_Plex_Mono'] hover:text-cyan-400 transition-colors px-3 py-1.5 border border-white/10 rounded"
              >
                {preview ? <><Edit2 className="w-3 h-3" /> EDIT</> : <><Eye className="w-3 h-3" /> PREVIEW</>}
              </button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={createMut.isPending || updateMut.isPending}
                className="bg-cyan-500 hover:bg-cyan-600 text-black text-xs font-['IBM_Plex_Mono'] font-bold"
              >
                <Save className="w-3.5 h-3.5 mr-1" />
                {editing === null ? "PUBLISH POST" : "SAVE CHANGES"}
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-8">
          {preview ? (
            <div className="prose prose-invert prose-sm max-w-none
              prose-headings:font-bold prose-headings:text-white
              prose-p:text-slate-300 prose-p:leading-relaxed
              prose-strong:text-white prose-a:text-cyan-400
              prose-code:text-cyan-300 prose-code:bg-white/5 prose-code:px-1 prose-code:rounded
              prose-blockquote:border-l-cyan-500 prose-blockquote:text-slate-400
              prose-ul:text-slate-300 prose-ol:text-slate-300">
              <h1 className="text-2xl font-bold text-white mb-2">{form.title || "Untitled"}</h1>
              {form.subtitle && <p className="text-slate-400 text-base mb-6">{form.subtitle}</p>}
              <hr className="border-white/10 mb-6" />
              {/* Simple markdown preview via Streamdown */}
              {(() => { const { Streamdown } = require("streamdown"); return <Streamdown>{form.content || "*No content yet*"}</Streamdown>; })()}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main content */}
              <div className="lg:col-span-2 space-y-4">
                <div>
                  <label className="text-xs text-slate-400 font-['IBM_Plex_Mono'] mb-1 block">TITLE *</label>
                  <Input
                    value={form.title}
                    onChange={e => handleTitleChange(e.target.value)}
                    placeholder="Post title..."
                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-cyan-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-['IBM_Plex_Mono'] mb-1 block">SUBTITLE / DECK</label>
                  <Input
                    value={form.subtitle}
                    onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))}
                    placeholder="Brief description shown in post list..."
                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-cyan-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-['IBM_Plex_Mono'] mb-1 block">CONTENT (MARKDOWN) *</label>
                  <Textarea
                    value={form.content}
                    onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                    placeholder="Write your post in Markdown..."
                    rows={20}
                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-cyan-500/50 font-['IBM_Plex_Mono'] text-sm resize-y"
                  />
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-4">
                <div className="p-4 rounded-lg border border-white/10 bg-white/[0.02] space-y-4">
                  <div>
                    <label className="text-xs text-slate-400 font-['IBM_Plex_Mono'] mb-1 block">SLUG *</label>
                    <Input
                      value={form.slug}
                      onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
                      placeholder="url-friendly-slug"
                      className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-cyan-500/50 font-['IBM_Plex_Mono'] text-xs"
                    />
                    <p className="text-xs text-slate-600 mt-1 font-['IBM_Plex_Mono']">/blog/{form.slug || "..."}</p>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 font-['IBM_Plex_Mono'] mb-1 block">CATEGORY</label>
                    <select
                      value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:border-cyan-500/50 font-['IBM_Plex_Mono']"
                    >
                      {CATEGORIES.map(c => <option key={c} value={c} className="bg-[#0a0e1a]">{c}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 font-['IBM_Plex_Mono'] mb-1 block">AUTHOR</label>
                    <Input
                      value={form.author}
                      onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
                      className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-cyan-500/50"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 font-['IBM_Plex_Mono'] mb-1 block">TAGS (comma-separated)</label>
                    <Input
                      value={form.tags}
                      onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                      placeholder="macro, risk, credit..."
                      className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-cyan-500/50 text-xs"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <label className="text-xs text-slate-400 font-['IBM_Plex_Mono']">PUBLISH NOW</label>
                    <button
                      onClick={() => setForm(f => ({ ...f, published: !f.published }))}
                      className={`relative w-10 h-5 rounded-full transition-colors ${form.published ? "bg-cyan-500" : "bg-white/10"}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.published ? "translate-x-5" : "translate-x-0.5"}`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080c18] text-white">
      <div className="border-b border-white/5 bg-[#0a0e1a]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/admin">
            <span className="flex items-center gap-2 text-xs text-slate-400 font-['IBM_Plex_Mono'] hover:text-white transition-colors cursor-pointer">
              <ArrowLeft className="w-3.5 h-3.5" /> ADMIN
            </span>
          </Link>
          <Button
            size="sm"
            onClick={openNew}
            className="bg-cyan-500 hover:bg-cyan-600 text-black text-xs font-['IBM_Plex_Mono'] font-bold"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> NEW POST
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="font-['Orbitron'] text-xl font-bold tracking-wider text-white mb-1">
            BLOG <span className="text-cyan-400">MANAGEMENT</span>
          </h1>
          <p className="text-slate-500 text-xs font-['IBM_Plex_Mono']">{posts.length} TOTAL POSTS</p>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-white/5 rounded animate-pulse" />)}
          </div>
        )}

        {!isLoading && posts.length === 0 && (
          <div className="text-center py-16 text-slate-500 font-['IBM_Plex_Mono'] text-sm">
            NO POSTS YET — CREATE YOUR FIRST BRIEFING
          </div>
        )}

        <div className="space-y-2">
          {posts.map(post => (
            <div key={post.id} className="flex items-center gap-3 p-4 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-['IBM_Plex_Mono'] ${post.published ? "text-green-400 bg-green-500/10" : "text-amber-400 bg-amber-500/10"}`}>
                    {post.published ? "LIVE" : "DRAFT"}
                  </span>
                  <span className="text-xs text-slate-500 font-['IBM_Plex_Mono']">{post.category}</span>
                </div>
                <p className="text-sm text-white font-medium truncate">{post.title}</p>
                <p className="text-xs text-slate-500 font-['IBM_Plex_Mono']">/blog/{post.slug}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => togglePublish(post)}
                  title={post.published ? "Unpublish" : "Publish"}
                  className="p-1.5 rounded text-slate-500 hover:text-cyan-400 hover:bg-white/5 transition-colors"
                >
                  {post.published ? <EyeOff className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => openEdit(post)}
                  className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                {post.published && (
                  <Link href={`/blog/${post.slug}`}>
                    <button className="p-1.5 rounded text-slate-500 hover:text-cyan-400 hover:bg-white/5 transition-colors">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </Link>
                )}
                <button
                  onClick={() => handleDelete(post.id, post.title)}
                  className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-white/5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
