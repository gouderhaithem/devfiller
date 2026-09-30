import type { FieldKey } from '../data';
import type { Control } from './types';
import {
  AUTOCOMPLETE, COMPOUND_PARTS, CONFIRMABLE_TYPES, CONFIRM_PHRASES, CONSENT, DATE_FIELD_TYPES, EXACT, FUZZY_POOL, INPUT_MODE_HINTS, INPUT_TYPE_HINTS,
  CIVILITY, DECLARATION, DESCRIBING, DESCRIBING_ANSWER, DOCUMENT_PHRASES, NOT_TYPOS, PERSON_ROLE_PHRASES, GLUE_WORDS, ID_NUMBER_PHRASES, PLAIN_CARD_PHRASES, LANGUAGE_PHRASES, OTHER_CARD_PHRASES, PLACEHOLDER_OPTION, SESSION, JOINED, MULTILINE_TYPES, NUMERIC_TYPES, PHRASES, QUALIFIERS, SEARCH_PHRASES, SELECT_TYPES, SENSITIVE_GLUED, SENSITIVE_PHRASES, SENSITIVE_SECTION_PHRASES, SLUG_PHRASES, WEAK_CARD_PHRASES, WORDS, YES_NO,
  type AliasEntry, type SensitiveKind,
} from './dictionary';
import { autocompleteToken, describeSignals, isChoice, isDatePicker, isInput, isScale, optionTexts, radioGroup, type Signal, type SignalSource } from './extract';
import { MONTH_SET, OPTION_LISTS } from './vocabulary';
import { unitOf, type UnitKind } from './units';
import { placeholderOf, placeholderShape, SHAPE_TYPES } from './placeholder';
import { normalize } from './normalize';

export type FieldType = FieldKey | 'unknown' | `skip:${SensitiveKind | 'consent' | 'session'}`;
export type MatchKind = 'autocomplete' | 'type' | 'exact' | 'plural' | 'phrase' | 'joined' | 'word' | 'compound' | 'fuzzy' | 'generic' | 'sensitive' | 'against' | 'options' | 'context';
export type FieldRole = 'confirm' | 'current' | 'new' | 'start' | 'end' | 'cardholder';
export interface Evidence { source: SignalSource; signal: string; weight: number; match: MatchKind }
export interface Candidate { type: FieldKey; score: number; evidence: Evidence[] }
export interface Classification {
  type: FieldType;
  role?: FieldRole;        // set by the form-level pass
  pairOf?: Control;        // the field a confirmation repeats
  after?: Control;         // the start date an end date must follow
  signals?: Signal[];      // what the field said, kept for the form-level pass
  fixed?: boolean;         // set by your type rule: nothing refines it
  unconfirmed?: Classification; // a card guess from a word other documents share: what the field is if the form has no card
  confidence: number;      // 0..1, after the margin adjustment
  candidates: Candidate[]; // top alternatives, best first
  evidence: Evidence[];    // why the winning type won (or why the field is sensitive)
}

// Calibrated on the benchmark. Below `low`, a field is unknown.
export const THRESHOLDS = { high: 0.9, medium: 0.7, low: 0.5 } as const;
// When the runner-up is within this margin, the field is ambiguous and loses confidence.
const MARGIN = 0.15;

// How much each source is worth on its own. Sources in one group repeat each other (a label and a
// placeholder usually say the same thing), so only the strongest in a group counts.
const SOURCE_WEIGHT: Readonly<Record<SignalSource, number>> = { autocomplete: 0.98, type: 1, inputmode: 1, label: 0.9, 'aria-label': 0.9, 'aria-labelledby': 0.88, placeholder: 0.75, title: 0.6, nearby: 0.65, name: 0.8, id: 0.75, legend: 0.4, options: 1, form: 1, unit: 1, rule: 1, format: 1 };
export const SOURCE_GROUP: Readonly<Record<SignalSource, string>> = { autocomplete: 'autocomplete', type: 'type', inputmode: 'type', label: 'visible', 'aria-label': 'visible', 'aria-labelledby': 'visible', placeholder: 'visible', title: 'visible', nearby: 'visible', name: 'attribute', id: 'attribute', legend: 'context', options: 'options', form: 'form', unit: 'unit', rule: 'rule', format: 'format' };
// A radio group's question is its label.
const RADIO_LEGEND_WEIGHT = 0.85;
// How well a signal matches an alias: the whole signal beats a phrase inside it, which beats a word.
const MATCH_STRENGTH: Readonly<Partial<Record<MatchKind, number>>> = { exact: 1, plural: 0.95, phrase: 0.9, joined: 0.9, word: 0.75, compound: 0.7, fuzzy: 0.6, generic: 0.35 };
const TEXT_SOURCES: ReadonlySet<SignalSource> = new Set(['label', 'aria-label', 'aria-labelledby', 'placeholder', 'title', 'nearby', 'name', 'id', 'legend']);
// Sources that name a field on their own; without them, a title does.
const NAMING_SOURCES: ReadonlySet<SignalSource> = new Set(['label', 'aria-label', 'aria-labelledby', 'placeholder']);
// Matches of a single word, which a long question may mention in passing.
const WORD_MATCHES: ReadonlySet<MatchKind> = new Set(['word', 'generic', 'compound', 'fuzzy']);

type Match = readonly [AliasEntry, MatchKind];
const contains = (text: string, phrase: string) => ` ${text} `.includes(` ${phrase} `);

// Optimal string alignment distance, stopping early once it exceeds `limit`.
function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let before: number[] = [], previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) value = Math.min(value, before[j - 2] + 1);
      current.push(value);
      best = Math.min(best, value);
    }
    if (best > limit) return limit + 1;
    before = previous; previous = current;
  }
  return previous[b.length];
}

// Two typos only in one long word: across a phrase, two edits turn "project code" into "product code".
const allowedEdits = (alias: string) => !alias.includes(' ') && alias.length >= 10 ? 2 : 1;

// Typos: "Emial", "Frist name", "usrname". Only when nothing specific matched.
function fuzzyMatches(text: string): Match[] {
  const joined = text.replace(/ /g, '');
  const found: Match[] = [];
  for (const entry of FUZZY_POOL) {
    const limit = allowedEdits(entry.name);
    if (Math.abs(text.length - entry.name.length) > limit && Math.abs(joined.length - entry.tokens.join('').length) > limit) continue;
    if (editDistance(text, entry.name, limit) <= limit || (!text.includes(' ') && entry.tokens.length > 1 && editDistance(joined, entry.tokens.join(''), limit) <= limit)) found.push([entry, 'fuzzy']);
  }
  if (found.length) return found;
  // Inside a longer label only longer words with the same first letter may be typos: "wage" is
  // one edit from "page", "estate" from "state", and "piece" from "pieces".
  for (const token of text.split(' ')) {
    if (token.length < 6 || NOT_TYPOS.has(token)) continue;
    for (const entry of FUZZY_POOL) if (entry.tokens.length === 1 && entry.name.length >= 5 && entry.name[0] === token[0] && Math.abs(token.length - entry.name.length) <= 1 && editDistance(token, entry.name, allowedEdits(entry.name)) <= allowedEdits(entry.name)) found.push([entry, 'fuzzy']);
  }
  return found;
}

const singular = (word: string) => word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : '';

// Whether the rest of a glued word is itself meaningful, so "useremail" counts but "statement"
// ("state" + "ment") and "headphone" ("head" + "phone") don't.
const knownPiece = (piece: string) => QUALIFIERS.includes(piece) || GLUE_WORDS.has(piece) || WORDS.has(piece) || JOINED.has(piece);

// A known word glued to another: "useremail", "billingpostalcode", "mobilephone", "orderquantity".
function compoundPart(token: string): AliasEntry[] | undefined {
  for (let size = token.length - 2; size >= 4; size--) {
    const head = token.slice(0, size), tail = token.slice(size);
    const front = COMPOUND_PARTS.get(head) ?? (WORDS.get(head)?.filter(entry => !entry.generic && head.length >= 4));
    if (front?.length && knownPiece(tail)) return front;
    const endHead = token.slice(0, token.length - size), end = token.slice(token.length - size);
    const back = COMPOUND_PARTS.get(end) ?? (WORDS.get(end)?.filter(entry => !entry.generic && end.length >= 4));
    if (back?.length && knownPiece(endHead)) return back;
  }
  return undefined;
}

// Every alias a normalized signal mentions. A phrase consumes its words, so "email address"
// never also votes for "address".
export function matchText(text: string): Match[] {
  const whole = EXACT.get(text);
  if (whole) return whole.map(entry => [entry, 'exact']);
  // "phonenumber", and "addressline 2" once the trailing number is split off.
  const glued = JOINED.get(text.replace(/ /g, ''));
  if (glued) return glued.map(entry => [entry, 'joined']);
  const plural = EXACT.get(singular(text));
  if (plural) return plural.map(entry => [entry, 'plural']);
  const tokens = text.split(' ');
  const covered = tokens.map(() => false);
  const found: Match[] = [];
  tokens.forEach((token, i) => {
    if (covered[i]) return;
    const phrase = (PHRASES.get(token) ?? []).find(entry => entry.tokens.every((word, j) => tokens[i + j] === word && !covered[i + j]));
    if (!phrase) return;
    found.push([phrase, 'phrase']);
    phrase.tokens.forEach((_, j) => { covered[i + j] = true; });
  });
  tokens.forEach((token, i) => {
    if (covered[i]) return;
    const words = WORDS.get(token) ?? WORDS.get(singular(token));
    if (words) { for (const entry of words) found.push([entry, entry.generic ? 'generic' : 'word']); return; }
    const part = token.length >= 6 ? compoundPart(token) : undefined;
    if (part) for (const entry of part) found.push([entry, 'compound']);
  });
  if (found.every(([, kind]) => kind === 'generic')) found.push(...fuzzyMatches(text));
  return found;
}

// Card, one-time-code and bank fields, found before any scoring so they can never be filled.
// `weak` marks a card word other documents share ("Expiry", "PIN"): the form must confirm it.
export function sensitiveKind(el: Control, signals: readonly Signal[]): { kind: SensitiveKind; evidence: Evidence; weak?: boolean } | undefined {
  for (const token of (el.getAttribute('autocomplete') || '').toLowerCase().split(/\s+/)) {
    if (token.startsWith('cc-')) return { kind: 'card', evidence: { source: 'autocomplete', signal: token, weight: 1, match: 'sensitive' } };
    if (token === 'one-time-code') return { kind: 'otp', evidence: { source: 'autocomplete', signal: token, weight: 1, match: 'sensitive' } };
  }
  // A checkbox or radio can't hold a card number or a code: "Pay by card" is a choice, not card data.
  if (isChoice(el)) return undefined;
  const kinds: SensitiveKind[] = ['card', 'otp', 'iban'];
  let weak: { kind: SensitiveKind; evidence: Evidence; weak: true } | undefined;
  for (const signal of signals) {
    if (!TEXT_SOURCES.has(signal.source)) continue;
    const phrases = signal.source === 'legend' ? SENSITIVE_SECTION_PHRASES : SENSITIVE_PHRASES;
    const glued = signal.source !== 'legend' ? signal.text.split(' ') : [];
    // "Numéro de carte d'identité": another card owns the plain card words, never "credit card" or "CVV".
    const otherCard = OTHER_CARD_PHRASES.some(phrase => contains(signal.text, phrase));
    const matches = (k: SensitiveKind) => {
      const words = phrases[k].filter(phrase => contains(signal.text, phrase) && !(k === 'card' && otherCard && PLAIN_CARD_PHRASES.has(phrase)));
      return words.length > 0 || glued.some(token => SENSITIVE_GLUED[k].test(token));
    };
    const kind = kinds.find(matches);
    if (kind) return { kind, evidence: { source: signal.source, signal: signal.raw, weight: 1, match: 'sensitive' } };
    // "Passport expiry", "Certificate expiration": a document's date, not a card's.
    const document = otherCard || DOCUMENT_PHRASES.some(phrase => contains(signal.text, phrase));
    if (!weak && !document && signal.source !== 'legend' && WEAK_CARD_PHRASES.some(phrase => contains(signal.text, phrase))) weak = { kind: 'card', evidence: { source: signal.source, signal: signal.raw, weight: 1, match: 'sensitive' }, weak: true };
  }
  return weak;
}

// Checkboxes, radios and yes/no selects about terms, privacy, newsletters or marketing are never touched.
function consentEvidence(el: Control, signals: readonly Signal[]): Evidence | undefined {
  // A scale ("Strongly disagree … Strongly agree") is an opinion, whatever its question says.
  if (isChoice(el) && el.type === 'radio' && isScale(optionTexts(el))) return undefined;
  // A radio's own label is left out of its signals, but "I agree" on any answer in the group
  // makes the whole group a consent question.
  const own: Signal[] = isChoice(el) && el.type === 'radio' ? radioGroup(el).flatMap(radio => Array.from(radio.labels || [], label => ({ source: 'label' as const, raw: (label.textContent || '').trim().slice(0, 120), text: normalize(label.textContent || '') }))) : [];
  // In a radio group, words that describe ("Returns accepted?", "Oui, notification reçue") aren't
  // asking for permission; everything else still counts, answers included ("Yes, send me offers").
  const radio = isChoice(el) && el.type === 'radio';
  const texts = signals.filter(signal => TEXT_SOURCES.has(signal.source)).map(signal => radio ? { ...signal, text: signal.text.replace(DESCRIBING, ' ') } : signal);
  const answers = own.map(signal => ({ ...signal, text: signal.text.replace(DESCRIBING_ANSWER, ' ') }));
  const found = [...texts, ...answers].find(signal => CONSENT.test(signal.text)) ?? texts.find(signal => (signal.source === 'label' || signal.source === 'nearby') && DECLARATION.test(signal.text));
  return found && { source: found.source, signal: found.raw, weight: 1, match: 'sensitive' };
}

// A date or time format in the placeholder ("MM/DD/YYYY") outranks type="tel", which some date
// fields use to get a numeric keyboard.
const showsDateOrTime = (el: Control) => ['date', 'time'].includes(placeholderShape(placeholderOf(el))?.kind ?? '');

// What the field's format says: a placeholder shaped like an email, a URL, a phone number, a date
// or a year, or a date picker's markup. A date format backs whichever date the words name.
function formatEvidence(el: Control, byType: Map<FieldKey, Evidence[]>, add: (type: FieldKey, evidence: Evidence) => void) {
  const placeholder = placeholderOf(el);
  const shape = placeholderShape(placeholder);
  const hinted = shape && SHAPE_TYPES[shape.kind];
  const picker = !hinted && isDatePicker(el) ? ['date', 0.8] as const : undefined;
  const [type, weight] = hinted ?? picker ?? [];
  if (!type || !weight) return;
  const evidence: Evidence = { source: 'format', signal: picker ? 'date picker' : placeholder, weight, match: 'type' };
  const named = type === 'date' ? [...byType.keys()].filter(key => DATE_FIELD_TYPES.has(key)) : [];
  for (const key of named.length ? named : [type]) add(key, evidence);
}

// An option that is a date: "2026-05-01", "01/05/2026", or a year on its own ("2000 sq ft" isn't).
const DATE_TEXT = /\d{4}-\d{2}|\d{1,2}[/.]\d{1,2}[/.]\d{2,4}|^\s*(?:19|20)\d{2}\s*$/;
// Negative evidence: the kind of control pushes down types it can't hold.
function against(el: Control, type: FieldKey, signals: readonly Signal[]): Evidence[] {
  const found: Evidence[] = [];
  const push = (source: SignalSource, signal: string, factor: number) => found.push({ source, signal, weight: -factor, match: 'against' });
  if (isInput(el)) {
    const ac = (el.getAttribute('autocomplete') || '').toLowerCase();
    if ((el.type === 'password' || ac.includes('password')) && type !== 'password') push('type', 'password', 0.9);
    else if (el.type === 'email' && type !== 'email') push('type', 'email', 0.6);
    else if (el.type === 'tel' && type !== 'phone' && !showsDateOrTime(el)) push('type', 'tel', 0.6);
    else if (el.type === 'url' && type !== 'website') push('type', 'url', 0.6);
    else if ((el.type === 'number' || el.type === 'range') && !NUMERIC_TYPES.has(type)) push('type', el.type, 0.6);
    else if (['date', 'datetime-local', 'month', 'week'].includes(el.type) && !DATE_FIELD_TYPES.has(type)) push('type', el.type, 0.7);
    else if (el.type === 'time' && type !== 'time') push('type', 'time', 0.7);
    else if (el.type === 'color' && type !== 'color') push('type', 'color', 0.7);
  }
  if (el instanceof HTMLTextAreaElement && !MULTILINE_TYPES.has(type)) push('type', 'textarea', 0.5);
  // A unit means a number: "Longueur (mm)" isn't a name or a city.
  const unit = unitOf(signals);
  if (unit && !NUMERIC_TYPES.has(type) && type !== 'date') push('unit', unit.symbol, 0.5);
  const options = el instanceof HTMLSelectElement ? optionTexts(el) : [];
  // A select of the person's own addresses may be an email; other selects can't hold one.
  const emails = type === 'email' && options.some(text => /@/.test(text));
  if (el instanceof HTMLSelectElement && !SELECT_TYPES.has(type) && !emails) push('type', 'select', 0.6);
  // A radio group's answers are choices too: "About you" over Yes / No isn't a bio.
  if (isChoice(el) && el.type === 'radio' && !SELECT_TYPES.has(type)) push('type', 'radio', 0.6);
  // "7 days, 30 days, No expiration" are durations: a date select lists dates or their parts.
  if (el instanceof HTMLSelectElement && DATE_FIELD_TYPES.has(type) && !options.some(text => DATE_TEXT.test(text)) && !datePart(options)) push('options', 'no dates among the options', 0.8);
  // The field's own words, not its section's: a "Search flights" heading doesn't make every
  // field in it a search box.
  const texts = signals.filter(signal => TEXT_SOURCES.has(signal.source) && signal.source !== 'legend');
  const search = type !== 'search' && texts.find(signal => SEARCH_PHRASES.some(phrase => contains(signal.text, phrase)));
  if (search) push(search.source, search.raw, 0.5);
  const confirm = !CONFIRMABLE_TYPES.has(type) && texts.find(signal => CONFIRM_PHRASES.some(phrase => contains(signal.text, phrase)));
  if (confirm) push(confirm.source, confirm.raw, 0.4);
  const idNumber = texts.find(signal => ID_NUMBER_PHRASES.some(phrase => contains(signal.text, phrase)));
  if (idNumber) push(idNumber.source, idNumber.raw, 0.6);
  const slug = type === 'website' && texts.find(signal => SLUG_PHRASES.some(phrase => contains(signal.text, phrase)));
  if (slug) push(slug.source, slug.raw, 0.9);
  // "Mr / Mrs / Dr" is a civility, not the title of a thing.
  if (type === 'title' && (options.length ? options : optionTexts(el)).filter(text => CIVILITY.test(normalize(text))).length >= 2) push('options', 'civility titles', 0.9);
  return found;
}

// What a unit beside the label says: "(mm)" is a measurement, "(u)" a count, "(%)" a percentage.
const UNIT_TYPES: Readonly<Record<UnitKind, readonly [FieldKey, number]>> = {
  length: ['measurement', 0.6], weight: ['measurement', 0.6], area: ['measurement', 0.6], volume: ['measurement', 0.6],
  count: ['quantity', 0.6], percent: ['percentage', 0.7], currency: ['amount', 0.55],
};

export type DatePart = 'day' | 'month' | 'year';
const numbersIn = (texts: readonly string[]) => texts.map(text => Number(text)).filter(n => Number.isInteger(n));

// Whether a select lists days, months or years, as split date-of-birth fields do.
export function datePart(texts: readonly string[]): DatePart | undefined {
  if (texts.length < 5) return undefined;
  const numbers = numbersIn(texts);
  if (numbers.length >= 0.8 * texts.length && numbers.every(n => n >= 1900 && n <= 2100)) return 'year';
  if (numbers.length >= 28 && numbers.every(n => n >= 1 && n <= 31)) return 'day';
  if (texts.filter(text => MONTH_SET.has(normalize(text))).length >= Math.min(10, 0.6 * texts.length)) return 'month';
  return undefined;
}

// What the answers say: mostly country names means a country, mostly wilayas a state or wilaya.
// Answers alone stay below medium confidence: a list can share words with another kind of list.
function optionEvidence(texts: readonly string[], signals: readonly Signal[]): Array<[FieldKey, Evidence]> {
  if (texts.length < 2) return [];
  const aboutLanguage = signals.some(signal => TEXT_SOURCES.has(signal.source) && LANGUAGE_PHRASES.some(phrase => contains(signal.text, phrase)));
  const found: Array<[FieldKey, Evidence]> = [];
  // "16 - Alger", "Alger (16)": the code isn't part of the name.
  const names = texts.map(text => normalize(text).replace(/^\d+ | \d+$/g, ''));
  for (const [type, list] of OPTION_LISTS) {
    const hits = names.filter(name => list.has(name)).length;
    const ratio = hits / names.length;
    if (aboutLanguage && type === 'nationality') continue;
    if (hits >= 2 && ratio >= 0.5) found.push([type, { source: 'options', signal: `${hits} of ${names.length} options`, weight: Math.min(THRESHOLDS.medium - 0.02, 0.5 + 0.2 * ratio), match: 'options' }]);
  }
  const part = datePart(texts);
  if (part) found.push(['date', { source: 'options', signal: `${part} options`, weight: 0.55, match: 'options' }]);
  // "08:00, 08:30…" are times; "maya@example.com…" are the person's addresses.
  const share = (pattern: RegExp) => texts.filter(text => pattern.test(text.trim())).length / texts.length;
  if (share(/^\d{1,2}[:h]\d{2}(?:\s?[ap]\.?m\.?)?$/i) >= 0.6) found.push(['time', { source: 'options', signal: 'clock times', weight: 0.7, match: 'options' }]);
  if (share(/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i) >= 0.5) found.push(['email', { source: 'options', signal: 'email addresses', weight: 0.7, match: 'options' }]);
  // Worded answers ("Strongly agree") are a scale; plain numbers (1 to 4) may just be a count.
  const scale = isScale(texts);
  if (scale) found.push(['rating', { source: 'options', signal: `a scale of ${texts.length}`, weight: scale === 'words' ? 0.65 : 0.4, match: 'options' }]);
  return found;
}

// Positive evidence from every signal, grouped by type.
function collectEvidence(el: Control, signals: readonly Signal[], answers?: readonly string[], grouped = false): Map<FieldKey, Evidence[]> {
  const byType = new Map<FieldKey, Evidence[]>();
  const add = (type: FieldKey, evidence: Evidence) => byType.set(type, [...(byType.get(type) ?? []), evidence]);
  const options = answers ?? optionTexts(el);
  for (const [type, evidence] of optionEvidence(options, signals)) add(type, evidence);
  const unit = unitOf(signals);
  if (unit) {
    // Money is an amount unless the label says price; a rate ("$/h", "€/m²") is a price.
    const perUnit = unit.kind === 'currency' && unit.per;
    const [type, weight] = perUnit ? ['price', 0.6] as const : UNIT_TYPES[unit.kind];
    add(type, { source: 'unit', signal: unit.symbol, weight, match: 'type' });
  }
  // A radio group's question, or the legend over split day/month/year selects, is their label.
  const radio = grouped || (isChoice(el) && el.type === 'radio') || !!datePart(options);
  // With no meaningful name or id, what the person reads is all there is, so it counts a bit more.
  const visibleBoost = signals.some(signal => signal.source === 'name' || signal.source === 'id') ? 1 : 1.06;
  // With no label, accessible name or placeholder, the title is the field's name (as for screen readers).
  const titleIsName = !signals.some(signal => NAMING_SOURCES.has(signal.source));
  for (const signal of signals) {
    if (signal.source === 'autocomplete') {
      const token = autocompleteToken(el).toLowerCase();
      if (Object.hasOwn(AUTOCOMPLETE, token)) add(AUTOCOMPLETE[token], { source: 'autocomplete', signal: token, weight: SOURCE_WEIGHT.autocomplete, match: 'autocomplete' });
    } else if (signal.source === 'type' || signal.source === 'inputmode') {
      const hints = signal.source === 'type' ? INPUT_TYPE_HINTS : INPUT_MODE_HINTS;
      const value = signal.raw.toLowerCase();
      if (Object.hasOwn(hints, value) && !(value === 'tel' && showsDateOrTime(el))) add(hints[value][0], { source: signal.source, signal: value, weight: hints[value][1], match: 'type' });
    } else {
      const base = signal.source === 'legend' && radio ? RADIO_LEGEND_WEIGHT : signal.source === 'title' && titleIsName ? SOURCE_WEIGHT.label : SOURCE_WEIGHT[signal.source];
      const boost = SOURCE_GROUP[signal.source] === 'visible' ? visibleBoost : 1;
      // "Email or phone", "City or airport": a field that takes either isn't clearly one type.
      const either = / (?:or|ou|او) /u.test(` ${signal.text} `) ? 0.6 : 1;
      // One word in a long question ("…work in the country of this position?") is not its topic.
      const aside = signal.source === 'legend' && signal.text.split(' ').length > 6 ? 0.7 : 1;
      // "Manager's name", "Name of host": a generic "name" beside a person's role is that person's name.
      const person = PERSON_ROLE_PHRASES.some(phrase => contains(signal.text, phrase));
      for (const [entry, found] of matchText(signal.text)) {
        const kind: MatchKind = found === 'generic' && entry.key === 'fullName' && person ? 'word' : found;
        const strength = (MATCH_STRENGTH[kind] ?? 0) * (kind === 'exact' ? 1 : either) * (WORD_MATCHES.has(kind) ? aside : 1);
        add(entry.key, { source: signal.source, signal: signal.raw, weight: Math.min(0.95, base * boost * strength), match: kind });
      }
    }
  }
  if (isInput(el) || el instanceof HTMLTextAreaElement) formatEvidence(el, byType, add);
  return byType;
}

// Agreeing groups reinforce each other; within a group only the strongest signal counts.
function scoreType(el: Control, type: FieldKey, evidence: readonly Evidence[], signals: readonly Signal[]): Candidate {
  const strongest = new Map<string, Evidence>();
  for (const item of evidence) {
    const group = SOURCE_GROUP[item.source];
    if ((strongest.get(group)?.weight ?? 0) < item.weight) strongest.set(group, item);
  }
  const kept = [...strongest.values()].sort((a, b) => b.weight - a.weight);
  const penalties = against(el, type, signals);
  // Generic words ("nom", "date") only count with other evidence: on their own, however many, they
  // stay below the threshold.
  const onlyGeneric = kept.every(item => item.match === 'generic');
  const positive = Math.min(onlyGeneric ? THRESHOLDS.low - 0.05 : 1, 1 - kept.reduce((rest, item) => rest * (1 - item.weight), 1));
  const score = penalties.reduce((value, item) => value * (1 + item.weight), positive);
  return { type, score, evidence: [...kept, ...penalties] };
}

export function classifyField(el: Control): Classification {
  const signals = describeSignals(el);
  return { ...classifySignals(el, signals), signals };
}

const sessionEvidence = (signals: readonly Signal[]): Evidence | undefined => {
  const found = signals.find(signal => TEXT_SOURCES.has(signal.source) && SESSION.test(signal.text));
  return found && { source: found.source, signal: found.raw, weight: 1, match: 'sensitive' };
};

function classifySignals(el: Control, signals: Signal[]): Classification {
  const sensitive = sensitiveKind(el, signals);
  if (sensitive) return { type: `skip:${sensitive.kind}`, confidence: 1, candidates: [], evidence: [sensitive.evidence], ...(sensitive.weak ? { unconfirmed: rank(el, signals) } : {}) };
  // "Subscribe to newsletter? Yes / No" asks for permission as much as a checkbox does.
  if (el instanceof HTMLSelectElement && isYesNo(el)) {
    const consent = consentEvidence(el, signals);
    if (consent) return { type: 'skip:consent', confidence: 1, candidates: [], evidence: [consent] };
  }
  if (isChoice(el) && el.type === 'checkbox') {
    const consent = consentEvidence(el, signals);
    if (consent) return { type: 'skip:consent', confidence: 1, candidates: [], evidence: [consent] };
    const session = sessionEvidence(signals);
    return session ? { type: 'skip:session', confidence: 1, candidates: [], evidence: [session] } : { type: 'unknown', confidence: 0, candidates: [], evidence: [] };
  }
  if (isChoice(el)) {
    const consent = consentEvidence(el, signals);
    if (consent) return { type: 'skip:consent', confidence: 1, candidates: [], evidence: [consent] };
    // "Stay signed in? Yes / No" is a session choice too.
    const session = sessionEvidence(signals);
    if (session) return { type: 'skip:session', confidence: 1, candidates: [], evidence: [session] };
  }
  return rank(el, signals);
}

// A select that only answers yes or no, besides its "Choose…" placeholder.
function isYesNo(el: HTMLSelectElement): boolean {
  const answers = optionTexts(el).map(normalize).filter(text => text && !PLACEHOLDER_OPTION.test(text));
  return answers.length >= 1 && answers.length <= 3 && answers.every(text => YES_NO.test(text));
}

const GENERAL_TYPE: Readonly<Partial<Record<FieldKey, FieldKey>>> = { birthDate: 'date', startDate: 'date', endDate: 'date' };

// Scores every candidate type and applies the margin rule.
function rank(el: Control, signals: Signal[], answers?: readonly string[], grouped = false): Classification {
  const candidates = [...collectEvidence(el, signals, answers, grouped)].map(([type, evidence]) => scoreType(el, type, evidence, signals)).sort((a, b) => b.score - a.score).slice(0, 3);
  const [top] = candidates;
  if (!top) return { type: 'unknown', confidence: 0, candidates, evidence: [] };
  // "Date" is the general form of a birth, start or end date: it agrees with them, it isn't a rival.
  const runnerUp = candidates.slice(1).find(candidate => GENERAL_TYPE[top.type] !== candidate.type);
  const confidence = Math.max(0, Math.min(1, top.score - Math.max(0, MARGIN - (top.score - (runnerUp?.score ?? 0))) * 2));
  return { type: confidence >= THRESHOLDS.low ? top.type : 'unknown', confidence, candidates, evidence: top.evidence };
}

// Custom widgets (ARIA radio groups, comboboxes, rich-text editors) have no native control, so they
// bring their own signals and answers; the same scoring then applies.
export function rankElement(el: Element, signals: Signal[], answers: readonly string[], grouped: boolean): Classification {
  return { ...rank(el as Control, signals, answers, grouped), signals };
}

// Classification never depends on a field's value, so one fill classifies each control once.
export function classificationOf(cache: Map<Control, Classification>, el: Control): Classification {
  let found = cache.get(el);
  if (!found) { found = classifyField(el); cache.set(el, found); }
  return found;
}

export const isSensitive = (type: FieldType) => type.startsWith('skip:');

// The recognized type the fill may use: medium confidence and up always, low confidence only
// when the user allows guessing with "Fill unknown fields".
export function usableKey(classification: Classification, fillUnknown: boolean): FieldKey | undefined {
  const { type, confidence } = classification;
  if (type === 'unknown' || isSensitive(type)) return undefined;
  return confidence >= THRESHOLDS.medium || (fillUnknown && confidence >= THRESHOLDS.low) ? type as FieldKey : undefined;
}

