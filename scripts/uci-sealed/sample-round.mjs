// Draws a labelling round from the UCI web form sample (forms.jsonl): at most one form per website,
// from websites no earlier round used, split by website into a training set and a sealed set. Pages
// are written inert (no scripts, styles, SVG or links) to label by hand. Data stays in $UCI_DIR.
//
//   ROUND=round2 TRAIN=1000 SEALED=200 node scripts/uci-sealed/sample-round.mjs
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';

const DIR = process.env.UCI_DIR || resolve(process.env.HOME, 'datasets/uci-webform');
const ROUND = process.env.ROUND || 'round2';
const TRAIN = Number(process.env.TRAIN || 1000);
const SEALED = Number(process.env.SEALED || 200);
const SEED = Number(process.env.SEED || 20261002);
const OUT = resolve(DIR, ROUND);
// Shares per UCI form type: rich forms first, a few of the common short ones.
const SHARE = { 'Account Registration Form': 35, 'Contact Form': 30, 'Role Application Form': 30, 'Payment Form': 25, 'Reservation Form': 20, 'Content Submission Form': 15, 'Financial Application Form': 15, 'Account Login Form': 10, 'Unknown': 10, 'Subscription Form': 5, 'Account Recovery Form': 5 };
const MIN_FIELDS = 4, MAX_FIELDS = 40, MAX_BYTES = 60_000;
const OMITTED = /type\s*=\s*["']?(hidden|submit|button|reset|image|file)\b/i;

let state = SEED >>> 0;
const random = () => { state = (state + 0x6d2b79f5) >>> 0; let t = state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// Real pages carry scripts, styles, icons and handlers; the page to label keeps only the form's markup.
const inert = html => html
  .replace(/<(script|noscript|iframe|style|svg|template)\b[\s\S]*?<\/\1>/gi, '').replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '').replace(/\s(src|srcset|action|formaction|href)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  .replace(/\sstyle\s*=\s*("[^"]*"|'[^']*')/gi, '');

// Every website an earlier round labelled, for training or sealing, is left out.
const used = new Set();
for (const name of readdirSync(DIR)) {
  for (const manifest of [resolve(DIR, name, 'manifest.json'), ...['train', 'sealed'].map(part => resolve(DIR, name, part, 'manifest.json'))]) {
    if (existsSync(manifest)) for (const domain of JSON.parse(readFileSync(manifest, 'utf8')).domains ?? []) used.add(domain);
  }
}

const total = Object.values(SHARE).reduce((a, b) => a + b, 0);
const quota = Object.fromEntries(Object.entries(SHARE).map(([type, share]) => [type, Math.round(share * (TRAIN + SEALED) / total)]));
const candidates = new Map();
for await (const line of createInterface({ input: createReadStream(resolve(DIR, 'forms.jsonl')) })) {
  const form = JSON.parse(line);
  if (!quota[form.formType] || used.has(form.domain)) continue;
  const shown = form.fields.filter(f => f.visible && /^(INPUT|SELECT|TEXTAREA)$/.test(f.tag) && !OMITTED.test(f.html));
  if (shown.length < MIN_FIELDS || shown.length > MAX_FIELDS) continue;
  const html = inert(form.html);
  if (html.length > MAX_BYTES) continue;
  const list = candidates.get(form.formType) ?? [];
  // A reservoir per type, so the draw doesn't depend on the file's order.
  const item = { key: `${form.domain}/${form.job}/${form.form}`, domain: form.domain, html, type: form.formType, fields: shown.length };
  if (list.length < 3000) list.push(item); else { const j = Math.floor(random() * (list.length + 1)); if (j < 3000) list[j] = item; }
  candidates.set(form.formType, list);
}

const taken = new Set();
const chosen = [];
for (const [type, count] of Object.entries(quota)) {
  const pool = (candidates.get(type) ?? []).map(item => [random(), item]).sort((a, b) => a[0] - b[0]).map(([, item]) => item);
  let n = 0;
  for (const item of pool) { if (n >= count) break; if (taken.has(item.domain)) continue; taken.add(item.domain); chosen.push(item); n++; }
}

// Types short of their share leave room for more forms of the others, richest first.
const leftovers = [...candidates.values()].flat().filter(item => !taken.has(item.domain)).map(item => [random(), item]).sort((a, b) => b[1].fields - a[1].fields || a[0] - b[0]).map(([, item]) => item);
for (const item of leftovers) { if (chosen.length >= TRAIN + SEALED) break; if (taken.has(item.domain)) continue; taken.add(item.domain); chosen.push(item); }

// Sealed forms are a stratified share of each form type; the rest is training.
const byType = new Map();
for (const item of chosen) byType.set(item.type, [...(byType.get(item.type) ?? []), item]);
const sealed = [], train = [];
for (const items of byType.values()) {
  const k = Math.round(items.length * SEALED / chosen.length);
  sealed.push(...items.slice(0, k)); train.push(...items.slice(k));
}

function write(part, items, note) {
  const out = resolve(OUT, part);
  mkdirSync(out, { recursive: true });
  const forms = items.map((item, i) => {
    const file = `${String(i + 1).padStart(4, '0')}-${item.domain.replace(/[^a-z0-9.-]/gi, '_')}.html`;
    writeFileSync(resolve(out, file), `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${item.domain} · ${item.type}</title>\n</head>\n<body>\n${item.html}\n</body>\n</html>\n`);
    return { file, domain: item.domain, source: item.key, uciFormType: item.type, fields: item.fields };
  });
  writeFileSync(resolve(out, 'manifest.json'), JSON.stringify({ seed: SEED, round: ROUND, part, note, domains: items.map(item => item.domain).sort(), forms }, null, 1));
  return forms.reduce((n, form) => n + form.fields, 0);
}
const trainFields = write('train', train, 'Training forms: labelled by hand, read into the model data.');
const sealedFields = write('sealed', sealed, 'Real-world sealed set: measured once, never trained on.');
console.log(`${ROUND}: ${train.length} training forms (${trainFields} fields), ${sealed.length} sealed (${sealedFields} fields); ${used.size} websites from earlier rounds left out`);
