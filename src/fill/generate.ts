import type { Exclusions, FieldKey, Identity, Values } from '../data';
import type { Control, FillContext, FillRequest } from './types';
import { COUNTRY_SPELLINGS, DATE_FIELD_TYPES, EXTENDABLE_KEYS, NUMERIC_KEYS, PLACEHOLDER_OPTION } from './dictionary';
import { datePart } from './classify';
import { optionTexts } from './extract';
import { GENDER_SPELLINGS, MONTH_NAMES, STATE_SPELLINGS } from './vocabulary';
import { DATE_TYPES, TEXT_TYPES, isInput } from './extract';
import { shouldExclude } from './exclude';
import { normalize } from './normalize';

export const random = (max: number) => max > 0 ? crypto.getRandomValues(new Uint32Array(1))[0] % max : 0;
const pick = <T>(choices: readonly T[]) => choices[random(choices.length)];

const WORDS = ['Garden','River','Meadow','Forest','Ocean','Sunshine','Morning','Breeze','Willow','Orchard','Mountain','Valley','Rainbow','Cloud','Summer','Autumn','Winter','Spring','Harbor','Village','Market','Library','Workshop','Journey','Picnic','Lantern','Candle','Window','Basket','Flower','Apple','Orange','Cherry','Peach','Olive','Maple','Cedar','Robin','Sparrow','Butterfly','Welcome','Friendly','Peaceful','Bright','Fresh','Gentle','Calm','Kind','Home','Book','Tree','Leaf','Sky','Sun','Sea','Tea','Go','Be','We','Us','It','A','I'];
const SENTENCES = ['The garden is quiet today.', 'A gentle breeze moves through the trees.', 'We enjoyed a walk beside the river.', 'The morning sun lights up the room.', 'Fresh flowers brighten the house.', 'A friendly welcome makes a lovely day.', 'The village market opens in the morning.', 'We found a peaceful place by the sea.'];
const IDENTITY_KEYS = ['firstName','middleName','lastName','fullName','username','email'] as const;

// A value the resolver settled on, with where it came from.
export interface Resolved { value: string; key?: FieldKey; literal: boolean; generic: boolean; ai: boolean }

// Real words and sentences for unknown text, never ID padding or scrambled characters.
export function readableText(ctx: FillContext, el: HTMLInputElement | HTMLTextAreaElement): string {
  const max = el.maxLength < 0 ? Infinity : el.maxLength;
  const min = Math.max(0, el.minLength);
  const preferred = el instanceof HTMLTextAreaElement ? SENTENCES : WORDS;
  let choices = preferred.filter(word => word.length <= max && word.length >= min);
  if (!choices.length) choices = WORDS.filter(word => word.length <= max);
  const different = choices.filter(word => word !== el.value);
  if (different.length) choices = different;
  const unused = choices.filter(word => !ctx.usedText.has(word));
  if (unused.length) choices = unused;
  let value = pick(choices) || '';
  while (value && value.length < min) {
    const fitting = WORDS.filter(word => value.length + 1 + word.length <= max);
    if (!fitting.length) break;
    value += ` ${pick(fitting).toLowerCase()}`;
  }
  // Longer minimum lengths may produce the same phrase; choose a new opening word.
  if (ctx.request.overwrite && value === el.value && value.includes(' ')) {
    const [first, ...rest] = value.split(' ');
    const alternatives = WORDS.filter(word => word !== first && word.length <= first.length);
    if (alternatives.length) value = `${pick(alternatives)} ${rest.join(' ')}`;
  }
  ctx.usedText.add(value);
  return value;
}

const randomWeek = (date: string) => `${date.slice(0, 4)}-W${String(1 + random(52)).padStart(2, '0')}`;

// The generic value for an unrecognized control when "Fill unknown fields" is on.
export function fallbackValue(ctx: FillContext, el: Control): { value: string; generic: boolean } {
  const { date, time, color } = ctx.request.values;
  if (el instanceof HTMLTextAreaElement) return { value: readableText(ctx, el), generic: true };
  if (!isInput(el)) return { value: 'Sample', generic: false };
  const byType: Record<string, () => string> = {
    number: () => String(1 + random(1000)), range: () => String(random(101)), date: () => date, 'datetime-local': () => `${date}T${time}`,
    month: () => date.slice(0, 7), week: () => randomWeek(date), time: () => time, color: () => color,
  };
  return Object.hasOwn(byType, el.type) ? { value: byType[el.type](), generic: false } : { value: readableText(ctx, el), generic: true };
}

// On repeated fills, pick one coherent alternative identity and fresh samples for the whole form.
// Values are only compared locally; they never leave the page.
export function coherentValues(request: FillRequest, controls: readonly Control[], exclusions: Exclusions): Values {
  let values = request.values;
  if (request.mode === 'scan' || !request.overwrite || !(request.identities?.length || request.samples)) return values;
  const current = controls.filter(el => !el.disabled && !('readOnly' in el && el.readOnly) && el.getClientRects().length && !shouldExclude(el, exclusions))
    .map(el => ({ value: el.value.trim(), maxLength: 'maxLength' in el ? el.maxLength : -1 })).filter(el => el.value);
  const repeatsValue = (value: string) => current.some(el => (el.maxLength < 0 ? value : value.slice(0, el.maxLength)) === el.value);
  const repeats = (identity: Identity) => IDENTITY_KEYS.some(key => repeatsValue(identity[key]));
  if (request.identities?.length && repeats(values)) {
    const alternatives = request.identities.filter(identity => !repeats(identity));
    if (alternatives.length) values = { ...values, ...pick(alternatives) };
  }
  // Select once per field category so repeated fields (especially password confirmation)
  // share the same readable value instead of independently choosing alternatives.
  for (const [key, choices] of Object.entries(request.samples || {}) as [FieldKey, readonly string[]][]) {
    if (IDENTITY_KEYS.some(identityKey => identityKey === key) || !repeatsValue(values[key])) continue;
    const alternatives = choices.filter(candidate => !repeatsValue(candidate));
    if (alternatives.length) values = { ...values, [key]: pick(alternatives) };
  }
  return values;
}

// Every way an option may spell a generated value: "Algeria", "Algérie", "DZ", "الجزائر".
// Gender and wilaya spellings only apply to those fields: an "Algiers" city isn't wilaya "16".
export function spellingsFor(value: string, key?: FieldKey): readonly string[] {
  const tables = [COUNTRY_SPELLINGS, ...(key === 'gender' ? [GENDER_SPELLINGS] : []), ...(key === 'state' ? [STATE_SPELLINGS] : [])];
  for (const table of tables) if (Object.hasOwn(table, value)) return table[value];
  return [value];
}

// The option (or radio) whose text or value spells the value: an exact match first, then a longer
// text that contains it as words ("16 - Alger"). One- and two-letter codes must match exactly.
// Spellings are tried in order, so the preferred one wins ("Prefer not to say" before "Other").
export function matchChoice<T>(choices: readonly T[], spellings: readonly string[], texts: (choice: T) => string[]): T | undefined {
  const wanted = spellings.map(normalize).filter(Boolean);
  const normalized = choices.map(choice => texts(choice).map(normalize));
  for (const word of wanted) {
    const exact = normalized.findIndex(list => list.includes(word));
    if (exact >= 0) return choices[exact];
  }
  for (const word of wanted.filter(word => word.length > 2)) {
    const inside = normalized.findIndex(list => list.some(text => ` ${text} `.includes(` ${word} `)));
    if (inside >= 0) return choices[inside];
  }
  return undefined;
}

// Split date selects: the day, month or year of the date. A missing year takes the nearest one.
function datePartOption(options: readonly HTMLOptionElement[], value: string, part: 'day' | 'month' | 'year'): HTMLOptionElement | undefined {
  const [year, month, rawDay] = value.slice(0, 10).split('-').map(Number);
  // 29 February becomes the 28th: the year select may only offer non-leap years.
  const day = month === 2 && rawDay === 29 ? 28 : rawDay;
  const target = part === 'year' ? year : part === 'month' ? month : day;
  const number = (o: HTMLOptionElement) => Number(o.value || o.textContent);
  // Month names win over values, which may count from 0.
  if (part === 'month') {
    const named = options.find(o => MONTH_NAMES[target - 1].has(normalize(o.textContent || '').replace(/ /g, '')));
    if (named) return named;
  }
  const byNumber = options.find(o => number(o) === target);
  if (byNumber || part !== 'year') return byNumber;
  const years = options.filter(o => Number.isInteger(number(o)) && number(o) > 1000);
  return years.sort((a, b) => Math.abs(number(a) - target) - Math.abs(number(b) - target))[0];
}

export function chooseOption(ctx: FillContext, el: HTMLSelectElement, resolved: Resolved): string | undefined {
  const { overwrite, fillUnknown } = ctx.request;
  const options = Array.from(el.options).filter(o => !o.disabled && !(o.parentElement instanceof HTMLOptGroupElement && o.parentElement.disabled));
  const eligible = options.filter(o => o.value && !PLACEHOLDER_OPTION.test(o.textContent || ''));
  const part = resolved.key && DATE_FIELD_TYPES.has(resolved.key) ? datePart(optionTexts(el)) : undefined;
  if (part && /^\d{4}-\d{2}-\d{2}/.test(resolved.value)) return datePartOption(eligible, resolved.value, part)?.value;
  const different = eligible.filter(o => !o.selected);
  const match = matchChoice(options, spellingsFor(resolved.value, resolved.key), o => [o.value, o.textContent || '']);
  const choices = overwrite && different.length ? different : eligible;
  const option = resolved.literal ? match
    : overwrite && match?.selected && fillUnknown && different.length ? pick(different)
    : match || (fillUnknown ? pick(choices) : undefined);
  return option?.value;
}

export function fitNumber(ctx: FillContext, el: HTMLInputElement, resolved: Resolved): string | undefined {
  let number = Number(resolved.value);
  if (!Number.isFinite(number)) {
    if (!ctx.request.fillUnknown || resolved.ai) return undefined;
    number = 1 + random(1000);
  }
  const min = el.min !== '' ? Number(el.min) : el.type === 'range' ? 0 : -Infinity;
  const max = el.max !== '' ? Number(el.max) : el.type === 'range' ? 100 : Infinity;
  number = Math.max(min, Math.min(max, number));
  const step = el.step === 'any' ? 0 : Number(el.step || 1);
  const base = Number.isFinite(min) ? min : Number(el.getAttribute('value') || 0);
  if (step > 0) number = base + Math.round((number - base) / step) * step;
  if (number > max && step > 0) number -= step;
  if (ctx.request.overwrite && el.value !== '' && number === Number(el.value)) {
    const increment = step > 0 ? step : 0.01;
    if (number + increment <= max) number += increment;
    else if (number - increment >= min) number -= increment;
  }
  return String(Number(number.toFixed(8)));
}

// The neighbouring date, month, week or time, one step up or down, that stays within min/max.
function nextDate(el: HTMLInputElement, value: string, direction: number, step: number): string {
  if (el.type === 'month') {
    const d = new Date(`${value}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + direction * step); return d.toISOString().slice(0, 7);
  }
  if (el.type === 'week') {
    let [year, week] = value.split('-W').map(Number); week += direction * step;
    while (week > 52) { year++; week -= 52; } while (week < 1) { year--; week += 52; }
    return `${year}-W${String(week).padStart(2, '0')}`;
  }
  const d = new Date(el.type === 'date' ? `${value}T00:00:00Z` : el.type === 'time' ? `2000-01-01T${value}Z` : `${value}Z`);
  d.setTime(d.getTime() + direction * step * (el.type === 'date' ? 86400000 : 1000));
  return el.type === 'date' ? d.toISOString().slice(0, 10) : el.type === 'time' ? d.toISOString().slice(11, 19) : d.toISOString().slice(0, 19);
}

export function fitDate(ctx: FillContext, el: HTMLInputElement, resolved: Resolved): string {
  const { date, time } = ctx.request.values;
  let value = resolved.value;
  if (el.type === 'datetime-local' && /^\d{4}-\d{2}-\d{2}$/.test(value)) value += `T${time}`;
  if (el.type === 'month') value = value.slice(0, 7);
  const formatProbe = el.cloneNode() as HTMLInputElement; formatProbe.value = value;
  if (!formatProbe.value && ctx.request.fillUnknown && !resolved.ai) {
    value = el.type === 'date' ? date : el.type === 'datetime-local' ? `${date}T${time}` : el.type === 'month' ? date.slice(0, 7) : el.type === 'week' ? randomWeek(date) : time;
  }
  if (el.min && value < el.min) value = el.min;
  if (el.max && value > el.max) value = el.max;
  if (ctx.request.overwrite && value === el.value) {
    const step = Math.max(1, Number(el.step) || (el.type === 'time' || el.type === 'datetime-local' ? 60 : 1));
    for (const direction of [1, -1]) {
      const next = nextDate(el, value, direction, step);
      if ((!el.min || next >= el.min) && (!el.max || next <= el.max)) return next;
    }
  }
  return value;
}

export function fitText(ctx: FillContext, el: HTMLInputElement | HTMLTextAreaElement, resolved: Resolved, value: string): string {
  const { request } = ctx;
  const key = resolved.key;
  const fit = (text: string) => el.maxLength < 0 ? text : text.slice(0, el.maxLength);
  if (!resolved.literal && key && request.overwrite && fit(value) === el.value) {
    if (NUMERIC_KEYS.includes(key) && Number.isFinite(Number(value))) value = String(Number(value) + 1);
    else if (key === 'phone') value = `+1 202 555 01${String((Number(value.slice(-2)) + 1) % 100).padStart(2, '0')}`;
  }
  if (!request.fillUnknown || resolved.literal) return value;
  // Length requirements use complete words, never ID padding or character scrambling.
  if (!resolved.generic && key && EXTENDABLE_KEYS.includes(key)) {
    const max = el.maxLength < 0 ? 5000 : Math.min(5000, el.maxLength);
    while (value.length < el.minLength) {
      const fitting = (request.samples?.[key] || SENTENCES).filter(sentence => value.length + 1 + sentence.length <= max);
      if (!fitting.length) break;
      value += ` ${pick(fitting)}`;
    }
  }
  return el.maxLength >= 0 ? fit(value) : value;
}

// Checks the value against the control the way the browser would, without touching the page.
function accepted(ctx: FillContext, el: HTMLInputElement | HTMLTextAreaElement, value: string): string | undefined {
  const probe = el.cloneNode() as HTMLInputElement | HTMLTextAreaElement;
  probe.value = value;
  if (probe.value && isInput(el) && DATE_TYPES.includes(el.type)) value = probe.value;
  if (probe.value !== value || (el.maxLength >= 0 && value.length > el.maxLength) || (!ctx.request.fillUnknown && !probe.checkValidity())) return undefined;
  return value;
}

// Fits a resolved value to the control's type and limits. Undefined means it can't fit.
export function fitValue(ctx: FillContext, el: Control, resolved: Resolved): string | undefined {
  if (el instanceof HTMLSelectElement) return chooseOption(ctx, el, resolved);
  let value: string | undefined = resolved.value;
  if (!resolved.literal && isInput(el) && ['number', 'range'].includes(el.type)) {
    value = fitNumber(ctx, el, resolved);
    if (value === undefined) return undefined;
  }
  if (!resolved.literal && isInput(el) && DATE_TYPES.includes(el.type)) value = fitDate(ctx, el, { ...resolved, value });
  if (!isInput(el) || TEXT_TYPES.includes(el.type)) value = fitText(ctx, el, resolved, value);
  if (!resolved.literal && isInput(el) && el.type === 'color' && ctx.request.overwrite && value === el.value) {
    value = `#${((parseInt(value.slice(1), 16) + 1) % 0x1000000).toString(16).padStart(6, '0')}`;
  }
  return accepted(ctx, el, value);
}
