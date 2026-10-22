import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { CANONICAL_DESTINATIONS, ANALYTICAL_LEGACY_ALIASES, preserveRouteContext, stripRouteContext } from '../shared/routeRegistry';
import { CUSTOMER_NAVIGATION_SECTIONS, NAVIGATION_HIERARCHY, CUSTOMER_SEARCH_ITEMS, TOOLS_HOME_CONTEXTUAL_SECTION, ADMIN_NAVIGATION_SECTION, getSearchNavigationItems, isNavigationItemActive, sectionHasActiveItem, isAdministrativeManifestPath } from '../shared/navigationHierarchy';
import { enumerateApplicationRoutes } from '../scripts/navigationInventory';

const router = fs.readFileSync('client/src/App.tsx', 'utf8');
const mounted = enumerateApplicationRoutes(router);
const baseline = JSON.parse(fs.readFileSync('docs/navigation/baseline-routes.json', 'utf8')) as Array<{path: string; component: string | null; redirect: string | null}>;

describe('consolidated customer navigation', () => {
  it('has exactly the five approved hierarchy sections', () => {
    expect(CUSTOMER_NAVIGATION_SECTIONS.map(i => i.label)).toEqual(['THE FIVE QUESTIONS', 'INTELLIGENCE DASHBOARDS', 'TRADING TOOLS', 'DAILY BRIEF', 'MORE']);
    expect(NAVIGATION_HIERARCHY.intelligence.kind).toBe('expandable');
    expect(NAVIGATION_HIERARCHY.trading.kind).toBe('expandable');
  });
  it('preserves all five question labels, order, canonical paths, and accents in the registry', () => {
    expect(NAVIGATION_HIERARCHY.primary.items.map(i => i.label)).toEqual(['NOW', 'WHY', 'OUTLOOK', 'WATCH', 'ACT']);
    expect(NAVIGATION_HIERARCHY.primary.items.map(i => i.path)).toEqual(CANONICAL_DESTINATIONS.map(i => i.path));
  });
  it('has one real Seismograph Deep Dashboard destination', () => {
    const deep = CUSTOMER_SEARCH_ITEMS.filter(i => stripRouteContext(i.path) === '/app/now/deep');
    expect(deep).toHaveLength(1);
    expect(deep[0].label).toBe('Seismograph Deep Dashboard');
    expect(NAVIGATION_HIERARCHY.intelligence.items).toContain(deep[0]);
    expect(CUSTOMER_SEARCH_ITEMS.some(i => i.path === '/app/seismograph-command-center')).toBe(false);
  });
  it('uses one existing discovery workspace for Top Opportunities and Smart Discovery, not a fictional ACT view', () => {
    const discovery = NAVIGATION_HIERARCHY.trading.items.filter(i => stripRouteContext(i.path) === '/app/discover');
    expect(discovery).toHaveLength(1);
    expect(discovery[0].label).toContain('Top Opportunities');
    expect(discovery[0].label).toContain('Smart Discovery');
    expect(CUSTOMER_SEARCH_ITEMS.some(i => i.path.includes('view=opportunities'))).toBe(false);
  });
  it('groups every required real specialist trading workspace together', () => {
    const paths = NAVIGATION_HIERARCHY.trading.items.map(i => i.path);
    for (const p of ['/app/signals','/app/crypto-signals','/app/decision-engine','/app/discover','/app/day-trade-intelligence','/app/symbol-intelligence','/app/signal-outlook']) expect(paths).toContain(p);
    for (const p of ['/app/outlook/deep','/app/act/deep']) expect(CUSTOMER_SEARCH_ITEMS.some(i => i.path === p)).toBe(false);
  });
  it('does not create entry/exit/stop/target/risk calculations as separate tools', () => {
    const forbidden = /^(entry|exit|stop.loss|take.profit|risk.reward|position.sizing|trade.preflight)$/i;
    expect(CUSTOMER_SEARCH_ITEMS.filter(i => forbidden.test(i.label))).toEqual([]);
  });
  it('contains no duplicate customer destinations or speculative placeholders', () => {
    const paths = CUSTOMER_SEARCH_ITEMS.map(i => stripRouteContext(i.path));
    expect(new Set(paths).size).toBe(paths.length);
    expect(CUSTOMER_SEARCH_ITEMS.some(i => /constellation|coming soon|placeholder/i.test(i.label))).toBe(false);
    const valid = new Set(mounted.map(i => i.path));
    for (const i of CUSTOMER_SEARCH_ITEMS) expect(valid.has(stripRouteContext(i.path)), `${i.label}: ${i.path}`).toBe(true);
  });
  it('keeps owner entries completely out of guest and member navigation search', () => {
    const customerPaths = new Set(getSearchNavigationItems(false).map(i => i.path));
    for (const i of ADMIN_NAVIGATION_SECTION.items) expect(customerPaths.has(i.path)).toBe(false);
    expect(getSearchNavigationItems(true).length).toBeGreaterThan(getSearchNavigationItems(false).length);
  });
  it('does not expose PLATO as a redundant customer menu destination or activate Track Record', () => {
    expect(CUSTOMER_SEARCH_ITEMS.some(i => /\/asha(?:$|-)|intelligence-track-record/.test(i.path))).toBe(false);
    expect(TOOLS_HOME_CONTEXTUAL_SECTION.items.some(i => /intelligence-track-record/.test(i.path))).toBe(false);
    expect(mounted.some(i => i.path === '/app/intelligence-track-record')).toBe(true);
    expect(TOOLS_HOME_CONTEXTUAL_SECTION.items.some(i => i.path === '/app/track-record')).toBe(true);
  });
  it('uses complete-segment active matching and identifies the real deep dashboard', () => {
    const deep = NAVIGATION_HIERARCHY.intelligence.items.find(i => i.id === 'seismograph-deep')!;
    expect(isNavigationItemActive(deep, '/app/now/deep?tab=scores')).toBe(true);
    expect(isNavigationItemActive(NAVIGATION_HIERARCHY.primary.items[0], '/app/now/deep')).toBe(false);
    const signals = NAVIGATION_HIERARCHY.trading.items.find(i => i.path === '/app/signals')!;
    expect(isNavigationItemActive(signals, '/app/signals/SPY')).toBe(true);
    expect(isNavigationItemActive(signals, '/app/signals-extra')).toBe(false);
    expect(sectionHasActiveItem(NAVIGATION_HIERARCHY.trading, '/app/decision-engine')).toBe(true);
  });
});

describe('complete route preservation', () => {
  it('preserves every immutable baseline mount and redirect exactly', () => {
    expect(mounted).toEqual(baseline);
  });
  it('retains query strings and hashes on every centrally registered legacy alias', () => {
    for (const [from, target] of Object.entries(ANALYTICAL_LEGACY_ALIASES)) {
      const resolved = preserveRouteContext(target, '?symbol=SPY&from=bookmark', '#evidence');
      expect(stripRouteContext(resolved), from).toBe(stripRouteContext(target));
      expect(resolved).toContain('symbol=SPY');
      expect(resolved).toContain('from=bookmark');
      expect(resolved.endsWith('#evidence')).toBe(true);
    }
  });
  it('classifies every mounted route and registry alias without omissions', () => {
    const rows = JSON.parse(fs.readFileSync('docs/navigation/route-inventory.json', 'utf8'));
    expect(rows.map((i: any) => i.path)).toEqual(mounted.map(i => i.path));
    for (const row of rows) expect(row.treatment).toMatch(/^[1-8]\. /);
  });
  it('exposes a real synchronized route manifest rather than a SPA fallback', () => {
    const manifest = JSON.parse(fs.readFileSync('client/public/manus-routes.json', 'utf8'));
    const publicRoutes = mounted.filter(i => i.path !== '/404' && !isAdministrativeManifestPath(i.path));
    expect(manifest.routes.map((r: any) => r.path)).toEqual(publicRoutes.map(i => i.path));
    expect(manifest.routes.some((r: { path: string }) => isAdministrativeManifestPath(r.path))).toBe(false);
    expect(manifest.routes.some((r: { path: string }) => r.path === '/app/validation')).toBe(true);
  });
  it('is not read by application runtime code', () => {
    let hits = '';
    try {
      hits = execSync(
        "rg -l manus-routes -g '!server/navigationHierarchy.test.ts' -g '!scripts/navigationInventory.ts'",
        { encoding: 'utf8' },
      ).trim();
    } catch (err) {
      hits = String((err as { stdout?: string }).stdout ?? '').trim();
    }
    expect(hits).toBe('');
  });
});
