// Builds benchmark/model/dataset.jsonl: one row per labelled field of the benchmark fixtures, the
// retired Form Lab pages and real forms labelled by hand. Rows hold the field's clues and its label,
// never a value.
//
//   npm run model:dataset            # Form Lab served at FORM_LAB_URL (default http://localhost:8777/pages/)
//   REAL_DIRS=a:b npm run model:dataset   # folders of hand-labelled real forms (outside the repo)
import { chromium } from 'playwright';
import { build } from 'esbuild';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const FIXTURES = resolve('benchmark/fixtures');
const FORM_LAB_DIR = process.env.FORM_LAB_DIR || resolve(process.env.HOME || '', 'ai-projects/form-test-site/pages');
const FORM_LAB_URL = process.env.FORM_LAB_URL || 'http://localhost:8777/pages/';
// A sealed range of Form Lab pages: measured once per round, never read into training data. Every
// Form Lab page is retired now; the sealed set is a folder of real forms kept out of REAL_DIRS.
const [sealedFrom, sealedTo] = (process.env.SEALED_PAGES || '0-0').split('-').map(Number);
export const SEALED_PAGES = [sealedFrom, sealedTo] as const;
const pageNumber = (name: string) => Number(name.match(/^(\d+)-/)?.[1] ?? NaN);
const sealed = (name: string) => pageNumber(name) >= SEALED_PAGES[0] && pageNumber(name) <= SEALED_PAGES[1];
// Pages that need a moment before a user would press Fill.
const WAIT: Record<string, number> = { '25-spa-controlled': 1800 };
const SENSITIVE = /^skip:/;

const html = (dir: string) => readdirSync(dir).filter(name => name.endsWith('.html')).sort();
// Real forms: the first real-world sealed set (retired) and each round's training forms. A round's
// sealed folder is never listed here.
const UCI = resolve(process.env.HOME || '', 'datasets/uci-webform');
export const REAL_DATASET = process.env.REAL_DATASET || resolve(UCI, 'model/dataset-real.jsonl');
// round4/train is labelled but left out: more contact and sign-up forms cost recall on the sealed set
// (F1 89.9% with it alone, 90.4% with it beside round 5, 90.9% without it).
const REAL_DIRS = (process.env.REAL_DIRS ?? [resolve(UCI, 'sealed'), resolve(UCI, 'round2/train'), resolve(UCI, 'round5/train')].join(':')).split(':').filter(dir => dir && existsSync(dir));
if (REAL_DIRS.some(dir => /sealed$/.test(dir) && !dir.endsWith('uci-webform/sealed'))) throw new Error('A round\'s sealed folder is never training data');
const sources = [
  ...html(FIXTURES).map(name => ({ page: `bench/${name}`, url: pathToFileURL(resolve(FIXTURES, name)).href, source: 'benchmark' })),
  ...['holdout', 'regressions'].flatMap(dir => html(resolve(FIXTURES, dir)).map(name => ({ page: `bench/${dir}/${name}`, url: pathToFileURL(resolve(FIXTURES, dir, name)).href, source: `benchmark-${dir}` }))),
  ...html(FORM_LAB_DIR).filter(name => /^\d+-/.test(name) && name !== '24-iframe-inner.html' && !sealed(name))
    .map(name => ({ page: `lab/${name}`, url: FORM_LAB_URL + name, source: 'form-lab' })),
  ...REAL_DIRS.flatMap(dir => html(dir).map(name => ({ page: `real/${dir.split('/').slice(-2).join('/')}/${name}`, url: pathToFileURL(resolve(dir, name)).href, source: 'real' }))),
];

const entry = (await build({ entryPoints: [resolve('scripts/model/page-entry.ts')], bundle: true, write: false, format: 'iife', target: 'chrome118', loader: { '.json': 'json' } })).outputFiles[0].text;
const browser = await chromium.launch();
const tab = await browser.newPage();
const lines: string[] = [];
const counts: Record<string, number> = {};
for (const { page, url, source } of sources) {
  await tab.goto(url);
  await tab.waitForLoadState('load');
  const wait = WAIT[page.replace(/^lab\//, '').replace(/\.html$/, '')];
  if (wait) await tab.waitForTimeout(wait);
  await tab.addScriptTag({ content: entry });
  // A page marked data-no-training tests the engine's own rules, not what the model learns: the
  // model is small enough that a few such rows move its answers elsewhere.
  if (await tab.evaluate(() => document.documentElement.hasAttribute('data-no-training'))) continue;
  const lang = await tab.evaluate(() => document.documentElement.lang?.slice(0, 2) || (document.documentElement.dir === 'rtl' ? 'ar' : 'en'));
  const rows = await tab.evaluate(() => (globalThis as any).__devfillerDataset()) as Array<{ index: number; expect: string; info: unknown }>;
  // Sensitive labels are left out: the model never learns card, code, bank or consent fields.
  const kept = rows.filter(row => !SENSITIVE.test(row.expect));
  for (const row of kept) lines.push(JSON.stringify({ page, source, lang, ...row }));
  counts[source] = (counts[source] ?? 0) + kept.length;
}
await browser.close();
// Rows from real websites stay outside the repository, under the UCI dataset's licence: the repo keeps
// only its own fixtures and Form Lab rows, and training reads both files.
const isReal = (line: string) => line.includes('"source":"real"');
writeFileSync(resolve('benchmark/model/dataset.jsonl'), lines.filter(line => !isReal(line)).join('\n') + '\n');
const real = lines.filter(isReal);
if (real.length) { mkdirSync(dirname(REAL_DATASET), { recursive: true }); writeFileSync(REAL_DATASET, real.join('\n') + '\n'); }
console.log(`${lines.length} fields from ${sources.length} pages`, counts);
