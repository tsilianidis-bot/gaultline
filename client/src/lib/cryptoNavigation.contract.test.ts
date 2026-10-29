import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ANALYTICAL_LEGACY_ALIASES, CANONICAL_DESTINATION_BY_ID } from "@shared/routeRegistry";

const projectRoot = path.resolve(import.meta.dirname, "../../..");
const source = (relativePath: string) => readFileSync(path.join(projectRoot, relativePath), "utf8");
const canonicalActPath = CANONICAL_DESTINATION_BY_ID.act.path;

describe("customer route navigation", () => {
  it("keeps repaired customer controls on declared authenticated routes and preserves legacy links", () => {
    const app = source("client/src/App.tsx");
    expect(app).toContain('<Route path="/app/crypto" component={CryptoHub} />');
    expect(app).toContain('<Route path="/app/crypto-search" component={CryptoSearch} />');
    expect(app).toContain('<Route path="/app/crypto-watchlist" component={CryptoWatchlist} />');
    expect(app).toContain('<Route path="/app/symbol-intelligence" component={UniversalSymbolIntelligence} />');
    expect(app).toContain('<Route path="/app/asha">');
    expect(ANALYTICAL_LEGACY_ALIASES["/app/dashboard"]).toBe(CANONICAL_DESTINATION_BY_ID.now.path);
    expect(app).toContain('<Route path="/demo/opportunities"><Redirect to={CANONICAL_DESTINATION_BY_ID.act.path} /></Route>');
    expect(app).not.toContain(`<Route path="/demo/opportunities"><Redirect to="${canonicalActPath}" /></Route>`);
    expect(app).toContain('<Route path="/crypto-search"><Redirect to="/app/crypto-search" /></Route>');
    expect(app).toContain('<Route path="/crypto-watchlist"><Redirect to="/app/crypto-watchlist" /></Route>');
    expect(app).toContain('<Route path="/app/crypto-intel"><Redirect to="/app/crypto" /></Route>');
    expect(app).toContain('<Route path="/asha"><Redirect to="/app/asha" /></Route>');
    expect(app).toContain('<Route path="/dashboard"><Redirect to="/app/dashboard" /></Route>');

    expect(source("client/src/components/HomeCryptoSection.tsx")).toContain("navigate('/app/crypto-search')");
    expect(source("client/src/pages/CryptoSearch.tsx")).toContain('navigate("/app/crypto-watchlist")');
    expect(source("client/src/pages/CryptoSignals.tsx")).toContain('<Link href="/app/crypto-search"');

    const watchlist = source("client/src/pages/CryptoWatchlist.tsx");
    expect(watchlist).not.toContain("navigate('/crypto-search')");
    expect(watchlist).toContain("navigate('/app/crypto-search')");
    expect(watchlist).toContain("navigate(`/app/symbol-intelligence?symbol=${encodeURIComponent(item.symbol)}&type=crypto&autorun=1`)");

    const tickerActions = source("client/src/components/TickerActionMenu.tsx");
    expect(tickerActions).toContain("navigate(`/app/symbol-intelligence?symbol=${encodeURIComponent(sym)}&type=${resolved}&autorun=1`)");
    expect(tickerActions).not.toContain("/crypto-search?symbol=");
    expect(tickerActions).not.toContain("/signals?search=");

    const rotation = source("client/src/pages/AltRotation.tsx");
    expect(rotation).toContain('<Link href="/app/crypto"');
    expect(rotation).not.toContain('href="/app/crypto-intel"');

    const seismograph = source("client/src/pages/SeismographIntelligence.tsx");
    expect(seismograph).toContain('<Link href="/app/asha">');
    expect(seismograph).not.toContain('<Link href="/asha">');

    const promo = source("client/src/pages/PromoRedeem.tsx");
    expect(promo).toContain('navigate("/app/dashboard")');
    expect(promo).not.toContain('navigate("/dashboard")');
  });
});
