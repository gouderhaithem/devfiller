// npm run train: reads benchmark/model/dataset.jsonl, trains the second-opinion model, calibrates
// it, packs it into src/fill/model.json and writes the model card benchmark/MODEL.md.
//
// Splits are by page, never by field: fields of one form share wording, so splitting a form would
// flatter the score. Settings are chosen by 5-fold group cross-validation on the training pages;
// the validation pages pick the stopping point, the temperature and the abstain threshold. The
// sealed Form Lab pages are not in the dataset at all.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { featuresOf, hashFeature, type FieldInfo } from '../../src/fill/features';
import { MODEL_CONFIDENCE_CAP, type PackedModel } from '../../src/fill/model';
import { THRESHOLDS } from '../../src/fill/classify';
import { augment } from './augment';
import { rng } from './rng';
import { scores, softmax, train, logLoss, type Example, type Settings } from './softmax';

const SEED = 20261001;
const HASH_BITS = 18;
const VARIANTS = 6;
const MIN_COUNT = 2;
const CLASS_WEIGHT_CAP = 5;
// The model must be at least as precise as the rules on the fields it answers.
const TARGET_PRECISION = Number(process.env.TARGET_PRECISION || 0.88);
const DATASET = resolve('benchmark/model/dataset.jsonl');
const VERSION = Number(process.env.MODEL_VERSION || 1);

interface Row { page: string; source: string; lang: string; expect: string; info: FieldInfo }
// Real-form rows live outside the repository (see dataset.ts); without them the model trains on the
// repo's rows alone.
const REAL_DATASET = process.env.REAL_DATASET || resolve(process.env.HOME || '', 'datasets/uci-webform/model/dataset-real.jsonl');
const repoRaw = readFileSync(DATASET, 'utf8');
const realRaw = existsSync(REAL_DATASET) ? readFileSync(REAL_DATASET, 'utf8') : '';
const raw = repoRaw.trimEnd() + '\n' + realRaw;
const rows: Row[] = raw.trim().split('\n').map(line => JSON.parse(line));
// The repo's rows are checked by a test; the real rows, kept outside, are recorded for traceability.
const datasetHash = createHash('sha256').update(repoRaw).digest('hex').slice(0, 16);
const realHash = realRaw ? createHash('sha256').update(realRaw).digest('hex').slice(0, 16) : '';

// Pages: about a fifth go to validation, drawn within each language and source. A page keeps the
// side it was given (benchmark/model/split.json), so adding pages never moves the others: a new
// page is placed by a hash of its name, and a group with no validation page yet gets its first.
const random = rng(SEED);
const pages = [...new Set(rows.map(row => row.page))];
// Real forms are their own stratum, so a fifth of them always validate: thresholds are then chosen
// on real pages, not only on fixtures and Form Lab.
const stratum = (page: string) => { const row = rows.find(r => r.page === page)!; return `${row.lang}:${row.source.startsWith('benchmark') ? 'b' : row.source === 'real' ? 'r' : 'l'}`; };
const SPLIT = resolve('benchmark/model/split.json');
const previous = existsSync(SPLIT) ? JSON.parse(readFileSync(SPLIT, 'utf8')) as { validation: string[]; training?: string[] } : undefined;
// A split written before training pages were listed trained on every page it didn't validate on.
const placed = previous && new Set([...previous.validation, ...(previous.training ?? pages)]);
const pageDraw = (page: string) => parseInt(createHash('sha256').update(`${SEED}:${page}`).digest('hex').slice(0, 8), 16) / 2 ** 32;
const validPages = new Set(pages.filter(page => placed?.has(page) ? previous!.validation.includes(page) : pageDraw(page) < 0.2));
const strata = new Map<string, string[]>();
for (const page of pages) strata.set(stratum(page), [...(strata.get(stratum(page)) ?? []), page]);
for (const list of strata.values()) if (!list.some(page => validPages.has(page))) validPages.add(list.reduce((a, b) => pageDraw(a) <= pageDraw(b) ? a : b));
// The draws the earlier shuffled split took, so the cross-validation folds below stay the same.
for (const list of strata.values()) random.shuffle([...list]);
// FRACTION < 1 trains on a seeded share of the training pages, for a learning curve (with DRY=1).
const FRACTION = Number(process.env.FRACTION || 1);
const kept = new Set(rng(SEED + 1).shuffle([...new Set(rows.filter(row => !validPages.has(row.page)).map(row => row.page))]).filter((_, i, all) => i < Math.max(1, Math.round(all.length * FRACTION))));
const trainRows = rows.filter(row => kept.has(row.page));
const validRows = rows.filter(row => validPages.has(row.page));

const classes = [...new Set(rows.map(row => row.expect))].sort((a, b) => a === 'unknown' ? -1 : b === 'unknown' ? 1 : a.localeCompare(b));
const classIndex = new Map(classes.map((name, i) => [name, i]));
const K = classes.length;

// EXTRA: more training rows from elsewhere (the UCI fields of scripts/uci), with silver labels.
// They join every training set but are never held out or validated on, are not reworded, and each
// weighs EXTRA_WEIGHT of a field; class weights come from the hand-labelled rows alone.
const EXTRA = process.env.EXTRA ? resolve(process.env.EXTRA) : '';
const EXTRA_WEIGHT = Number(process.env.EXTRA_WEIGHT || 0.3);
const extraRaw = EXTRA ? readFileSync(EXTRA, 'utf8') : '';
const extraRows: Row[] = extraRaw.trim() ? extraRaw.trim().split('\n').map(line => JSON.parse(line)).filter((row: Row) => classIndex.has(row.expect)) : [];
const extraSet = new Set(extraRows);
const extraHash = extraRaw ? createHash('sha256').update(extraRaw).digest('hex').slice(0, 16) : '';
const withExtra = (set: readonly Row[]) => [...set, ...extraRows];

// Fields the model is asked about at run time: the rules said unknown, or weren't sure.
const askable = (row: Row) => !row.info.verdict[0].startsWith('skip:') && (row.info.verdict[0] === 'unknown' || row.info.verdict[1] < THRESHOLDS.medium);

function featureSet(info: FieldInfo, exclude: readonly string[]): number[] {
  return featuresOf(info).filter(f => !exclude.some(prefix => f.startsWith(prefix))).map(f => hashFeature(f, HASH_BITS));
}

interface Prepared { examples: Example[]; columns: Map<number, number> }
function prepare(trainSet: readonly Row[], exclude: readonly string[], seed: number): Prepared {
  const r = rng(seed);
  const expanded = trainSet.flatMap(row => [{ row, info: row.info }, ...(extraSet.has(row) ? [] : augment(row.info, row.expect, r, VARIANTS).map(info => ({ row, info })))]);
  const hashed = expanded.map(({ row, info }) => ({ row, buckets: featureSet(info, exclude) }));
  const counts = new Map<number, number>();
  for (const { buckets } of hashed) for (const b of new Set(buckets)) counts.set(b, (counts.get(b) ?? 0) + 1);
  const columns = new Map<number, number>();
  for (const [b, c] of counts) if (c >= MIN_COUNT) columns.set(b, columns.size);
  // Inverse-frequency class weights, capped, so rare types count and common ones don't dominate.
  const freq = new Map<string, number>();
  const labelled = trainSet.filter(row => !extraSet.has(row));
  for (const row of labelled) freq.set(row.expect, (freq.get(row.expect) ?? 0) + 1);
  const mean = labelled.length / freq.size;
  const classWeight = (name: string) => Math.min(CLASS_WEIGHT_CAP, Math.max(1 / CLASS_WEIGHT_CAP, mean / (freq.get(name) ?? mean)));
  // An original field and its variants weigh as much together as two fields.
  const examples = hashed.map(({ row, buckets }, i) => ({ cols: toCols(buckets, columns), y: classIndex.get(row.expect)!, weight: classWeight(row.expect) * (extraSet.has(row) ? EXTRA_WEIGHT : expanded[i].info === row.info ? 1 : 1 / VARIANTS) }));
  return { examples, columns };
}
const toCols = (buckets: readonly number[], columns: Map<number, number>) => Int32Array.from(new Set(buckets.flatMap(b => columns.has(b) ? [columns.get(b)!] : [])));
const examplesFor = (set: readonly Row[], columns: Map<number, number>, exclude: readonly string[]): Example[] => set.map(row => ({ cols: toCols(featureSet(row.info, exclude), columns), y: classIndex.get(row.expect)!, weight: 1 }));

// --- Settings by 5-fold group cross-validation on the training pages ---
const trainPages = random.shuffle([...new Set(trainRows.map(row => row.page))]);
const folds = Array.from({ length: 5 }, (_, f) => new Set(trainPages.filter((_, i) => i % 5 === f)));
const GRID: Array<{ settings: Settings; exclude: string[] }> = [];
for (const l1 of [1.5, 4, 8, 16]) for (const alpha of [0.3]) for (const exclude of [[]]) GRID.push({ settings: { alpha, beta: 1, l1, l2: 1, epochs: 12, seed: SEED }, exclude });

function cvLoss({ settings, exclude }: (typeof GRID)[number]): number {
  let total = 0;
  for (const fold of folds) {
    const inner = trainRows.filter(row => !fold.has(row.page)), held = trainRows.filter(row => fold.has(row.page));
    const { examples, columns } = prepare(withExtra(inner), exclude, SEED);
    const heldOut = examplesFor(held, columns, exclude);
    total += train(examples, columns.size, K, settings, heldOut).validLoss;
  }
  return total / folds.length;
}

const started = Date.now();
// SKIP_CV=1 reuses the last chosen setting instead of searching again.
const grid = process.env.SKIP_CV ? [{ ...GRID.find(g => g.settings.l1 === Number(process.env.L1 || 8))!, loss: NaN }] : GRID.map(option => ({ ...option, loss: cvLoss(option) }));
grid.sort((a, b) => a.loss - b.loss);
const chosen = grid[0];
console.log('cross-validation:', grid.map(g => `l1=${g.settings.l1} α=${g.settings.alpha}${g.exclude.length ? ' no-rule' : ''}: ${g.loss.toFixed(3)}`).join(' | '));

// --- Final fit on the training pages, stopped on the validation pages ---
const { examples, columns } = prepare(withExtra(trainRows), chosen.exclude, SEED);
const valid = examplesFor(validRows, columns, chosen.exclude);
const fitted = train(examples, columns.size, K, { ...chosen.settings, epochs: 30 }, valid);

// --- Calibration: temperature, then the lowest threshold that keeps precision on answers ---
let temperature = 1, bestLoss = Infinity;
for (let t = 0.5; t <= 3.01; t += 0.05) { const loss = logLoss(fitted.weights, valid, K, t); if (loss < bestLoss) { bestLoss = loss; temperature = +t.toFixed(2); } }
const opinions = validRows.map((row, i) => {
  const p = softmax(scores(fitted.weights, valid[i].cols, K), temperature);
  const order = [...p.keys()].sort((a, b) => p[b] - p[a]);
  return { row, type: classes[order[0]], p: p[order[0]], lead: p[order[0]] - p[order[1]] };
});
const asked = opinions.filter(o => askable(o.row));
function answered(threshold: number, margin: number) { return asked.filter(o => o.type !== 'unknown' && o.p >= threshold && o.lead >= margin); }
let threshold = 0.95, margin = 0.2;
let bestGain = -1;
for (let t = 0.3; t <= 0.951; t += 0.05) for (const m of [0, 0.1, 0.2, 0.3]) {
  const answers = answered(t, m);
  const right = answers.filter(o => o.type === o.row.expect).length;
  if (!answers.length || right / answers.length < TARGET_PRECISION) continue;
  // Gain: fields recovered from unknown, minus rule answers it would overturn wrongly.
  const gain = answers.reduce((sum, o) => sum + (o.type === o.row.expect ? 1 : 0) - (o.row.info.verdict[0] === o.row.expect ? 1 : 0), 0);
  if (gain > bestGain) { bestGain = gain; threshold = +t.toFixed(2); margin = m; }
}

// Replacing a weak rule answer: the lowest probability at which replacements gain more than they lose.
const ruleGuess = (row: Row) => row.info.verdict[1] >= THRESHOLDS.low ? row.info.verdict[0] : 'unknown';
let override = 1, bestOverride = 0;
for (let t = 0.7; t <= 0.991; t += 0.01) {
  const replaced = asked.filter(o => ruleGuess(o.row) !== 'unknown' && o.type !== 'unknown' && o.type !== ruleGuess(o.row) && o.p >= t && o.lead >= margin);
  const gain = replaced.reduce((sum, o) => sum + (o.type === o.row.expect ? 1 : 0) - (ruleGuess(o.row) === o.row.expect ? 1 : 0), 0);
  if (gain > bestOverride) { bestOverride = gain; override = +t.toFixed(2); }
}

// --- Pack: drop zeros, quantize to 8 bits with one scale per class ---
const D = columns.size;
const scale = Array.from({ length: K }, (_, k) => { let max = 0; for (let c = 0; c < D; c++) max = Math.max(max, Math.abs(fitted.weights[c * K + k])); return max / 127 || 1; });
const bucketOf = new Map([...columns].map(([bucket, col]) => [col, bucket]));
const biasCol = columns.get(hashFeature('bias', HASH_BITS));
// Small weights are dropped until the file fits the size budget.
// The model ships inside the engine bundle; MAX_KB lets a round try a bigger one.
const MAX_BYTES = Number(process.env.MAX_KB || 150) * 1024;
function pack(cutoff: number): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (let c = 0; c < D; c++) {
    if (c === biasCol) continue;
    const row: number[] = [];
    for (let k = 0; k < K; k++) { const q = Math.round(fitted.weights[c * K + k] / scale[k]); if (Math.abs(q) >= cutoff) row.push(k, q); }
    if (row.length) out[bucketOf.get(c)!] = row;
  }
  return out;
}
let cutoff = 1, weights = pack(cutoff);
while (JSON.stringify(weights).length > MAX_BYTES - 4096 && cutoff < 64) weights = pack(++cutoff);
const bias = Array.from({ length: K }, (_, k) => biasCol === undefined ? 0 : +fitted.weights[biasCol * K + k].toFixed(4));
const model: PackedModel & { dataset: string; realDataset?: string } = { version: VERSION, hashBits: HASH_BITS, classes, bias, scale: scale.map(s => +s.toPrecision(5)), weights, temperature, threshold, margin, override, exclude: chosen.exclude, dataset: datasetHash, ...(realHash ? { realDataset: realHash } : {}) };
const json = JSON.stringify(model);

// The packed model must agree with the full-precision one.
const { predict, answer } = await import('../../src/fill/model');
let agree = 0;
validRows.forEach((row, i) => { const full = opinions[i]; const packed = predict(model, featuresOf(row.info)); if (packed?.type === full.type) agree++; });

// --- Report against the rules alone, on the validation pages ---
const rulesType = (row: Row) => row.info.verdict[1] >= THRESHOLDS.low ? row.info.verdict[0] : 'unknown';
const withModel = (row: Row) => { if (!askable(row)) return rulesType(row); const t = answer(model, predict(model, featuresOf(row.info)), ruleGuess(row)); return t ?? rulesType(row); };
function f1(predictions: string[], set: readonly Row[]) {
  const typed = set.filter((_, i) => predictions[i] !== 'unknown'), right = set.filter((row, i) => predictions[i] !== 'unknown' && predictions[i] === row.expect).length;
  const expected = set.filter(row => row.expect !== 'unknown').length;
  const P = right / Math.max(1, typed.length), R = right / Math.max(1, expected);
  return { P, R, F: 2 * P * R / Math.max(1e-9, P + R) };
}
const rulesScore = f1(validRows.map(rulesType), validRows), modelScore = f1(validRows.map(withModel), validRows);
const missed = validRows.filter(row => row.expect !== 'unknown' && rulesType(row) === 'unknown');
const recovered = missed.filter(row => withModel(row) === row.expect).length;
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const answers = answered(threshold, margin);

const top1 = opinions.filter(o => o.type === o.row.expect).length / opinions.length;
console.log(`l1 ${chosen.settings.l1}, size ${(json.length / 1024).toFixed(0)} KB, cutoff ${cutoff}, packed agreement ${pct(agree / validRows.length)}; pages ${new Set(trainRows.map(r => r.page)).size}, fields ${trainRows.length}${extraRows.length ? ` + ${extraRows.length} extra ×${EXTRA_WEIGHT}` : ''}: validation log-loss ${logLoss(fitted.weights, valid, K, temperature).toFixed(3)}, top-1 ${pct(top1)}, asked top-1 ${pct(asked.filter(o => o.type === o.row.expect).length / asked.length)}, F1 rules ${pct(rulesScore.F)} → model ${pct(modelScore.F)}`);
if (process.env.DRY) process.exit(0);
writeFileSync(resolve('src/fill/model.json'), json + '\n');
// Which pages were held out, so the whole-engine evaluation can score the same pages.
writeFileSync(SPLIT, JSON.stringify({ seed: SEED, validation: [...validPages].sort(), training: pages.filter(page => !validPages.has(page)).sort() }, null, 1) + '\n');
const card = `# Second-opinion model

Generated by \`npm run train\` on ${new Date().toISOString().slice(0, 10)}. Don't edit by hand.

| | |
| --- | --- |
| Version | ${VERSION} |
| Dataset | \`benchmark/model/dataset.jsonl\` (hash \`${datasetHash}\`)${realHash ? ` and the real-form rows kept outside the repo (hash \`${realHash}\`)` : ''}, ${rows.length} fields from ${pages.length} pages |
| Sources | ${Object.entries(rows.reduce((acc, r) => ({ ...acc, [r.source]: (acc[r.source] ?? 0) + 1 }), {} as Record<string, number>)).map(([s, n]) => `${s} ${n}`).join(', ')} |
| Languages | ${Object.entries(rows.reduce((acc, r) => ({ ...acc, [r.lang]: (acc[r.lang] ?? 0) + 1 }), {} as Record<string, number>)).map(([s, n]) => `${s} ${n}`).join(', ')} |
${extraRows.length ? `| Extra training rows | ${extraRows.length} from \`${EXTRA.replace(process.env.HOME || '~', '~')}\` (hash \`${extraHash}\`), ${Object.entries(extraRows.reduce((acc, r) => ({ ...acc, [r.source]: (acc[r.source] ?? 0) + 1 }), {} as Record<string, number>)).map(([s, n]) => `${s} ${n}`).join(', ')}; each weighs ${EXTRA_WEIGHT} of a field, not reworded, never validated on |\n` : ''}| Split | ${pages.length - validPages.size} training pages (${trainRows.length} fields, ×${VARIANTS} rewordings), ${validPages.size} validation pages (${validRows.length} fields), by page, stratified by language and source |
| Classes | ${K} (${classes.length - 1} types and unknown; sensitive labels are not in the data) |
| Model | softmax regression, FTRL-Proximal, l1 ${chosen.settings.l1}, l2 ${chosen.settings.l2}, α ${chosen.settings.alpha}, ${fitted.epochs} epochs, seed ${SEED}${chosen.exclude.length ? `, without ${chosen.exclude.join(', ')} features` : ''} |
| Calibration | temperature ${temperature}; answers when p ≥ ${threshold} and leads by ≥ ${margin}, replaces a weak rule answer only when p ≥ ${override === 1 ? 'never' : override} (gain ${bestOverride} on validation); confidence capped at ${MODEL_CONFIDENCE_CAP} |
| Size | ${(json.length / 1024).toFixed(0)} KB, ${Object.keys(weights).length} buckets; weights under ${cutoff}/127 of a class's largest dropped; packed agrees with full precision on ${pct(agree / validRows.length)} of validation fields |

## Validation pages (never trained on)

| | Precision | Recall | F1 |
| --- | --- | --- | --- |
| Rules alone (first pass) | ${pct(rulesScore.P)} | ${pct(rulesScore.R)} | ${pct(rulesScore.F)} |
| Rules + model | ${pct(modelScore.P)} | ${pct(modelScore.R)} | ${pct(modelScore.F)} |

Fields the rules left unknown: ${missed.length}; the model recovers ${recovered}. It answers ${answers.length} of the ${asked.length} fields it is asked about, ${pct(answers.filter(o => o.type === o.row.expect).length / Math.max(1, answers.length))} of them right.

Cross-validation log-loss by setting: ${grid.map(g => `l1 ${g.settings.l1}, α ${g.settings.alpha}${g.exclude.length ? ', no rule features' : ''}: ${g.loss.toFixed(3)}`).join('; ')}.

These are first-pass numbers. The sealed-set result, measured with the whole engine in Chromium, is in benchmark/README.md.
`;
writeFileSync(resolve('benchmark/MODEL.md'), card);
console.log(card);
console.log(`trained in ${((Date.now() - started) / 1000).toFixed(0)} s`);
