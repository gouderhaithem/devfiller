// npm run model:evaluate -- <folder of labelled pages> [out.json]
// Scores the shipped engine bundle on labelled pages (data-expect), with the model off and on:
// field F1, the fields that changed, and whether a fill touches a sensitive field. Pages load from
// disk with every network request blocked. Used for sealed sets kept outside the repository.
import { chromium, type Page } from 'playwright';
import { isTestValue, TEST_TEXT, testKind } from '../../src/fill/sensitive';
import { fillSummary } from './acceptable';
import { build } from 'esbuild';
import { readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { defaultExclusions, defaults, generateIdentities, generatePhones, generateValues, localizedValues } from '../../src/data';
import { generateSamples } from '../../src/samples';
import type { FillRequest, FillResult } from '../../src/fill';

const [dirArg, outArg] = process.argv.slice(2);
if (!dirArg) { console.error('usage: npm run model:evaluate -- <folder> [out.json]'); process.exit(2); }
const DIR = resolve(dirArg);
const OMITTED = ['hidden', 'submit', 'button', 'reset', 'image', 'file'];
const SENSITIVE = /^skip:(card|otp|iban|consent)$/;
// What a sensitive field may hold after a fill (src/fill/sensitive.ts).
const U = 'unknown';

const base: FillRequest = {
  values: generateValues('en'), identities: generateIdentities('en'), samples: generateSamples('en'), phones: generatePhones(), localized: localizedValues('en'),
  custom: [], overwrite: defaults.overwrite, fillUnknown: defaults.fillUnknown, passwords: true, exclusions: defaultExclusions,
};
interface Pair { page: string; index: number; expected: string; predicted: string; html: string }

async function open(page: Page, url: string, engine: string) {
  await page.goto(url);
  await page.addScriptTag({ content: engine });
  await page.evaluate(() => { document.addEventListener('submit', e => e.preventDefault(), true); for (const m of ['submit', 'requestSubmit'] as const) HTMLFormElement.prototype[m] = function () {}; });
}

async function score(page: Page, name: string, engine: string, modelGuesses: boolean) {
  const url = pathToFileURL(resolve(DIR, name)).href;
  await open(page, url, engine);
  const result = await page.evaluate(r => (globalThis as any).__devfiller.fillPage(r), { ...base, modelGuesses, mode: 'classify' as const }) as FillResult;
  const found = new Map((result.classified ?? []).map(f => [f.index, f.type]));
  const controls = await page.evaluate(omitted => Array.from(document.querySelectorAll('input, textarea, select'), (el, index) => ({ index, expect: el.getAttribute('data-expect'), omit: el instanceof HTMLInputElement && omitted.includes(el.type), html: el.outerHTML.slice(0, 140) })), OMITTED);
  const pairs: Pair[] = controls.filter(c => !c.omit && c.expect).map(c => ({ page: name, index: c.index, expected: c.expect!, predicted: found.get(c.index) ?? U, html: c.html }));
  const unlabelled = controls.filter(c => !c.omit && !c.expect).length;
  // A real fill: did anything sensitive change?
  await open(page, url, engine);
  // `!!checked` on both sides: a select has no `checked`, and undefined against false would read as a change.
  const before = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLInputElement>('input, textarea, select'), el => `${el.value}|${!!el.checked}`));
  await page.evaluate(r => (globalThis as any).__devfiller.fillPage(r), { ...base, modelGuesses });
  // Sensitive fields get test values; a leak is one that got anything else (or a card field, which
  // this run fills with no test card).
  const after = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLInputElement>('input, textarea, select'), el => ({ value: el.value, checked: !!el.checked, expect: el.getAttribute('data-expect') || '', html: el.outerHTML.slice(0, 120), text: el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && !['checkbox', 'radio'].includes(el.type)) })));
  const leaks = after.flatMap((el, i) => {
    if (!SENSITIVE.test(el.expect) || `${el.value}|${el.checked}` === before[i]) return [];
    const kind = testKind(el.expect);
    const ok = kind === 'consent' || kind === 'session' ? !el.text || el.value === TEST_TEXT || el.value === before[i].split('|')[0] : !!kind && isTestValue(kind, el.value);
    return ok ? [] : [el.html];
  });
  return { pairs, unlabelled, leaks };
}

function summary(pairs: readonly Pair[]) {
  const typed = pairs.filter(p => p.predicted !== U), expected = pairs.filter(p => p.expected !== U);
  const right = typed.filter(p => p.predicted === p.expected).length;
  const P = right / Math.max(1, typed.length), R = right / Math.max(1, expected.length);
  return { fields: pairs.length, precision: P, recall: R, f1: 2 * P * R / Math.max(1e-9, P + R), missed: expected.filter(p => p.predicted === U).length, wrong: typed.length - right, fill: fillSummary(pairs) };
}

const engine = (await build({ entryPoints: [resolve('benchmark/engine-entry.ts')], bundle: true, write: false, format: 'iife', target: 'chrome118', loader: { '.json': 'json' } })).outputFiles[0].text;
const browser = await chromium.launch();
const context = await browser.newContext();
await context.route(url => !url.protocol.startsWith('file'), route => route.abort());
const page = await context.newPage();
const files = readdirSync(DIR).filter(name => name.endsWith('.html')).sort();
const runs = { rules: [] as Pair[], model: [] as Pair[] };
const leaks = { rules: [] as string[], model: [] as string[] };
let unlabelled = 0;
for (const name of files) {
  for (const side of ['rules', 'model'] as const) {
    const r = await score(page, name, engine, side === 'model');
    runs[side].push(...r.pairs);
    leaks[side].push(...r.leaks.map(l => `${name}: ${l}`));
    if (side === 'rules') unlabelled += r.unlabelled;
  }
}
await browser.close();
const changed = runs.model.flatMap((p, i) => { const o = runs.rules[i]; return o.predicted !== p.predicted ? [{ page: p.page, expected: p.expected, rules: o.predicted, model: p.predicted, better: p.predicted === p.expected, worse: o.predicted === o.expected, html: p.html }] : []; });
const report = { folder: DIR, pages: files.length, unlabelled, rules: summary(runs.rules), model: summary(runs.model), leaks, better: changed.filter(c => c.better).length, worse: changed.filter(c => c.worse).length, changed };
if (outArg) writeFileSync(resolve(outArg), JSON.stringify({ ...report, pairs: runs }, null, 1));
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
console.log(`${files.length} pages, ${runs.rules.length} labelled fields${unlabelled ? `, ${unlabelled} unlabelled` : ''}`);
for (const side of ['rules', 'model'] as const) { const s = report[side]; console.log(`${side.padEnd(6)} precision ${pct(s.precision)}  recall ${pct(s.recall)}  F1 ${pct(s.f1)}  missed ${s.missed}  wrong ${s.wrong}  sensitive filled ${leaks[side].length}`); }
// Strict F1 counts a sentence in a notes box labelled message as wrong; "fine" doesn't (acceptable.ts).
for (const side of ['rules', 'model'] as const) { const f = report[side].fill; console.log(`${side.padEnd(6)} fine fills ${pct(f.fine)}  real mistakes ${f.mistakes}`); }
console.log(`real mistakes with the model: ${report.model.fill.top.map(([pair, n]) => `${pair} ${n}`).join(', ')}`);
console.log(`model vs rules: ${report.better} better, ${report.worse} worse, ${changed.length - report.better - report.worse} changed between two wrong answers`);
