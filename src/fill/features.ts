import type { Control } from './types';
import { SOURCE_GROUP, type Classification } from './classify';
import { isScale, optionTexts, type Signal } from './extract';
import { normalize } from './normalize';
import { placeholderOf, placeholderShape } from './placeholder';
import { unitOf } from './units';
import { optionLists, optionName } from './vocabulary';

// What the learned second opinion reads about a field. Two steps, so training can't drift from the
// extension: fieldInfo() reads the page (run in the browser, for the extension and for the
// dataset alike), and featuresOf() turns that plain record into features, the same code everywhere.

export interface FieldInfo {
  signals: Array<{ source: Signal['source']; text: string }>;
  tag: 'input' | 'select' | 'textarea';
  type: string;
  inputmode: string;
  autocomplete: string;
  maxLength: number;
  pattern: boolean;
  shape: string;           // what the placeholder looks like: date, phone, year, example…
  unit: string;            // a unit beside the label: length, currency…
  options: { count: number; numbers: number; dates: number; times: number; lists: string[]; scale: string };
  rule: Array<[string, number]>; // the rules' own candidates and scores, before the form-level pass
  verdict: [string, number];       // the rules' answer and confidence: not a feature, it says whether the model is asked
  prev: string;            // the rules' type for the field just before and just after
  next: string;
}

const DATE_TEXT = /\d{4}-\d{2}|\d{1,2}[/.]\d{1,2}[/.]\d{2,4}/;
const TIME_TEXT = /^\d{1,2}[:h]\d{2}/i;

function optionSummary(texts: readonly string[]): FieldInfo['options'] {
  const share = (test: (text: string) => boolean) => texts.length ? Math.round(10 * texts.filter(test).length / texts.length) / 10 : 0;
  const names = texts.map(optionName);
  const lists = optionLists().filter(([, list]) => names.filter(name => list.has(name)).length >= Math.max(2, names.length / 2)).map(([type]) => type);
  return { count: texts.length, numbers: share(text => /^\s*-?\d+(?:[.,]\d+)?\s*$/.test(text)), dates: share(text => DATE_TEXT.test(text)), times: share(text => TIME_TEXT.test(text.trim())), lists, scale: isScale(texts) ?? '' };
}

export function fieldInfo(el: Control, found: Classification, prev = '', next = ''): FieldInfo {
  const input = el instanceof HTMLInputElement ? el : undefined;
  const signals = found.signals ?? [];
  return {
    signals: signals.filter(signal => !['type', 'inputmode', 'autocomplete'].includes(signal.source)).map(({ source, text }) => ({ source, text })),
    tag: el instanceof HTMLSelectElement ? 'select' : el instanceof HTMLTextAreaElement ? 'textarea' : 'input',
    type: input?.type ?? '',
    inputmode: el.getAttribute('inputmode') || '',
    autocomplete: (el.getAttribute('autocomplete') || '').toLowerCase().split(/\s+/).at(-1) || '',
    maxLength: 'maxLength' in el ? el.maxLength : -1,
    pattern: !!el.getAttribute('pattern'),
    shape: placeholderShape(placeholderOf(el))?.kind ?? '',
    unit: unitOf(signals)?.kind ?? '',
    options: optionSummary(optionTexts(el)),
    rule: found.candidates.map(candidate => [candidate.type, Math.round(candidate.score * 100) / 100]),
    verdict: [found.type, Math.round(found.confidence * 100) / 100],
    prev, next,
  };
}

const TAG: Readonly<Record<string, string>> = { visible: 'v', attribute: 'a', context: 'c' };
const bucket = (n: number, edges: readonly number[]) => edges.findIndex(edge => n <= edge);

// Word pieces let the model handle words it never saw whole: "surnom" and "surname", "téléphone"
// and "telephone" share most of theirs.
function textFeatures(tag: string, text: string, out: Set<string>) {
  const tokens = text.split(' ').filter(Boolean).map(token => /^\d+$/.test(token) ? '#' : token);
  tokens.forEach((token, i) => {
    out.add(`${tag}:w:${token}`);
    if (i > 0) out.add(`${tag}:b:${tokens[i - 1]}_${token}`);
    if (token.length < 3 || token === '#') return;
    const padded = `<${token}>`;
    for (const size of [3, 4]) for (let k = 0; k + size <= padded.length; k++) out.add(`${tag}:c:${padded.slice(k, k + size)}`);
  });
}

export function featuresOf(info: FieldInfo): string[] {
  const out = new Set<string>(['bias']);
  for (const signal of info.signals) textFeatures(TAG[SOURCE_GROUP[signal.source]] ?? 'v', signal.text, out);
  out.add(`tag:${info.tag}`);
  if (info.type) out.add(`type:${info.type}`);
  if (info.inputmode) out.add(`im:${info.inputmode}`);
  if (info.autocomplete && !['on', 'off'].includes(info.autocomplete)) out.add(`ac:${info.autocomplete}`);
  out.add(`ml:${info.maxLength < 0 ? 'none' : bucket(info.maxLength, [2, 4, 6, 10, 20, 60, 255, Infinity])}`);
  if (info.pattern) out.add('pattern');
  if (info.shape) out.add(`shape:${info.shape}`);
  if (info.unit) out.add(`unit:${info.unit}`);
  if (!info.signals.length) out.add('no-words');
  const { options } = info;
  if (options.count) {
    out.add(`opt:n:${bucket(options.count, [2, 3, 5, 10, 30, Infinity])}`);
    for (const [name, share] of [['num', options.numbers], ['date', options.dates], ['time', options.times]] as const) if (share >= 0.5) out.add(`opt:${name}`);
    for (const list of options.lists) out.add(`opt:list:${list}`);
    if (options.scale) out.add(`opt:scale:${options.scale}`);
  }
  for (const [type, score] of info.rule) out.add(`rule:${type}:${score >= 0.7 ? 'hi' : score >= 0.4 ? 'mid' : 'lo'}`);
  out.add(`prev:${info.prev || 'none'}`);
  out.add(`next:${info.next || 'none'}`);
  return [...out];
}

// FNV-1a, so a new word needs no vocabulary file: every feature lands in one of 2^bits buckets.
export function hashFeature(feature: string, bits: number): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < feature.length; i++) { hash ^= feature.charCodeAt(i); hash = Math.imul(hash, 0x01000193); }
  return (hash >>> 0) % (1 << bits);
}
