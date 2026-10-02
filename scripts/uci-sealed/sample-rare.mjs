// Draws a training round of the UCI forms that ask for the types the model has the fewest examples
// of (gender, nationality, salary, middle names, ratings, start and end dates…): at most one form per
// website, from websites no earlier round used, the one with the most of those fields. Unlike
// sample-round.mjs it takes every form type, UCI's unclassified ones too, and larger forms. Pages
// are written inert, like sample-round.mjs, to label by hand. Data stays in $UCI_DIR.
//
//   ROUND=round5 MIN_RARE=1 LIMIT=1500 node scripts/uci-sealed/sample-rare.mjs
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';

const DIR = process.env.UCI_DIR || resolve(process.env.HOME, 'datasets/uci-webform');
const ROUND = process.env.ROUND || 'round5';
const MIN_RARE = Number(process.env.MIN_RARE || 1);
const LIMIT = Number(process.env.LIMIT || 1500);
const MIN_FIELDS = 4, MAX_FIELDS = Number(process.env.MAX_FIELDS || 80), MAX_BYTES = Number(process.env.MAX_BYTES || 200_000);
const OUT = resolve(DIR, ROUND, 'train');
const OMITTED = /type\s*=\s*["']?(hidden|submit|button|reset|image|file)\b/i;
// Clues to the rare types, read from a field's name, label, the text before it and its opening tag.
const CUES = {
  gender: /gender|\bsex\b|civilit|honorific/i, title: /\b(name.?)?prefix\b|salutation|\btitle\b.*\b(mr|mrs|ms|dr)\b/i,
  nationality: /nationalit|citizenship/i, middleName: /middle.?(name|initial)|\bsuffix\b/i, age: /\bage\b|age.?range|how old/i,
  birthDate: /birth|\bdob\b/i, salary: /salary|compensation|income|wage|pay.?expect/i, experience: /experience|years.?(of|in)\b/i,
  department: /department|division/i, industry: /industry|sector/i,
  employeeCount: /company.?size|employees|team.?size|headcount|number.?of.?staff/i, rating: /rating|satisf|how likely|\bstars?\b/i,
  color: /colou?r/i, material: /material|fabric/i, percentage: /percent/i, price: /price|budget/i,
  dates: /start.?date|end.?date|check.?in|check.?out|arrival|departure|(from|to).?date|move.?in/i,
  district: /district|county|neighbou?rhood|suburb/i, year: /\byear\b|graduat/i, bio: /\bbio\b|about.?(you|yourself|me)/i,
  time: /\btime\b|\bhour/i, quantity: /quantity|\bqty\b|guests|adults|children|attendees|number.?of.?(people|persons|tickets)/i,
  jobTitle: /job.?title|position|occupation|profession/i,
};

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
if (existsSync(resolve(OUT, 'manifest.json'))) throw new Error(`${ROUND} already exists`);

const best = new Map();
for await (const line of createInterface({ input: createReadStream(resolve(DIR, 'forms.jsonl')) })) {
  const form = JSON.parse(line);
  if (used.has(form.domain)) continue;
  const shown = form.fields.filter(f => f.visible && /^(INPUT|SELECT|TEXTAREA)$/.test(f.tag) && !OMITTED.test(f.html));
  if (shown.length < MIN_FIELDS || shown.length > MAX_FIELDS) continue;
  const hits = new Set();
  for (const f of shown) {
    const text = `${f.name} ${f.label} ${f.previous} ${f.html.slice(0, f.html.indexOf('>') + 1)}`;
    for (const [type, cue] of Object.entries(CUES)) if (cue.test(text)) hits.add(type);
  }
  if (hits.size < MIN_RARE) continue;
  const known = best.get(form.domain);
  if (known && (known.rare.length > hits.size || (known.rare.length === hits.size && known.fields >= shown.length))) continue;
  const html = inert(form.html);
  if (html.length > MAX_BYTES) continue;
  best.set(form.domain, { key: `${form.domain}/${form.job}/${form.form}`, domain: form.domain, html, type: form.formType ?? 'Unclassified', fields: shown.length, rare: [...hits].sort() });
}

const chosen = [...best.values()].sort((a, b) => b.rare.length - a.rare.length || b.fields - a.fields || a.domain.localeCompare(b.domain)).slice(0, LIMIT);
mkdirSync(OUT, { recursive: true });
const forms = chosen.map((item, i) => {
  const file = `${String(i + 1).padStart(4, '0')}-${item.domain.replace(/[^a-z0-9.-]/gi, '_')}.html`;
  writeFileSync(resolve(OUT, file), `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${item.domain} · ${item.type}</title>\n</head>\n<body>\n${item.html}\n</body>\n</html>\n`);
  return { file, domain: item.domain, source: item.key, uciFormType: item.type, fields: item.fields, rareCues: item.rare };
});
writeFileSync(resolve(OUT, 'manifest.json'), JSON.stringify({ round: ROUND, part: 'train', minRare: MIN_RARE, note: 'Training forms rich in rare field types: labelled by hand, read into the model data.', domains: chosen.map(item => item.domain).sort(), forms }, null, 1));
console.log(`${ROUND}: ${forms.length} training forms (${forms.reduce((n, f) => n + f.fields, 0)} fields); ${used.size} websites from earlier rounds left out`);
