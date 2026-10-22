import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { ANALYTICAL_LEGACY_ALIASES, CANONICAL_DESTINATIONS, CANONICAL_DESTINATION_BY_ID, EXPERT_WORKSPACE_BY_ID, stripRouteContext } from '../shared/routeRegistry';
import { CUSTOMER_NAVIGATION_SECTIONS, isAdministrativeManifestPath } from '../shared/navigationHierarchy';

export type InventoryRow = { path: string; component: string | null; redirect: string | null; treatment: string; access: string; navigation: string; note: string };
export function enumerateApplicationRoutes(sourceText: string): Array<{ path: string; component: string | null; redirect: string | null }> {
  const source = ts.createSourceFile('App.tsx', sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const constants: Record<string, string> = {};
  const rows = new Map<string, { path: string; component: string | null; redirect: string | null }>();
  function resolve(expression: ts.Expression): string | undefined {
    if (ts.isStringLiteralLike(expression)) return expression.text;
    if (ts.isIdentifier(expression)) return constants[expression.text];
    const text = expression.getText(source);
    const canonical = text.match(/^CANONICAL_DESTINATION_BY_ID(?:\.([a-z]+)|\["([a-z]+)"\])\.path$/);
    if (canonical) return CANONICAL_DESTINATION_BY_ID[(canonical[1] ?? canonical[2]) as keyof typeof CANONICAL_DESTINATION_BY_ID]?.path;
    const expert = text.match(/^EXPERT_WORKSPACE_BY_ID(?:\.([\w-]+)|\["([\w-]+)"\])\.path$/);
    if (expert) return EXPERT_WORKSPACE_BY_ID[(expert[1] ?? expert[2]) as keyof typeof EXPERT_WORKSPACE_BY_ID]?.path;
    const alias = text.match(/^ANALYTICAL_LEGACY_ALIASES\["([^"]+)"\]$/);
    if (alias) return ANALYTICAL_LEGACY_ALIASES[alias[1]];
    if (text === 'CANONICAL_HOME') return CANONICAL_DESTINATION_BY_ID.now.path;
    return undefined;
  }
  function attribute(attributes: ts.JsxAttributes, name: string): string | undefined {
    const a = attributes.properties.find(a => ts.isJsxAttribute(a) && a.name.getText(source) === name) as ts.JsxAttribute | undefined;
    if (!a?.initializer) return undefined;
    if (ts.isStringLiteral(a.initializer)) return a.initializer.text;
    if (ts.isJsxExpression(a.initializer) && a.initializer.expression) return resolve(a.initializer.expression);
    return undefined;
  }
  function visit(node: ts.Node): void {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isStringLiteralLike(node.initializer)) constants[node.name.text] = node.initializer.text;
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      if (opening.tagName.getText(source) === 'Route') {
        const routePath = attribute(opening.attributes, 'path');
        if (routePath && !rows.has(routePath)) {
          let component = opening.attributes.properties.find(a => ts.isJsxAttribute(a) && a.name.getText(source) === 'component')?.getText(source).replace(/^component=\{|\}$/g, '') ?? null;
          let redirect: string | null = null;
          const inspect = (child: ts.Node) => {
            if (child !== node && (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child))) {
              const tag = ts.isJsxElement(child) ? child.openingElement : child;
              if (tag.tagName.getText(source) === 'Route') return;
              if (tag.tagName.getText(source) === 'Redirect') redirect = attribute(tag.attributes, 'to') ?? null;
              if (!component && /^[A-Z]/.test(tag.tagName.getText(source)) && !['ErrorBoundary', 'Suspense', 'Redirect', 'Switch'].includes(tag.tagName.getText(source))) component = tag.tagName.getText(source);
            }
            ts.forEachChild(child, inspect);
          };
          inspect(node);
          rows.set(routePath, { path: routePath, component, redirect });
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  for (const item of CANONICAL_DESTINATIONS) rows.set(item.path, { path: item.path, component: item.label[0] + item.label.slice(1).toLowerCase(), redirect: null });
  for (const [from, to] of Object.entries(ANALYTICAL_LEGACY_ALIASES)) if (!rows.has(from)) rows.set(from, { path: from, component: null, redirect: to });
  return [...rows.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export function buildNavigationInventory(menu: ReadonlyArray<{ label: string; items: ReadonlyArray<{ label: string; path: string }> }> = CUSTOMER_NAVIGATION_SECTIONS): InventoryRow[] {
  const sourceText = fs.readFileSync(path.join(process.cwd(), 'client/src/App.tsx'), 'utf8');
  const ownerPaths = new Set(['/admin/promo', '/owner/simulation', '/app/analytics', '/app/seo-optimizer', '/app/x-posts', '/app/x-post-queue', '/app/fmos-health', '/app/asha-intelligence']);
  const primary = new Set(CANONICAL_DESTINATIONS.map(item => item.path));
  return enumerateApplicationRoutes(sourceText).map(row => {
    const clean = stripRouteContext(row.path);
    const entry = menu.flatMap(g => g.items.map(i => ({ ...i, group: g.label }))).find(i => stripRouteContext(i.path) === clean);
    const isOwner = ownerPaths.has(clean) || clean.startsWith('/app/admin');
    let treatment = '6. Contextual-only destination';
    let navigation = 'Preserved direct route and existing contextual links';
    let access = clean.startsWith('/app') || clean.startsWith('/owner') ? 'Existing authenticated / page-specific entitlement boundary unchanged' : 'Existing public or standalone boundary unchanged';
    let note = 'Router mount, component, parameters, and access logic unchanged.';
    if (row.redirect) { treatment = '8. Legacy redirect to a canonical destination'; navigation = row.redirect; note = 'Existing redirect unchanged; registry aliases retain query/hash merging.'; }
    else if (isOwner) { treatment = '7. Authorized internal or administrative destination'; access = 'Existing owner/admin checks unchanged'; navigation = 'Owner portal only; excluded from member navigation and search'; }
    else if (primary.has(clean as any)) { treatment = '1. Primary Five Questions destination'; navigation = CANONICAL_DESTINATIONS.find(i => i.path === clean)!.label; }
    else if (clean === '/daily-brief' || clean.startsWith('/daily-brief/') || ['/intel-archive', '/intelligence', '/intelligence-library'].includes(clean) || clean.startsWith('/intelligence-library/')) { treatment = '4. Daily Brief or historical child'; navigation = clean === '/daily-brief' ? 'DAILY BRIEF' : 'Contextual historical access through DAILY BRIEF'; }
    else if (entry) {
      treatment = entry.group === 'INTELLIGENCE DASHBOARDS' ? '2. Intelligence Dashboards child' : entry.group === 'TRADING TOOLS' ? '3. Trading Tools child' : '5. Secondary / More destination';
      navigation = `${entry.group} / ${entry.label}`;
    }
    if (clean.startsWith('/mobile')) note += ' Standalone PWA layout is preserved; it is not mounted alongside the app mobile navigation.';
    if (['/app/outlook/deep','/app/act/deep'].includes(clean)) note += ' Same component as Signal Outlook / Smart Discovery respectively; no duplicate primary menu entry.';
    if (clean === '/app/seismograph-command-center') { navigation = 'NOW → Seismograph Intelligence contextual link'; note += ' Distinct existing Seismograph Intelligence page retained; single Deep Dashboard menu entry points to /app/now/deep.'; }
    if (clean === '/intelligence-track-record' || clean === '/app/intelligence-track-record') { navigation = 'Publication-gated contextual access'; note += ' Default-off publication flag unchanged; not activated.'; }
    if (['/mobile','/mobile/','/pricing'].includes(clean)) note += ' Explicit outer-router mount takes precedence over older registry alias metadata.';
    return { ...row, treatment, access, navigation, note };
  });
}

if (process.argv[1]?.endsWith('navigationInventory.ts')) {
  const menuPath = process.argv[2];
  const menu = menuPath ? JSON.parse(fs.readFileSync(menuPath, 'utf8')) : CUSTOMER_NAVIGATION_SECTIONS;
  const inventory = buildNavigationInventory(menu);
  fs.mkdirSync('docs/navigation', { recursive: true });
  fs.writeFileSync('docs/navigation/navigation-tree.json', JSON.stringify(menu, null, 2) + '\n');
  fs.writeFileSync('docs/navigation/route-inventory.json', JSON.stringify(inventory, null, 2) + '\n');
  fs.writeFileSync('docs/navigation/route-inventory.md', '# FAULTLINE route preservation inventory\n\nEvery mounted route and centrally registered alias is listed below. Existing page mounts, intelligence calculations, entitlements and redirects are preserved. The standalone PWA is separate from the app shell.\n\n| Route | Treatment | Navigation / target | Access | Component | Notes |\n|---|---|---|---|---|---|\n' + inventory.map(r => `| \`${r.path}\` | ${r.treatment} | ${r.navigation} | ${r.access} | ${r.component ?? 'Redirect'} | ${r.note} |`).join('\n') + '\n');
  fs.writeFileSync('client/public/manus-routes.json', JSON.stringify({ routes: inventory.filter(i => i.path !== '/404' && !isAdministrativeManifestPath(i.path)).map(i => ({ path: i.path, title: i.navigation })) }, null, 2) + '\n');
  console.log(JSON.stringify({ routes: inventory.length, treatments: inventory.reduce((a,r) => { a[r.treatment] = (a[r.treatment] ?? 0) + 1; return a; }, {} as Record<string,number>) }, null, 2));
}
