/**
 * One-shot generator for action.yml from src/schema (used at contract-freeze
 * time and whenever the contract changes). action.yml is committed; the drift
 * test in __tests__/action-yml-drift.test.ts asserts it stays in sync.
 *
 * Run: npx tsx scripts/gen-action-yml.ts   (or: node --experimental-strip-types)
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { stringify } from 'yaml';
import { ACTION_META, INPUT_DEFS, OUTPUT_DEFS } from '../src/schema/index.js';

const inputs: Record<string, Record<string, unknown>> = {};
for (const def of INPUT_DEFS) {
  const entry: Record<string, unknown> = { description: def.description };
  if (def.required) entry.required = true;
  if (def.default !== undefined) entry.default = def.default;
  inputs[def.key] = entry;
}

const outputs: Record<string, Record<string, unknown>> = {};
for (const def of OUTPUT_DEFS) {
  outputs[def.key] = { description: def.description };
}

const doc = {
  name: ACTION_META.name,
  description: ACTION_META.description,
  author: ACTION_META.author,
  branding: { icon: ACTION_META.branding.icon, color: ACTION_META.branding.color },
  inputs,
  outputs,
  runs: { using: ACTION_META.runs.using, main: ACTION_META.runs.main }
};

const header =
  '# Generated from src/schema — if you edit inputs here, update src/schema/inputs.ts\n' +
  '# (the drift test in __tests__/action-yml-drift.test.ts enforces parity).\n';

const yamlText = header + stringify(doc, { lineWidth: 100 });
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
writeFileSync(join(root, 'action.yml'), yamlText);
process.stdout.write(`action.yml written (${INPUT_DEFS.length} inputs, ${OUTPUT_DEFS.length} outputs)\n`);
