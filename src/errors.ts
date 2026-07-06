/**
 * Coded, actionable errors. Every user-facing failure path goes through one
 * of these so the log always says WHAT failed and HOW to fix it.
 */
export type ErrorCode =
  | 'E_ORG_NOT_FOUND'
  | 'E_TOKEN_SCOPE'
  | 'E_CUSTOM_DATES'
  | 'E_BAD_INPUT'
  | 'E_CONFIG_FILE'
  | 'E_EMAIL_CONFIG'
  | 'E_LLM_CONFIG'
  | 'E_SEARCH_CAP'
  | 'E_ALL_DELIVERIES_FAILED';

export class ActionError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly hints: string[] = []
  ) {
    super(message);
    this.name = 'ActionError';
  }

  /** Multi-line message with fix-it hints, ready for core.setFailed. */
  format(): string {
    const lines = [`[${this.code}] ${this.message}`];
    for (const hint of this.hints) lines.push(`  ↳ ${hint}`);
    return lines.join('\n');
  }
}
