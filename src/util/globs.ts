/**
 * Tiny glob matching for repo names and bot login patterns.
 * Supports `*` (any run) and `?` (single char) — nothing else, on purpose.
 */

const REGEX_SPECIALS = /[.+^${}()|[\]\\]/g;

export function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(REGEX_SPECIALS, '\\$&').replaceAll('*', '.*').replaceAll('?', '.');
  return new RegExp(`^${escaped}$`, 'i');
}

export function matchesAny(name: string, globs: readonly string[]): boolean {
  return globs.some((g) => globToRegExp(g).test(name));
}

/** Split a comma/newline-separated input into trimmed, non-empty entries. */
export function parseList(input: string | undefined): string[] {
  if (!input) return [];
  return input
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
