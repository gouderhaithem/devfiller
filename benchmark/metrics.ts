// Pure scoring for the benchmark: no browser, so it is unit tested with the rest of the suite.

export interface Pair { fixture: string; index: number; expected: string; predicted: string; confidence?: number; html?: string }

export interface TypeStats {
  support: number;          // fields that expect this type
  predicted: number;        // fields the engine gave this type
  correct: number;
  precision: number | null; // null when the engine never predicted the type
  recall: number | null;    // null when no fixture expects the type
  f1: number | null;
}

export interface Summary {
  fields: number;
  precision: number;         // correct typed predictions / typed predictions
  recall: number;            // correct typed predictions / fields that expect a type
  f1: number;
  accuracy: number;          // exact answer, "unknown" included
  unknownRate: number;       // fields the engine called unknown
  falsePositiveRate: number; // fields that expect unknown but got a type
  wrongRate: number;         // fields given a type that isn't the expected one
}

export interface Metrics { summary: Summary; types: Record<string, TypeStats>; confusions: Array<{ expected: string; predicted: string; count: number }> }

const UNKNOWN = 'unknown';
const ratio = (part: number, whole: number) => whole ? part / whole : 0;
const f1 = (p: number | null, r: number | null) => p === null || r === null ? null : p + r ? 2 * p * r / (p + r) : 0;

export function isSensitive(type: string) { return type.startsWith('skip:'); }

export function scoreTypes(pairs: readonly Pair[]): Record<string, TypeStats> {
  const labels = new Set(pairs.flatMap(pair => [pair.expected, pair.predicted]).filter(label => label !== UNKNOWN));
  const types: Record<string, TypeStats> = {};
  for (const label of [...labels].sort()) {
    const support = pairs.filter(pair => pair.expected === label).length;
    const predicted = pairs.filter(pair => pair.predicted === label).length;
    const correct = pairs.filter(pair => pair.expected === label && pair.predicted === label).length;
    const precision = predicted ? correct / predicted : null;
    const recall = support ? correct / support : null;
    types[label] = { support, predicted, correct, precision, recall, f1: f1(precision, recall) };
  }
  return types;
}

export function summarize(pairs: readonly Pair[]): Summary {
  const typed = pairs.filter(pair => pair.predicted !== UNKNOWN);
  const expectedTyped = pairs.filter(pair => pair.expected !== UNKNOWN);
  const correct = typed.filter(pair => pair.predicted === pair.expected).length;
  const expectedUnknown = pairs.filter(pair => pair.expected === UNKNOWN);
  const precision = ratio(correct, typed.length);
  const recall = ratio(correct, expectedTyped.length);
  return {
    fields: pairs.length,
    precision, recall, f1: f1(precision, recall) ?? 0,
    accuracy: ratio(pairs.filter(pair => pair.predicted === pair.expected).length, pairs.length),
    unknownRate: ratio(pairs.length - typed.length, pairs.length),
    falsePositiveRate: ratio(expectedUnknown.filter(pair => pair.predicted !== UNKNOWN).length, expectedUnknown.length),
    wrongRate: ratio(typed.length - correct, pairs.length),
  };
}

export function confusions(pairs: readonly Pair[]) {
  const counts = new Map<string, number>();
  for (const pair of pairs) if (pair.expected !== pair.predicted) {
    const key = `${pair.expected}\u0000${pair.predicted}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].map(([key, count]) => {
    const [expected, predicted] = key.split('\u0000');
    return { expected, predicted, count };
  }).sort((a, b) => b.count - a.count || a.expected.localeCompare(b.expected));
}

export interface Band { band: string; from: number; predicted: number; correct: number; precision: number | null }
// Calibration: how often typed answers in each confidence band are right. Sensitive skips and
// unknowns are left out; they aren't guesses.
export function calibration(pairs: readonly Pair[], bands: ReadonlyArray<readonly [string, number]>): Band[] {
  const typed = pairs.filter(pair => pair.predicted !== UNKNOWN && !isSensitive(pair.predicted) && pair.confidence !== undefined);
  return bands.map(([band, from], i) => {
    const upper = i ? bands[i - 1][1] : Infinity;
    const inBand = typed.filter(pair => pair.confidence! >= from && pair.confidence! < upper);
    const correct = inBand.filter(pair => pair.expected === pair.predicted).length;
    return { band, from, predicted: inBand.length, correct, precision: inBand.length ? correct / inBand.length : null };
  });
}

export function score(pairs: readonly Pair[]): Metrics {
  return { summary: summarize(pairs), types: scoreTypes(pairs), confusions: confusions(pairs) };
}

export interface Baseline { summary: Summary; types: Record<string, TypeStats>; leaks: number; variants: { correct: number; total: number } }
export interface Current extends Baseline { submits: number; requests: number }

// Returns every reason the run is worse than the baseline. Empty means the gate passes.
export function regressions(current: Current, baseline: Baseline | undefined): string[] {
  const problems: string[] = [];
  const epsilon = 1e-9;
  if (current.leaks) problems.push(`${current.leaks} sensitive field(s) were filled`);
  if (current.submits) problems.push(`${current.submits} form submission(s) happened`);
  if (current.requests) problems.push(`${current.requests} network request(s) happened during detection`);
  if (!baseline) return problems;
  if (current.summary.precision + epsilon < baseline.summary.precision) problems.push(`overall precision fell from ${pct(baseline.summary.precision)} to ${pct(current.summary.precision)}`);
  if (current.summary.recall + epsilon < baseline.summary.recall) problems.push(`overall recall fell from ${pct(baseline.summary.recall)} to ${pct(current.summary.recall)}`);
  for (const [type, before] of Object.entries(baseline.types)) {
    const now = current.types[type];
    // A type the engine stopped predicting entirely has no precision; its recall drop still counts.
    if (before.precision !== null && now?.precision != null && now.precision + epsilon < before.precision) problems.push(`${type} precision fell from ${pct(before.precision)} to ${pct(now.precision)}`);
    if (before.recall !== null && (now?.recall ?? 0) + epsilon < before.recall) problems.push(`${type} recall fell from ${pct(before.recall)} to ${pct(now?.recall ?? 0)}`);
  }
  if (current.variants.correct < baseline.variants.correct) problems.push(`spelling variants fell from ${baseline.variants.correct} to ${current.variants.correct} correct`);
  return problems;
}

export const pct = (value: number | null) => value === null ? '—' : `${(value * 100).toFixed(1)}%`;
