import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";

type PostType = "premarket" | "midday" | "closing" | "breaking";
type VariantKey = "short" | "thread" | "founder" | "institutional" | "breaking";

const POST_TYPES: { id: PostType; label: string; time: string; icon: string }[] = [
  { id: "premarket", label: "PREMARKET DROP", time: "8:10–8:35 AM ET", icon: "◈" },
  { id: "midday", label: "MIDDAY UPDATE", time: "12:00–1:00 PM ET", icon: "◉" },
  { id: "closing", label: "CLOSING SUMMARY", time: "3:45–4:10 PM ET", icon: "◎" },
  { id: "breaking", label: "BREAKING ALERT", time: "Real-time trigger", icon: "⬥" },
];

const VARIANTS: { key: VariantKey; label: string; desc: string }[] = [
  { key: "short", label: "SHORT POST", desc: "≤280 chars" },
  { key: "thread", label: "THREAD", desc: "5-tweet thread" },
  { key: "founder", label: "FOUNDER VOICE", desc: "Personal tone" },
  { key: "institutional", label: "INSTITUTIONAL", desc: "Risk desk style" },
  { key: "breaking", label: "BREAKING ALERT", desc: "Urgent format" },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="text-xs px-3 py-1 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 transition-colors rounded font-mono tracking-widest"
    >
      {copied ? "COPIED" : "COPY"}
    </button>
  );
}

function CharCount({ text }: { text: string }) {
  const count = text.length;
  const over = count > 280;
  return (
    <span className={`text-xs font-mono ${over ? "text-red-400" : "text-zinc-500"}`}>
      {count} chars{over ? " ⚠ over limit" : ""}
    </span>
  );
}

export default function XPostGenerator() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const [activeType, setActiveType] = useState<PostType>("premarket");
  const [headline, setHeadline] = useState("");
  const [activeVariant, setActiveVariant] = useState<VariantKey>("short");

  const generate = trpc.xPost.generate.useMutation();

  if (authLoading) return null;
  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-[#050a0f] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 font-mono text-sm tracking-widest mb-4">ACCESS RESTRICTED</p>
          <p className="text-zinc-500 text-sm">Admin credentials required.</p>
        </div>
      </div>
    );
  }

  const result = generate.data;
  const isLoading = generate.isPending;
  const error = generate.error;

  const handleGenerate = () => {
    generate.mutate({ postType: activeType, headline: activeType === "breaking" ? headline : undefined });
  };

  const currentVariantText = result?.variants?.[activeVariant] ?? "";

  return (
    <div className="min-h-screen bg-[#050a0f] text-white font-mono">
      {/* Header */}
      <div className="border-b border-zinc-800/60 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-cyan-400 text-lg">⬡</span>
              <span className="text-white font-bold tracking-[0.2em] text-sm">FAULTLINE</span>
              <span className="text-zinc-600 text-xs">×</span>
              <span className="text-orange-400 tracking-[0.15em] text-sm font-bold">X POST GENERATOR</span>
            </div>
            <p className="text-zinc-500 text-xs mt-1 tracking-wider">
              Institutional macro intelligence — powered by live FAULTLINE pressure data
            </p>
          </div>
          {result && (
            <div className="text-right">
              <div className="text-xs text-zinc-500 tracking-widest">PRESSURE INDEX</div>
              <div className="text-2xl font-bold text-orange-400">{result.pressure.overallPressure}</div>
              <div className="text-xs text-zinc-400 tracking-widest">{result.pressure.regime}</div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* Post Type Selector */}
        <div>
          <div className="text-xs text-zinc-500 tracking-[0.2em] mb-3">SELECT POST TYPE</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {POST_TYPES.map((pt) => (
              <button
                key={pt.id}
                onClick={() => setActiveType(pt.id)}
                className={`p-4 border rounded text-left transition-all ${
                  activeType === pt.id
                    ? "border-orange-500/60 bg-orange-500/10 text-orange-300"
                    : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-600"
                }`}
              >
                <div className="text-lg mb-1">{pt.icon}</div>
                <div className="text-xs font-bold tracking-widest">{pt.label}</div>
                <div className="text-xs text-zinc-500 mt-1">{pt.time}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Breaking Headline Input */}
        {activeType === "breaking" && (
          <div>
            <div className="text-xs text-zinc-500 tracking-[0.2em] mb-2">BREAKING HEADLINE (optional)</div>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g. Fed signals emergency rate cut amid banking stress..."
              className="w-full bg-zinc-900/60 border border-zinc-700 rounded px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500/50 transition-colors"
            />
            <p className="text-xs text-zinc-600 mt-1">Leave blank to generate a general breaking-alert based on current pressure readings.</p>
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={isLoading}
          className={`w-full py-4 rounded border font-bold tracking-[0.2em] text-sm transition-all ${
            isLoading
              ? "border-zinc-700 bg-zinc-900 text-zinc-500 cursor-not-allowed"
              : "border-orange-500/50 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20 hover:border-orange-400 active:scale-[0.99]"
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-3">
              <span className="inline-block w-4 h-4 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin" />
              ANALYZING PRESSURE DATA — GENERATING POSTS...
            </span>
          ) : (
            `⬡ GENERATE ${POST_TYPES.find(p => p.id === activeType)?.label}`
          )}
        </button>

        {/* Error */}
        {error && (
          <div className="border border-red-500/30 bg-red-500/5 rounded p-4 text-red-400 text-sm">
            <span className="font-bold">ERROR:</span> {error.message}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6">
            {/* Variant Tabs */}
            <div>
              <div className="text-xs text-zinc-500 tracking-[0.2em] mb-3">POST VARIANTS</div>
              <div className="flex flex-wrap gap-2">
                {VARIANTS.map((v) => (
                  <button
                    key={v.key}
                    onClick={() => setActiveVariant(v.key)}
                    className={`px-4 py-2 rounded text-xs font-bold tracking-widest transition-all border ${
                      activeVariant === v.key
                        ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-300"
                        : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                    }`}
                  >
                    {v.label}
                    <span className="ml-2 text-zinc-600 font-normal">{v.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Active Variant Display */}
            <div className="border border-zinc-800 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/60 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-400 tracking-widest font-bold">
                    {VARIANTS.find(v => v.key === activeVariant)?.label}
                  </span>
                  {activeVariant === "short" && <CharCount text={currentVariantText} />}
                </div>
                <CopyButton text={currentVariantText} />
              </div>
              <div className="p-5 bg-zinc-950/40">
                <pre className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed font-mono">
                  {currentVariantText}
                </pre>
              </div>
            </div>

            {/* All Variants Grid */}
            <div>
              <div className="text-xs text-zinc-500 tracking-[0.2em] mb-3">ALL VARIANTS — QUICK COPY</div>
              <div className="space-y-3">
                {VARIANTS.map((v) => {
                  const text = result.variants[v.key] ?? "";
                  return (
                    <div key={v.key} className="border border-zinc-800/60 rounded p-4 bg-zinc-900/20">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-400 font-bold tracking-widest">{v.label}</span>
                          <span className="text-xs text-zinc-600">{v.desc}</span>
                          {v.key === "short" && <CharCount text={text} />}
                        </div>
                        <CopyButton text={text} />
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3">
                        {text.split("\n")[0]}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pressure Context */}
            <div className="border border-zinc-800/40 rounded p-4 bg-zinc-900/20">
              <div className="text-xs text-zinc-500 tracking-[0.2em] mb-2">LIVE PRESSURE CONTEXT USED</div>
              <div className="flex flex-wrap gap-4 text-xs">
                <div>
                  <span className="text-zinc-600">INDEX</span>
                  <span className="ml-2 text-orange-400 font-bold">{result.pressure.overallPressure}/100</span>
                </div>
                <div>
                  <span className="text-zinc-600">REGIME</span>
                  <span className="ml-2 text-white">{result.pressure.regime}</span>
                </div>
                <div>
                  <span className="text-zinc-600">LEVEL</span>
                  <span className="ml-2 text-amber-400">{result.pressure.level}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!result && !isLoading && (
          <div className="border border-zinc-800/40 rounded-lg p-12 text-center">
            <div className="text-4xl text-zinc-700 mb-4">⬡</div>
            <p className="text-zinc-500 text-sm tracking-wider">
              Select a post type and generate to see all 5 variants
            </p>
            <p className="text-zinc-600 text-xs mt-2">
              Posts are generated using live FAULTLINE Pressure Index data
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
