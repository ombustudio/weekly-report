/**
 * Live validation of the configurator state — warnings shown above the output.
 */
import type { ConfiguratorState } from '../state.js';

export interface Warning {
  level: 'error' | 'warn' | 'info';
  message: string;
}

export function lint(state: ConfiguratorState): Warning[] {
  const warnings: Warning[] = [];

  if (!state.actionRef || state.actionRef.startsWith('OWNER/')) {
    warnings.push({
      level: 'warn',
      message: 'Replace OWNER/weekly-report with the published action reference.'
    });
  }

  if (!state.slackEnabled && !state.emailEnabled) {
    warnings.push({
      level: 'warn',
      message: 'No Slack or email delivery configured — the report will only appear in the job summary and artifact.'
    });
  }

  if (state.emailEnabled) {
    if (!state.emailTo.trim()) warnings.push({ level: 'error', message: 'Email delivery needs at least one recipient (email-to).' });
    if (!state.emailFrom.trim()) {
      warnings.push({
        level: 'error',
        message: 'Email delivery needs a Resend-verified sender (email-from). Use onboarding@resend.dev while testing.'
      });
    }
  }

  if (state.llm === 'none') {
    warnings.push({ level: 'info', message: 'Metrics-only mode: no LLM narrative will be generated.' });
  }

  if (state.cadence === 'biweekly') {
    warnings.push({
      level: 'info',
      message:
        'Biweekly runs use a weekly cron; the action skips off-weeks by ISO-week parity. Manual runs always produce a report.'
    });
  }

  const noLevels = !state.levels.org && !state.levels.repo && !state.levels.person;
  if (noLevels) warnings.push({ level: 'error', message: 'Enable at least one report level.' });

  if (state.minute % 30 === 0) {
    warnings.push({
      level: 'info',
      message: 'Tip: crons at :00/:30 are the most congested on GitHub — an odd minute like :17 fires more punctually.'
    });
  }

  return warnings;
}
