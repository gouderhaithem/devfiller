// Builds benchmark/model/dataset.jsonl: one row per labelled field of the benchmark fixtures and the
// retired Form Lab pages. Rows hold the field's clues and its label, never a value.
//
//   npm run model:dataset            # Form Lab served at FORM_LAB_URL (default http://localhost:8777/pages/)
import { chromium } from 'playwright';
import { build } from 'esbuild';
import { readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const FIXTURES = resolve('benchmark/fixtures');
const FORM_LAB_DIR = process.env.FORM_LAB_DIR || resolve(process.env.HOME || '', 'ai-projects/form-test-site/pages');
const FORM_LAB_URL = process.env.FORM_LAB_URL || 'http://localhost:8777/pages/';
// The sealed set: measured once per round, never read into training data.
export const SEALED_PAGES = [76, 90] as const;
const pageNumber = (name: string) => Number(name.match(/^(\d+)-/)?.[1] ?? NaN);
const sealed = (name: string) => pageNumber(name) >= SEALED_PAGES[0] && pageNumber(name) <= SEALED_PAGES[1];
// Pages that need a moment before a user would press Fill.
const WAIT: Record<string, number> = { '25-spa-controlled': 1800 };
const SENSITIVE = /^skip:/;

const html = (dir: string) => readdirSync(dir).filter(name => name.endsWith('.html')).sort();
const sources = [
  ...html(FIXTURES).map(name => ({ page: `bench/${name}`, url: pathToFileURL(resolve(FIXTURES, name)).href, source: 'benchmark' })),
  ...['holdout', 'regressions'].flatMap(dir => html(resolve(FIXTURES, dir)).map(name => ({ page: `bench/${dir}/${name}`, url: pathToFileURL(resolve(FIXTURES, dir, name)).href, source: `benchmark-${dir}` }))),
  ...html(FORM_LAB_DIR).filter(name => /^\d+-/.test(name) && name !== '24-iframe-inner.html' && !sealed(name))
    .map(name => ({ page: `lab/${name}`, url: FORM_LAB_URL + name, source: 'form-lab' })),
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
  const lang = await tab.evaluate(() => document.documentElement.lang?.slice(0, 2) || (document.documentElement.dir === 'rtl' ? 'ar' : 'en'));
  const rows = await tab.evaluate(() => (globalThis as any).__devfillerDataset()) as Array<{ index: number; expect: string; info: unknown }>;
  // Sensitive labels are left out: the model never learns card, code, bank or consent fields.
  const kept = rows.filter(row => !SENSITIVE.test(row.expect));
  for (const row of kept) lines.push(JSON.stringify({ page, source, lang, ...row }));
  counts[source] = (counts[source] ?? 0) + kept.length;
}
await browser.close();
writeFileSync(resolve('benchmark/model/dataset.jsonl'), lines.join('\n') + '\n');
console.log(`${lines.length} fields from ${sources.length} pages`, counts);
