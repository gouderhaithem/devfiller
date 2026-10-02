import type { FieldKey, TypeRule } from '../data';
import type { Control, FormInsight } from './types';
import { classifyField, datePart, isSensitive, SOURCE_GROUP, THRESHOLDS, type Classification, type Evidence, type FieldRole } from './classify';
import { AUTOCOMPLETE, CONFIRMABLE_TYPES, DATE_FIELD_TYPES, PAIR_PHRASES } from './dictionary';
import { autocompleteToken, describeSignals, displayLabel, indexRadios, isChoice, isVisible, OMITTED_TYPES, optionTexts, type Signal } from './extract';
import { normalize } from './normalize';
import { secondOpinion } from './model';

// The second pass: after each field is classified on its own, read each form as a whole.

export type FormType = 'login' | 'signup' | 'checkout' | 'booking' | 'contact' | 'search' | 'other';
export interface PageAnalysis { fields: Map<Control, Classification>; forms: FormInsight[] }

const words = (list: readonly string[]) => list.map(normalize);
const CURRENT_WORDS = words(['current', 'old', 'existing', 'actuel', 'actuelle', 'ancien', 'ancienne', 'الحالية', 'الحالي', 'القديمة']);
const NEW_WORDS = words(['new', 'nouveau', 'nouvelle', 'الجديدة', 'الجديد']);
const FROM_WORDS = words(['from', 'du', 'de', 'start', 'begin', 'depuis', 'من']);
const TO_WORDS = words(['to', 'au', 'until', 'end', 'jusqu au', 'الى', 'حتى']);
const START_WORDS = words(['start', 'starts', 'started', 'starting', 'commencing', 'commence', 'commences', 'begin', 'begins', 'beginning', 'rentree', 'debut', 'بداية', 'البدء']);
const DEPARTURE_WORDS = words(['departure', 'depart', 'départ', 'leaving', 'المغادرة']);
const SPECIFY_WORDS = words(['specify', 'please specify', 'other', 'précisez', 'préciser', 'autre', 'autres', 'حدد', 'أخرى']);
const NAME_TYPES: ReadonlySet<string> = new Set(['fullName', 'firstName', 'lastName']);
const ADDRESS_TYPES: ReadonlySet<string> = new Set(['address', 'address2', 'city', 'postalCode', 'state', 'country']);
// Fields that usually follow each other. A fitting neighbour raises a weak guess.
const NEXT: Readonly<Partial<Record<FieldKey, readonly FieldKey[]>>> = {
  firstName: ['lastName', 'middleName'], middleName: ['lastName'], lastName: ['firstName', 'email'], fullName: ['email', 'phone'], email: ['phone', 'password'],
  address: ['address2', 'city', 'postalCode'], address2: ['city', 'postalCode'], city: ['postalCode', 'state', 'country'], postalCode: ['city', 'country', 'state'],
  state: ['postalCode', 'country'], startDate: ['endDate', 'time'],
};
const FORM_WORDS: Readonly<Record<FormType, readonly string[]>> = {
  login: words(['login', 'log in', 'signin', 'sign in', 'connexion', 'se connecter', 'تسجيل الدخول']),
  signup: words(['register', 'registration', 'signup', 'sign up', 'join', 'create account', 'inscription', 'creer un compte', 'إنشاء حساب']),
  checkout: words(['checkout', 'payment', 'pay', 'order', 'place order', 'cart', 'shipping', 'delivery', 'commande', 'commander', 'livraison', 'paiement', 'panier', 'الدفع', 'التوصيل']),
  booking: words(['booking', 'book', 'reservation', 'reservations', 'reserve', 'reserver', 'rdv', 'rendez vous', 'حجز']),
  contact: words(['contact', 'support', 'enquiry', 'inquiry', 'enquire', 'requests', 'تواصل', 'اتصل']),
  search: words(['search', 'recherche', 'بحث']),
  other: words(['survey', 'questionnaire', 'settings', 'profile', 'profil', 'preferences', 'admin', 'apply', 'application', 'candidature', 'candidatures', 'billing', 'addresses', 'parametres', 'security']),
};

const contains = (text: string, phrase: string) => ` ${text} `.includes(` ${phrase} `);
const VISIBLE = new Set(['visible', 'attribute']);
const texts = (signals: readonly Signal[]) => signals.filter(signal => VISIBLE.has(SOURCE_GROUP[signal.source])).map(signal => signal.text);
const mentions = (signals: readonly Signal[], phrases: readonly string[]) => texts(signals).some(text => phrases.some(phrase => contains(text, phrase)));
// "From", "Du 12 au 14": the visible label starts with the word.
const visibleText = (signals: readonly Signal[]) => signals.find(signal => SOURCE_GROUP[signal.source] === 'visible')?.text ?? '';
const startsWith = (signals: readonly Signal[], list: readonly string[]) => { const text = visibleText(signals); return list.some(word => text === word || text.startsWith(`${word} `)); };
// "Period from", "Valid to": the label ends with the word. French articles ("de", "au") end too many labels.
const ARTICLES: ReadonlySet<string> = new Set(['de', 'du', 'au']);
const endsWith = (signals: readonly Signal[], list: readonly string[]) => { const text = visibleText(signals); return list.some(word => !ARTICLES.has(word) && text.endsWith(` ${word}`)); };
const evidence = (signal: string, weight: number): Evidence => ({ source: 'form', signal, weight, match: 'context' });
const quote = (el: Control) => `“${displayLabel(el).slice(0, 40)}”`;

interface Pass { members: readonly Control[]; fields: Map<Control, Classification>; signals: (el: Control) => Signal[] }
const get = (pass: Pass, el: Control) => pass.fields.get(el)!;
// Context refines ordinary fields only. A sensitive field stays sensitive whatever its neighbours say.
function update(pass: Pass, el: Control, change: Partial<Classification>, reason: Evidence) {
  const current = get(pass, el);
  if (isSensitive(current.type) || current.fixed) return;
  pass.fields.set(el, { ...current, ...change, evidence: [...current.evidence, reason] });
}
const retype = (pass: Pass, el: Control, type: FieldKey, role: FieldRole | undefined, reason: Evidence, extra: Partial<Classification> = {}) =>
  update(pass, el, { type, role, confidence: Math.max(get(pass, el).confidence, reason.weight), ...extra }, reason);

const isTextInput = (el: Control) => el instanceof HTMLInputElement && ['text', 'email', 'tel', 'password', ''].includes(el.type);

// "Confirm", "Repeat your email", "Retype it": the field repeats one of the few just before it,
// preferably the one of the type its own words name ("Re-enter email" repeats the email).
function linkConfirmations(pass: Pass) {
  pass.members.forEach((el, i) => {
    const signals = pass.signals(el);
    if (!isTextInput(el) || !mentions(signals, PAIR_PHRASES)) return;
    const own = get(pass, el);
    const named = new Set<string>([own.type, ...own.candidates.map(candidate => candidate.type)]);
    const targets = pass.members.slice(Math.max(0, i - 3), i).reverse().filter(target => get(pass, target).role !== 'confirm' && CONFIRMABLE_TYPES.has(get(pass, target).type as FieldKey));
    const target = targets.find(candidate => named.has(get(pass, candidate).type)) ?? targets[0];
    if (!target) return;
    const type = get(pass, target).type as FieldKey;
    // An unrecognized field only pairs on a short label that is mostly the confirm word.
    const short = visibleText(signals).split(' ').length <= 4;
    if (own.type === type || (own.type === 'unknown' && short) || (own.confidence < THRESHOLDS.medium && named.has(type))) retype(pass, el, type, 'confirm', evidence(`confirms ${quote(target)}`, 0.85), { pairOf: target });
  });
}

// A change-password form: the current password, then a new one and its confirmation.
function passwordRoles(pass: Pass) {
  const passwords = pass.members.filter(el => get(pass, el).type === 'password');
  if (passwords.length < 2) return;
  for (const el of passwords) {
    const found = get(pass, el);
    if (found.role === 'confirm') continue;
    const ac = (el.getAttribute('autocomplete') || '').toLowerCase();
    const signals = pass.signals(el);
    const role: FieldRole | undefined = ac.includes('current-password') || mentions(signals, CURRENT_WORDS) ? 'current' : ac.includes('new-password') || mentions(signals, NEW_WORDS) ? 'new' : undefined;
    if (role) update(pass, el, { role }, evidence(role === 'current' ? 'the current password' : 'a new password', found.confidence));
  }
}

// "Interview date" after "Available from" is its own date, not the end of the start date. A bare
// "Date", a date with no words, an end word ("Policy expiry date") or the start's own subject
// ("Policy start date" → "Policy renewal date") still makes it the end.
// A deadline, not an expiry: an expiry date is its own date, not the end of the one before it.
const DEADLINE_WORDS = words(['deadline', 'due', 'due date', 'until', 'no later than', 'date limite', 'au plus tard', 'آخر أجل']);
const END_WORDS = words(['end', 'expiry', 'expiration', 'expires', 'until', 'deadline', 'due', 'return', 'fin', 'échéance', 'limite', 'retour', 'انتهاء', 'نهاية', 'العودة']);
const DATE_WORDS = new Set(words(['date', 'start', 'from', 'du', 'de', 'of', 'the', 'le', 'la', 'تاريخ']));
const labelWords = (signals: readonly Signal[]) => signals.filter(signal => SOURCE_GROUP[signal.source] === 'visible').flatMap(signal => signal.text.split(' ')).filter(word => word && !DATE_WORDS.has(word));
function ownDate(start: readonly Signal[], signals: readonly Signal[]): boolean {
  const own = labelWords(signals);
  // "Departure" or "Leaving on" after an arrival ends the stay.
  if (!own.length || own.some(word => END_WORDS.includes(word) || DEPARTURE_WORDS.includes(word))) return false;
  const subject = new Set(labelWords(start));
  return !own.some(word => subject.has(word));
}
// What the field itself says: its label, accessible name, placeholder, name and id, not a hint or title.
const OWN = new Set(['label', 'aria-label', 'aria-labelledby', 'placeholder', 'name', 'id']);
const ownWords = (signals: readonly Signal[]) => signals.filter(signal => OWN.has(signal.source)).map(signal => signal.text);
const isDateInput = (el: Control) => el instanceof HTMLInputElement && (el.type === 'date' || el.type === 'datetime-local');

// Start and end dates: "Arrival" then "Departure", "From"/"To", "Du"/"Au", "من"/"إلى", or an
// unlabelled date just after a start date.
function dateRoles(pass: Pass) {
  const dates = pass.members.filter(el => !(el instanceof HTMLSelectElement) && !isSensitive(get(pass, el).type) && (isDateInput(el) || DATE_FIELD_TYPES.has(get(pass, el).type as FieldKey)) && get(pass, el).type !== 'birthDate');
  // "Date you'd like to start", "started_on", "Week commencing": a plain date whose
  // own words name a beginning is a start date, alone or before its end.
  for (const el of dates) {
    const found = get(pass, el);
    if ((found.type === 'date' || (found.type === 'unknown' && isDateInput(el))) && ownWords(pass.signals(el)).some(text => START_WORDS.some(word => contains(text, word)))) retype(pass, el, 'startDate', 'start', evidence('a date that starts something', 0.75));
  }
  for (let k = 0; k + 1 < dates.length; k++) {
    const a = dates[k], b = dates[k + 1];
    const first = get(pass, a), second = get(pass, b);
    const [sa, sb] = [pass.signals(a), pass.signals(b)];
    const fromTo = (startsWith(sa, FROM_WORDS) && startsWith(sb, TO_WORDS)) || (endsWith(sa, FROM_WORDS) && endsWith(sb, TO_WORDS));
    const leaving = first.type === 'startDate' && second.type === 'startDate' && mentions(sb, DEPARTURE_WORDS);
    const follows = first.type === 'startDate' && (second.type === 'unknown' || (second.type === 'date' && !ownDate(sa, sb)));
    const precedes = (first.type === 'unknown' || first.type === 'date') && second.type === 'endDate';
    // "Drop-off" then "Need it back by", "Order placed" then "Deliver by": a plain date followed by a
    // deadline is a start and an end.
    const plain = (found: Classification) => found.type === 'date' || found.type === 'unknown';
    const deadline = plain(first) && plain(second) && (/(?:^| )by$/.test(visibleText(sb)) || mentions(sb, DEADLINE_WORDS));
    if (fromTo || precedes || deadline) retype(pass, a, 'startDate', 'start', evidence(`before ${quote(b)}`, 0.8));
    if (fromTo || leaving || follows || deadline) retype(pass, b, 'endDate', 'end', evidence(`after ${quote(a)}`, 0.8), { after: a });
    else if (first.type === 'startDate' && second.type === 'endDate') update(pass, b, { role: 'end', after: a }, evidence(`after ${quote(a)}`, second.confidence));
  }
}

const isDateLike = (el: Control, type: string) => DATE_FIELD_TYPES.has(type as FieldKey) || (el instanceof HTMLInputElement && ['date', 'month'].includes(el.type)) || (el instanceof HTMLSelectElement && !!datePart(optionTexts(el)));
// Fields that could hold card data: text, a number or a select. A time or a URL can't.
const couldHoldCard = (el: Control) => el instanceof HTMLSelectElement || (el instanceof HTMLInputElement && ['text', 'tel', 'password', 'number', ''].includes(el.type));
// A field that says what it is, such as autocomplete="bday", keeps its type beside card fields.
const declared = (el: Control) => { const token = autocompleteToken(el).toLowerCase(); return Object.hasOwn(AUTOCOMPLETE, token); };

// "Expiry" or "PIN" is card data only on a page that has a card field (a checkout may split its card
// across forms); elsewhere it is a passport expiry or an account PIN, and gets the type its words give.
function confirmCards(fields: Map<Control, Classification>) {
  const card = [...fields.values()].some(found => found.type === 'skip:card' && !found.unconfirmed);
  for (const [el, found] of fields) {
    if (found.unconfirmed) fields.set(el, card ? { ...found, unconfirmed: undefined } : { ...found.unconfirmed, signals: found.signals });
  }
}

// In the same section as card fields, a name is the cardholder's, a month, year or date is the
// card's expiry, and anything unrecognized is most likely card data too: none of them is filled.
// Four or more one-character boxes in a row are one code typed digit by digit: a one-time code,
// never test data. One box of the row may take two characters. (A card number in four boxes takes
// four characters per box.) A box read as something else, a ZIP code typed digit by digit, breaks
// the row.
const codeBoxSize = (el: Control) => el instanceof HTMLInputElement && ['text', 'tel', 'number', 'password', ''].includes(el.type) && el.maxLength >= 1 && el.maxLength <= 2 ? el.maxLength : 0;
function codeBoxes(pass: Pass) {
  const run: Control[] = [];
  const close = () => {
    const single = run.filter(el => codeBoxSize(el) === 1).length;
    if (run.length >= 4 && single >= run.length - 1) for (const el of run) pass.fields.set(el, { ...get(pass, el), type: 'skip:otp', confidence: 1, candidates: [], evidence: [{ source: 'form', signal: `${run.length} one-character boxes in a row`, weight: 1, match: 'sensitive' }] });
    run.length = 0;
  };
  for (const el of pass.members) { if (codeBoxSize(el) && get(pass, el).type === 'unknown') run.push(el); else close(); }
  close();
}

// A date split into day, month and year is a birth date when any part, or the words just before the
// first, say "birth": "Date of Birth" over three selects, dayofbirth / monthofbirth / yearOfBirth.
// Only selects of days, months or years are parts: a whole date beside a birth date ("Start date")
// is a date of its own, and a year typed into a text box can't hold a whole date.
const BIRTH = /birth|\bdob\b|dob[_-]|naissance|\bborn\b|ميلاد/i;
const isDatePart = (_pass: Pass, el: Control) => el instanceof HTMLSelectElement && !!datePart(optionTexts(el));
function birthDateParts(pass: Pass) {
  const run: Control[] = [];
  const close = () => {
    const birth = run.length >= 2 && run.some(el => pass.signals(el).some(signal => BIRTH.test(signal.raw)));
    if (birth) for (const el of run) if (get(pass, el).type !== 'birthDate') retype(pass, el, 'birthDate', undefined, evidence('a part of a split birth date', 0.85));
    run.length = 0;
  };
  for (const el of pass.members) { if (isDatePart(pass, el)) run.push(el); else close(); }
  close();
}

function cardSection(pass: Pass, all: readonly Control[]) {
  const cards = all.filter(el => get(pass, el).type === 'skip:card');
  if (!cards.length) return;
  const sections = new Map<Element, boolean>(); // section → whether it also holds address fields
  for (const card of cards) {
    for (let node = card.parentElement, depth = 0; node && depth < 4 && node !== card.form && node !== document.body; node = node.parentElement, depth++) {
      if (!sections.has(node)) sections.set(node, all.some(other => node!.contains(other) && ADDRESS_TYPES.has(get(pass, other).type)));
    }
  }
  for (const el of all) {
    const found = get(pass, el);
    const name = NAME_TYPES.has(found.type) && !/shipping|billing/.test((el.getAttribute('autocomplete') || '').toLowerCase());
    if (declared(el) && !name) continue;
    // A plain or unrecognized date is the card's expiry; a birthday or a named start date is not.
    // A year beside the card ("YYYY") is its expiry year too.
    const expiry = (isDateLike(el, found.type) && (found.type === 'date' || found.type === 'unknown' || found.confidence < THRESHOLDS.medium)) || found.type === 'year';
    if (!name && !expiry && !(found.type === 'unknown' && couldHoldCard(el))) continue;
    for (let node = el.parentElement, depth = 0; node && depth < 4 && node !== el.form && node !== document.body; node = node.parentElement, depth++) {
      if (!sections.has(node)) continue;
      if (!sections.get(node)) update(pass, el, { type: 'skip:card', role: name ? 'cardholder' : undefined, confidence: 1 }, { source: 'form', signal: name ? 'a name beside card fields' : 'beside card fields', weight: 1, match: 'sensitive' });
      break;
    }
  }
}

// "Grade — précisez", "Other (please specify)": a text field that completes the choice just before
// it, and shares a word of its label, holds the same kind of value.
function specifyCompanions(pass: Pass) {
  pass.members.forEach((el, i) => {
    if (i === 0 || !(el instanceof HTMLInputElement) || !['text', ''].includes(el.type) || !mentions(pass.signals(el), SPECIFY_WORDS)) return;
    const choice = pass.members[i - 1];
    const found = get(pass, choice);
    if (!(choice instanceof HTMLSelectElement || isChoice(choice)) || found.type === 'unknown' || isSensitive(found.type) || get(pass, el).confidence >= THRESHOLDS.medium) return;
    const own = new Set(visibleText(pass.signals(el)).split(' ').filter(word => word.length > 2 && !SPECIFY_WORDS.includes(word)));
    if (!visibleText(pass.signals(choice)).split(' ').some(word => own.has(word))) return;
    retype(pass, el, found.type as FieldKey, undefined, evidence(`completes ${quote(choice)}`, 0.7));
  });
}

// Weak guesses that fit their neighbours ("Last name" after "First name") gain confidence.
function fieldOrder(pass: Pass) {
  pass.members.forEach((el, i) => {
    if (i === 0) return;
    const previous = get(pass, pass.members[i - 1]).type as FieldKey;
    const found = get(pass, el);
    if (found.confidence >= THRESHOLDS.medium || isSensitive(found.type)) return;
    const fitting = found.candidates.find(candidate => NEXT[previous]?.includes(candidate.type) && candidate.score >= 0.4);
    if (!fitting || (found.type !== 'unknown' && found.type !== fitting.type)) return;
    const confidence = Math.min(THRESHOLDS.medium - 0.01, Math.max(found.confidence, fitting.score) + (1 - fitting.score) * 0.25);
    update(pass, el, { type: fitting.type, confidence }, evidence(`follows ${quote(pass.members[i - 1])}`, 0.25));
  });
}

// "Company" then "Title": beside the person's employer, a bare title is their job title, not the
// title of a thing. Only a title whose words say nothing more ("Title", "Titre").
const WORK_TYPES: ReadonlySet<string> = new Set(['company', 'department', 'industry']);
// A form that asks for an email and has one text area with no clue of its own ("input_10"): the
// message, as a weak answer that any clue or the model still overrides. Captcha and spam-trap
// boxes don't count.
const NOT_WRITTEN = /captcha|hp_textarea|honeypot/i;
function soleMessage(pass: Pass, visible?: ReadonlyMap<Control, boolean>) {
  const areas = pass.members.filter(el => el instanceof HTMLTextAreaElement && !NOT_WRITTEN.test(`${el.name} ${el.id}`) && (visible?.get(el) ?? isVisible(el)));
  if (areas.length !== 1 || !pass.members.some(el => get(pass, el).type === 'email')) return;
  const [area] = areas;
  if (get(pass, area).type === 'unknown') retype(pass, area, 'message', undefined, evidence('the one text area of a form asking for an email', THRESHOLDS.low));
  // "Description", "Details" there is what the person asks: the message. A form about a thing (a
  // listing with a title and a price) keeps its description.
  const thing = pass.members.some(el => THING_TYPES.has(get(pass, el).type));
  if (get(pass, area).type === 'description' && !thing) retype(pass, area, 'message', undefined, evidence('the one text area of a form asking for an email', get(pass, area).confidence));
}
const THING_TYPES: ReadonlySet<string> = new Set(['title', 'price', 'amount', 'quantity', 'measurement', 'material', 'color']);

// A lead form's "Title" is a job title: when its own words say "Job title", or when a work field
// (company, department…) is among the three fields on either side.
function jobTitles(pass: Pass) {
  pass.members.forEach((el, i) => {
    const found = get(pass, el);
    if (found.type !== 'title') return;
    if (mentions(pass.signals(el), ['job title', 'job'])) return retype(pass, el, 'jobTitle', undefined, evidence('says “job title”', Math.max(found.confidence, 0.8)));
    if (visibleText(pass.signals(el)).split(' ').length > 1) return;
    const neighbour = pass.members.slice(Math.max(0, i - 3), i + 4).find(other => other !== el && WORK_TYPES.has(get(pass, other).type));
    if (neighbour) retype(pass, el, 'jobTitle', undefined, evidence(`beside ${quote(neighbour)}`, Math.max(found.confidence, 0.7)));
  });
}

// What kind of form this is, from its fields and the words on its action, id and submit button.
export function formType(form: HTMLFormElement, types: readonly string[], roles: readonly (FieldRole | undefined)[]): { type: FormType; confidence: number } {
  const count = (type: string) => types.filter(found => found === type).length;
  const has = (...wanted: string[]) => wanted.some(type => types.includes(type));
  const fields = types.length;
  const button = form.querySelector('button[type="submit"], button:not([type]), input[type="submit"]');
  const text = normalize([form.getAttribute('action'), form.id, form.getAttribute('name'), form.getAttribute('aria-label'), button?.textContent, button?.getAttribute('value')].filter(Boolean).join(' '));
  const scores: Record<FormType, number> = { login: 0, signup: 0, checkout: 0, booking: 0, contact: 0, search: 0, other: 0 };
  if (form.matches('[role="search"]') || (fields <= 2 && has('search'))) scores.search = 0.95;
  if (count('password') === 1 && fields <= 4 && has('email', 'username') && !has('firstName', 'lastName', 'fullName', 'address')) scores.login = 0.85;
  if ((count('password') >= 2 && !roles.includes('current')) || (count('password') >= 1 && has('firstName', 'lastName', 'fullName', 'birthDate'))) scores.signup = 0.8;
  if (has('skip:card')) scores.checkout = 0.85;
  else if (has('address') && has('postalCode', 'city')) scores.checkout = 0.45;
  if ((has('startDate') && has('endDate')) || (has('date', 'startDate') && has('time'))) scores.booking = 0.75;
  if (has('message', 'subject', 'description') && has('email', 'phone') && !has('password', 'skip:card') && fields <= 10) scores.contact = 0.7;
  for (const [type, list] of Object.entries(FORM_WORDS) as [FormType, readonly string[]][]) {
    if (!list.some(word => contains(text, word))) continue;
    // "survey", "settings", "profile": words that say this isn't one of the common kinds. Other words
    // only confirm what the fields suggest: an "order" form with no address or card isn't a checkout.
    scores[type] = type === 'other' ? 0.75 : scores[type] > 0 ? 1 - (1 - scores[type]) * 0.5 : 0;
  }
  const [best, score] = (Object.entries(scores) as [FormType, number][]).sort((x, y) => y[1] - x[1])[0];
  return score >= THRESHOLDS.low ? { type: best, confidence: Math.round(score * 100) / 100 } : { type: 'other', confidence: 0 };
}

const classifiable = (el: Control) => !(el instanceof HTMLInputElement && [...OMITTED_TYPES, 'file'].includes(el.type));

// Classifies every control, then adjusts each form's fields using the form as context.
// Your type rules for this site: the selector saved from the side panel, matched on this page.
function ruleFor(el: Control, rules: readonly TypeRule[]): TypeRule | undefined {
  const host = location.hostname;
  return rules.find(rule => (!rule.site || rule.site === host) && (() => { try { return el.matches(rule.selector); } catch { return false; } })());
}

// Each field on its own, before the form is read as a whole.
export function firstPass(controls: readonly Control[], rules: readonly TypeRule[] = []): Map<Control, Classification> {
  const fields = new Map<Control, Classification>();
  indexRadios(controls);
  try {
    for (const el of controls) if (classifiable(el)) fields.set(el, classifyField(el));
  } finally { indexRadios(undefined); }
  confirmCards(fields);
  // A sensitive field stays sensitive even if a rule says otherwise: it is never filled.
  if (rules.length) for (const [el, found] of fields) {
    const rule = ruleFor(el, rules);
    if (rule && !isSensitive(found.type)) fields.set(el, { ...found, type: rule.type, confidence: rule.type === 'unknown' ? 0 : 1, candidates: [], evidence: [{ source: 'rule', signal: 'set for this site', weight: 1, match: 'context' }], fixed: true });
  }
  return fields;
}

export function analyzePage(controls: readonly Control[], visible?: ReadonlyMap<Control, boolean>, rules: readonly TypeRule[] = [], model = true): PageAnalysis {
  const fields = firstPass(controls, rules);
  // The model reads each field as the first pass saw it, as in training.
  const first = new Map(fields);
  const signals = (el: Control) => fields.get(el)?.signals ?? describeSignals(el);
  const groups = new Map<HTMLFormElement | null, Control[]>();
  for (const el of fields.keys()) { const members = groups.get(el.form) ?? []; members.push(el); groups.set(el.form, members); }
  const forms: FormInsight[] = [];
  for (const [form, members] of groups) {
    // Split day/month/year selects are one date, handled when filling; they don't take part here.
    const pass: Pass = { members: members.filter(el => !(el instanceof HTMLSelectElement && datePart(optionTexts(el)))), fields, signals };
    linkConfirmations(pass);
    passwordRoles(pass);
    dateRoles(pass);
    codeBoxes(pass);
    // Split day/month/year selects take part here: they are the parts.
    birthDateParts({ ...pass, members });
    cardSection(pass, members);
    specifyCompanions(pass);
    jobTitles(pass);
    fieldOrder(pass);
    if (!form) continue;
    // A form is judged by what the user can see: hidden fields and hidden forms don't count.
    const shown = members.filter(el => (visible?.get(el) ?? isVisible(el)));
    if (!shown.length) continue;
    const types = shown.filter(el => !isChoice(el)).map(el => fields.get(el)!.type);
    const kind = formType(form, types, shown.map(el => fields.get(el)!.role));
    // An order's or a booking's text area holds notes ("delivery instructions"), not a message.
    if (kind.type !== 'checkout' && kind.type !== 'booking') soleMessage(pass, visible);
    forms.push({ index: Array.from(document.forms).indexOf(form), fields: shown.length, ...kind });
  }
  // Last, so confirmations, dates, neighbours and card sections speak first, and form types come
  // from the rules alone: the model only names fields they still leave unknown or unsure.
  if (model) secondOpinion(controls, fields, first);
  return { fields, forms };
}
