import type { FieldKey } from '../data';
import type { Random } from '../rng';
import type { Control, PageState } from './types';
import { COUNTRY_CODES, DATE_FIELD_TYPES } from './dictionary';
import { dispatchChange, setNativeValue } from './apply';

// Values that fit the page's rules: the field's own constraints before a value is written, and the
// app's own validation (aria-invalid) after it.

// Fields whose values may be reshaped to fit a pattern. Names and emails never are: "QKZ" is not
// a name, and a field that rejects a real name should stay visibly invalid.
const RESHAPE: ReadonlySet<FieldKey> = new Set(['phone', 'postalCode', 'reference', 'measurement', 'quantity', 'price', 'amount', 'salary', 'percentage', 'age', 'employeeCount', 'rating', 'birthDate', 'date', 'startDate', 'endDate']);

// ---- A small generator for the patterns forms use: [A-Z]{3}, \d{5}, [0-9]{2}-[0-9]{3}, (ab|cd)\d+.
type Piece = { chars: string } | { group: Piece[][] };
interface Node { piece: Piece; min: number; max: number }
const DIGITS = '0123456789', UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', LOWER = 'abcdefghijklmnopqrstuvwxyz';
const ESCAPES: Readonly<Record<string, string>> = { d: DIGITS, w: UPPER + LOWER + DIGITS + '_', s: ' ' };

function parseClass(pattern: string, start: number): [string, number] {
  let i = start, chars = '';
  if (pattern[i] === '^') throw new Error('negated class');
  while (i < pattern.length && pattern[i] !== ']') {
    let char = pattern[i];
    if (char === '\\') { const next = pattern[++i]; chars += ESCAPES[next] ?? next; i++; continue; }
    if (pattern[i + 1] === '-' && pattern[i + 2] && pattern[i + 2] !== ']') {
      const end = pattern[i + 2];
      for (let code = char.charCodeAt(0); code <= end.charCodeAt(0) && code - char.charCodeAt(0) < 200; code++) chars += String.fromCharCode(code);
      i += 3; continue;
    }
    chars += char; i++;
    char = '';
  }
  if (pattern[i] !== ']') throw new Error('unclosed class');
  return [chars, i + 1];
}

function parseSequence(pattern: string, start: number, depth: number): [Piece[][], number] {
  const branches: Piece[][] = [[]];
  const nodes: Node[][] = [[]];
  let i = start;
  while (i < pattern.length) {
    const char = pattern[i];
    let piece: Piece | undefined;
    if (char === ')') break;
    if (char === '|') { branches.push([]); nodes.push([]); i++; continue; }
    if (char === '^' || char === '$') { i++; continue; }
    if (char === '(') {
      if (depth > 3) throw new Error('too deep');
      const inner = pattern.startsWith('(?:', i) ? i + 3 : i + 1;
      const [group, end] = parseSequence(pattern, inner, depth + 1);
      if (pattern[end] !== ')') throw new Error('unclosed group');
      piece = { group }; i = end + 1;
    } else if (char === '[') { const [chars, end] = parseClass(pattern, i + 1); piece = { chars }; i = end; }
    else if (char === '\\') { const next = pattern[i + 1]; piece = { chars: ESCAPES[next] ?? next }; i += 2; }
    else if (char === '.') { piece = { chars: UPPER + DIGITS }; i++; }
    else if ('*+?{'.includes(char)) throw new Error('dangling quantifier');
    else { piece = { chars: char }; i++; }
    let min = 1, max = 1;
    const q = pattern.slice(i).match(/^(?:\{(\d+)(?:(,)(\d*))?\}|[*+?])/);
    if (q) {
      if (q[0] === '*') [min, max] = [0, 3]; else if (q[0] === '+') [min, max] = [1, 3]; else if (q[0] === '?') [min, max] = [0, 1];
      else { min = Number(q[1]); max = q[2] ? (q[3] ? Number(q[3]) : min + 3) : min; }
      i += q[0].length;
    }
    if (min > 64 || max > 64) throw new Error('too long');
    nodes.at(-1)!.push({ piece: piece!, min, max });
  }
  // Store each branch as pieces repeated to a chosen count later: keep nodes on the branch array.
  branches.forEach((_, b) => { (branches[b] as unknown as { nodes: Node[] }).nodes = nodes[b]; });
  return [branches, i];
}

function build(branches: Piece[][], random: Random): string {
  const branch = branches[random(branches.length)] as unknown as { nodes: Node[] };
  return branch.nodes.map(node => {
    const count = node.min + random(node.max - node.min + 1);
    return Array.from({ length: count }, () => 'chars' in node.piece ? node.piece.chars[random(node.piece.chars.length)] ?? '' : build(node.piece.group, random)).join('');
  }).join('');
}

// A value matching a field's pattern, or undefined when the pattern is beyond this generator.
export function patternSample(pattern: string, random: Random): string | undefined {
  try {
    const [branches, end] = parseSequence(pattern, 0, 0);
    if (end !== pattern.length) return undefined;
    const value = build(branches, random);
    return new RegExp(`^(?:${pattern})$`, 'u').test(value) ? value : undefined;
  } catch { return undefined; }
}

// ---- Dates written into text fields, in the format the field shows.
const DATE_HINTS: ReadonlyArray<readonly [RegExp, (y: string, m: string, d: string) => string]> = [
  [/(?:dd|jj)\s*\/\s*mm\s*\/\s*(?:yyyy|aaaa)/i, (y, m, d) => `${d}/${m}/${y}`],
  [/mm\s*\/\s*dd\s*\/\s*yyyy/i, (y, m, d) => `${m}/${d}/${y}`],
  [/(?:dd|jj)\s*-\s*mm\s*-\s*(?:yyyy|aaaa)/i, (y, m, d) => `${d}-${m}-${y}`],
  [/(?:dd|jj)\s*\.\s*mm\s*\.\s*(?:yyyy|aaaa)/i, (y, m, d) => `${d}.${m}.${y}`],
  [/(?:yyyy|aaaa)\s*-\s*mm\s*-\s*(?:dd|jj)/i, (y, m, d) => `${y}-${m}-${d}`],
  [/(?:yyyy|aaaa)\s*\/\s*mm\s*\/\s*(?:dd|jj)/i, (y, m, d) => `${y}/${m}/${d}`],
];
const isTextInput = (el: Control) => el instanceof HTMLInputElement && ['text', 'search', 'tel', ''].includes(el.type);
const language = (el: Control) => (el.closest('[lang]')?.getAttribute('lang') || document.documentElement.lang || '').toLowerCase();

export function formatDateText(el: Control, iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match || !isTextInput(el)) return iso;
  const [, y, m, d] = match;
  const hints = ['placeholder', 'title', 'aria-label'].map(name => el.getAttribute(name) || '').join(' ') + ' ' + Array.from(el.labels || [], label => label.textContent || '').join(' ');
  const hinted = DATE_HINTS.find(([pattern]) => pattern.test(hints));
  if (hinted) return hinted[1](y, m, d);
  // French and Arabic forms write day first; others keep the unambiguous ISO date.
  return /^(fr|ar)\b/.test(language(el)) ? `${d}/${m}/${y}` : iso;
}

// Other ways to write the same value, most likely first, for fields that reject the first one.
export function alternatives(el: Control, key: FieldKey | undefined, value: string, random: Random, otherPhones: readonly string[] = []): string[] {
  const found: string[] = [];
  const pattern = el.getAttribute('pattern');
  if (key === 'phone') {
    // This number in other formats first, then the other countries' numbers, which may be the
    // format an app insists on ("0[5-7]…" wants an Algerian or French mobile).
    const phones = [value, ...otherPhones];
    for (const phone of phones) {
      const national = phone.match(/^\+(?:213|33)\s?(.*)$/)?.[1];
      if (national) found.push(`0${national}`, `0${national.replace(/\D/g, '')}`);
    }
    for (const phone of phones) { const digits = phone.replace(/\D/g, ''); found.push(phone, phone.replace(/\s/g, ''), digits, `+${digits}`); }
  }
  // A username may lose its dot for a stricter pattern; it never becomes random characters.
  if (key === 'username') found.push(value.replace(/\./g, '_'), value.replace(/\./g, ''), value.replace(/\./g, '-'));
  if (key && DATE_FIELD_TYPES.has(key)) {
    const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/) ? value : '';
    if (iso) { const [y, m, d] = iso.slice(0, 10).split('-'); found.push(`${d}/${m}/${y}`, iso.slice(0, 10), `${m}/${d}/${y}`, `${y}/${m}/${d}`, `${d}-${m}-${y}`, `${d}.${m}.${y}`); }
  }
  if (key === 'reference' || key === 'postalCode') found.push(value.replace(/[^A-Za-z0-9]/g, ''), value.replace(/\D/g, ''));
  if (key === 'country') found.push(...Object.entries(COUNTRY_CODES).find(([name, codes]) => name === value || codes.includes(value))?.[1] ?? []);
  // A plain number of the usual lengths, for apps that want digits only.
  if (key === 'reference') found.push(...[8, 6, 10].map(count => String(1 + random(9)) + Array.from({ length: count - 1 }, () => random(10)).join('')));
  if (/^-?\d+[.,]\d+$/.test(value)) found.push(value.includes(',') ? value.replace(',', '.') : value.replace('.', ','), String(Math.round(Number(value.replace(',', '.')))));
  if (pattern && (!key || RESHAPE.has(key))) { const sample = patternSample(pattern, random); if (sample) found.push(sample); }
  if (!key) found.push('12345', 'ABC123');
  // The caller drops whichever candidate it wrote; the input itself may still be a good alternative
  // (a date reshaped from its ISO form can fall back to ISO).
  return [...new Set(found)].filter(Boolean);
}

// The first candidate the browser itself would accept in this control.
export function firstValid(el: Control, candidates: readonly string[]): string | undefined {
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return candidates[0];
  for (const candidate of candidates) {
    const probe = el.cloneNode() as HTMLInputElement | HTMLTextAreaElement;
    probe.value = candidate;
    if (probe.value === candidate && (el.maxLength < 0 || candidate.length <= el.maxLength) && probe.checkValidity()) return candidate;
  }
  return undefined;
}

// ---- After the fill: the app's own verdict. Frameworks mark rejected fields with aria-invalid,
// sometimes a moment later, so the extension calls this after a short wait.
type RetryState = PageState & { __devfillerRetry?: Map<Control, { candidates: string[]; next: number }> };

export function rememberAlternatives(el: Control, candidates: readonly string[]) {
  const state = globalThis as RetryState;
  state.__devfillerRetry ??= new Map();
  if (candidates.length) state.__devfillerRetry.set(el, { candidates: [...candidates], next: 0 });
  else state.__devfillerRetry.delete(el);
}

export function forgetAlternatives() { (globalThis as RetryState).__devfillerRetry = new Map(); }

const rejected = (el: Control) => el.getAttribute('aria-invalid') === 'true' || !el.checkValidity();

// Tries the next alternative in every filled field the page rejected. Returns how many it changed.
// The extension calls it again after each short wait until nothing is left to retry.
export function revalidate(): { retried: number; stillInvalid: number } {
  const state = globalThis as RetryState;
  let retried = 0, stillInvalid = 0;
  for (const [el, entry] of state.__devfillerRetry ?? []) {
    if (!el.isConnected || !rejected(el)) continue;
    const next = entry.candidates[entry.next];
    if (next === undefined) { stillInvalid++; continue; }
    entry.next++;
    el.focus({ preventScroll: true });
    setNativeValue(el, next);
    // Most apps validate on blur, so leave the field the way a person would.
    el.dispatchEvent(new FocusEvent('blur'));
    el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    dispatchChange(el);
    retried++;
  }
  return { retried, stillInvalid };
}
