// A labelling helper for real forms: lists each control with the clues a person reads, and writes
// the labels back as data-expect. Labels follow benchmark/fixtures/README.md.
//
//   node scripts/uci-sealed/label.mjs list  <page.html>                 # one line per control
//   node scripts/uci-sealed/label.mjs apply <page.html> '{"0":"email"}'  # labels by control number
//   node scripts/uci-sealed/label.mjs check <folder>                     # every control labelled?
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const README = resolve(new URL('.', import.meta.url).pathname, '../../benchmark/fixtures/README.md');
// The allowed answers: every `type` in the guide's type table, unknown and the skip kinds.
const allowed = () => {
  const guide = readFileSync(README, 'utf8');
  const table = guide.slice(guide.indexOf('## Types'), guide.indexOf('Two more kinds of answer'));
  const types = [...table.matchAll(/`([a-zA-Z0-9]+)`/g)].map(m => m[1]);
  return new Set([...types, 'unknown', 'skip:card', 'skip:otp', 'skip:iban', 'skip:consent', 'skip:session']);
};
const OMITTED = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'file']);
const WIDGETS = '[role="checkbox"]:not(input), [role="switch"]:not(input), [role="radio"]:not(input), [role="combobox"]:not(input):not(select), [contenteditable="true"], [contenteditable=""], [role="textbox"]:not(input):not(textarea)';
const clip = (text, n = 70) => (text || '').replace(/\s+/g, ' ').trim().slice(0, n);

function controls(document) {
  const natives = [...document.querySelectorAll('input, select, textarea')].filter(el => !(el.tagName === 'INPUT' && OMITTED.has((el.getAttribute('type') || 'text').toLowerCase())));
  return [...natives, ...document.querySelectorAll(WIDGETS)];
}

function describe(document, el) {
  const byIds = ids => (ids || '').split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ');
  const labels = el.id ? [...document.querySelectorAll(`label[for="${el.id.replace(/"/g, '\\"')}"]`)] : [];
  const wrapping = el.closest('label');
  const label = clip([...labels, ...(wrapping && !labels.includes(wrapping) ? [wrapping] : [])].map(l => l.textContent).join(' / '));
  let nearby = '';
  for (let node = el.previousSibling, n = 0; node && n < 4 && !nearby; node = node.previousSibling, n++) nearby = clip(node.textContent, 50);
  if (!nearby) for (let node = el.parentElement?.previousElementSibling, n = 0; node && n < 2 && !nearby; node = node.previousElementSibling, n++) if (!node.querySelector('input, select, textarea')) nearby = clip(node.textContent, 50);
  const legend = clip(el.closest('fieldset')?.querySelector('legend')?.textContent, 50);
  const tag = el.tagName.toLowerCase();
  const kind = tag === 'input' ? `input[${(el.getAttribute('type') || 'text').toLowerCase()}]` : el.getAttribute('role') ? `widget[${el.getAttribute('role')}]` : tag;
  const options = tag === 'select' ? clip([...el.options].slice(0, 8).map(o => o.textContent.trim()).filter(Boolean).join(' | '), 90) : '';
  const parts = { name: el.getAttribute('name'), id: el.id, ac: el.getAttribute('autocomplete'), ph: el.getAttribute('placeholder'), aria: el.getAttribute('aria-label') || byIds(el.getAttribute('aria-labelledby')), title: el.getAttribute('title'), label, nearby: label ? '' : nearby, legend, value: ['radio', 'checkbox'].includes(el.getAttribute('type')) ? el.getAttribute('value') : '', options };
  return `${kind} ${Object.entries(parts).filter(([, v]) => v).map(([k, v]) => `${k}=${JSON.stringify(clip(v))}`).join(' ')}`;
}

const [command, target, json] = process.argv.slice(2);
if (command === 'list') {
  const { document } = new JSDOM(readFileSync(target, 'utf8')).window;
  console.log(document.title);
  controls(document).forEach((el, i) => console.log(`${i}${el.hasAttribute('data-expect') ? `=${el.getAttribute('data-expect')}` : ''}\t${describe(document, el)}`));
} else if (command === 'apply') {
  const text = readFileSync(target, 'utf8');
  const dom = new JSDOM(text);
  const { document } = dom.window;
  const list = controls(document);
  const labels = JSON.parse(json);
  const ok = allowed();
  for (const [index, label] of Object.entries(labels)) {
    if (!ok.has(label)) { console.error(`not an allowed label: ${label}`); process.exit(1); }
    if (!list[Number(index)]) { console.error(`no control ${index}`); process.exit(1); }
    list[Number(index)].setAttribute('data-expect', label);
  }
  const missing = list.map((el, i) => el.hasAttribute('data-expect') ? -1 : i).filter(i => i >= 0);
  writeFileSync(target, `<!doctype html>\n${document.documentElement.outerHTML}\n`);
  console.log(`${Object.keys(labels).length} labelled${missing.length ? `; still unlabelled: ${missing.join(', ')}` : '; all controls labelled'}`);
} else if (command === 'check') {
  const ok = allowed();
  let pages = 0, fields = 0, bad = 0;
  for (const name of readdirSync(target).filter(n => n.endsWith('.html')).sort()) {
    const { window } = new JSDOM(readFileSync(resolve(target, name), 'utf8'));
    const list = controls(window.document);
    const wrong = list.filter(el => !ok.has(el.getAttribute('data-expect') || ''));
    // A big round doesn't fit in memory unless each page's window is closed and freed before the next.
    window.close();
    await new Promise(setImmediate);
    pages++; fields += list.length;
    if (wrong.length) { bad++; console.log(`${name}: ${wrong.length} of ${list.length} unlabelled or not allowed`); }
  }
  console.log(`${pages} pages, ${fields} controls, ${bad} pages incomplete`);
} else {
  console.error('usage: label.mjs list <page> | apply <page> <json> | check <folder>');
  process.exit(2);
}
