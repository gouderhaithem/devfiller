// "Was the fill fine?" A stricter test than a user needs marks some answers wrong that fill the
// field just as well: a sentence in a notes box where the label says message, a price where it says
// amount, a field skipped that needed nothing. These count as fine here, so what is left are
// the mistakes a user would see.

import type { FieldKey } from '../../src/data';

// Types whose values are interchangeable in a fill (src/data.ts, src/samples.ts).
const FAMILIES: readonly (readonly FieldKey[])[] = [
  ['message', 'notes', 'description', 'bio'], // a sentence of text
  ['price', 'amount'], // a sum of money
];

// A field that needs nothing may be skipped as sensitive. The other way round is a mistake: a
// consent box read as unknown is one a fill of unknown fields may tick.
export function acceptable(expected: string, predicted: string): boolean {
  if (expected === predicted) return true;
  if (expected === 'unknown' && predicted.startsWith('skip:')) return true;
  return FAMILIES.some(family => family.includes(expected as FieldKey) && family.includes(predicted as FieldKey));
}

export interface FillSummary { fine: number; mistakes: number; top: [string, number][] }

export function fillSummary(pairs: readonly { expected: string; predicted: string }[], limit = 15): FillSummary {
  const counts = new Map<string, number>();
  for (const { expected, predicted } of pairs) {
    if (acceptable(expected, predicted)) continue;
    const key = `${expected} → ${predicted}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const mistakes = [...counts.values()].reduce((sum, n) => sum + n, 0);
  const top = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
  return { fine: pairs.length ? (pairs.length - mistakes) / pairs.length : 0, mistakes, top };
}
