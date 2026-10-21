// Checks hand labels against the guide's settled cases, so many labellers give one answer: customer
// numbers, address line 2, other people's names, the parts of a split date, permission to be
// contacted, topics picked from a list and spam traps. Prints what it would change; FIX=1 writes the changes.
//
//   node scripts/uci-sealed/consistency.mjs <folder> [<folder>…]
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const OMITTED = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'file']);
// The short text just before a control or its wrapper, where a label-less question sits ("Topic*").
const nearby = el => {
  for (let node = el, depth = 0; node && depth < 3; node = node.parentElement, depth++) {
    const before = node.previousElementSibling?.textContent?.replace(/\s+/g, ' ').trim();
    if (before) return before.length <= 80 ? before : '';
  }
  return '';
};
const text = (document, el) => {
  const byIds = ids => (ids || '').split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ');
  const labels = el.id ? [...document.querySelectorAll(`label[for="${el.id.replace(/"/g, '\\"')}"]`)].map(l => l.textContent) : [];
  return [...labels, el.closest('label')?.textContent, el.getAttribute('aria-label'), byIds(el.getAttribute('aria-labelledby')), el.getAttribute('placeholder'), el.getAttribute('title'), el.getAttribute('name'), el.id]
    .filter(Boolean).join(' | ').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').toLowerCase();
};

// Each rule: which labels it corrects, what the field's text says, and the guide's answer. `checkbox`
// and `choice` (a select or a radio) limit a rule to those controls.
const RULES = [
  { name: 'customer number is a record reference', from: ['unknown'], unless: /permanent account|personal account number|\(pan\)|pan card|tax|ssn|social security/, when: /customer\s*(number|no\.?|id|#)|(?<!ga ?|google |analytics |\w)client (number|no\.?|id)(?!\w)|account\s*number(?!.*(bank|iban|routing))|\bmember(ship)? (number|no\.?)(?!\w)/, to: 'reference' },
  { name: 'address line 2', from: ['unknown'], typed: true, when: /address\s*(line)?\s*[23]\b|address2|\bapt\b|apartment|\bsuite\s*(number|no|#)?\s*($|\|)/, to: 'address2' },
  { name: "another person's name", from: ['unknown'], when: /(\breferr?(er|ed|al)?|\brefer you|emergency|manager|supervisor|guardian|parent|spouse|recipient|next of kin|beneficiary)[^|]{0,40}name|name of (your|the) (referrer|manager|supervisor)/, unless: /username/, to: 'fullName' },
  { name: 'automatic renewal is a permission', from: ['unknown'], checkbox: true, when: /auto(matic(ally)?)?[- ]?renew|renew[^|]{0,30}automatically/, to: 'skip:consent' },
  { name: 'a promise to pay more', from: ['unknown'], checkbox: true, when: /(cover|pay|add)[^|]{0,40}(processing|transaction|admin\w*|card|credit card)?\s*(fee|cost)s?\b|processing[- _]?fee|fee[- _]?cover|cover[- _]?fees|(make|making) (this|it|my \w+) (a )?(monthly|recurring|weekly|annual)|(monthly|recurring) (gift|donation|contribution|pledge)|repeat (this|my) (gift|donation)|every month|\bisrecurring\b|donor.?recurring|auto.?repeat/, to: 'skip:consent' },
  { name: 'a topic picked from a list', from: ['unknown'], choice: true,
    when: /\btopics?\b|reason (for|of)|(^|\| )\W*reason\W*($| \|)|(type|kind|nature|category) of (\w+ ){0,2}(enquiry|inquiry|request|query|question|message|feedback|issue|concern)\b|(enquiry|inquiry|request|query|question|feedback|issue|message) (type|category|topic)|best describes (your|the) (enquiry|inquiry|request|issue|question|feedback)|(need|want) help with|in which area (may|can) we help|how can we (best )?direct your|(^|\| )i would like to\W*($| \|)|first option: (select|choose) (a |the |your )?(topic|subject|category|reason|request)|how can we help|how may we help|what can we help|what (is|are) (your|this) [^|]{0,20}(about|regarding)|\bregarding\b(?! an?\b)|\bsubject\b|^\s*i('m| am) (contacting|writing)|main concern|choose your issue|contact.?reason|inquiry.?reason|enquiry.?reason/,
    unless: /department|\bteam\b|\boffice\b|send (it |this |your message )?to|recipient|branch|\bstore\b|location|who (would|do|should) you|which (person|contact)|interest(s|ed)?\b|subject areas?|newsletter|opt.?out|unsubscrib|cancel|leaving|delet|this.?subject|interview|(^|\| )i( am|'m|m) an?\b|contact you|contact method|how would you like|\bhear\b|heard|find us|found us|tribute/, to: 'subject' },
  // Sites fill these themselves or keep them empty to catch bots, whatever the field's name says.
  { name: 'a spam trap or a field the site fills', from: ['website', 'email', 'fullName', 'firstName', 'lastName', 'phone', 'company', 'message', 'subject', 'city'], typed: true,
    when: /leave (this |the )?(field )?(blank|empty)|laisser ce champ vide|(don ?t|do not|please don ?t) fill|if you are human|prove (your|you re) human|spam check|honeypot|\bhp\b|(page|referr?er|referring|refer|return|redirect|embed|current page) ?url\b/, to: 'unknown' },
  { name: 'a LinkedIn or profile link is a website', from: ['unknown'], typed: true, when: /linked ?in|لينكد|profile (url|link)|portfolio (url|link)|website url|personal website/, unless: /leave|blank|honeypot|(don ?t|do not) fill|company|business|title|link text/, to: 'website' },
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
      // A radio's question is its group's legend and name; its own label is one answer.
      const legend = (el.closest('fieldset')?.querySelector('legend')?.textContent || '').replace(/\s+/g, ' ').toLowerCase();
      // A select's first option often asks the question itself ("Select a topic").
      const prompt = el.tagName === 'SELECT' ? ` | ${nearby(el).toLowerCase()} | first option: ${(el.querySelector('option')?.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase()}` : '';
      const asked = el.getAttribute('type') === 'radio' ? `${legend} | ${el.getAttribute('name') || ''}`.toLowerCase().replace(/[-_]+/g, ' ') : `${said} | ${legend}${prompt}`;
      for (const rule of RULES) {
        if (!rule.from.includes(label) || (rule.checkbox && el.getAttribute('type') !== 'checkbox') || (rule.typed && (el.tagName === 'SELECT' || ['checkbox', 'radio'].includes(el.getAttribute('type')))) || (rule.choice && el.tagName !== 'SELECT' && el.getAttribute('type') !== 'radio') || !rule.when.test(rule.choice ? asked : said) || rule.unless?.test(rule.choice ? asked : said)) continue;
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
