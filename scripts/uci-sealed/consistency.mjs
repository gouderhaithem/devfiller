// Checks hand labels against the guide's settled cases, so many labellers give one answer: customer
// numbers, address line 2, other people's names, the parts of a split date and permission to be
// contacted. Prints what it would change; FIX=1 writes the changes.
//
//   node scripts/uci-sealed/consistency.mjs <folder> [<folder>…]
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const OMITTED = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'file']);
const text = (document, el) => {
  const byIds = ids => (ids || '').split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ');
  const labels = el.id ? [...document.querySelectorAll(`label[for="${el.id.replace(/"/g, '\\"')}"]`)].map(l => l.textContent) : [];
  return [...labels, el.closest('label')?.textContent, el.getAttribute('aria-label'), byIds(el.getAttribute('aria-labelledby')), el.getAttribute('placeholder'), el.getAttribute('name'), el.id]
    .filter(Boolean).join(' | ').replace(/\s+/g, ' ').toLowerCase();
};

// Each rule: which labels it corrects, what the field's text says, and the guide's answer.
const RULES = [
  { name: 'customer number is a record reference', from: ['unknown'], unless: /permanent account|pan card|tax|ssn|social security/, when: /customer\s*(number|no\.?|id|#)|(?<!ga ?|google |analytics |\w)client (number|no\.?|id)(?!\w)|account\s*number(?!.*(bank|iban|routing))|\bmember(ship)? (number|no\.?)(?!\w)/, to: 'reference' },
  { name: 'address line 2', from: ['unknown'], when: /address\s*(line)?\s*[23]\b|address2|\bapt\b|apartment|\bsuite\s*(number|no|#)?\s*($|\|)/, to: 'address2' },
  { name: "another person's name", from: ['unknown'], when: /(\breferr?(er|ed|al)?|\brefer you|emergency|manager|supervisor|guardian|parent|spouse|recipient|next of kin|beneficiary)[^|]{0,40}name|name of (your|the) (referrer|manager|supervisor)/, unless: /username/, to: 'fullName' },
  { name: 'automatic renewal is a permission', from: ['unknown'], checkbox: true, when: /auto(matic(ally)?)?[- ]?renew|renew[^|]{0,30}automatically/, to: 'skip:consent' },
  { name: '"Remember me" is a session choice', from: ['skip:consent'], checkbox: true, when: /^\s*remember me|\|\s*remember me/, to: 'skip:session' },
  { name: 'permission to be contacted', from: ['unknown'], checkbox: true, when: /(contact|call|text|sms) me\b|okay to (text|call|contact)|may (we|i) contact|consent to be contacted/, to: 'skip:consent' },
];
const DATE_TYPES = new Set(['birthDate', 'date', 'startDate', 'endDate']);
// "dob_day", "visit[month]", "birthYear": the stem a split date's parts share.
const stem = name => (name || '').toLowerCase().replace(/[\[\]_.-]?(day|dd|month|mm|year|yyyy|yy|jour|mois|annee)\]?$/i, '');
const isPart = name => /(day|dd|month|mm|year|yyyy|yy|jour|mois|annee)\]?$/i.test(name || '');

const fix = process.env.FIX === '1';
const counts = {};
for (const dir of process.argv.slice(2)) {
  for (const file of readdirSync(dir).filter(n => n.endsWith('.html')).sort()) {
    const path = resolve(dir, file);
    const dom = new JSDOM(readFileSync(path, 'utf8'));
    const { document } = dom.window;
    const controls = [...document.querySelectorAll('input, select, textarea')].filter(el => !(el.tagName === 'INPUT' && OMITTED.has((el.getAttribute('type') || 'text').toLowerCase())));
    const changes = [];
    for (const el of controls) {
      const label = el.getAttribute('data-expect');
      const said = text(document, el);
      for (const rule of RULES) {
        if (!rule.from.includes(label) || (rule.checkbox && el.getAttribute('type') !== 'checkbox') || !rule.when.test(said) || rule.unless?.test(said)) continue;
        changes.push([el, rule.to, rule.name, said]);
        break;
      }
    }
    // The parts of one split date take the date's type: day, month and year of a birth date are each
    // a birth date.
    const groups = new Map();
    for (const el of controls) if (isPart(el.getAttribute('name'))) groups.set(stem(el.getAttribute('name')), [...(groups.get(stem(el.getAttribute('name'))) ?? []), el]);
    for (const parts of groups.values()) {
      if (parts.length < 2) continue;
      const labels = parts.map(el => el.getAttribute('data-expect'));
      // A day or month among the parts makes the group a date, even when only its year had a type;
      // a card's expiry month and year stay card data.
      const dayOrMonth = parts.some(el => /(day|dd|month|mm|jour|mois)\]?$/i.test(el.getAttribute('name') || ''));
      const type = labels.find(label => DATE_TYPES.has(label)) ?? (dayOrMonth && !labels.some(label => label?.startsWith('skip:')) ? 'date' : undefined);
      if (!type) continue;
      for (const el of parts) if (el.getAttribute('data-expect') !== type && ['unknown', 'year', 'date'].includes(el.getAttribute('data-expect'))) changes.push([el, type, 'split date part', text(document, el)]);
    }
    for (const [el, to, rule, said] of changes) {
      counts[rule] = (counts[rule] ?? 0) + 1;
      console.log(`${file}\t${el.getAttribute('data-expect')} → ${to}\t${rule}\t${said.slice(0, 90)}`);
      if (fix) el.setAttribute('data-expect', to);
    }
    if (fix && changes.length) writeFileSync(path, `<!doctype html>\n${document.documentElement.outerHTML}\n`);
    // A big round doesn't fit in memory unless each page's window is closed and freed before the next.
    dom.window.close();
    await new Promise(setImmediate);
  }
}
console.log(JSON.stringify(counts), fix ? '(written)' : '(dry run)');
