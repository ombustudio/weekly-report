import { describe, expect, it, vi } from 'vitest';
import { collectQase } from '../src/qase/collect.js';
import { aggregate } from '../src/metrics/aggregate.js';
import { buildReport } from '../src/metrics/report.js';
import { renderMarkdown } from '../src/render/markdown.js';
import { buildSlackPayload } from '../src/render/slack.js';
import { NOW, busyWeek, testConfig } from './fixtures.js';
import { computeWindow } from '../src/util/time.js';

const WINDOW = computeWindow({ period: 'weekly', timezone: 'UTC', nowMs: NOW });

function envelope(entities: unknown[], total = entities.length): Response {
  return new Response(JSON.stringify({ status: true, result: { total, entities } }), { status: 200 });
}

function qaseFetchMock() {
  // Routes by URL — one project ENT with one run, 2 cases (1 in window), 1 defect.
  return vi.fn().mockImplementation((url: string) => {
    const u = String(url);
    if (u.includes('/project')) return Promise.resolve(envelope([{ code: 'ENT', title: 'Entraste' }]));
    if (u.includes('/run/ENT')) {
      return Promise.resolve(
        envelope([{ stats: { total: 40, passed: 35, failed: 3, blocked: 1, skipped: 1 } }])
      );
    }
    if (u.includes('/case/ENT')) {
      return Promise.resolve(
        envelope([
          { created_at: '2026-06-15T10:00:00Z' }, // before window
          { created_at: '2026-07-01T10:00:00Z' } // inside
        ])
      );
    }
    if (u.includes('/defect/ENT') && u.includes('status=open')) return Promise.resolve(envelope([], 2));
    if (u.includes('/defect/ENT')) return Promise.resolve(envelope([{ created_at: '2026-07-02T09:00:00Z' }]));
    return Promise.resolve(new Response('not found', { status: 404 }));
  });
}

describe('collectQase', () => {
  const config = { ...testConfig(), qase: { apiToken: 'qase_x', projects: [] } };

  it('aggregates runs, new cases and defects per project', async () => {
    const qa = await collectQase(config, WINDOW, qaseFetchMock() as unknown as typeof fetch);
    expect(qa).not.toBeNull();
    expect(qa!.projects).toHaveLength(1);
    expect(qa!.projects[0]).toMatchObject({
      code: 'ENT',
      runs: 1,
      testsExecuted: 40,
      passed: 35,
      failed: 3,
      newCases: 1,
      newDefects: 1,
      openDefects: 2
    });
    expect(qa!.totals.passRate).toBeCloseTo(89.7, 1); // 35 / (35+3+1)
  });

  it('returns null without a token and degrades per-project on errors', async () => {
    expect(await collectQase({ ...config, qase: { apiToken: undefined, projects: [] } }, WINDOW)).toBeNull();

    const failing = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('/project')) return Promise.resolve(envelope([{ code: 'BAD', title: 'Bad' }]));
      return Promise.resolve(new Response('boom', { status: 500 }));
    });
    const qa = await collectQase(config, WINDOW, failing as unknown as typeof fetch);
    expect(qa!.projects).toHaveLength(0);
    expect(qa!.warnings.join(' ')).toMatch(/BAD/);
  });

  it('rejects clearly on bad tokens', async () => {
    const unauthorized = vi.fn().mockResolvedValue(new Response('no', { status: 401 }));
    await expect(collectQase(config, WINDOW, unauthorized as unknown as typeof fetch)).rejects.toThrow(/qase-api-token/);
  });
});

describe('QA section rendering', () => {
  it('renders totals, table and key-number rows in Spanish', async () => {
    const config = testConfig({ language: 'es' });
    const data = busyWeek();
    const metrics = aggregate(data, config);
    const qa = await collectQase(
      { ...config, qase: { apiToken: 'x', projects: [] } },
      WINDOW,
      qaseFetchMock() as unknown as typeof fetch
    );
    const report = buildReport({
      data,
      metrics,
      highlights: [],
      config,
      narrative: null,
      narrativeStatus: 'skipped-no-key',
      llmUsage: null,
      runUrl: 'https://x/run',
      qa
    });
    const md = renderMarkdown(report);
    expect(md).toContain('## 🧪 QA y Testing');
    expect(md).toContain('40 tests ejecutados en 1 corridas');
    expect(md).toContain('| **Entraste** | 1 | 40 | 35 | 3 |');
    expect(md).toContain('| Tests ejecutados | 40 |');
    expect(md).toContain('| Tasa de éxito de tests | 89.7% |');

    const slack = JSON.stringify(buildSlackPayload(report).blocks);
    expect(slack).toContain('🧪 *QA:*');
    expect(slack).toContain('40 tests ejecutados en 1 corridas');
  });

  it('omits the section entirely without Qase data', () => {
    const config = testConfig();
    const data = busyWeek();
    const metrics = aggregate(data, config);
    const report = buildReport({
      data, metrics, highlights: [], config,
      narrative: null, narrativeStatus: 'skipped-no-key', llmUsage: null, runUrl: 'https://x/run'
    });
    expect(renderMarkdown(report)).not.toContain('QA');
  });
});
