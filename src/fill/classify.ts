import type { FieldKey } from '../data';
import type { Control } from './types';
import {
  AUTOCOMPLETE, COMPOUND_PARTS, CONFIRMABLE_TYPES, CONFIRM_PHRASES, CONSENT, DATE_FIELD_TYPES, EXACT, FUZZY_POOL, INPUT_MODE_HINTS, INPUT_TYPE_HINTS,
  DECLARATION, GLUE_WORDS, LANGUAGE_PHRASES, SESSION, JOINED, MULTILINE_TYPES, NUMERIC_TYPES, PHRASES, QUALIFIERS, SEARCH_PHRASES, SELECT_TYPES, SENSITIVE_GLUED, SENSITIVE_PHRASES, SENSITIVE_SECTION_PHRASES, WORDS,
  type AliasEntry, type SensitiveKind,
} from './dictionary';
import { autocompleteToken, describeSignals, isChoice, isInput, optionTexts, radioGroup, type Signal, type SignalSource } from './extract';
import { MONTH_SET, OPTION_LISTS } from './vocabulary';
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
const SOURCE_WEIGHT: Readonly<Record<SignalSource, number>> = { autocomplete: 0.98, type: 1, inputmode: 1, label: 0.9, 'aria-label': 0.9, 'aria-labelledby': 0.88, placeholder: 0.75, title: 0.6, nearby: 0.65, name: 0.8, id: 0.75, legend: 0.4, options: 1, form: 1 };
export const SOURCE_GROUP: Readonly<Record<SignalSource, string>> = { autocomplete: 'autocomplete', type: 'type', inputmode: 'type', label: 'visible', 'aria-label': 'visible', 'aria-labelledby': 'visible', placeholder: 'visible', title: 'visible', nearby: 'visible', name: 'attribute', id: 'attribute', legend: 'context', options: 'options', form: 'form' };
// A radio group's question is its label.
const RADIO_LEGEND_WEIGHT = 0.85;
// How well a signal matches an alias: the whole signal beats a phrase inside it, which beats a word.
const MATCH_STRENGTH: Readonly<Partial<Record<MatchKind, number>>> = { exact: 1, plural: 0.95, phrase: 0.9, joined: 0.9, word: 0.75, compound: 0.7, fuzzy: 0.6, generic: 0.35 };
const TEXT_SOURCES: ReadonlySet<SignalSource> = new Set(['label', 'aria-label', 'aria-labelledby', 'placeholder', 'title', 'nearby', 'name', 'id', 'legend']);

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

const allowedEdits = (alias: string) => alias.replace(/ /g, '').length >= 10 ? 2 : 1;

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
  // one edit from "page", and "estate" from "state".
  for (const token of text.split(' ')) {
    if (token.length < 5) continue;
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
export function sensitiveKind(el: Control, signals: readonly Signal[]): { kind: SensitiveKind; evidence: Evidence } | undefined {
  for (const token of (el.getAttribute('autocomplete') || '').toLowerCase().split(/\s+/)) {
    if (token.startsWith('cc-')) return { kind: 'card', evidence: { source: 'autocomplete', signal: token, weight: 1, match: 'sensitive' } };
    if (token === 'one-time-code') return { kind: 'otp', evidence: { source: 'autocomplete', signal: token, weight: 1, match: 'sensitive' } };
  }
  // A checkbox or radio can't hold a card number or a code: "Pay by card" is a choice, not card data.
  if (isChoice(el)) return undefined;
  const kinds: SensitiveKind[] = ['card', 'otp', 'iban'];
  for (const signal of signals) {
    if (!TEXT_SOURCES.has(signal.source)) continue;
    const phrases = signal.source === 'legend' ? SENSITIVE_SECTION_PHRASES : SENSITIVE_PHRASES;
    const glued = signal.source !== 'legend' ? signal.text.split(' ') : [];
    const kind = kinds.find(k => phrases[k].some(phrase => contains(signal.text, phrase)) || glued.some(token => SENSITIVE_GLUED[k].test(token)));
    if (kind) return { kind, evidence: { source: signal.source, signal: signal.raw, weight: 1, match: 'sensitive' } };
  }
  return undefined;
}

// Checkboxes and radios about terms, privacy, newsletters or marketing are never touched.
function consentEvidence(el: HTMLInputElement, signals: readonly Signal[]): Evidence | undefined {
  // A radio's own label is left out of its signals, but "I agree" on any answer in the group
  // makes the whole group a consent question.
  const own: Signal[] = el.type === 'radio' ? radioGroup(el).flatMap(radio => Array.from(radio.labels || [], label => ({ source: 'label' as const, raw: (label.textContent || '').trim().slice(0, 120), text: normalize(label.textContent || '') }))) : [];
  const texts = [...signals, ...own].filter(signal => TEXT_SOURCES.has(signal.source));
  const found = texts.find(signal => CONSENT.test(signal.text)) ?? texts.find(signal => (signal.source === 'label' || signal.source === 'nearby') && DECLARATION.test(signal.text));
  return found && { source: found.source, signal: found.raw, weight: 1, match: 'sensitive' };
}

// Negative evidence: the kind of control pushes down types it can't hold.
function against(el: Control, type: FieldKey, signals: readonly Signal[]): Evidence[] {
  const found: Evidence[] = [];
  const push = (source: SignalSource, signal: string, factor: number) => found.push({ source, signal, weight: -factor, match: 'against' });
  if (isInput(el)) {
    const ac = (el.getAttribute('autocomplete') || '').toLowerCase();
    if ((el.type === 'password' || ac.includes('password')) && type !== 'password') push('type', 'password', 0.9);
    else if (el.type === 'email' && type !== 'email') push('type', 'email', 0.6);
    else if (el.type === 'tel' && type !== 'phone') push('type', 'tel', 0.6);
    else if (el.type === 'url' && type !== 'website') push('type', 'url', 0.6);
    else if ((el.type === 'number' || el.type === 'range') && !NUMERIC_TYPES.has(type)) push('type', el.type, 0.6);
    else if (['date', 'datetime-local', 'month', 'week'].includes(el.type) && !DATE_FIELD_TYPES.has(type)) push('type', el.type, 0.7);
    else if (el.type === 'time' && type !== 'time') push('type', 'time', 0.7);
    else if (el.type === 'color' && type !== 'color') push('type', 'color', 0.7);
  }
  if (el instanceof HTMLTextAreaElement && !MULTILINE_TYPES.has(type)) push('type', 'textarea', 0.5);
  if (el instanceof HTMLSelectElement && !SELECT_TYPES.has(type)) push('type', 'select', 0.6);
  const texts = signals.filter(signal => TEXT_SOURCES.has(signal.source));
  const search = type !== 'search' && texts.find(signal => SEARCH_PHRASES.some(phrase => contains(signal.text, phrase)));
  if (search) push(search.source, search.raw, 0.5);
  const confirm = !CONFIRMABLE_TYPES.has(type) && texts.find(signal => CONFIRM_PHRASES.some(phrase => contains(signal.text, phrase)));
  if (confirm) push(confirm.source, confirm.raw, 0.4);
  return found;
}

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
  return found;
}

// Positive evidence from every signal, grouped by type.
function collectEvidence(el: Control, signals: readonly Signal[]): Map<FieldKey, Evidence[]> {
  const byType = new Map<FieldKey, Evidence[]>();
  const add = (type: FieldKey, evidence: Evidence) => byType.set(type, [...(byType.get(type) ?? []), evidence]);
  const options = optionTexts(el);
  for (const [type, evidence] of optionEvidence(options, signals)) add(type, evidence);
  // A radio group's question, or the legend over split day/month/year selects, is their label.
  const radio = (isChoice(el) && el.type === 'radio') || !!datePart(options);
  // With no meaningful name or id, what the person reads is all there is, so it counts a bit more.
  const visibleBoost = signals.some(signal => signal.source === 'name' || signal.source === 'id') ? 1 : 1.06;
  for (const signal of signals) {
    if (signal.source === 'autocomplete') {
      const token = autocompleteToken(el).toLowerCase();
      if (Object.hasOwn(AUTOCOMPLETE, token)) add(AUTOCOMPLETE[token], { source: 'autocomplete', signal: token, weight: SOURCE_WEIGHT.autocomplete, match: 'autocomplete' });
    } else if (signal.source === 'type' || signal.source === 'inputmode') {
      const hints = signal.source === 'type' ? INPUT_TYPE_HINTS : INPUT_MODE_HINTS;
      const value = signal.raw.toLowerCase();
      if (Object.hasOwn(hints, value)) add(hints[value][0], { source: signal.source, signal: value, weight: hints[value][1], match: 'type' });
    } else {
      const base = signal.source === 'legend' && radio ? RADIO_LEGEND_WEIGHT : SOURCE_WEIGHT[signal.source];
      const boost = SOURCE_GROUP[signal.source] === 'visible' ? visibleBoost : 1;
      // "Email or phone", "City or airport": a field that takes either isn't clearly one type.
      const either = / (?:or|ou|او) /u.test(` ${signal.text} `) ? 0.6 : 1;
      for (const [entry, kind] of matchText(signal.text)) {
        const strength = (MATCH_STRENGTH[kind] ?? 0) * (kind === 'exact' ? 1 : either);
        add(entry.key, { source: signal.source, signal: signal.raw, weight: Math.min(0.95, base * boost * strength), match: kind });
      }
    }
  }
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
  const positive = 1 - kept.reduce((rest, item) => rest * (1 - item.weight), 1);
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
  if (sensitive) return { type: `skip:${sensitive.kind}`, confidence: 1, candidates: [], evidence: [sensitive.evidence] };
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
  const candidates = [...collectEvidence(el, signals)].map(([type, evidence]) => scoreType(el, type, evidence, signals)).sort((a, b) => b.score - a.score).slice(0, 3);
  const [top, runnerUp] = candidates;
  if (!top) return { type: 'unknown', confidence: 0, candidates, evidence: [] };
  const confidence = Math.max(0, Math.min(1, top.score - Math.max(0, MARGIN - (top.score - (runnerUp?.score ?? 0))) * 2));
  return { type: confidence >= THRESHOLDS.low ? top.type : 'unknown', confidence, candidates, evidence: top.evidence };
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

