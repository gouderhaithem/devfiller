import { test, expect, type Page } from '@playwright/test';
import { build } from 'esbuild';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fields, generateIdentities, generatePhones, generateValues, defaultExclusions } from '../src/data';
import { generateSamples } from '../src/samples';
import type { FillRequest, FillResult } from '../src/engine';
import { calibration, regressions, score, type Baseline, type Current, type Pair } from './metrics';
import { formatReport, type FixtureScore, type PerfResult, type RunExtras } from './report';
import { variantCases } from './variants';
import { WIDGET_SELECTOR } from '../src/fill/widgets';

// The benchmark injects the same bundle the extension ships, built straight from source.
// BENCHMARK_ENTRY swaps in another engine entry, to compare engines on the same fixtures.
const ENGINE_ENTRY = resolve(process.env.BENCHMARK_ENTRY || 'benchmark/engine-entry.ts');
const FIXTURES = resolve('benchmark/fixtures');
const BLANK = pathToFileURL(resolve('benchmark/blank.html')).href;
const BASELINE = resolve('benchmark/baseline.json');
const RESULTS = resolve('benchmark/results');
const UPDATE = process.env.BENCHMARK_UPDATE === '1';
const PERF_TARGETS: Array<[number, number]> = [[50, 50], [100, 100], [500, 200], [1000, 200]];
// Leaks count these. `skip:session` (remember me) is skipped too, but it isn't private data.
const SENSITIVE = ['skip:card', 'skip:otp', 'skip:iban', 'skip:consent'];
const ALLOWED = new Set<string>([...fields.map(([key]) => key), 'unknown', ...SENSITIVE, 'skip:session']);
const OMITTED = ['hidden', 'submit', 'button', 'reset', 'image', 'file'];

type Engine = { fillPage: (request: FillRequest) => FillResult; revalidate: () => { retried: number }; fillWidgets: (request: FillRequest) => Promise<unknown> };
interface ControlInfo { index: number; expect: string | null; omitted: boolean; html: string; widget?: boolean }
interface ControlState { value: string; checked: boolean }

const values = generateValues('en');
const base: FillRequest = { values, identities: generateIdentities('en'), samples: generateSamples('en'), phones: generatePhones(), custom: [], overwrite: true, fillUnknown: true, passwords: false, exclusions: defaultExclusions };
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
  return page.evaluate(({ omitted, widgets }): ControlInfo[] => [
    ...Array.from(document.querySelectorAll('input, textarea, select'), (el, index) => ({
      index, expect: el.getAttribute('data-expect'), omitted: el instanceof HTMLInputElement && omitted.includes(el.type), html: el.outerHTML.slice(0, 140),
    })),
    // Custom widgets are scored the same way, indexed among the widgets.
    ...Array.from(document.querySelectorAll(widgets), (el, index) => ({ index, expect: el.getAttribute('data-expect'), omitted: !el.hasAttribute('data-expect'), html: el.outerHTML.slice(0, 140), widget: true })),
  ], { omitted: OMITTED, widgets: WIDGET_SELECTOR });
}

function readStates(page: Page, controls: ControlInfo[]) {
  return page.evaluate(({ wanted, widgets }): ControlState[] => {
    const natives = document.querySelectorAll<HTMLInputElement>('input, textarea, select');
    const custom = document.querySelectorAll<HTMLElement>(widgets);
    return wanted.map(([i, widget]) => widget ? { value: custom[i].textContent || '', checked: custom[i].getAttribute('aria-checked') === 'true' } : { value: natives[i].value, checked: !!natives[i].checked });
  }, { wanted: controls.map(control => [control.index, !!control.widget] as [number, boolean]), widgets: WIDGET_SELECTOR });
}

async function classifyFixture(page: Page, name: string, controls: ControlInfo[]) {
  const result = await runEngine(page, { ...base, mode: 'classify' });
  const forms = await formTypes(page, result);
  const predicted = new Map((result.classified ?? []).map(field => [field.index, field]));
  const predictedWidgets = new Map((result.widgets ?? []).map(field => [field.index, field]));
  const pairs: Pair[] = [];
  for (const control of controls) {
    if (control.omitted) continue;
    expect(control.expect, `${name}: control needs data-expect: ${control.html}`).not.toBeNull();
    expect(ALLOWED.has(control.expect!), `${name}: unknown data-expect "${control.expect}"`).toBe(true);
    const answers = control.widget ? predictedWidgets : predicted;
    expect(answers.has(control.index), `${name}: engine did not classify ${control.html}`).toBe(true);
    const answer = answers.get(control.index)!;
    pairs.push({ fixture: name, index: control.index, expected: control.expect!, predicted: answer.type, confidence: answer.confidence, html: control.html });
  }
  return { pairs, forms };
}

async function findLeaks(page: Page, url: string, name: string, controls: ControlInfo[]) {
  const sensitive = controls.filter(control => SENSITIVE.includes(control.expect ?? ''));
  const leaks: RunExtras['leaks'] = [];
  let submits = 0;
  let relations: Relation[] = [];
  for (const settings of FILL_SETTINGS) {
    await openWithEngine(page, url);
    const before = await readStates(page, sensitive);
    await runEngine(page, settings);
    await page.evaluate(req => (globalThis as unknown as { __devfiller: Engine }).__devfiller.fillWidgets(req), settings);
    // What the extension does after a fill: let the page validate, then retry rejected values.
    await page.evaluate(async () => {
      const engine = (globalThis as unknown as { __devfiller: Engine }).__devfiller;
      for (let round = 0; round < 4; round++) { await new Promise(resolve => setTimeout(resolve, 30)); if (!engine.revalidate().retried) break; }
    });
    const after = await readStates(page, sensitive);
    sensitive.forEach((control, i) => {
      const changed = before[i].value !== after[i].value || before[i].checked !== after[i].checked;
      if (changed && !leaks.some(leak => leak.control === control.html)) leaks.push({ fixture: name, expected: control.expect!, control: control.html });
    });
    submits += await page.evaluate(() => (globalThis as typeof globalThis & { __submits: number }).__submits);
    // Relationships are checked after the fill with every filler on (passwords included).
    relations = await checkRelations(page, name);
  }
  return { leaks, submits, relations };
}

interface Relation { kind: string; ok: boolean; detail: string }
function checkRelations(page: Page, fixture: string): Promise<Relation[]> {
  return page.evaluate(name => {
    const read = (el: Element | null) => el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement ? el.value : (el?.textContent ?? '').trim();
    const describe = (el: Element) => `${name}: ${el.outerHTML.slice(0, 100)}`;
    const checks: Array<[string, string, (a: string, b: string) => boolean]> = [
      ['data-same-as', 'confirmation', (a, b) => !!a && a === b],
      ['data-after', 'end after start', (a, b) => !!a && !!b && a > b],
      ['data-differs-from', 'new differs', (a, b) => !!a && !!b && a !== b],
    ];
    const pairs = checks.flatMap(([attribute, kind, test]) => Array.from(document.querySelectorAll(`[${attribute}]`), el => {
      const other = document.querySelector(el.getAttribute(attribute)!);
      return { kind, ok: test(read(el), read(other)), detail: `${describe(el)} → "${read(el)}" vs "${read(other)}"` };
    }));
    // Phone formats: +213 for Algeria, +33 for France, +1 for the United States.
    const prefix: Record<string, string> = { dz: '+213', fr: '+33', us: '+1 ' };
    const countryRegion = (text: string) => /alg|الجزائر|^dz$/i.test(text) ? 'dz' : /fran|فرنسا|^fr$/i.test(text) ? 'fr' : /united states|usa|états-unis|^us$/i.test(text) ? 'us' : '';
    const phones = [
      ...Array.from(document.querySelectorAll('[data-phone-region]'), el => ({ el, region: el.getAttribute('data-phone-region')! })),
      ...Array.from(document.querySelectorAll('[data-phone-follows]'), el => {
        const country = document.querySelector(el.getAttribute('data-phone-follows')!);
        const text = country instanceof HTMLSelectElement ? country.selectedOptions[0]?.textContent ?? '' : read(country);
        return { el, region: countryRegion(text.trim()) };
      }),
    ].map(({ el, region }) => ({ kind: 'phone follows the form', ok: !!region && read(el).startsWith(prefix[region]), detail: `${describe(el)} → "${read(el)}" for ${region || 'no country'}` }));
    // Whether the page accepts each value written: its own rules and its aria-invalid verdict.
    const accepted = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[data-expect], textarea[data-expect]'))
      .filter(el => !['checkbox', 'radio', 'hidden', 'file'].includes(el.type) && !el.getAttribute('data-expect')!.startsWith('skip:') && el.value)
      .map(el => ({ kind: 'accepted by the page', ok: el.checkValidity() && el.getAttribute('aria-invalid') !== 'true', detail: `${describe(el)} → "${el.value}"` }));
    // The shape of what was written: a number, a code, a decimal comma.
    const shapes = Array.from(document.querySelectorAll('[data-value-pattern]'), el => ({ kind: 'value shape', ok: new RegExp(el.getAttribute('data-value-pattern')!).test(read(el)), detail: `${describe(el)} → "${read(el)}"` }));
    return [...pairs, ...phones, ...shapes, ...accepted];
  }, fixture);
}

function formTypes(page: Page, result: FillResult) {
  return page.evaluate(found => Array.from(document.forms).flatMap((form, index) => {
    const expected = form.getAttribute('data-form-type');
    const predicted = found.find(f => f.index === index)?.type ?? 'other';
    return expected ? [{ expected, predicted, action: form.getAttribute('action') || '' }] : [];
  }), result.forms ?? []);
}

// A seed gives the same data on every run: fill twice after reloading, then once more on the same
// page with replacement on. All three must match.
async function seededRepeat(page: Page, url: string, name: string): Promise<Relation> {
  const seeded: FillRequest = { ...base, seed: 'benchmark', values: generateValues('en', { seed: 'benchmark' }), phones: generatePhones('benchmark') };
  const snapshot = () => page.evaluate(() => Array.from(document.querySelectorAll<HTMLInputElement>('input, select, textarea'), el => ['radio', 'checkbox'].includes(el.type) ? String(el.checked) : el.value).join('\u0001'));
  await openWithEngine(page, url);
  await runEngine(page, seeded);
  const first = await snapshot();
  await openWithEngine(page, url);
  await runEngine(page, seeded);
  const second = await snapshot();
  await runEngine(page, seeded);
  const third = await snapshot();
  return { kind: 'seeded repeat', ok: first === second && second === third, detail: `${name}: ${first === second ? 'a refill on the same page changed values' : 'a new page load changed values'}` };
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
  const relations: Relation[] = [];
  const formChecks: Array<{ fixture: string; expected: string; predicted: string; action: string }> = [];
  const holdoutForms: typeof formChecks = [];
  const holdoutRelations: Relation[] = [];
  const fixtures: FixtureScore[] = [];
  const leaks: RunExtras['leaks'] = [];
  let submits = 0;
  for (const name of [...names, ...regressionNames, ...holdoutNames]) {
    const url = pathToFileURL(resolve(FIXTURES, name)).href;
    await openWithEngine(page, url);
    const controls = await describeControls(page);
    const { pairs: fixturePairs, forms } = await classifyFixture(page, name, controls);
    const holdout = holdoutNames.includes(name);
    (holdout ? holdoutForms : formChecks).push(...forms.map(form => ({ fixture: name, ...form })));
    if (holdout) holdoutPairs.push(...fixturePairs); else pairs.push(...fixturePairs);
    if (!holdout) fixtures.push({ fixture: name, fields: fixturePairs.length, correct: fixturePairs.filter(p => p.expected === p.predicted).length });
    const found = await findLeaks(page, url, name, controls);
    leaks.push(...found.leaks);
    submits += found.submits;
    (holdout ? holdoutRelations : relations).push(...found.relations, await seededRepeat(page, url, name));
  }
  const variants = await runVariants(page);
  const perf = await runPerf(page);
  const metrics = score(pairs);
  const relationTally = Object.fromEntries([...new Set(relations.map(r => r.kind))].map(kind => [kind, { correct: relations.filter(r => r.kind === kind && r.ok).length, total: relations.filter(r => r.kind === kind).length }]));
  const formTally = { correct: formChecks.filter(f => f.expected === f.predicted).length, total: formChecks.length };
  const current: Current = { summary: metrics.summary, types: metrics.types, leaks: leaks.length, variants: { correct: variants.correct, total: variants.total }, submits, requests, relations: relationTally, forms: formTally };
  const baseline = await readBaseline();
  const problems = regressions(current, UPDATE ? undefined : baseline);
  const bands = [['high', 0.9], ['medium', 0.7], ['low', 0.5]] as const;
  const held = holdoutPairs.length ? { fixtures: holdoutNames.length, summary: score(holdoutPairs).summary, confusions: score(holdoutPairs).confusions,
    forms: { correct: holdoutForms.filter(f => f.expected === f.predicted).length, total: holdoutForms.length }, relations: { correct: holdoutRelations.filter(r => r.ok).length, total: holdoutRelations.length } } : undefined;
  const report = formatReport(metrics, { fixtures, leaks, submits, requests, variants, perf, calibration: calibration(pairs, bands), holdout: held, problems,
    relations: relationTally, relationFailures: relations.filter(r => !r.ok).map(r => `${r.kind}: ${r.detail}`),
    forms: { ...formTally, mistakes: formChecks.filter(f => f.expected !== f.predicted).map(f => `${f.fixture} ${f.action}: expected ${f.expected}, got ${f.predicted}`) } });
  await mkdir(RESULTS, { recursive: true });
  await writeFile(resolve(RESULTS, 'latest.md'), `# Benchmark run\n\n${report}\n`);
  await writeFile(resolve(RESULTS, 'latest.json'), JSON.stringify({ ...current, perf, mistakes: pairs.filter(p => p.expected !== p.predicted), holdoutMistakes: holdoutPairs.filter(p => p.expected !== p.predicted) }, null, 2));
  if (UPDATE) await writeFile(BASELINE, `${JSON.stringify({ summary: current.summary, types: current.types, leaks: current.leaks, variants: current.variants, relations: current.relations, forms: current.forms }, null, 2)}\n`);
  console.log(`\n${report}\n`);
  expect(problems, problems.join('\n')).toEqual([]);
});
