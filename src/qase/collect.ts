/**
 * Qase (test management) collection — the QA side of the weekly story:
 * runs executed in the window, pass/fail totals, new test cases, defects.
 *
 * Same philosophy as the GitHub side: deterministic numbers via REST
 * (auth: `Token` header; envelope { status, result: { entities } }),
 * failures degrade to warnings — QA data never breaks the report.
 */
import type { ResolvedConfig } from '../schema/index.js';
import type { ReportWindow } from '../util/time.js';

const API = 'https://api.qase.io/v1';
const PAGE = 100;
/** Tail pages fetched when an endpoint lacks server-side date filters. */
const CLIENT_FILTER_CAP = 300;

export interface QaProjectStats {
  code: string;
  title: string;
  runs: number;
  testsExecuted: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  newCases: number;
  newDefects: number;
  openDefects: number;
}

export interface QaTotals {
  runs: number;
  testsExecuted: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  newCases: number;
  newDefects: number;
  openDefects: number;
  /** 0-100, over executed tests with a verdict. */
  passRate: number | null;
}

export interface QaData {
  projects: QaProjectStats[];
  totals: QaTotals;
  warnings: string[];
}

interface QaseEnvelope<T> {
  status: boolean;
  result?: { total?: number; entities?: T[] } & Record<string, unknown>;
  errorMessage?: string;
}

async function qget<T>(
  token: string,
  path: string,
  params: Record<string, string | number>,
  fetchImpl: typeof fetch
): Promise<{ entities: T[]; total: number }> {
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])));
  const response = await fetchImpl(`${API}${path}?${qs}`, {
    headers: { Token: token, accept: 'application/json' }
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error(`Qase rejected the API token (HTTP ${response.status}) — check qase-api-token.`);
  }
  if (!response.ok) throw new Error(`Qase API ${path} → HTTP ${response.status}`);
  const body = (await response.json()) as QaseEnvelope<T>;
  if (!body.status) throw new Error(`Qase API ${path}: ${body.errorMessage ?? 'status=false'}`);
  return { entities: body.result?.entities ?? [], total: body.result?.total ?? 0 };
}

/** Entities ordered oldest-first + no server date filter → read only the tail. */
async function fetchTail<T>(
  token: string,
  path: string,
  fetchImpl: typeof fetch,
  warnings: string[],
  label: string
): Promise<T[]> {
  const probe = await qget<T>(token, path, { limit: 1 }, fetchImpl);
  const total = probe.total;
  const start = Math.max(0, total - CLIENT_FILTER_CAP);
  if (start > 0) warnings.push(`Qase ${label}: window counts cover the most recent ${CLIENT_FILTER_CAP} of ${total} entries.`);
  const out: T[] = [];
  for (let offset = start; offset < total; offset += PAGE) {
    const page = await qget<T>(token, path, { limit: PAGE, offset }, fetchImpl);
    out.push(...page.entities);
    if (page.entities.length === 0) break;
  }
  return out;
}

function inWindow(iso: string | number | null | undefined, window: ReportWindow): boolean {
  if (iso === null || iso === undefined) return false;
  const ms = typeof iso === 'number' ? iso * 1000 : Date.parse(iso);
  return Number.isFinite(ms) && ms >= window.startUtcMs && ms < window.endUtcMs;
}

interface RunEntity {
  stats?: Partial<Record<'total' | 'passed' | 'failed' | 'blocked' | 'skipped' | 'untested', number>>;
}
interface CreatedEntity {
  created_at?: string;
  created?: string;
}

export async function collectQase(
  config: ResolvedConfig,
  window: ReportWindow,
  fetchImpl: typeof fetch = fetch
): Promise<QaData | null> {
  const token = config.qase.apiToken;
  if (!token) return null;
  const warnings: string[] = [];

  // Which projects: configured codes, or every project the token can see.
  let projects: Array<{ code: string; title: string }>;
  if (config.qase.projects.length > 0) {
    projects = config.qase.projects.map((code) => ({ code, title: code }));
  } else {
    const listed = await qget<{ code: string; title: string }>(token, '/project', { limit: PAGE }, fetchImpl);
    projects = listed.entities.map((p) => ({ code: p.code, title: p.title }));
  }

  const stats: QaProjectStats[] = [];
  for (const project of projects) {
    try {
      // Test runs inside the window (server-side time filter, epoch seconds).
      const runEntities: RunEntity[] = [];
      for (let offset = 0; offset < 300; offset += PAGE) {
        const page = await qget<RunEntity>(
          token,
          `/run/${project.code}`,
          {
            from_start_time: Math.floor(window.startUtcMs / 1000),
            to_start_time: Math.floor((window.endUtcMs - 1000) / 1000),
            limit: PAGE,
            offset
          },
          fetchImpl
        );
        runEntities.push(...page.entities);
        if (page.entities.length < PAGE) break;
      }

      const sum = (key: 'total' | 'passed' | 'failed' | 'blocked' | 'skipped'): number =>
        runEntities.reduce((a, r) => a + (r.stats?.[key] ?? 0), 0);

      // New cases / defects: no server date filter — client-side over the tail.
      const cases = await fetchTail<CreatedEntity>(token, `/case/${project.code}`, fetchImpl, warnings, `${project.code} cases`);
      const defects = await fetchTail<CreatedEntity>(token, `/defect/${project.code}`, fetchImpl, warnings, `${project.code} defects`);
      const openDefects = (await qget(token, `/defect/${project.code}`, { status: 'open', limit: 1 }, fetchImpl)).total;

      const entry: QaProjectStats = {
        code: project.code,
        title: project.title,
        runs: runEntities.length,
        testsExecuted: sum('total'),
        passed: sum('passed'),
        failed: sum('failed'),
        blocked: sum('blocked'),
        skipped: sum('skipped'),
        newCases: cases.filter((c) => inWindow(c.created_at ?? c.created, window)).length,
        newDefects: defects.filter((d) => inWindow(d.created_at ?? d.created, window)).length,
        openDefects
      };
      // Only report projects with some QA signal — silent ones add noise.
      if (entry.runs + entry.newCases + entry.newDefects + entry.openDefects > 0) stats.push(entry);
    } catch (error) {
      warnings.push(`Qase project ${project.code}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const total = (key: keyof Omit<QaProjectStats, 'code' | 'title'>): number =>
    stats.reduce((a, p) => a + (p[key] as number), 0);
  const verdicts = total('passed') + total('failed') + total('blocked');
  const totals: QaTotals = {
    runs: total('runs'),
    testsExecuted: total('testsExecuted'),
    passed: total('passed'),
    failed: total('failed'),
    blocked: total('blocked'),
    skipped: total('skipped'),
    newCases: total('newCases'),
    newDefects: total('newDefects'),
    openDefects: total('openDefects'),
    passRate: verdicts > 0 ? Math.round((total('passed') / verdicts) * 1000) / 10 : null
  };

  return { projects: stats, totals, warnings };
}
