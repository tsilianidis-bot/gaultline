import { describe, expect, it } from 'vitest';
import { buildWatchlistItem } from '../client/src/components/watchlist/WatchlistEditModel';
import type { WatchlistItem } from '../client/src/lib/watchlist';

describe('buildWatchlistItem', () => {
  it('builds a new alert with deterministic identity and trimmed notes', () => {
    const result = buildWatchlistItem({
      indicatorKey: 'score_credit',
      thresholdValue: 7.5,
      condition: 'above',
      severity: 'critical',
      note: '  credit stress  ',
    }, null, () => 1_700_000_000_000, () => 'watch-123');

    expect(result).toEqual({
      id: 'watch-123',
      indicatorKey: 'score_credit',
      thresholdValue: 7.5,
      condition: 'above',
      severity: 'critical',
      note: 'credit stress',
      createdAt: 1_700_000_000_000,
      breachCount: 0,
      lastBreached: undefined,
    });
  });

  it('preserves persisted identity and breach history when editing', () => {
    const existing: WatchlistItem = {
      id: 'watch-existing',
      indicatorKey: 'score_overall',
      thresholdValue: 6,
      condition: 'above',
      severity: 'high',
      createdAt: 42,
      breachCount: 3,
      lastBreached: 84,
    };

    const result = buildWatchlistItem({
      indicatorKey: 'score_overall',
      thresholdValue: 5.5,
      condition: 'below',
      severity: 'moderate',
      note: '   ',
    }, existing, () => 999, () => 'unused');

    expect(result).toEqual({
      id: 'watch-existing',
      indicatorKey: 'score_overall',
      thresholdValue: 5.5,
      condition: 'below',
      severity: 'moderate',
      note: undefined,
      createdAt: 42,
      breachCount: 3,
      lastBreached: 84,
    });
  });
});
