import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fields } from '../src/data';
import { ALIASES } from '../src/fill/dictionary';

// The field guide (also published as devfiller.com/docs/field-types) lists the engine's aliases.
describe('field guide', () => {
  const guide = readFileSync('FIELD_GUIDE.md', 'utf8');
  it.each(fields)('lists every alias for %s', (key, label) => {
    const row = guide.split('\n').find(line => line.startsWith(`| ${label} |`));
    expect(row, `row for ${label}`).toBeDefined();
    for (const alias of ALIASES[key]) expect(row, `"${alias}" in the ${label} row`).toContain(alias);
  });
});
