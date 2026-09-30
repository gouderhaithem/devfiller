import type { FieldKey } from '../data';
import type { Random } from '../rng';
import type { Classification } from './classify';
import type { Control, FillContext } from './types';
import { SOURCE_GROUP } from './classify';
import { normalize } from './normalize';
import { measurementNumber, unitOf, type Dimension } from './units';

// Values shaped by their field: a measurement sized for its dimension and unit, and a reference
// code that looks like the ones the page expects.

const words = (list: readonly string[]) => list.map(normalize);
const contains = (text: string, phrase: string) => ` ${text} `.includes(` ${phrase} `);
const texts = (found: Classification) => (found.signals ?? []).filter(signal => ['visible', 'attribute'].includes(SOURCE_GROUP[signal.source])).map(signal => signal.text);
const says = (found: Classification, list: readonly string[]) => texts(found).some(text => list.some(word => contains(text, word)));

// The page's language decides the decimal separator: "12,5" on a French page.
const language = (el: Control) => (el.closest('[lang]')?.getAttribute('lang') || document.documentElement.lang || '').toLowerCase();
const isNumberInput = (el: Control) => el instanceof HTMLInputElement && (el.type === 'number' || el.type === 'range');
export function localizeDecimal(el: Control, value: string): string {
  return !isNumberInput(el) && /^fr\b/.test(language(el)) && /^-?\d+\.\d+$/.test(value) ? value.replace('.', ',') : value;
}
export const DECIMAL_KEYS: ReadonlySet<FieldKey> = new Set(['price', 'amount', 'salary', 'measurement', 'percentage']);

const DIMENSIONS: ReadonlyArray<readonly [Dimension, readonly string[]]> = [
  ['thickness', words(['thickness', 'thick', 'épaisseur', 'ep', 'gauge', 'السمك'])],
  ['diameter', words(['diameter', 'diamètre', 'dia', 'radius', 'rayon', 'القطر'])],
  ['weight', words(['weight', 'poids', 'mass', 'masse', 'الوزن'])],
  ['area', words(['area', 'surface', 'superficie', 'المساحة'])],
  ['volume', words(['volume', 'capacity', 'capacité', 'الحجم'])],
];

export function measurementValue(el: Control, found: Classification, random: Random): string {
  const unit = unitOf(found.signals ?? []);
  const byUnit: Partial<Record<string, Dimension>> = { weight: 'weight', area: 'area', volume: 'volume' };
  const named = DIMENSIONS.find(([, list]) => says(found, list))?.[0];
  const dimension: Dimension = (unit && byUnit[unit.kind]) || (named && (named !== 'weight' || !unit || unit.kind === 'weight') ? named : 'length');
  const { value } = measurementNumber(dimension, unit?.symbol ?? '', random);
  return localizeDecimal(el, String(value));
}

// Prefixes by what the reference refers to, in English and French. Dated kinds carry the year.
const REFERENCE_KINDS: ReadonlyArray<readonly [readonly string[], string, string, boolean]> = [
  [words(['work order', 'ordre de travail']), 'WO', 'OT', true],
  [words(['purchase order', 'po', 'bon de commande', 'bc']), 'PO', 'BC', true],
  [words(['invoice', 'facture', 'فاتورة']), 'INV', 'FAC', true],
  [words(['quote', 'devis']), 'QT', 'DEV', true],
  [words(['delivery note', 'bon de livraison', 'livraison']), 'DN', 'BL', true],
  [words(['order', 'commande', 'طلب']), 'ORD', 'CMD', true],
  [words(['sku']), 'SKU', 'SKU', false],
  [words(['part', 'article', 'item', 'product', 'produit']), 'PRT', 'ART', false],
  [words(['ticket']), 'TCK', 'TCK', false],
  [words(['lot', 'batch']), 'LOT', 'LOT', false],
  [words(['serial', 'serie']), 'SN', 'NS', false],
  [words(['dossier', 'file', 'case']), 'CASE', 'DOS', false],
];

const digits = (random: Random, count: number, leading = true) => Array.from({ length: count }, (_, i) => i === 0 && !leading ? 1 + random(9) : random(10)).join('');
const letter = (random: Random) => String.fromCharCode(65 + random(26));

// How many digits a digit-only pattern asks for: "[0-9]{8}", "\d{6,10}".
function patternDigits(el: Control): number | undefined {
  const pattern = el.getAttribute('pattern') || '';
  const match = pattern.match(/^\^?(?:\\d|\[0-9\])\{(\d+)(?:,(\d+))?\}\$?$/);
  return match ? Number(match[1]) : /^\^?(?:\\d|\[0-9\])[+*]\$?$/.test(pattern) ? 8 : undefined;
}
export const wantsDigits = (el: Control) => isNumberInput(el) || /^(numeric|decimal)$/.test(el.getAttribute('inputmode') || '') || patternDigits(el) !== undefined;

// Whether the browser would accept the value in this control: its pattern, type and length.
function fits(el: Control, value: string): boolean {
  if (!(el instanceof HTMLInputElement)) return true;
  const probe = el.cloneNode() as HTMLInputElement;
  probe.value = value;
  return probe.value === value && (el.maxLength < 0 || value.length <= el.maxLength) && probe.checkValidity();
}

export function referenceValue(el: Control, found: Classification, random: Random, year: string): string {
  const kind = REFERENCE_KINDS.find(([list]) => says(found, list));
  const french = /^fr\b/.test(language(el));
  const prefix = kind ? (french ? kind[2] : kind[1]) : 'REF';
  const max = 'maxLength' in el && el.maxLength > 0 ? el.maxLength : Infinity;
  const count = patternDigits(el) ?? (max >= 4 && max <= 12 ? max : 8);
  const candidates = wantsDigits(el) ? [digits(random, count, !isNumberInput(el))]
    : max <= 4 ? [`${letter(random)}${digits(random, Math.min(2, max - 1))}`]
    : [kind?.[3] ? `${prefix}-${year}-${digits(random, 4)}` : `${prefix}-${digits(random, 5)}`, `${prefix}-${digits(random, 5)}`, `${prefix}${digits(random, 4)}`, digits(random, Math.min(count, 8))];
  return candidates.find(candidate => fits(el, candidate)) ?? candidates.at(-1)!;
}

// An unrecognized field that wants digits gets digits, not a word.
export function numericFallback(el: Control, random: Random): string | undefined {
  if (!(el instanceof HTMLInputElement) || !['text', 'search', 'tel', ''].includes(el.type) || !wantsDigits(el)) return undefined;
  const count = patternDigits(el);
  return count ? digits(random, count) : String(1 + random(1000));
}
