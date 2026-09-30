import { test, expect, type Page } from '@playwright/test';
import { build } from 'esbuild';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fields, generateIdentities, generateValues, defaultExclusions } from '../src/data';
import { generateSamples } from '../src/samples';
import type { FillRequest, FillResult } from '../src/engine';
import { calibration, regressions, score, type Baseline, type Current, type Pair } from './metrics';
import { formatReport, type FixtureScore, type PerfResult, type RunExtras } from './report';
import { variantCases } from './variants';

// The benchmark injects the same bundle the extension ships, built straight from source.
// BENCHMARK_ENTRY swaps in another engine entry, to compare engines on the same fixtures.
const ENGINE_ENTRY = resolve(process.env.BENCHMARK_ENTRY || 'benchmark/engine-entry.ts');
const FIXTURES = resolve('benchmark/fixtures');
const BLANK = pathToFileURL(resolve('benchmark/blank.html')).href;
const BASELINE = resolve('benchmark/baseline.json');
const RESULTS = resolve('benchmark/results');
const UPDATE = process.env.BENCHMARK_UPDATE === '1';
const PERF_TARGETS: Array<[number, number]> = [[50, 50], [100, 100], [500, 200], [1000, 200]];
const SENSITIVE = ['skip:card', 'skip:otp', 'skip:iban', 'skip:consent'];
const ALLOWED = new Set<string>([...fields.map(([key]) => key), 'unknown', ...SENSITIVE]);
const OMITTED = ['hidden', 'submit', 'button', 'reset', 'image', 'file'];

type Engine = { fillPage: (request: FillRequest) => FillResult };
interface ControlInfo { index: number; expect: string | null; omitted: boolean; html: string }
interface ControlState { value: string; checked: boolean }

const values = generateValues('en');
const base: FillRequest = { values, identities: generateIdentities('en'), samples: generateSamples('en'), custom: [], overwrite: true, fillUnknown: true, passwords: false, exclusions: defaultExclusions };
// The default settings, then every optional filler switched on: neither may touch a sensitive field.
const FILL_SETTINGS: FillRequest[] = [base, { ...base, passwords: true, exclusions: { skipSearch: false, skipHeader: false, rules: [] } }];

let engineScript = '';

async function openWithEngine(page: Page, url: string) {
  await page.goto(url);
  await page.addScriptTag({ content: engineScript });
  await page.evaluate(() => {
    // Count submissions from any path: events, form.submit() and requestSubmit().
    const state = globalThis as typeof globalThis & { __submits: number };
    state.__submits = 0;
    document.addEventListener('submit', event => { state.__submits++; event.preventDefault(); }, true);
    for (const method of ['submit', 'requestSubmit'] as const) {
      HTMLFormElement.prototype[method] = function () { state.__submits++; };
    }
  });
}

const runEngine = (page: Page, request: FillRequest) => page.evaluate(req => (globalThis as unknown as { __devfiller: Engine }).__devfiller.fillPage(req), request);

function describeControls(page: Page) {
  return page.evaluate((omitted): ControlInfo[] => Array.from(document.querySelectorAll('input, textarea, select'), (el, index) => ({
    index,
    expect: el.getAttribute('data-expect'),
    omitted: el instanceof HTMLInputElement && omitted.includes(el.type),
    html: el.outerHTML.slice(0, 140),
  })), OMITTED);
}

function readStates(page: Page, indexes: number[]) {
  return page.evaluate((wanted): ControlState[] => {
    const controls = document.querySelectorAll<HTMLInputElement>('input, textarea, select');
    return wanted.map(i => ({ value: controls[i].value, checked: !!controls[i].checked }));
  }, indexes);
}

async function classifyFixture(page: Page, name: string, controls: ControlInfo[]) {
  const result = await runEngine(page, { ...base, mode: 'classify' });
  const predicted = new Map((result.classified ?? []).map(field => [field.index, field]));
  const pairs: Pair[] = [];
  for (const control of controls) {
    if (control.omitted) continue;
    expect(control.expect, `${name}: control needs data-expect: ${control.html}`).not.toBeNull();
    expect(ALLOWED.has(control.expect!), `${name}: unknown data-expect "${control.expect}"`).toBe(true);
    expect(predicted.has(control.index), `${name}: engine did not classify ${control.html}`).toBe(true);
    const answer = predicted.get(control.index)!;
    pairs.push({ fixture: name, index: control.index, expected: control.expect!, predicted: answer.type, confidence: answer.confidence, html: control.html });
  }
  return pairs;
}

async function findLeaks(page: Page, url: string, name: string, controls: ControlInfo[]) {
  const sensitive = controls.filter(control => control.expect?.startsWith('skip:'));
  const leaks: RunExtras['leaks'] = [];
  let submits = 0;
  for (const settings of FILL_SETTINGS) {
    await openWithEngine(page, url);
    const before = await readStates(page, sensitive.map(control => control.index));
    await runEngine(page, settings);
    const after = await readStates(page, sensitive.map(control => control.index));
    sensitive.forEach((control, i) => {
      const changed = before[i].value !== after[i].value || before[i].checked !== after[i].checked;
      if (changed && !leaks.some(leak => leak.control === control.html)) leaks.push({ fixture: name, expected: control.expect!, control: control.html });
    });
    submits += await page.evaluate(() => (globalThis as typeof globalThis & { __submits: number }).__submits);
  }
  return { leaks, submits };
}

async function runVariants(page: Page) {
  const cases = variantCases();
  await openWithEngine(page, BLANK);
  await page.evaluate(names => {
    const form = document.createElement('form');
    for (const name of names) { const input = document.createElement('input'); input.name = name; form.append(input); }
    document.body.replaceChildren(form);
  }, cases.map(c => c.name));
  const result = await runEngine(page, { ...base, mode: 'classify' });
  const types = (result.classified ?? []).map(field => field.type);
  const failures = cases.map((c, i) => ({ name: c.name, expect: c.expect, predicted: types[i] })).filter(c => c.predicted !== c.expect);
  return { correct: cases.length - failures.length, total: cases.length, failures };
}

// A realistic mix of labelled, named and bare controls, repeated to the requested size.
async function buildLargeForm(page: Page, size: number) {
  await page.evaluate(count => {
    const templates = [
      (i: number) => `<label for="f${i}">First name</label><input id="f${i}" name="first_${i}">`,
      (i: number) => `<label>Email address<input type="email" name="email_${i}"></label>`,
      (i: number) => `<input name="phoneNumber${i}" placeholder="Phone">`,
      (i: number) => `<label for="f${i}">Numéro de téléphone</label><input id="f${i}" name="field_${i}">`,
      (i: number) => `<input aria-label="المدينة" name="c${i}">`,
      (i: number) => `<select name="country_${i}"><option>France</option><option>Algeria</option></select>`,
      (i: number) => `<textarea name="message_${i}"></textarea>`,
      (i: number) => `<input type="number" name="quantity_${i}" min="1" max="9">`,
      (i: number) => `<input type="date" name="start_date_${i}">`,
      (i: number) => `<input name="field${i}">`,
    ];
    document.body.innerHTML = `<form>${Array.from({ length: count }, (_, i) => templates[i % templates.length](i)).join('')}</form>`;
  }, size);
}

async function measure(page: Page, request: FillRequest, runs: number) {
  const times = await page.evaluate(({ req, n }) => {
    const engine = (globalThis as unknown as { __devfiller: Engine }).__devfiller;
    return Array.from({ length: n }, () => { const start = performance.now(); engine.fillPage(req); return performance.now() - start; });
  }, { req: request, n: runs });
  return times.sort((a, b) => a - b)[Math.floor(times.length / 2)];
}

async function runPerf(page: Page): Promise<PerfResult[]> {
  const results: PerfResult[] = [];
  for (const [size, targetMs] of PERF_TARGETS) {
    await openWithEngine(page, BLANK);
    await buildLargeForm(page, size);
    const classifyMs = await measure(page, { ...base, mode: 'classify' }, 5);
    const fillMs = await measure(page, base, 3);
    results.push({ fields: size, classifyMs, fillMs, targetMs });
  }
  return results;
}

async function readBaseline(): Promise<Baseline | undefined> {
  try { return JSON.parse(await readFile(BASELINE, 'utf8')) as Baseline; } catch { return undefined; }
}

test.beforeAll(async () => {
  const bundle = await build({ entryPoints: [ENGINE_ENTRY], bundle: true, format: 'iife', write: false, target: 'chrome118', logLevel: 'silent' });
  engineScript = bundle.outputFiles[0].text;
});

test('fill engine benchmark', async ({ page }) => {
  let requests = 0;
  page.on('request', request => { if (!/^(file|data|about):/.test(request.url())) requests++; });
  const names = (await readdir(FIXTURES)).filter(name => name.endsWith('.html')).sort();
  const folder = async (dir: string) => (await readdir(resolve(FIXTURES, dir)).catch(() => [] as string[])).filter(name => name.endsWith('.html')).sort().map(name => `${dir}/${name}`);
  const regressionNames = await folder('regressions');
  const holdoutNames = await folder('holdout');
  const pairs: Pair[] = [];
  const holdoutPairs: Pair[] = [];
  const fixtures: FixtureScore[] = [];
  const leaks: RunExtras['leaks'] = [];
  let submits = 0;
  for (const name of [...names, ...regressionNames, ...holdoutNames]) {
    const url = pathToFileURL(resolve(FIXTURES, name)).href;
    await openWithEngine(page, url);
    const controls = await describeControls(page);
    const fixturePairs = await classifyFixture(page, name, controls);
    if (holdoutNames.includes(name)) { holdoutPairs.push(...fixturePairs); } else { pairs.push(...fixturePairs); }
    if (!holdoutNames.includes(name)) fixtures.push({ fixture: name, fields: fixturePairs.length, correct: fixturePairs.filter(p => p.expected === p.predicted).length });
    const found = await findLeaks(page, url, name, controls);
    leaks.push(...found.leaks);
    submits += found.submits;
  }
  const variants = await runVariants(page);
  const perf = await runPerf(page);
  const metrics = score(pairs);
  const current: Current = { summary: metrics.summary, types: metrics.types, leaks: leaks.length, variants: { correct: variants.correct, total: variants.total }, submits, requests };
  const baseline = await readBaseline();
  const problems = regressions(current, UPDATE ? undefined : baseline);
  const bands = [['high', 0.9], ['medium', 0.7], ['low', 0.5]] as const;
  const held = holdoutPairs.length ? { fixtures: holdoutNames.length, summary: score(holdoutPairs).summary, confusions: score(holdoutPairs).confusions } : undefined;
  const report = formatReport(metrics, { fixtures, leaks, submits, requests, variants, perf, calibration: calibration(pairs, bands), holdout: held, problems });
  await mkdir(RESULTS, { recursive: true });
  await writeFile(resolve(RESULTS, 'latest.md'), `# Benchmark run\n\n${report}\n`);
  await writeFile(resolve(RESULTS, 'latest.json'), JSON.stringify({ ...current, perf, mistakes: pairs.filter(p => p.expected !== p.predicted), holdoutMistakes: holdoutPairs.filter(p => p.expected !== p.predicted) }, null, 2));
  if (UPDATE) await writeFile(BASELINE, `${JSON.stringify({ summary: current.summary, types: current.types, leaks: current.leaks, variants: current.variants }, null, 2)}\n`);
  console.log(`\n${report}\n`);
  expect(problems, problems.join('\n')).toEqual([]);
});
