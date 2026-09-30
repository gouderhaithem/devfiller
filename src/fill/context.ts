import type { FieldKey } from '../data';
import type { Control, FormInsight } from './types';
import { classifyField, datePart, isSensitive, SOURCE_GROUP, THRESHOLDS, type Classification, type Evidence, type FieldRole } from './classify';
import { CONFIRMABLE_TYPES, DATE_FIELD_TYPES, PAIR_PHRASES } from './dictionary';
import { describeSignals, displayLabel, indexRadios, isChoice, isVisible, OMITTED_TYPES, optionTexts, type Signal } from './extract';
import { normalize } from './normalize';

// The second pass: after each field is classified on its own, read each form as a whole.

export type FormType = 'login' | 'signup' | 'checkout' | 'booking' | 'contact' | 'search' | 'other';
export interface PageAnalysis { fields: Map<Control, Classification>; forms: FormInsight[] }

const words = (list: readonly string[]) => list.map(normalize);
const CURRENT_WORDS = words(['current', 'old', 'existing', 'actuel', 'actuelle', 'ancien', 'ancienne', 'الحالية', 'الحالي', 'القديمة']);
const NEW_WORDS = words(['new', 'nouveau', 'nouvelle', 'الجديدة', 'الجديد']);
const FROM_WORDS = words(['from', 'du', 'de', 'start', 'begin', 'depuis', 'من']);
const TO_WORDS = words(['to', 'au', 'until', 'end', 'jusqu au', 'الى', 'حتى']);
const DEPARTURE_WORDS = words(['departure', 'depart', 'départ', 'leaving', 'المغادرة']);
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
const evidence = (signal: string, weight: number): Evidence => ({ source: 'form', signal, weight, match: 'context' });
const quote = (el: Control) => `“${displayLabel(el).slice(0, 40)}”`;

interface Pass { members: readonly Control[]; fields: Map<Control, Classification>; signals: (el: Control) => Signal[] }
const get = (pass: Pass, el: Control) => pass.fields.get(el)!;
// Context refines ordinary fields only. A sensitive field stays sensitive whatever its neighbours say.
function update(pass: Pass, el: Control, change: Partial<Classification>, reason: Evidence) {
  const current = get(pass, el);
  if (isSensitive(current.type)) return;
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

const isDateInput = (el: Control) => el instanceof HTMLInputElement && (el.type === 'date' || el.type === 'datetime-local');

// Start and end dates: "Arrival" then "Departure", "From"/"To", "Du"/"Au", "من"/"إلى", or an
// unlabelled date just after a start date.
function dateRoles(pass: Pass) {
  const dates = pass.members.filter(el => !(el instanceof HTMLSelectElement) && !isSensitive(get(pass, el).type) && (isDateInput(el) || DATE_FIELD_TYPES.has(get(pass, el).type as FieldKey)) && get(pass, el).type !== 'birthDate');
  for (let k = 0; k + 1 < dates.length; k++) {
    const a = dates[k], b = dates[k + 1];
    const first = get(pass, a), second = get(pass, b);
    const [sa, sb] = [pass.signals(a), pass.signals(b)];
    const fromTo = startsWith(sa, FROM_WORDS) && startsWith(sb, TO_WORDS);
    const leaving = first.type === 'startDate' && second.type === 'startDate' && mentions(sb, DEPARTURE_WORDS);
    const follows = first.type === 'startDate' && (second.type === 'unknown' || second.type === 'date');
    const precedes = (first.type === 'unknown' || first.type === 'date') && second.type === 'endDate';
    if (fromTo || precedes) retype(pass, a, 'startDate', 'start', evidence(`before ${quote(b)}`, 0.8));
    if (fromTo || leaving || follows) retype(pass, b, 'endDate', 'end', evidence(`after ${quote(a)}`, 0.8), { after: a });
    else if (first.type === 'startDate' && second.type === 'endDate') update(pass, b, { role: 'end', after: a }, evidence(`after ${quote(a)}`, second.confidence));
  }
}

const isDateLike = (el: Control, type: string) => DATE_FIELD_TYPES.has(type as FieldKey) || (el instanceof HTMLInputElement && ['date', 'month'].includes(el.type)) || (el instanceof HTMLSelectElement && !!datePart(optionTexts(el)));

// In the same section as card fields, a name is the cardholder's, a month, year or date is the
// card's expiry, and anything unrecognized is most likely card data too: none of them is filled.
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
    if (!name && !isDateLike(el, found.type) && !(found.type === 'unknown' && !isChoice(el))) continue;
    for (let node = el.parentElement, depth = 0; node && depth < 4 && node !== el.form && node !== document.body; node = node.parentElement, depth++) {
      if (!sections.has(node)) continue;
      if (!sections.get(node)) update(pass, el, { type: 'skip:card', role: name ? 'cardholder' : undefined, confidence: 1 }, { source: 'form', signal: name ? 'a name beside card fields' : 'beside card fields', weight: 1, match: 'sensitive' });
      break;
    }
  }
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
    // "survey", "settings", "profile": words that say this isn't one of the common kinds.
    scores[type] = type === 'other' ? 0.75 : 1 - (1 - scores[type]) * 0.5;
  }
  const [best, score] = (Object.entries(scores) as [FormType, number][]).sort((x, y) => y[1] - x[1])[0];
  return score >= THRESHOLDS.low ? { type: best, confidence: Math.round(score * 100) / 100 } : { type: 'other', confidence: 0 };
}

const classifiable = (el: Control) => !(el instanceof HTMLInputElement && [...OMITTED_TYPES, 'file'].includes(el.type));

// Classifies every control, then adjusts each form's fields using the form as context.
export function analyzePage(controls: readonly Control[], visible?: ReadonlyMap<Control, boolean>): PageAnalysis {
  const fields = new Map<Control, Classification>();
  indexRadios(controls);
  try {
    for (const el of controls) if (classifiable(el)) fields.set(el, classifyField(el));
  } finally { indexRadios(undefined); }
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
    cardSection(pass, members);
    fieldOrder(pass);
    if (!form) continue;
    // A form is judged by what the user can see: hidden fields and hidden forms don't count.
    const shown = members.filter(el => (visible?.get(el) ?? isVisible(el)));
    if (!shown.length) continue;
    const types = shown.filter(el => !isChoice(el)).map(el => fields.get(el)!.type);
    forms.push({ index: Array.from(document.forms).indexOf(form), fields: shown.length, ...formType(form, types, shown.map(el => fields.get(el)!.role)) });
  }
  return { fields, forms };
}
