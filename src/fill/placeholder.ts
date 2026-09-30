import type { FieldKey } from '../data';
import type { Random } from '../rng';
import type { Control } from './types';

// What a placeholder shows about the value it wants: a format ("DD/MM/YYYY", "HH:MM"), or an
// example ("e.g. 2019", "you@company.com", "+213 5XX XX XX XX", "Ex: Paris").

// "e.g. 5", "Ex : Paris", "Example: 12", "par ex. 3", "مثال: 2020" → the example itself.
// The prefix must end the word: "Explain your role" and "Expiry date" aren't examples.
const EXAMPLE_PREFIX = /^(?:e\.\s?g\.?|eg(?=[\s:])|ex(?:ample)?\.?(?=[\s:：])|ex\.|for example|such as|par ex(?:emple)?\.?|exemple|مثال|مثلا|مثلاً)(?:\s*[:：,-]\s*|\s+)/iu;
const DATE_FORMAT = /^(?:(?:dd|jj|يوم)\s*([/.-])\s*(?:mm|شهر)\s*\1\s*(?:yyyy|aaaa|yy|سنة)|(?:mm)\s*([/.-])\s*(?:dd)\s*\2\s*(?:yyyy|yy)|(?:yyyy|aaaa)\s*([/.-])\s*(?:mm)\s*\3\s*(?:dd|jj))$/iu;
const TIME_FORMAT = /^(?:hh|hh24)\s*:\s*mm(?:\s*:\s*ss)?(?:\s*(?:am|pm|a))?$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const URL = /^(?:https?:\/\/\S*|www\.\S+\.\S+|\S+\.(?:com|net|org|io|dev|fr|dz)(?:\/\S*)?)$/i;
// "+213 5XX XX XX XX", "(555) 123-4567", "06 12 34 56 78": digits, or X standing for them.
const PHONE = /^\+?[\d(][\dXx#*\s().-]{6,}$/;
// Card numbers and security or one-time codes shown as masks: never a shape to copy.
const CODE_MASK = /^(?:\d{4}[\s-]?){3}\d{1,7}$|^[•*x0-9]{13,19}$|^(?:123|1234|000|0000|000000|123456|•+|\*+)$/i;
const YEAR = /^(?:19|20)\d{2}$|^(?:yyyy|aaaa|سنة)$/i;
const INTEGER = /^\d{1,9}$/;
const DECIMAL = /^\d{1,9}[.,]\d{1,4}$/;

export type PlaceholderShape =
  | { kind: 'date'; format: string }
  | { kind: 'time' }
  | { kind: 'email' | 'website' | 'phone' }
  | { kind: 'year' }
  | { kind: 'integer'; digits: number }
  | { kind: 'decimal'; decimals: number; separator: string }
  | { kind: 'example'; text: string };

export const placeholderOf = (el: Element) => (el.getAttribute('placeholder') || el.getAttribute('aria-placeholder') || '').trim();

// What the placeholder asks for, or undefined when it's a plain instruction ("Enter your name").
export function placeholderShape(raw: string): PlaceholderShape | undefined {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text || text.length > 60) return undefined;
  if (DATE_FORMAT.test(text)) return { kind: 'date', format: text };
  if (TIME_FORMAT.test(text)) return { kind: 'time' };
  if (CODE_MASK.test(text.replace(EXAMPLE_PREFIX, ''))) return undefined;
  const hasPrefix = EXAMPLE_PREFIX.test(text);
  const example = text.replace(EXAMPLE_PREFIX, '').replace(/^["“'«]|["”'»]$/g, '').trim();
  if (!example) return undefined;
  if (DATE_FORMAT.test(example)) return { kind: 'date', format: example };
  if (EMAIL.test(example)) return { kind: 'email' };
  if (/^https?:\/\/$/i.test(example) || URL.test(example)) return { kind: 'website' };
  if (YEAR.test(example)) return { kind: 'year' };
  if (DECIMAL.test(example)) return { kind: 'decimal', decimals: example.split(/[.,]/)[1].length, separator: example.includes(',') ? ',' : '.' };
  if (INTEGER.test(example)) return { kind: 'integer', digits: example.length };
  const phoneDigits = example.replace(/[^\dXx]/g, '').length;
  if (PHONE.test(example) && phoneDigits >= 6 && phoneDigits <= 15) return { kind: 'phone' };
  // Only an explicit "e.g." makes words an example: "Enter your city" is an instruction.
  if (hasPrefix && example.length <= 40 && !/[?!]$/.test(example)) return { kind: 'example', text: example.replace(/[.…]+$/, '') };
  return undefined;
}

// The field type a placeholder's shape points to, and how strongly.
export const SHAPE_TYPES: Readonly<Partial<Record<PlaceholderShape['kind'], readonly [FieldKey, number]>>> = {
  date: ['date', 0.8], time: ['time', 0.8], email: ['email', 0.88], website: ['website', 0.82], phone: ['phone', 0.82], year: ['year', 0.7],
};

const digits = (random: Random, count: number) => Array.from({ length: count }, (_, i) => i === 0 && count > 1 ? 1 + random(9) : random(10)).join('');

// A value shaped like the placeholder's example, for a field nothing else recognized.
export function placeholderValue(el: Control, random: Random, year: string): string | undefined {
  const shape = placeholderShape(placeholderOf(el));
  if (!shape) return undefined;
  if (shape.kind === 'year') return String(Number(year) - random(8));
  if (shape.kind === 'integer') return shape.digits <= 2 ? String(1 + random(shape.digits === 1 ? 9 : 20)) : digits(random, shape.digits);
  if (shape.kind === 'decimal') return `${1 + random(99)}${shape.separator}${digits(random, shape.decimals)}`;
  if (shape.kind === 'example') return shape.text;
  return undefined;
}
