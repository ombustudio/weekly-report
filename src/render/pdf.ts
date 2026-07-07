/**
 * PDF generation via the runner's preinstalled Chrome/Chromium — zero new
 * dependencies. GitHub-hosted runners ship Chrome; elsewhere we degrade
 * gracefully (report still delivers everywhere, just without the PDF).
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
];

export function findChrome(): string | null {
  for (const candidate of CHROME_CANDIDATES) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  return null;
}

export interface PdfResult {
  ok: boolean;
  detail: string;
}

export async function generatePdf(htmlPath: string, pdfPath: string): Promise<PdfResult> {
  const chrome = findChrome();
  if (!chrome) {
    return {
      ok: false,
      detail: 'No Chrome/Chromium found on this runner — skipping the PDF (set CHROME_PATH to enable it).'
    };
  }
  try {
    await execFileAsync(
      chrome,
      [
        '--headless',
        '--disable-gpu',
        '--no-sandbox',
        '--no-pdf-header-footer',
        `--print-to-pdf=${pdfPath}`,
        `file://${htmlPath}`
      ],
      { timeout: 60_000 }
    );
    if (!existsSync(pdfPath)) return { ok: false, detail: 'Chrome exited without producing the PDF.' };
    return { ok: true, detail: 'ok' };
  } catch (error) {
    return { ok: false, detail: `PDF generation failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}
