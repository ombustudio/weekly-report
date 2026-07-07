/**
 * Optional .github/weekly-report.yml generator — emitted only when the state
 * carries settings that can't be expressed as simple workflow inputs
 * (per-highlight params, bot/person exclusions, tone, biweekly anchor).
 * The output must round-trip through the action's own configFileSchema
 * (asserted by tests).
 */
import { stringify } from 'yaml';
import { HIGHLIGHT_DEFAULTS } from '@schema/index';
import type { ConfiguratorState } from '../state.js';

const BRANCH_DEFAULTS = {
  production: 'main, master',
  staging: 'develop, development, staging',
  commitPriority: 'develop, development, staging'
};

function csv(value: string): string[] {
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

export function buildConfigObject(state: ConfiguratorState): Record<string, unknown> {
  const config: Record<string, unknown> = {};

  if (state.cadence === 'biweekly' && state.biweeklyAnchor !== 'even') {
    config['biweekly-anchor'] = state.biweeklyAnchor;
  }

  if (state.staleThresholdDays !== HIGHLIGHT_DEFAULTS['stale-prs'].params.thresholdDays && state.highlights['stale-prs']) {
    config.highlights = {
      'stale-prs': { 'threshold-days': state.staleThresholdDays }
    };
  }

  if (!state.listMergedPrs) {
    config.report = { 'list-merged-prs': false };
  }

  if (state.includeForks) {
    config.repos = { 'skip-forks': false };
  }

  const branches: Record<string, unknown> = {};
  if (state.branchesProduction.trim() !== BRANCH_DEFAULTS.production) branches.production = csv(state.branchesProduction);
  if (state.branchesStaging.trim() !== BRANCH_DEFAULTS.staging) branches.staging = csv(state.branchesStaging);
  if (state.branchesCommitPriority.trim() !== BRANCH_DEFAULTS.commitPriority) {
    branches['commit-priority'] = csv(state.branchesCommitPriority);
  }
  if (Object.keys(branches).length > 0) config.branches = branches;

  const people: Record<string, unknown> = {};
  if (!state.excludeBots) people['exclude-bots'] = false;
  const excluded = state.peopleExclude
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (excluded.length > 0) people.exclude = excluded;
  if (Object.keys(people).length > 0) config.people = people;

  const llm: Record<string, unknown> = {};
  if (state.tone !== 'professional-warm') llm.tone = state.tone;
  if (state.audience !== 'mixed') llm.audience = state.audience;
  if (Object.keys(llm).length > 0) config.llm = llm;

  return config;
}

export function needsConfigFile(state: ConfiguratorState): boolean {
  return Object.keys(buildConfigObject(state)).length > 0;
}

export function generateConfigFile(state: ConfiguratorState): string {
  const header =
    '# Rich configuration for Org Weekly Report (AI) — every key optional.\n' +
    '# Secrets NEVER go in this file; pass them as action inputs.\n';
  return header + stringify(buildConfigObject(state));
}
