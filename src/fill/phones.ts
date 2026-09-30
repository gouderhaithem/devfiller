import type { Control, FillContext } from './types';
import { classificationOf, usableKey } from './classify';
import { COUNTRY_SPELLINGS } from './dictionary';
import { fitValue, matchChoice } from './generate';
import { setNativeValue } from './apply';

type Region = 'us' | 'fr' | 'dz';
const COUNTRY_REGION: Readonly<Record<string, Region>> = { 'United States': 'us', France: 'fr', Algeria: 'dz' };
const DIAL_CODE: Readonly<Record<Region, string>> = { dz: '+213', fr: '+33', us: '+1' };
// Dial codes in a field's hints. National numbers (05…, 06…) exist in more than one of these
// countries, so they only decide the format, not the country.
const DIAL_HINTS: ReadonlyArray<readonly [RegExp, Region]> = [[/(?:\+|00)\s?213/, 'dz'], [/(?:\+|00)\s?33/, 'fr'], [/\+\s?1/, 'us']];

const hints = (el: Control) => ['placeholder', 'pattern', 'title'].map(name => (el.getAttribute(name) || '').trim()).filter(Boolean);
const regionOfValue = (value: string) => (Object.entries(DIAL_CODE) as [Region, string][]).find(([, code]) => value.startsWith(`${code} `))?.[0];

// "Algérie", "Algeria +213", "Algérie (DZ)": the country a text names, if it is one of the regions.
function regionOfCountry(text: string): Region | undefined {
  for (const [country, spellings] of Object.entries(COUNTRY_SPELLINGS)) {
    if (matchChoice([text], spellings, value => [value])) return COUNTRY_REGION[country];
  }
  return undefined;
}

// The country each form asks for: its first visible country field, as it ended up after the fill.
function formRegions(ctx: FillContext): Map<HTMLFormElement | null, Region> {
  const regions = new Map<HTMLFormElement | null, Region>();
  for (const other of ctx.controls) {
    if (regions.has(other.form) || !ctx.visible.get(other) || usableKey(classificationOf(ctx.classifications, other), true) !== 'country') continue;
    const texts = other instanceof HTMLSelectElement ? [other.selectedOptions[0]?.textContent || '', other.value] : [other.value];
    const region = texts.map(text => text.trim() && regionOfCountry(text)).find(Boolean);
    if (region) regions.set(other.form, region);
  }
  return regions;
}

// Among our regions, an Arabic-language form is Algerian.
const languageRegion = (el: Control): Region | undefined => /^ar\b/i.test(el.closest('[lang]')?.getAttribute('lang') || '') ? 'dz' : undefined;

// "05XX XX XX XX", "06 12 34 56 78" or a ten-character limit: the field wants a national number.
const wantsNational = (el: Control) => hints(el).some(hint => /^0\d/.test(hint)) || ('maxLength' in el && el.maxLength > 0 && el.maxLength <= 10);

// A short field gets the digits alone: "0550123456" fits a ten-character limit.
function national(phone: string, region: Region, short: boolean): string {
  const digits = phone.slice(DIAL_CODE[region].length).replace(/\D/g, '');
  if (region === 'us') return short ? digits : `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return short ? `0${digits}` : `0${phone.slice(DIAL_CODE[region].length + 1)}`;
}

// Phone numbers follow the form: a dial code on the field, then the country chosen in the form,
// then the form's language, win over the region the data was generated for. Only numbers the
// engine generated are changed, and a number already in the right country and format stays.
export function alignPhones(ctx: FillContext) {
  const phones = ctx.request.phones;
  if (!phones || ![...ctx.filled.values()].includes('phone')) return;
  const countries = formRegions(ctx);
  const confirmations = new Map<Control, Control[]>();
  for (const other of ctx.controls) {
    const pair = classificationOf(ctx.classifications, other).pairOf;
    if (pair && ctx.touched.has(other)) confirmations.set(pair, [...(confirmations.get(pair) ?? []), other]);
  }
  for (const [el, key] of ctx.filled) {
    if (key !== 'phone') continue;
    const current = regionOfValue(el.value);
    const region = DIAL_HINTS.find(([pattern]) => hints(el).some(hint => pattern.test(hint)))?.[1] ?? countries.get(el.form) ?? languageRegion(el) ?? current;
    if (!region) continue;
    const international = current === region ? el.value : phones[region];
    if (!international) continue;
    const short = 'maxLength' in el && el.maxLength > 0 && el.maxLength <= 10;
    const phone = wantsNational(el) ? national(international, region, short) : international;
    if (phone === el.value) continue;
    const fitted = fitValue(ctx, el, { value: phone, key: 'phone', literal: false, generic: false, ai: false });
    if (fitted === undefined) continue;
    setNativeValue(el, fitted);
    // A confirmation of this number repeats the new one.
    for (const other of confirmations.get(el) ?? []) setNativeValue(other, el.value);
  }
}
