import type { Signal } from './extract';
import type { Random } from '../rng';

// Units written next to a field ("Longueur (mm)", "Weight [lb]", "Prix en €", "Taux ($/h)") say what
// the field holds and how big its value should be.

export type UnitKind = 'length' | 'weight' | 'area' | 'volume' | 'count' | 'percent' | 'currency';
export interface Unit { symbol: string; kind: UnitKind; per?: string } // per: "h" in "$/h"

const UNITS: ReadonlyArray<readonly [UnitKind, readonly string[]]> = [
  ['area', ['mm²', 'mm2', 'cm²', 'cm2', 'm²', 'm2', 'ft²', 'ft2', 'sq ft', 'ha']],
  ['volume', ['m³', 'm3', 'cm³', 'cm3', 'l', 'ml', 'cl', 'litres', 'liters', 'gal']],
  ['length', ['mm', 'cm', 'm', 'km', 'in', 'inch', 'inches', 'ft', 'feet', 'yd', 'µm']],
  ['weight', ['mg', 'g', 'kg', 't', 'tonnes', 'tons', 'lb', 'lbs', 'oz']],
  ['count', ['u', 'pcs', 'pc', 'pieces', 'pièces', 'unités', 'units', 'qty']],
  ['percent', ['%', 'pct', 'percent']],
  ['currency', ['€', 'eur', '$', 'usd', '£', 'gbp', 'da', 'dzd', 'dinars', 'د.ج', 'دج']],
];
const SYMBOLS = new Map(UNITS.flatMap(([kind, symbols]) => symbols.map(symbol => [symbol, kind] as const)));
const VISIBLE = new Set(['label', 'aria-label', 'aria-labelledby', 'placeholder', 'title', 'nearby']);

// "(mm)", "[kg]", "en mm", "in inches", "($/h)", or a unit ending the label: "Longueur mm".
function unitIn(text: string): Unit | undefined {
  const lower = text.toLowerCase().replace(/\s+/g, ' ').trim();
  const candidates = [
    // A bracket holds a unit, not a formula: "(mm)", "(€ HT)", "($/h)", but not "(L × l × h)".
    ...Array.from(lower.matchAll(/[([]\s*([^)\]]{1,12}?)\s*[)\]]/g), match => match[1]).filter(inner => inner.split(/\s+/).length <= 2),
    ...Array.from(lower.matchAll(/(?:^|\s)(?:en|in)\s+(\S{1,8})$/g), match => match[1]),
    lower.match(/\s(\S{1,4})\*?$/)?.[1] ?? '',
  ];
  for (const candidate of candidates) {
    // "$/h", "€ HT", "kg/m": the first part names the unit.
    const [symbol, per] = candidate.split('/').map(part => part.trim().split(/\s/)[0].replace(/\.$/, ''));
    const kind = SYMBOLS.get(symbol);
    // A lone "m", "t", "l", "u" or "g" only counts inside brackets; "€" and "%" count anywhere.
    if (kind && (symbol.length > 1 || /[([]/.test(lower) || kind === 'currency' || kind === 'percent')) return per ? { symbol, kind, per } : { symbol, kind };
  }
  return undefined;
}

export function unitOf(signals: readonly Signal[]): Unit | undefined {
  for (const signal of signals) {
    if (!VISIBLE.has(signal.source)) continue;
    const unit = unitIn(signal.raw);
    if (unit) return unit;
  }
  return undefined;
}

export type Dimension = 'length' | 'thickness' | 'diameter' | 'weight' | 'area' | 'volume';
// [smallest, largest, decimals] for a dimension in a unit.
const RANGES: Readonly<Record<Dimension, Readonly<Record<string, readonly [number, number, number]>>>> = {
  length: { mm: [100, 6000, 0], cm: [10, 600, 0], m: [1, 60, 1], km: [1, 500, 0], in: [1, 240, 1], inch: [1, 240, 1], inches: [1, 240, 1], ft: [1, 50, 1], feet: [1, 50, 1], yd: [1, 20, 1], µm: [5, 500, 0], '': [10, 500, 0] },
  thickness: { mm: [1, 40, 1], cm: [1, 10, 1], m: [0.01, 0.5, 2], in: [0.1, 2, 2], µm: [10, 500, 0], '': [1, 40, 1] },
  diameter: { mm: [5, 500, 0], cm: [1, 50, 1], m: [0.1, 5, 2], in: [0.25, 20, 2], '': [5, 500, 0] },
  weight: { kg: [0.5, 2000, 1], g: [5, 5000, 0], mg: [1, 1000, 0], t: [1, 40, 1], tonnes: [1, 40, 1], tons: [1, 40, 1], lb: [1, 4000, 1], lbs: [1, 4000, 1], oz: [1, 100, 1], '': [1, 500, 1] },
  area: { 'm²': [5, 500, 1], m2: [5, 500, 1], 'cm²': [10, 10000, 0], cm2: [10, 10000, 0], 'mm²': [10, 100000, 0], mm2: [10, 100000, 0], 'ft²': [50, 5000, 0], ft2: [50, 5000, 0], 'sq ft': [50, 5000, 0], ha: [1, 200, 1], '': [5, 500, 1] },
  volume: { 'm³': [1, 100, 1], m3: [1, 100, 1], l: [1, 1000, 0], litres: [1, 1000, 0], liters: [1, 1000, 0], ml: [10, 2000, 0], cl: [5, 100, 0], 'cm³': [10, 5000, 0], cm3: [10, 5000, 0], gal: [1, 200, 1], '': [1, 100, 1] },
};

// A number in the range of that dimension and unit. Half the decimal values are whole numbers,
// the way people usually type them.
export function measurementNumber(dimension: Dimension, unit: string, random: Random): { value: number; decimals: number } {
  const table = RANGES[dimension];
  const [min, max, decimals] = table[unit] ?? table[''];
  const scale = 10 ** decimals;
  const raw = min + random(Math.round((max - min) * scale) + 1) / scale;
  const value = decimals && random(2) ? Math.round(raw) || min : raw;
  return { value: Number(value.toFixed(decimals)), decimals };
}
