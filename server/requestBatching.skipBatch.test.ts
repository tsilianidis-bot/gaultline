/**
 * marketIntelligence.getAll can take 12–25 s on a cold cache. It must travel in its own HTTP
 * request so it can never head-of-line block marketState.canonicalCurrent / marketState.current.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createTRPCClient, httpBatchLink, httpLink, splitLink } from "@trpc/client";
import superjson from "superjson";

const root = resolve(import.meta.dirname, "..");
const src = (p: string) => readFileSync(resolve(root, p), "utf8");
const GETALL_CALLERS = [
  "client/src/components/AppLayout.tsx",
  "client/src/pages/MarketCommandCenter.tsx",
  "client/src/pages/SmartDiscovery.tsx",
  "client/src/pages/MarketIntelligence.tsx",
];

describe("marketIntelligence.getAll is never batched with marketState", () => {
  it("main.tsx routes skipBatch ops to a non-batching httpLink", () => {
    const main = src("client/src/main.tsx");
    expect(main).toMatch(/splitLink\(/);
    expect(main).toMatch(/op\.context\.skipBatch === true/);
    expect(main).toMatch(/true: httpLink\(/);
    expect(main).toMatch(/false: httpBatchLink\(/);
  });

  it("every client getAll useQuery opts out of batching", () => {
    let total = 0;
    for (const f of GETALL_CALLERS) {
      const s = src(f);
      let i = s.indexOf("marketIntelligence.getAll.useQuery(");
      expect(i, f).toBeGreaterThan(-1);
      while (i !== -1) {
        total++;
        const call = s.slice(i, s.indexOf(");", i));
        expect(call, f).toMatch(/trpc: \{ context: \{ skipBatch: true \} \}/);
        i = s.indexOf("marketIntelligence.getAll.useQuery(", i + 1);
      }
    }
    expect(total).toBe(GETALL_CALLERS.length);
  });

  it("at runtime the split link sends getAll alone and batches the marketState calls together", async () => {
    const urls: string[] = [];
    const fakeFetch = async (url: any) => {
      urls.push(String(url));
      const n = String(url).includes(",") ? String(url).split("/api/trpc/")[1].split("?")[0].split(",").length : 1;
      const one = { result: { data: superjson.serialize(null) } };
      const batched = String(url).includes("batch=1");
      return new Response(JSON.stringify(batched ? Array.from({ length: n }, () => one) : one), {
        headers: { "content-type": "application/json" },
      });
    };
    const opts = { url: "http://x/api/trpc", transformer: superjson, fetch: fakeFetch as any };
    const client: any = createTRPCClient<any>({
      links: [splitLink({ condition: op => op.context.skipBatch === true, true: httpLink(opts), false: httpBatchLink(opts) })],
    });
    await Promise.all([
      client.marketIntelligence.getAll.query(undefined, { context: { skipBatch: true } }),
      client.marketState.canonicalCurrent.query(),
      client.marketState.current.query(),
    ]);
    expect(urls).toHaveLength(2);
    const getAllReq = urls.filter(u => u.includes("marketIntelligence.getAll"));
    expect(getAllReq).toHaveLength(1);
    expect(getAllReq[0]).not.toMatch(/marketState/);
    expect(getAllReq[0]).not.toMatch(/batch=1/);
    expect(urls.find(u => u.includes("marketState.canonicalCurrent"))).toMatch(/marketState\.current/);
  });
});
