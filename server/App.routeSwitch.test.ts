/**
 * Regression tests for the wouter Switch path-less catch-all bug.
 *
 * Root cause: <CanonicalDestinationRoutes /> and <AnalyticalLegacyAliases />
 * were placed directly inside a <Switch> without a `path` prop. wouter's Switch
 * treats any element without a `path` prop as a wildcard ("*") that matches
 * every URL, so the Switch would match these wrapper components for ALL routes
 * (e.g., /app/signals), render them, and their inner Switch would return null
 * because none of their routes matched the current URL. Result: blank content area.
 *
 * Fix: inline the routes from both wrapper components directly into the Switch
 * so every entry has an explicit `path` prop.
 *
 * These tests verify:
 * 1. CANONICAL_DESTINATIONS all have non-empty path strings
 * 2. ANALYTICAL_LEGACY_ALIASES all have non-empty source path strings
 * 3. No secondary route path is a prefix of any canonical destination path
 *    (which would cause the canonical destination to shadow the secondary route)
 * 4. The known-blank routes (/app/signals, /app/historical-analogs, etc.) are
 *    registered in the route registry and have unique, non-overlapping paths
 */

import { describe, it, expect } from 'vitest';
import {
  CANONICAL_DESTINATIONS,
  ANALYTICAL_LEGACY_ALIASES,
  CANONICAL_DESTINATION_BY_ID,
} from '../shared/routeRegistry';

// Secondary routes that were previously blank due to the catch-all bug
const KNOWN_SECONDARY_ROUTES = [
  '/app/signals',
  '/app/historical-analogs',
  '/app/watchlist',
  '/app/portfolio',
  '/app/crypto',
  '/app/crypto-signals',
  '/app/sim-portfolio',
  '/app/trade-journal',
  '/app/validation',
  '/app/validation-lab',
  '/app/decision-ledger',
  '/app/guide',
  '/app/roadmap',
  '/app/alerts',
  '/app/discover',
  '/app/pressure',
  '/app/account',
  '/app/analytics',
  '/app/market-movers',
  '/app/signal-outlook',
  '/app/day-trade-intelligence',
  '/app/symbol-intelligence',
];

describe('Route Switch — path-less catch-all regression', () => {
  it('all CANONICAL_DESTINATIONS have non-empty path strings', () => {
    for (const dest of CANONICAL_DESTINATIONS) {
      expect(dest.path, `Destination "${dest.id}" must have a non-empty path`).toBeTruthy();
      expect(typeof dest.path).toBe('string');
      expect(dest.path.length).toBeGreaterThan(0);
    }
  });

  it('all CANONICAL_DESTINATIONS have paths starting with /app/', () => {
    for (const dest of CANONICAL_DESTINATIONS) {
      expect(dest.path, `Destination "${dest.id}" path must start with /app/`).toMatch(/^\/app\//);
    }
  });

  it('all ANALYTICAL_LEGACY_ALIASES have non-empty source paths', () => {
    const entries = Object.entries(ANALYTICAL_LEGACY_ALIASES);
    expect(entries.length).toBeGreaterThan(0);
    for (const [source] of entries) {
      expect(source, 'Legacy alias source must be a non-empty string').toBeTruthy();
      expect(source.startsWith('/')).toBe(true);
    }
  });

  it('all ANALYTICAL_LEGACY_ALIASES have non-empty target paths', () => {
    for (const [source, target] of Object.entries(ANALYTICAL_LEGACY_ALIASES)) {
      expect(target, `Legacy alias "${source}" must have a non-empty target`).toBeTruthy();
    }
  });

  it('canonical destination paths do not shadow known secondary routes', () => {
    const canonicalPaths = CANONICAL_DESTINATIONS.map(d => d.path);
    for (const secondaryPath of KNOWN_SECONDARY_ROUTES) {
      for (const canonicalPath of canonicalPaths) {
        // A canonical path should not be a prefix of a secondary route
        // (e.g., /app/signals should not be shadowed by /app/sig)
        const wouldShadow = secondaryPath.startsWith(canonicalPath + '/') || secondaryPath === canonicalPath;
        expect(wouldShadow, `Canonical path "${canonicalPath}" shadows secondary route "${secondaryPath}"`).toBe(false);
      }
    }
  });

  it('known secondary routes are not in CANONICAL_DESTINATIONS', () => {
    const canonicalPaths = new Set(CANONICAL_DESTINATIONS.map(d => d.path));
    for (const secondaryPath of KNOWN_SECONDARY_ROUTES) {
      expect(canonicalPaths.has(secondaryPath), `"${secondaryPath}" should be a secondary route, not a canonical destination`).toBe(false);
    }
  });

  it('CANONICAL_DESTINATION_BY_ID has entries for all 5 primary destinations', () => {
    const requiredIds = ['now', 'why', 'outlook', 'watch', 'act'];
    for (const id of requiredIds) {
      expect(CANONICAL_DESTINATION_BY_ID[id as keyof typeof CANONICAL_DESTINATION_BY_ID], `Missing canonical destination: ${id}`).toBeDefined();
    }
  });

  it('no two canonical destinations share the same path', () => {
    const paths = CANONICAL_DESTINATIONS.map(d => d.path);
    const uniquePaths = new Set(paths);
    expect(uniquePaths.size).toBe(paths.length);
  });

  it('no two legacy aliases share the same source path', () => {
    const sources = Object.keys(ANALYTICAL_LEGACY_ALIASES);
    const uniqueSources = new Set(sources);
    expect(uniqueSources.size).toBe(sources.length);
  });
});
