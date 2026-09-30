import { pct, type Band, type Metrics, type Summary, type TypeStats } from './metrics';

export interface FixtureScore { fixture: string; fields: number; correct: number }
export interface PerfResult { fields: number; classifyMs: number; fillMs: number; targetMs: number }
export interface RunExtras {
  fixtures: FixtureScore[];
  leaks: Array<{ fixture: string; expected: string; control: string }>;
  submits: number;
  requests: number;
  variants: { correct: number; total: number; failures: Array<{ name: string; expect: string; predicted: string }> };
  perf: PerfResult[];
  calibration: Band[];
  relations: Record<string, { correct: number; total: number }>;
  forms: { correct: number; total: number; mistakes: string[] };
  relationFailures: string[];
  holdout?: { fixtures: number; summary: Summary; confusions: Metrics['confusions'] };
  problems: string[];
}

const row = (cells: Array<string | number>) => `| ${cells.join(' | ')} |`;
const header = (cells: string[]) => [row(cells), row(cells.map(() => '---'))].join('\n');

function typeTable(types: Record<string, TypeStats>) {
  const lines = Object.entries(types).map(([type, stats]) => row([`\`${type}\``, stats.support, stats.predicted, pct(stats.precision), pct(stats.recall), pct(stats.f1)]));
  return [header(['Type', 'Expected', 'Predicted', 'Precision', 'Recall', 'F1']), ...lines].join('\n');
}

export function formatReport(metrics: Metrics, extras: RunExtras): string {
  const s = metrics.summary;
  const sections = [
    '## Summary',
    header(['Metric', 'Value']),
    row(['Fixtures', extras.fixtures.length]),
    row(['Fields', s.fields]),
    row(['Precision', pct(s.precision)]),
    row(['Recall', pct(s.recall)]),
    row(['F1', pct(s.f1)]),
    row(['Accuracy (unknown included)', pct(s.accuracy)]),
    row(['Unknown rate', pct(s.unknownRate)]),
    row(['False-positive rate (unknown fields given a type)', pct(s.falsePositiveRate)]),
    row(['Wrong-type rate', pct(s.wrongRate)]),
    row(['Sensitive-field leaks', extras.leaks.length]),
    row(['Form submissions', extras.submits]),
    row(['Network requests', extras.requests]),
    row(['Spelling variants correct', `${extras.variants.correct} / ${extras.variants.total}`]),
    '',
    '## Relationships and form types',
    header(['Check', 'Passing']),
    ...Object.entries(extras.relations).map(([kind, t]) => row([kind, `${t.correct} / ${t.total}`])),
    row(['form type', `${extras.forms.correct} / ${extras.forms.total}`]),
    ...(extras.relationFailures.length || extras.forms.mistakes.length ? ['', ...extras.relationFailures.map(f => `- ✗ ${f}`), ...extras.forms.mistakes.map(f => `- ✗ ${f}`)] : []),
    '',
    '## Per type',
    typeTable(metrics.types),
    '',
    '## Confidence calibration',
    header(['Band', 'Typed answers', 'Precision']),
    ...extras.calibration.map(b => row([`${b.band} (≥ ${b.from})`, b.predicted, pct(b.precision)])),
    '',
    '## Most common mistakes',
    header(['Expected', 'Predicted', 'Count']),
    ...metrics.confusions.slice(0, 25).map(c => row([`\`${c.expected}\``, `\`${c.predicted}\``, c.count])),
    '',
    '## Per fixture',
    header(['Fixture', 'Fields', 'Correct']),
    ...extras.fixtures.map(f => row([f.fixture, f.fields, `${f.correct} (${pct(f.fields ? f.correct / f.fields : 0)})`])),
    '',
    '## Performance',
    header(['Fields', 'Classify', 'Full fill', 'Target (classify)']),
    ...extras.perf.map(p => row([p.fields, `${p.classifyMs.toFixed(1)} ms`, `${p.fillMs.toFixed(1)} ms`, `< ${p.targetMs} ms ${p.classifyMs < p.targetMs ? '✓' : '✗'}`])),
  ];
  if (extras.holdout) {
    const h = extras.holdout.summary;
    sections.push('', '## Held-out fixtures', 'Forms the engine was never tuned on. Reported, and gated only on leaks and safety.', '',
      header(['Fixtures', 'Fields', 'Precision', 'Recall', 'F1', 'Unknown rate', 'Wrong-type rate']),
      row([extras.holdout.fixtures, h.fields, pct(h.precision), pct(h.recall), pct(h.f1), pct(h.unknownRate), pct(h.wrongRate)]),
      '', header(['Expected', 'Predicted', 'Count']),
      ...extras.holdout.confusions.slice(0, 15).map(c => row([`\`${c.expected}\``, `\`${c.predicted}\``, c.count])));
  }
  if (extras.leaks.length) sections.push('', '## Leaks', ...extras.leaks.map(l => `- ${l.fixture}: \`${l.expected}\` ${l.control}`));
  if (extras.variants.failures.length) sections.push('', '## Spelling variants that failed', ...extras.variants.failures.slice(0, 40).map(f => `- \`${f.name}\` expected \`${f.expect}\`, got \`${f.predicted}\``));
  sections.push('', '## Gate', extras.problems.length ? extras.problems.map(p => `- ✗ ${p}`).join('\n') : '✓ No regressions against the baseline.');
  return sections.join('\n');
}
