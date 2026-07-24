import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("ASHA cross-surface continuity", () => {
  const main = read("client/src/main.tsx");
  const app = read("client/src/App.tsx");
  const context = read("client/src/contexts/AshaContext.tsx");
  const panel = read("client/src/components/AshaPanel.tsx");
  const workspace = read("client/src/pages/AshaIntelligenceCenter.tsx");
  const now = read("client/src/pages/Now.tsx");
  const why = read("client/src/pages/Why.tsx");
  const outlook = read("client/src/pages/Outlook.tsx");
  const watch = read("client/src/pages/Watch.tsx");
  const act = read("client/src/pages/Act.tsx");

  it("mounts exactly one existing provider above the full application tree", () => {
    expect(main.match(/<AshaProvider>/g)).toHaveLength(1);
    expect(main).toMatch(/<AshaProvider>[\s\S]*<App\s*\/>[\s\S]*<\/AshaProvider>/);
    expect(app).not.toContain("<AshaProvider>");
  });

  it("persists one bounded session thread and derives gateway history from it", () => {
    expect(context).toContain('const ASHA_THREAD_STORAGE_KEY = "faultline:asha-thread:v1"');
    expect(context).toContain("window.sessionStorage.getItem(ASHA_THREAD_STORAGE_KEY)");
    expect(context).toContain("window.sessionStorage.setItem(ASHA_THREAD_STORAGE_KEY");
    expect(context).toContain("MAX_ASHA_THREAD_MESSAGES = 24");
    expect(context).toContain("appendThreadExchange");
    expect(context).toContain("threadHistory");
  });

  it("sends the prior thread through the persistent utility and records live response provenance", () => {
    expect(panel).toContain("const { pageContext, threadHistory, appendThreadExchange } = useAshaContext()");
    expect(panel).toMatch(/history:\s*threadHistory/);
    expect(panel).toContain("appendThreadExchange({");
    expect(panel).toContain("confidence: response.confidence");
    expect(panel).toContain("sources: response.sources");
    expect(panel).toContain("enginesConsulted: response.enginesConsulted");
    expect(panel).toContain('window.addEventListener("asha:summon", handler)');
  });

  it("does not append a failed live request to the shared thread and resets the panel for retry", () => {
    const catchBranch = panel.match(/\}\s*catch\s*\{([\s\S]*?)\n\s*\}\n\s*\}, \[/)?.[1] ?? "";

    expect(catchBranch).toContain("setSynthSteps([])");
    expect(catchBranch).toContain('setPanelState("summon")');
    expect(catchBranch).not.toContain("appendThreadExchange");
  });

  it("keeps every canonical destination attached to the same registry-owned ASHA utility", () => {
    for (const destination of [now, why, outlook, watch, act]) {
      expect(destination).toContain("PERSISTENT_UTILITY_BY_ID.asha.path");
    }
    expect(why).toContain("?from=why");
    expect(outlook).toContain("?from=outlook");
    expect(panel).toContain("pageContext");
    expect(panel).toMatch(/pageContext:\s*fullPageContext/);
  });

  it("lets the canonical workspace originate a prompt that the same panel records into the shared thread", () => {
    expect(app).toMatch(/<Route path="\/app\/asha">[\s\S]*?<AshaIntelligenceCenter\s*\/>[\s\S]*?<\/Route>/);
    expect(app).toContain('<Route path="/app/asha-intelligence">');
    expect(workspace).toContain("const { threadMessages, clearThread } = useAshaContext()");
    expect(workspace).toContain("data-asha-shared-thread");
    expect(workspace).toContain("data-asha-thread-message={message.role}");
    expect(workspace).toContain("data-asha-workspace-continuation");
    expect(workspace).toContain("summonSharedThread(workspacePrompt)");
    expect(workspace).toContain('new CustomEvent("asha:summon"');
    expect(panel).toContain('window.addEventListener("asha:summon", handler)');
    expect(panel).toContain('new CustomEvent("asha:prefill", { detail: { prompt } })');
    expect(panel).toContain("appendThreadExchange({");
    expect(workspace).toContain("trpc.ashaMemory.getTodayConversation.useQuery()");
  });
});
