import {
  nanoid8,
  type AlertCondition,
  type AlertSeverity,
  type WatchlistItem,
} from '@/lib/watchlist';

export interface WatchlistItemDraft {
  indicatorKey: string;
  thresholdValue: number;
  condition: AlertCondition;
  severity: AlertSeverity;
  note: string;
}

export function buildWatchlistItem(
  draft: WatchlistItemDraft,
  existing?: WatchlistItem | null,
  now: () => number = Date.now,
  createId: () => string = nanoid8,
): WatchlistItem {
  return {
    id: existing?.id ?? createId(),
    indicatorKey: draft.indicatorKey,
    thresholdValue: draft.thresholdValue,
    condition: draft.condition,
    severity: draft.severity,
    note: draft.note.trim() || undefined,
    createdAt: existing?.createdAt ?? now(),
    breachCount: existing?.breachCount ?? 0,
    lastBreached: existing?.lastBreached,
  };
}
