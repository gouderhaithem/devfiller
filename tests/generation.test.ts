// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateIdentities, generatePhones, generateValues, validateSettings, fields } from '../src/data';
import { generateSamples } from '../src/samples';
import { PLACES, WILAYAS, WILAYA_LIST_VERSION } from '../src/profiles/algeria';
import { GENERATED_PLACES } from '../src/profiles/regions';
import { COMMUNES } from '../src/profiles/algeria-communes';
import { seededRandom } from '../src/rng';
import { boundaryValues, invalidValues, mismatchedConfirmation, INVALID_VALUES } from '../src/testdata';
import { fillPage, type FillRequest } from '../src/fill';

beforeEach(() => {
  document.body.replaceChildren();
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
});

describe('seeded generation', () => {
  it('gives the same values for the same seed, and different ones for another seed', () => {
    const first = generateValues('fr', { seed: 'checkout-test' });
    expect(generateValues('fr', { seed: 'checkout-test' })).toEqual(first);
    expect(generateValues('fr', { seed: 'checkout-test' })).toEqual(first);
    expect(generateValues('fr', { seed: 'other' })).not.toEqual(first);
    expect(generatePhones('checkout-test')).toEqual(generatePhones('checkout-test'));
  });
  it('does not depend on the day it runs', () => {
    const today = generateValues('en', { seed: 'dates' });
    vi.useFakeTimers({ now: new Date('2031-07-15T10:00:00Z') });
    try { expect(generateValues('en', { seed: 'dates' })).toEqual(today); } finally { vi.useRealTimers(); }
    expect(today.startDate >= '2030-01-01').toBe(true);
  });
  it('keeps fresh values without a seed', () => {
    expect(generateValues('en').username).not.toBe(generateValues('en').username);
  });
  it('produces a stable stream from a seed', () => {
    const a = seededRandom('x'), b = seededRandom('x');
    const draws = Array.from({ length: 50 }, () => a(1000));
    expect(Array.from({ length: 50 }, () => b(1000))).toEqual(draws);
    expect(draws.every(n => Number.isInteger(n) && n >= 0 && n < 1000)).toBe(true);
    expect(new Set(draws).size).toBeGreaterThan(30);
  });
});

describe('regions', () => {
  it.each(['en', 'fr', 'ar'] as const)('keeps an Algerian address, phone and country together in %s', locale => {
    for (let i = 0; i < 10; i++) {
      const v = generateValues(locale, { region: 'dz' });
      expect(v.phone).toMatch(/^\+213 [567]\d{2} \d{2} \d{2} \d{2}$/);
      expect(v.country).toBe('Algeria');
      expect(v.nationality).toBe('Algerian');
      const wilaya = WILAYAS.find(w => w.fr === v.state || w.ar === v.state)!;
      expect(wilaya).toBeDefined();
      expect(v.postalCode).toBe(`${wilaya.code}000`);
      if (locale === 'ar') expect(v.state + v.city + v.district).toMatch(/^[؀-ۿ\s]+$/);
      else expect(v.state).toMatch(/^[\p{Script=Latin}' -]+$/u);
    }
  });
  it('writes Algerian names in Arabic script for Arabic and Latin script otherwise', () => {
    expect(generateIdentities('ar', 'dz')[0].firstName).toBe('أمين');
    expect(generateIdentities('fr', 'dz')[0]).toMatchObject({ firstName: 'Amine', lastName: 'Bensalah', username: 'amine.bensalah' });
    expect(generateIdentities('en', 'us')[0].firstName).toBe('Alex');
  });
  it('matches phone formats to the region', () => {
    expect(generateValues('en', { region: 'us' }).phone).toMatch(/^\+1 202 555 01\d{2}$/);
    expect(generateValues('fr', { region: 'fr' }).phone).toMatch(/^\+33 6 \d{2} \d{2} \d{2} \d{2}$/);
    const phones = generatePhones();
    expect(Object.keys(phones).sort()).toEqual(['dz', 'fr', 'us']);
  });
  it('mixes regions by default, each fill consistent in itself', () => {
    const countries = new Set(Array.from({ length: 30 }, () => generateValues('en')).map(v => `${v.country}|${v.phone.slice(0, 4)}`));
    expect([...countries].every(entry => ['United States|+1 2', 'France|+33 ', 'Algeria|+213'].includes(entry))).toBe(true);
    expect(countries.size).toBeGreaterThan(1);
  });
  it('validates and defaults the new settings', () => {
    expect(validateSettings({})).toMatchObject({ region: 'mixed', seed: '' });
    expect(validateSettings({ version: 3, region: 'dz', seed: 'abc' })).toMatchObject({ region: 'dz', seed: 'abc' });
    expect(validateSettings({ version: 3, region: 'mars', seed: 42 })).toMatchObject({ region: 'mixed', seed: '' });
    expect(validateSettings({ version: 3, seed: 'x'.repeat(500) }).seed).toHaveLength(200);
  });
  it('generates a value for every field type', () => {
    const v = generateValues('fr', { region: 'fr' });
    for (const [key] of fields) expect(v[key], key).toMatch(/\S/);
  });
});

describe('Algeria profile data', () => {
  it('lists the 69 wilayas of the 2026 law in code order, each with a French and an Arabic name', () => {
    expect(WILAYA_LIST_VERSION).toMatch(/69 wilayas: Law 26-06/);
    expect(WILAYAS).toHaveLength(69);
    expect(WILAYAS.map(w => w.code)).toEqual(Array.from({ length: 69 }, (_, i) => String(i + 1).padStart(2, '0')));
    expect(WILAYAS.slice(58).map(w => w.fr)).toEqual(['Aflou', 'Barika', 'El Kantara', 'Bir El Ater', 'El Aricha', 'Ksar Chellala', 'Aïn Oussara', 'Messaad', 'Ksar El Boukhari', 'Bou Saâda', 'El Abiodh Sidi Cheikh']);
    for (const w of WILAYAS) { expect(w.fr).toMatch(/\p{Script=Latin}/u); expect(w.ar).toMatch(/[؀-ۿ]/); }
    expect(WILAYAS[15]).toMatchObject({ code: '16', fr: 'Alger' });
  });
  it('gives each place the postal code of its wilaya', () => {
    for (const place of PLACES) expect(place.postalCode).toBe(`${place.wilaya}000`);
    expect(PLACES.find(p => p.wilaya === '16')).toMatchObject({ commune: { fr: 'Alger-Centre' }, daira: { fr: "Sidi M'Hamed" } });
  });
  it('generates any commune of wilayas 1 to 58 with its daira, from the imported dataset', () => {
    expect(COMMUNES.length).toBeGreaterThan(1400);
    expect(GENERATED_PLACES.length).toBeGreaterThan(1300);
    expect(GENERATED_PLACES.every(place => Number(place.wilaya) <= 58 && place.postalCode === `${place.wilaya}000` && place.daira.fr && place.daira.ar)).toBe(true);
    expect(GENERATED_PLACES.find(place => place.commune.fr === 'Bab El Oued')).toMatchObject({ wilaya: '16' });
    const cities = new Set(Array.from({ length: 40 }, () => generateValues('fr', { region: 'dz' }).city));
    expect(cities.size).toBeGreaterThan(20);
  });
});

const values = generateValues('en', { seed: 'engine' });
const request: FillRequest = { values, identities: generateIdentities('en'), samples: generateSamples('en'), phones: generatePhones('engine'), custom: [], overwrite: true, fillUnknown: true, passwords: true, exclusions: { skipSearch: false, skipHeader: false, rules: [] } };
const FORM = `<form><input id="mystery"><textarea id="free"></textarea><input id="n" type="number" min="1" max="100000"><input id="d" type="date"><input id="c" type="color">
  <select id="s"><option>A</option><option>B</option><option>C</option></select><input type="radio" name="r" id="r1"><input type="radio" name="r" id="r2"><input type="radio" name="r" id="r3">
  <input type="checkbox" id="k"><label for="e">Email</label><input id="e" type="email"><input id="w" type="week"></form>`;
const snapshot = () => Array.from(document.querySelectorAll<HTMLInputElement>('input,select,textarea'), el => ['radio', 'checkbox'].includes(el.type) ? String(el.checked) : el.value);

describe('seeded fills', () => {
  it('fill a form identically every time, even with replacement on', () => {
    document.body.innerHTML = FORM;
    fillPage({ ...request, seed: 'engine' });
    const first = snapshot();
    for (let i = 0; i < 4; i++) { fillPage({ ...request, seed: 'engine' }); expect(snapshot()).toEqual(first); }
    document.body.innerHTML = FORM;
    fillPage({ ...request, seed: 'engine' });
    expect(snapshot()).toEqual(first);
  });
  it('keep other fields the same when a field is added', () => {
    document.body.innerHTML = FORM;
    fillPage({ ...request, seed: 'engine' });
    const before = { mystery: (document.getElementById('mystery') as HTMLInputElement).value, n: (document.getElementById('n') as HTMLInputElement).value };
    document.body.innerHTML = FORM.replace('<form>', '<form><input id="extra" name="extra">');
    fillPage({ ...request, seed: 'engine' });
    expect((document.getElementById('n') as HTMLInputElement).value).toBe(before.n);
    expect((document.getElementById('mystery') as HTMLInputElement).value).toBe(before.mystery);
  });
  it('still change every value on each fill without a seed', () => {
    document.body.innerHTML = FORM;
    fillPage(request);
    const first = snapshot();
    fillPage(request);
    expect(snapshot()).not.toEqual(first);
  });
});

describe('phones follow the form', () => {
  const phones = { us: '+1 202 555 0142', fr: '+33 6 12 34 56 78', dz: '+213 550 12 34 56' };
  const run = { ...request, values: { ...values, phone: phones.us }, phones };
  it('use the country chosen in the form', () => {
    document.body.innerHTML = '<form><label for="c">Pays</label><select id="c"><option>Algérie</option></select><label for="p">Téléphone</label><input id="p" type="tel"><label for="p2">Confirm phone</label><input id="p2" type="tel"></form>';
    fillPage(run);
    expect((document.getElementById('p') as HTMLInputElement).value).toBe(phones.dz);
    expect((document.getElementById('p2') as HTMLInputElement).value).toBe(phones.dz);
  });
  it('use a dial code in the placeholder, which wins over the country field', () => {
    document.body.innerHTML = '<form><label for="c">Country</label><select id="c"><option>Algeria</option></select><label for="p">Phone</label><input id="p" type="tel" placeholder="+33 6 00 00 00 00"></form>';
    fillPage(run);
    expect((document.getElementById('p') as HTMLInputElement).value).toBe(phones.fr);
  });
  it('leave a custom value and an unhinted form alone', () => {
    document.body.innerHTML = '<form><label for="c">Country</label><select id="c"><option>France</option></select><label for="p">Phone</label><input id="p" type="tel"></form>';
    fillPage({ ...run, custom: [{ id: '1', label: 'Phone', value: '0123' }] });
    expect((document.getElementById('p') as HTMLInputElement).value).toBe('0123');
    document.body.innerHTML = '<form><label for="p">Phone</label><input id="p" type="tel"></form>';
    fillPage(run);
    expect((document.getElementById('p') as HTMLInputElement).value).toBe(phones.us);
  });
});

describe('invalid and boundary data', () => {
  it('offers values each type should reject', () => {
    for (const bad of invalidValues('email')) expect(bad).not.toMatch(/^[^@\s]+@[^@\s.]+\.[^@\s]+$/);
    expect(Object.keys(INVALID_VALUES).length).toBeGreaterThan(15);
    expect(invalidValues('bio')).toEqual(['']);
  });
  it('lists the values on and just past each limit', () => {
    expect(boundaryValues({ required: true, minLength: 3, maxLength: 5 })).toEqual([
      { label: 'empty', value: '', valid: false },
      { label: 'shortest allowed', value: 'aaa', valid: true },
      { label: 'one character too short', value: 'aa', valid: false },
      { label: 'longest allowed', value: 'aaaaa', valid: true },
      { label: 'one character too long', value: 'aaaaaa', valid: false },
    ]);
    expect(boundaryValues({ min: 0.5, max: 2, step: 0.25 }).map(c => [c.value, c.valid])).toEqual([['', true], ['0.5', true], ['0.25', false], ['2', true], ['2.25', false]]);
  });
  it('makes a confirmation that almost matches', () => {
    expect(mismatchedConfirmation('Garden-River-27!')).toBe('Garden-River-27x');
    expect(mismatchedConfirmation('box')).toBe('boy');
    expect(mismatchedConfirmation('')).toBe('x');
  });
});

describe('Phase E review regressions', () => {
  const el = <T extends Element = HTMLInputElement>(id: string) => document.getElementById(id) as unknown as T;
  it('keeps the country and wilaya on the generated answer over repeated fills in one region', () => {
    document.body.innerHTML = '<form><label for="c">Country</label><select id="c"><option>Algeria</option><option>France</option><option>United States</option><option>Canada</option></select><label for="w">Wilaya</label><select id="w"><option value="">—</option><option value="16">16 - Alger</option><option value="31">31 - Oran</option><option value="25">25 - Constantine</option><option value="23">23 - Annaba</option></select><label for="p">Phone</label><input id="p" type="tel"></form>';
    for (let i = 0; i < 12; i++) {
      const v = generateValues('fr', { region: 'dz' });
      fillPage({ ...request, values: v, identities: generateIdentities('fr', 'dz'), phones: generatePhones() });
      expect(el<HTMLSelectElement>('c').value).toBe('Algeria');
      expect(el('p').value).toMatch(/^\+213 /);
    }
  });
  it('does not repeat the same place on consecutive fills', () => {
    let previous = generateValues('en', { region: 'us' });
    for (let i = 0; i < 20; i++) { const next = generateValues('en', { region: 'us' }); expect(next.city).not.toBe(previous.city); previous = next; }
  });
  it('generates Algerian mobiles that validators accept', () => {
    const valid = /^\+213 (?:5(?:4[0-29]|5\d|6[0-2])|6(?:[569]\d|7[0-6])|7[7-9]\d) \d{2} \d{2} \d{2}$/;
    for (let i = 0; i < 200; i++) expect(generateValues('fr', { region: 'dz' }).phone).toMatch(valid);
  });
  it('keeps a phone that is already in the right country', () => {
    document.body.innerHTML = '<form><label for="c">Pays</label><select id="c"><option>Algérie (DZ)</option></select><label for="p">Téléphone</label><input id="p" type="tel"></form>';
    const v = generateValues('fr', { region: 'dz' });
    fillPage({ ...request, values: v, phones: { ...generatePhones(), dz: '+213 770 00 00 00' } });
    expect(el('p').value).toBe(v.phone);
  });
  it('reads compact dial codes and writes national numbers where the field asks for them', () => {
    const phones = { us: '+1 202 555 0142', fr: '+33 6 12 34 56 78', dz: '+213 550 12 34 56' };
    document.body.innerHTML = '<form><label for="a">Mobile</label><input id="a" type="tel" placeholder="+33612345678"><label for="b">Portable</label><input id="b" type="tel" placeholder="05 61 12 34 56"><label for="c">Mobile</label><input id="c" type="tel" maxlength="10" placeholder="+213 5XX XX XX XX"></form>';
    fillPage({ ...request, values: { ...values, phone: phones.us }, phones });
    expect(el('a').value).toBe(phones.fr);
    expect(el('b').value).toBe('(202) 555-0142');
    expect(el('c').value).toBe('0550123456');
    document.body.innerHTML = '<form lang="ar"><label for="h">رقم الهاتف</label><input id="h" type="tel" placeholder="05XX XX XX XX"></form>';
    fillPage({ ...request, values: { ...values, phone: phones.us }, phones });
    expect(el('h').value).toBe('0550 12 34 56');
  });
  it('matches an English "Algiers" option for the wilaya of Algiers', () => {
    document.body.innerHTML = '<form><label for="w">State</label><select id="w"><option>Choose</option><option>Oran</option><option>Algiers</option></select></form>';
    fillPage({ ...request, values: { ...values, state: 'Alger' } });
    expect(el<HTMLSelectElement>('w').value).toBe('Algiers');
  });
  it('gives seeded identities an age that matches the birth date', () => {
    for (let i = 0; i < 200; i++) {
      const v = generateValues('en', { seed: `age-${i}` });
      const [y, m, d] = v.birthDate.split('-').map(Number);
      const expected = 2026 - y - ((m > 1 || d > 1) ? 1 : 0);
      expect(Number(v.age)).toBe(expected);
      expect(Number(v.age)).toBeGreaterThanOrEqual(18);
    }
  });
  it('follows the step grid and never contradicts itself at maxlength 0', () => {
    expect(boundaryValues({ min: 0, max: 10, step: 3 }).find(c => c.label === 'largest allowed')!.value).toBe('9');
    expect(boundaryValues({ min: 0.5, max: 2 }).find(c => c.label === 'largest allowed')!.value).toBe('1.5');
    expect(boundaryValues({ maxLength: 0, required: true }).map(c => c.label)).toEqual(['empty', 'one character too long']);
  });
});
