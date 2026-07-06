/**
 * Canonical highlight catalog — v1 ships 8 highlights, all default-ON.
 *
 * Product rule (frozen at design time): highlights are celebratory or
 * process-level only. Individual-shaming metrics (after-hours/weekend
 * activity) are rejected by design and must not be added. Deferred to v1.1
 * (default OFF, repo-level aggregation only): busiest-day, unreviewed-merges,
 * slowest-review.
 */

export const HIGHLIGHT_IDS = [
  'oldest-open-pr',
  'top-merger',
  'top-reviewer',
  'stale-prs',
  'biggest-pr',
  'fastest-review',
  'first-time-contributors',
  'most-active-repo'
] as const;

export type HighlightId = (typeof HIGHLIGHT_IDS)[number];

/** Per-highlight tunable parameters with their frozen defaults. */
export interface HighlightParams {
  'oldest-open-pr': { minAgeDays: number; ignoreDrafts: boolean };
  'top-merger': { podium: number };
  'top-reviewer': { podium: number };
  'stale-prs': { thresholdDays: number; maxListed: number };
  'biggest-pr': { excludeBots: boolean };
  'fastest-review': { minMinutes: number };
  'first-time-contributors': Record<string, never>;
  'most-active-repo': Record<string, never>;
}

export const HIGHLIGHT_DEFAULTS: { [K in HighlightId]: { enabled: boolean; params: HighlightParams[K] } } = {
  'oldest-open-pr': { enabled: true, params: { minAgeDays: 14, ignoreDrafts: true } },
  'top-merger': { enabled: true, params: { podium: 1 } },
  'top-reviewer': { enabled: true, params: { podium: 1 } },
  'stale-prs': { enabled: true, params: { thresholdDays: 7, maxListed: 5 } },
  'biggest-pr': { enabled: true, params: { excludeBots: true } },
  'fastest-review': { enabled: true, params: { minMinutes: 10 } },
  'first-time-contributors': { enabled: true, params: {} },
  'most-active-repo': { enabled: true, params: {} }
};

export function isHighlightId(id: string): id is HighlightId {
  return (HIGHLIGHT_IDS as readonly string[]).includes(id);
}
