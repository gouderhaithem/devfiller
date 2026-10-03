// node scripts/model/run.mjs compare <out.json> <folder> [<folder>…]
// Compares form fillers on hand-labelled pages (data-expect): DevFiller's shipped engine with its
// default settings, and other fillers' Chrome extensions (unpacked in $COMPETITORS) triggered the way
// their "fill the page" shortcut does. Every tool is scored the same way, on the values it leaves in
// the fields: a value that fits the field's label is right, any other value is wrong, an untouched
// field is missed. Card, code and bank fields filled with anything but a test value are leaks. Pages
// are served over http from a local server, with every other request blocked.
import { chromium, type BrowserContext, type Page } from 'playwright';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync } from 'node:fs';
import { defaultExclusions, defaults, generateIdentities, generatePhones, generateValues, localizedValues } from '../../src/data';
import { generateSamples } from '../../src/samples';
import type { FillRequest } from '../../src/fill';

const [outArg, ...dirArgs] = process.argv.slice(2);
if (!outArg || !dirArgs.length) { console.error('usage: run.mjs compare <out.json> <folder> [<folder>…]'); process.exit(2); }
const COMPETITORS = process.env.COMPETITORS || resolve(process.env.HOME || '', 'datasets/competitors');
const TOOLS = (process.env.TOOLS || 'devfiller,fake-filler,fake-data').split(',');
const OMITTED = ['hidden', 'submit', 'button', 'reset', 'image', 'file'];

// --- The pages, served over http: unpacked extensions can't read file:// pages by default.
const dirs = dirArgs.map(dir => resolve(dir));
const server = createServer((req, res) => {
  const [, index, ...rest] = decodeURIComponent((req.url || '').split('?')[0]).split('/');
  const dir = dirs[Number(index)];
  if (!dir) { res.writeHead(404).end(); return; }
  try { res.writeHead(200, { 'content-type': extname(rest.join('/')) === '.html' ? 'text/html; charset=utf-8' : 'text/plain' }).end(readFileSync(resolve(dir, rest.join('/')))); }
  catch { res.writeHead(404).end(); }
});
await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
const port = (server.address() as { port: number }).port;
const pages = dirs.flatMap((dir, i) => readdirSync(dir).filter(name => name.endsWith('.html')).sort().map(name => ({ set: dir.split('/').slice(-2).join('/'), name, url: `http://127.0.0.1:${port}/${i}/${encodeURIComponent(name)}` })));

// --- What each control holds, read the same way for every tool.
interface State { index: number; expect: string; tag: string; type: string; value: string; checked: boolean; option: string; placeholderOption: boolean; group: string; html: string }
const read = (page: Page) => page.evaluate(omitted => Array.from(document.querySelectorAll<HTMLInputElement>('input, select, textarea'), (el, index) => {
  const select = el instanceof HTMLSelectElement ? el : undefined;
  const chosen = select?.selectedOptions[0];
  return { index, expect: el.getAttribute('data-expect') || '', tag: el.tagName.toLowerCase(), type: (el.getAttribute('type') || '').toLowerCase(), value: el.value ?? '', checked: !!el.checked, option: chosen?.textContent?.trim() ?? '', placeholderOption: !!select && (select.selectedIndex <= 0 && !chosen?.value), group: el.name || '', html: el.outerHTML.slice(0, 160), omit: el instanceof HTMLInputElement && omitted.includes(el.type) };
}).filter(state => !state.omit) as State[], OMITTED);

// --- Does a value fit the label?
const words = (value: string) => value.trim().split(/\s+/).filter(Boolean);
const letters = (value: string) => /^[\p{L}][\p{L}\s.'’-]*$/u.test(value.trim());
const NUMERIC = new Set(['quantity', 'age', 'amount', 'price', 'salary', 'experience', 'employeeCount', 'percentage', 'rating', 'measurement', 'year']);
const DATES = new Set(['date', 'birthDate', 'startDate', 'endDate']);
const parsesAsDate = (value: string) => !Number.isNaN(Date.parse(value)) || /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(value.trim()) || /^\d{4}-\d{2}(-\d{2})?$/.test(value.trim());
// Lorem ipsum: what a filler types into a field it doesn't recognise. In a field that asks for a
// name, a city, a company or a topic it is a placeholder, not an answer.
const LOREM = new Set('a ab accusamus accusantium ad adipisci alias aliquam aliquid amet animi aperiam architecto asperiores aspernatur assumenda at atque aut autem beatae blanditiis commodi consectetur consequatur consequuntur corporis corrupti culpa cum cumque cupiditate debitis delectus deleniti deserunt dicta dignissimos distinctio dolor dolore dolorem doloremque dolores doloribus dolorum ducimus ea eaque earum eius eligendi enim eos est et eum eveniet ex excepturi exercitationem expedita explicabo facere facilis fuga fugiat fugit harum hic id illo illum impedit in incidunt inventore ipsa ipsam ipsum iste itaque iure iusto labore laboriosam laborum laudantium libero magnam magni maiores maxime minima minus modi molestiae molestias mollitia nam natus necessitatibus nemo neque nesciunt nihil nisi nobis non nostrum nulla numquam obcaecati odio odit officia officiis omnis optio pariatur perferendis perspiciatis placeat porro possimus praesentium provident quae quaerat quam quas quasi qui quia quibusdam quidem quis quisquam quo quod quos ratione recusandae reiciendis rem repellat repellendus reprehenderit repudiandae rerum saepe sapiente sed sequi similique sint sit soluta sunt suscipit tempora tempore temporibus tenetur totam ullam unde ut vel velit veniam veritatis vero vitae voluptas voluptate voluptatem voluptates voluptatibus voluptatum lorem elit sed eiusmod tempor incididunt magna aliqua'.split(' '));
const lorem = (value: string) => { const w = value.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean); return w.length > 0 && w.every(word => LOREM.has(word)); };
const NOT_LOREM = new Set(['firstName', 'lastName', 'middleName', 'fullName', 'city', 'state', 'country', 'district', 'nationality', 'company', 'jobTitle', 'department', 'industry', 'title', 'subject', 'address2', 'username', 'gender', 'color', 'material', 'search', 'reference']);
function fits(type: string, s: State, value: string): boolean {
  const v = value.trim();
  if (s.tag !== 'select' && NOT_LOREM.has(type) && lorem(v)) return false;
  if (s.tag === 'select') return !s.placeholderOption;
  if (s.type === 'radio' || s.type === 'checkbox') return s.checked;
  if (type === 'email') return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v);
  if (type === 'phone') { const digits = v.replace(/\D/g, ''); return /^[+\d\s().-]+$/.test(v) && digits.length >= 6 && digits.length <= 15; }
  if (type === 'postalCode') return /^[A-Z0-9][A-Z0-9 -]{1,9}$/i.test(v) && /\d/.test(v);
  if (type === 'website') return /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(v);
  if (type === 'firstName' || type === 'lastName' || type === 'middleName') return letters(v) && words(v).length <= 2;
  if (type === 'fullName') return letters(v) && words(v).length >= 2 && words(v).length <= 4;
  if (type === 'city' || type === 'state' || type === 'country' || type === 'district' || type === 'nationality') return letters(v) && words(v).length <= 4;
  if (type === 'password') return v.length >= 6;
  if (type === 'username') return /^\S{3,}$/.test(v) && !/@/.test(v);
  if (type === 'year') return /^(19|20)\d{2}$/.test(v);
  if (type === 'age') return /^\d{1,3}$/.test(v) && +v >= 13 && +v <= 110;
  if (NUMERIC.has(type)) return /^[$€£]?\s?\d[\d\s,.]*\s?[%$€£]?$/.test(v);
  if (type === 'time') return /^\d{1,2}[:h]\d{2}/.test(v);
  if (type === 'birthDate') { const t = Date.parse(v); const years = (Date.now() - t) / 3.156e10; return parsesAsDate(v) && (Number.isNaN(t) || (years >= 13 && years <= 110)); }
  if (DATES.has(type)) return parsesAsDate(v);
  if (type === 'address') return /\d/.test(v) && /\p{L}{2,}/u.test(v);
  if (['message', 'description', 'bio', 'notes'].includes(type)) return words(v).length >= 3;
  if (['company', 'jobTitle', 'department', 'industry', 'title', 'subject', 'address2', 'reference', 'search', 'gender', 'color', 'material'].includes(type)) return v.length >= 1 && !/@/.test(v);
  return v.length > 0;
}
const SENSITIVE = /^skip:(card|otp|iban)$/;
const testLike = (value: string) => { const plain = value.replace(/[\s-]/g, ''); return !plain || /^4+$/.test(plain) || /^4242/.test(plain) || /^4000/.test(plain) || /^DE47/.test(plain) || /^TESTDE/.test(plain) || plain === '110000000' || /^(0?[1-9]|1[0-2])\/?\d{2,4}$/.test(plain); };

interface Score { right: number; wrong: number; missed: number; leaks: number; typed: number; byType: Record<string, { right: number; wrong: number; missed: number }>; examples: Array<{ page: string; expect: string; value: string; html: string }> }
const empty = (): Score => ({ right: 0, wrong: 0, missed: 0, leaks: 0, typed: 0, byType: {}, examples: [] });
function score(into: Score, page: string, before: readonly State[], after: readonly State[]) {
  const groupChecked = new Map<string, boolean>();
  for (const s of after) if (s.type === 'radio') groupChecked.set(s.group, (groupChecked.get(s.group) ?? false) || s.checked);
  after.forEach((s, i) => {
    const was = before[i];
    const changed = !was || was.value !== s.value || was.checked !== s.checked || was.option !== s.option;
    if (SENSITIVE.test(s.expect)) { if (changed && s.tag !== 'select' && !testLike(s.value)) into.leaks++; return; }
    if (!s.expect || s.expect === 'unknown' || s.expect.startsWith('skip:')) return;
    into.typed++;
    const t = (into.byType[s.expect] ??= { right: 0, wrong: 0, missed: 0 });
    const filled = s.type === 'radio' ? groupChecked.get(s.group) && changed || (groupChecked.get(s.group) ?? false) : changed;
    if (!filled) { into.missed++; t.missed++; return; }
    const ok = s.type === 'radio' ? true : fits(s.expect, s, s.tag === 'select' ? s.option : s.value);
    if (ok) { into.right++; t.right++; } else { into.wrong++; t.wrong++; if (into.examples.length < 400) into.examples.push({ page, expect: s.expect, value: (s.tag === 'select' ? s.option : s.value).slice(0, 60), html: s.html }); }
  });
}

// --- The tools.
const base: FillRequest = {
  values: generateValues('en'), identities: generateIdentities('en'), samples: generateSamples('en'), phones: generatePhones(), localized: localizedValues('en'),
  custom: [], overwrite: defaults.overwrite, fillUnknown: defaults.fillUnknown, passwords: true, exclusions: defaultExclusions, modelGuesses: false,
};
const engine = (await build({ entryPoints: [resolve('benchmark/engine-entry.ts')], bundle: true, write: false, format: 'iife', target: 'chrome118', loader: { '.json': 'json' } })).outputFiles[0].text;

async function run(tool: string): Promise<Record<string, Score>> {
  // devfiller-guesses: DevFiller with learned guesses on.
  const ours = tool.startsWith('devfiller');
  const extension = ours ? undefined : resolve(COMPETITORS, tool);
  const context: BrowserContext = await chromium.launchPersistentContext(mkdtempSync(resolve(tmpdir(), `compare-${tool}-`)), {
    channel: 'chromium', headless: true,
    args: extension ? ['--enable-unsafe-extension-debugging', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`] : [],
  });
  await context.route(url => !(url.hostname === '127.0.0.1' && url.port === String(port)), route => route.abort());
  const worker = extension ? (context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', { timeout: 15000 })) : undefined;
  await new Promise(done => setTimeout(done, 1500));
  for (const extra of context.pages().slice(1)) await extra.close();
  const page = context.pages()[0] ?? await context.newPage();
  const scores: Record<string, Score> = {};
  for (const { set, name, url } of pages) {
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 15000 });
      await page.waitForTimeout(extension ? 500 : 50);
      const before = await read(page);
      if (ours) {
        await page.addScriptTag({ content: engine });
        await page.evaluate(r => (globalThis as any).__devfiller.fillPage(r), { ...base, modelGuesses: tool === 'devfiller-guesses' });
      } else if (tool === 'fake-filler') {
        await worker!.evaluate(async target => {
          // Without the "tabs" permission a tab's URL is hidden: the one open page is the active tab.
          const tabs = await chrome.tabs.query({}); const tab = tabs.find(t => t.url === target) ?? tabs.find(t => t.active) ?? tabs[0];
          await chrome.scripting.executeScript({ target: { tabId: tab.id!, allFrames: true }, func: () => (window as any).fakeFiller?.fillAllInputs() });
        }, url);
      } else if (tool === 'fake-data') {
        await worker!.evaluate(async target => {
          // Without the "tabs" permission a tab's URL is hidden: the one open page is the active tab.
          const tabs = await chrome.tabs.query({}); const tab = tabs.find(t => t.url === target) ?? tabs.find(t => t.active) ?? tabs[0];
          // Fake Data never answers this message: send it, don't wait for a reply.
          chrome.tabs.sendMessage(tab.id!, { type: 'fill_entire_page' }).catch(() => {});
        }, url);
      }
      await page.waitForTimeout(extension ? 1200 : 50);
      score((scores[set] ??= empty()), name, before, await read(page));
    } catch (error) {
      console.error(`${tool} ${name}: ${String((error as Error).message).split('\n')[0]}`);
    }
  }
  await context.close();
  return scores;
}

const results: Record<string, Record<string, Score>> = {};
for (const tool of TOOLS) {
  results[tool] = await run(tool);
  for (const [set, s] of Object.entries(results[tool])) console.log(`${tool.padEnd(11)} ${set.padEnd(24)} right ${(100 * s.right / s.typed).toFixed(1)}%  wrong ${(100 * s.wrong / s.typed).toFixed(1)}%  missed ${(100 * s.missed / s.typed).toFixed(1)}%  of ${s.typed} fields, leaks ${s.leaks}`);
}
server.close();
writeFileSync(resolve(outArg), JSON.stringify(results, null, 1));
