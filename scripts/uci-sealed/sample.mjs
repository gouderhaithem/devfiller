// Draws the real-world sealed set from the UCI web form sample (forms.jsonl, built by scripts/uci in
// the uci worktree): at most one form per website, weighted towards forms with many kinds of fields,
// written as inert standalone pages to label by hand. Data stays in $UCI_DIR, never in the repo.
//
//   node scripts/uci-sealed/sample.mjs            # UCI_DIR defaults to ~/datasets/uci-webform
import { createReadStream, mkdirSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';

const DIR = process.env.UCI_DIR || resolve(process.env.HOME, 'datasets/uci-webform');
const OUT = resolve(DIR, 'sealed');
const SEED = 20261001;
// Forms per UCI form type: rich forms first, a few of the common short ones.
const QUOTA = { 'Account Registration Form': 35, 'Contact Form': 30, 'Role Application Form': 30, 'Payment Form': 25, 'Reservation Form': 20, 'Content Submission Form': 15, 'Financial Application Form': 15, 'Account Login Form': 10, 'Unknown': 10, 'Subscription Form': 5, 'Account Recovery Form': 5 };
const MIN_FIELDS = 4;
const OMITTED = /type\s*=\s*["']?(hidden|submit|button|reset|image|file)\b/i;

let state = SEED >>> 0;
const random = () => { state = (state + 0x6d2b79f5) >>> 0; let t = state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// Real pages carry scripts and handlers; the fixture keeps only markup.
const inert = html => html
  .replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<noscript\b[\s\S]*?<\/noscript>/gi, '').replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '')
  .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '').replace(/\s(src|srcset|action|formaction|href)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');

const candidates = new Map(); // form type → [{ key, domain, html }]
const lines = createInterface({ input: createReadStream(resolve(DIR, 'forms.jsonl')) });
for await (const line of lines) {
  const form = JSON.parse(line);
  const quota = QUOTA[form.formType];
  if (!quota) continue;
  const shown = form.fields.filter(f => f.visible && /^(INPUT|SELECT|TEXTAREA)$/.test(f.tag) && !OMITTED.test(f.html));
  if (shown.length < MIN_FIELDS || shown.length > 40) continue;
  const list = candidates.get(form.formType) ?? [];
  // Reservoir of 400 per type, so the draw doesn't depend on the file's order.
  const item = { key: `${form.domain}/${form.job}/${form.form}`, domain: form.domain, html: form.html, type: form.formType, fields: shown.length };
  if (list.length < 400) list.push(item); else { const j = Math.floor(random() * (list.length + 1)); if (j < 400) list[j] = item; }
  candidates.set(form.formType, list);
}

const used = new Set();
const chosen = [];
for (const [type, quota] of Object.entries(QUOTA)) {
  const pool = (candidates.get(type) ?? []).map(item => [random(), item]).sort((a, b) => a[0] - b[0]).map(([, item]) => item);
  let taken = 0;
  for (const item of pool) { if (taken >= quota) break; if (used.has(item.domain)) continue; used.add(item.domain); chosen.push(item); taken++; }
}

mkdirSync(OUT, { recursive: true });
const manifest = chosen.map((item, i) => {
  const name = `${String(i + 1).padStart(3, '0')}-${item.domain.replace(/[^a-z0-9.-]/gi, '_')}.html`;
  writeFileSync(resolve(OUT, name), `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${item.domain} · ${item.type}</title>\n</head>\n<body>\n${inert(item.html)}\n</body>\n</html>\n`);
  return { file: name, domain: item.domain, source: item.key, uciFormType: item.type, fields: item.fields };
});
writeFileSync(resolve(OUT, 'manifest.json'), JSON.stringify({ seed: SEED, note: 'Real-world sealed set: never train on these domains.', domains: [...used].sort(), forms: manifest }, null, 1));
const byType = manifest.reduce((acc, m) => ({ ...acc, [m.uciFormType]: (acc[m.uciFormType] ?? 0) + 1 }), {});
console.log(`${manifest.length} forms from ${used.size} sites, ${manifest.reduce((n, m) => n + m.fields, 0)} visible fields`, byType);
