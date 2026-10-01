// Runs the engine on every form of $UCI_DIR/forms.jsonl in Chromium, into engine.jsonl: per form,
// the type and confidence the engine gives each field it found, and the form type it reads.
//
//   node scripts/uci/run.mjs engine            # UCI_DIR defaults to ~/datasets/uci-webform
import { chromium, type Page } from 'playwright';
import { build } from 'esbuild';
import { createReadStream, openSync, writeSync, closeSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import type { EngineForm, UciField } from './engine-entry';

const UCI_DIR = process.env.UCI_DIR || resolve(process.env.HOME || '', 'datasets/uci-webform');
const TABS = Number(process.env.UCI_TABS || 4);
// A fresh tab now and then, so nothing one form leaves behind builds up.
const FORMS_PER_TAB = 500;
// A form the engine takes longer than this on is recorded as failed, and its tab replaced.
const FORM_TIMEOUT_MS = 20_000;

interface FormRow { domain: string; job: string; form: string; html: string; fields: UciField[] }

const entry = (await build({ entryPoints: [resolve('scripts/uci/engine-entry.ts')], bundle: true, write: false, format: 'iife', target: 'chrome118', loader: { '.json': 'json' } })).outputFiles[0].text;

const forms: FormRow[] = [];
for await (const line of createInterface({ input: createReadStream(resolve(UCI_DIR, 'forms.jsonl')) })) if (line) forms.push(JSON.parse(line));

const browser = await chromium.launch();
async function openTab(): Promise<Page> {
  const tab = await browser.newPage();
  // The forms come from live sites: nothing they point at is fetched.
  await tab.route('**/*', route => route.abort());
  await tab.setContent('<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body></body></html>');
  await tab.addScriptTag({ content: entry });
  return tab;
}

function withTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`no answer in ${FORM_TIMEOUT_MS} ms`)), FORM_TIMEOUT_MS); });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

// Rows are written as they come, in any order (the report joins them by job and form), so a crash
// keeps what was done.
const out = resolve(UCI_DIR, 'engine.jsonl');
const file = openSync(out, 'w');
let next = 0, failed = 0, written = 0;
async function worker() {
  let tab = await openTab(), done = 0;
  const replace = async () => { await tab.close().catch(() => {}); tab = await openTab(); done = 0; };
  while (next < forms.length) {
    const i = next++;
    const { domain, job, form, html, fields } = forms[i];
    let row: object;
    try {
      const result = await withTimeout(tab.evaluate(([html, fields]) => (globalThis as any).__uciRun(html, fields), [html, fields] as const)) as EngineForm;
      row = { domain, job, form, ...result };
      done++;
    } catch (error) {
      failed++;
      row = { domain, job, form, error: String(error).slice(0, 300) };
      done = FORMS_PER_TAB;
    }
    writeSync(file, JSON.stringify(row) + '\n');
    if (done >= FORMS_PER_TAB) await replace();
    if (++written % 2000 === 0) console.log(`${written}/${forms.length} forms`);
  }
  await tab.close().catch(() => {});
}
try {
  await Promise.all(Array.from({ length: TABS }, worker));
} finally {
  closeSync(file);
  await browser.close();
}
console.log(`${forms.length} forms through the engine, ${failed} failed -> ${out}`);
