/**
 * Drift guard: action.yml is hand-committed but must stay in lockstep with
 * the canonical registry in src/schema. Both directions are checked.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { ACTION_META, INPUT_DEFS, OUTPUT_DEFS } from '../src/schema/index.js';

const actionYml = parse(readFileSync(join(__dirname, '..', 'action.yml'), 'utf8')) as {
  name: string;
  description: string;
  author: string;
  branding: { icon: string; color: string };
  inputs: Record<string, { description: string; required?: boolean; default?: unknown }>;
  outputs: Record<string, { description: string }>;
  runs: { using: string; main: string };
};

describe('action.yml ↔ src/schema parity', () => {
  it('has identical input keys (no extras, no missing)', () => {
    expect(Object.keys(actionYml.inputs).sort()).toEqual(INPUT_DEFS.map((d) => d.key).sort());
  });

  it.each(INPUT_DEFS.map((d) => [d.key, d] as const))('input %s matches registry', (_key, def) => {
    const entry = actionYml.inputs[def.key];
    expect(entry).toBeDefined();
    expect(entry!.description).toBe(def.description);
    expect(Boolean(entry!.required)).toBe(def.required);
    if (def.default === undefined) {
      expect(entry!.default).toBeUndefined();
    } else {
      // YAML may parse 'false' → boolean; compare as strings like the runner does.
      expect(String(entry!.default)).toBe(def.default);
    }
  });

  it('has identical output keys and descriptions', () => {
    expect(Object.keys(actionYml.outputs).sort()).toEqual(OUTPUT_DEFS.map((d) => d.key).sort());
    for (const def of OUTPUT_DEFS) {
      expect(actionYml.outputs[def.key]!.description).toBe(def.description);
    }
  });

  it('matches static metadata (name, branding, runs)', () => {
    expect(actionYml.name).toBe(ACTION_META.name);
    expect(actionYml.description).toBe(ACTION_META.description);
    expect(actionYml.author).toBe(ACTION_META.author);
    expect(actionYml.branding).toEqual(ACTION_META.branding);
    expect(actionYml.runs.using).toBe(ACTION_META.runs.using);
    expect(actionYml.runs.main).toBe(ACTION_META.runs.main);
  });

  it('marks every secret input as optional except github-token', () => {
    for (const def of INPUT_DEFS.filter((d) => d.secret)) {
      expect(def.required).toBe(def.key === 'github-token');
      expect(def.suggestedSecretName).toBeTruthy();
    }
  });
});
