// @vitest-environment jsdom
// Fields people reported filled wrongly on real sites (30 September 2026): years and years of
// experience given words, placeholders ignored when choosing a value, date pickers left empty,
// and Arabic labels filled in English.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fillPage, type FillRequest } from '../src/fill';
import { generateIdentities, generateValues } from '../src/data';
import { generateSamples } from '../src/samples';
import { placeholderShape } from '../src/fill/placeholder';

const values = generateValues('en', { seed: 'lab', region: 'us' });
const arabic = { values: generateValues('ar', { seed: 'lab', region: 'dz' }), identities: generateIdentities('ar', 'dz'), samples: generateSamples('ar'), latin: generateIdentities('en', 'dz') };
const latinTwin = arabic.latin.find(person => person.username === arabic.values.username)!;
const request: FillRequest = { values, identities: generateIdentities('en'), samples: generateSamples('en'), custom: [], overwrite: true, fillUnknown: true, passwords: false, seed: 'lab' };
beforeEach(() => {
  document.body.replaceChildren();
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
});
const field = (id: string) => document.getElementById(id) as HTMLInputElement;
function types(html: string): Record<string, string> {
  document.body.innerHTML = html;
  const controls = Array.from(document.querySelectorAll<HTMLInputElement>('input, select, textarea'));
  const result = fillPage({ ...request, mode: 'classify' });
  return Object.fromEntries((result.classified ?? []).map(({ index, type }) => [controls[index].id || controls[index].name, type]));
}
function fill(html: string, extra: Partial<FillRequest> = {}) {
  document.body.innerHTML = html;
  return fillPage({ ...request, ...extra });
}
const ARABIC = /[؀-ۿ]/;
const thisYear = new Date().getUTCFullYear();

describe('years and years of experience', () => {
  it('reads graduation years and years of experience in English, French and Arabic', () => {
    expect(types(`<form>
      <label for="g">GRADUATION YEAR *</label><input id="g" name="graduation_year">
      <label for="e">YEARS OF EXPERIENCE</label><input id="e" name="experience">
      <label for="gf">Année d'obtention du diplôme</label><input id="gf">
      <label for="ef">Années d'expérience</label><input id="ef">
      <label for="ga">سنة التخرج</label><input id="ga">
      <label for="ea">سنوات الخبرة</label><input id="ea">
      <label for="e2">Experience (years)</label><input id="e2">
      <label for="by">Year of birth</label><input id="by">
    </form>`)).toMatchObject({ g: 'year', e: 'experience', gf: 'year', ef: 'experience', ga: 'year', ea: 'experience', e2: 'experience', by: 'year' });
  });
  it('writes a year and a number of years that agree with the person', () => {
    fill(`<form>
      <label for="g">GRADUATION YEAR *</label><input id="g" name="graduation_year">
      <label for="e">YEARS OF EXPERIENCE</label><input id="e">
      <label for="by">Birth year</label><input id="by">
      <label for="dob">Date of birth</label><input id="dob" type="date">
    </form>`);
    const birthYear = Number(values.birthDate.slice(0, 4));
    const graduation = Number(field('g').value);
    expect(field('g').value).toMatch(/^(19|20)\d{2}$/);
    expect(graduation).toBeGreaterThanOrEqual(birthYear + 17);
    expect(graduation).toBeLessThanOrEqual(thisYear);
    expect(field('e').value).toMatch(/^\d{1,2}$/);
    expect(Number(field('e').value)).toBeLessThanOrEqual(Number(values.age) - 16);
    expect(field('by').value).toBe(String(birthYear));
  });
  it('keeps a free-text experience question as text', () => {
    fill(`<form><label for="t">Describe your experience</label><textarea id="t"></textarea></form>`);
    expect(field('t').value).not.toMatch(/^\d+$/);
  });
  it('still reads a Year select beside Day and Month as part of the birth date', () => {
    const years = Array.from({ length: 80 }, (_, i) => `<option>${1950 + i}</option>`).join('');
    fill(`<form><fieldset><legend>Date of birth</legend>
      <label for="y">Year</label><select id="y"><option value="">Year</option>${years}</select>
    </fieldset></form>`);
    expect((document.getElementById('y') as HTMLSelectElement).value).toBe(values.birthDate.slice(0, 4));
  });
});

describe('placeholders', () => {
  it('reads formats and examples', () => {
    expect(placeholderShape('e.g. 2019')).toEqual({ kind: 'year' });
    expect(placeholderShape('DD/MM/YYYY')).toMatchObject({ kind: 'date' });
    expect(placeholderShape('jj/mm/aaaa')).toMatchObject({ kind: 'date' });
    expect(placeholderShape('HH:MM')).toEqual({ kind: 'time' });
    expect(placeholderShape('you@company.com')).toEqual({ kind: 'email' });
    expect(placeholderShape('https://')).toEqual({ kind: 'website' });
    expect(placeholderShape('+213 5XX XX XX XX')).toEqual({ kind: 'phone' });
    expect(placeholderShape('0.00')).toMatchObject({ kind: 'decimal', decimals: 2 });
    expect(placeholderShape('e.g. 5')).toMatchObject({ kind: 'integer', digits: 1 });
    expect(placeholderShape('Ex: Paris')).toEqual({ kind: 'example', text: 'Paris' });
    expect(placeholderShape('Enter your city')).toBeUndefined();
    // Words that start like a prefix aren't examples, and card or code masks are never copied.
    for (const text of ['Explain your role', 'Expiry date', 'Experience in years', 'Exact address', 'Likelihood', 'Eggs']) expect(placeholderShape(text), text).toBeUndefined();
    for (const text of ['1234 5678 9012 3456', '4242424242424242', '123', '000000', '•••']) expect(placeholderShape(text), text).toBeUndefined();
  });
  it('recognizes a field from its placeholder when nothing else names it', () => {
    expect(types(`<form>
      <input id="a" name="f1" placeholder="you@company.com">
      <input id="b" name="f2" placeholder="https://">
      <input id="c" name="f3" placeholder="+213 5XX XX XX XX">
      <input id="d" name="f4" placeholder="DD/MM/YYYY">
      <input id="t" name="f5" placeholder="HH:MM">
    </form>`)).toMatchObject({ a: 'email', b: 'website', c: 'phone', d: 'date', t: 'time' });
  });
  it('shapes the value of an unknown field like its placeholder', () => {
    fill(`<form>
      <input id="y" name="f1" placeholder="e.g. 2019">
      <input id="n" name="f2" placeholder="e.g. 5">
      <input id="z" name="f3" placeholder="12345">
      <input id="m" name="f4" placeholder="0.00">
      <input id="w" name="f5" placeholder="e.g. Software Engineer">
      <input id="d" name="f6" placeholder="DD/MM/YYYY">
    </form>`);
    expect(field('y').value).toMatch(/^(19|20)\d{2}$/);
    expect(field('n').value).toMatch(/^\d{1,2}$/);
    expect(field('z').value).toMatch(/^\d{5}$/);
    expect(field('m').value).toMatch(/^\d+\.\d{2}$/);
    expect(field('w').value).toBe('Software Engineer');
    expect(field('d').value).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });
});

describe('date pickers', () => {
  it('recognizes pickers by their markup', () => {
    expect(types(`<form>
      <label for="a">Joining date</label><input id="a" class="datepicker">
      <div class="react-datepicker-wrapper"><div class="react-datepicker__input-container"><input id="b" placeholder="Select date"></div></div>
      <label for="c">Event date</label><input id="c" type="tel" inputmode="text" placeholder="MM/DD/YYYY">
      <label for="d">Appointment</label><input id="d" class="flatpickr-input" readonly>
    </form>`)).toMatchObject({ a: 'date', b: 'date', c: 'date', d: 'date' });
  });
  it('fills read-only pickers in the format they show', () => {
    fill(`<form>
      <label for="dob">Date of birth</label><input id="dob" class="form-control" placeholder="dd/mm/yyyy" readonly>
      <label for="app">Appointment</label><input id="app" class="flatpickr-input" readonly>
      <label for="join">Joining date</label><input id="join" class="datepicker" data-date-format="dd-mm-yyyy">
      <label for="ev">Event date</label><input id="ev" type="tel" placeholder="MM/DD/YYYY">
      <label for="code">Customer code</label><input id="code" value="C-1" readonly>
    </form>`);
    const [y, m, d] = values.birthDate.split('-');
    expect(field('dob').value).toBe(`${d}/${m}/${y}`);
    expect(field('app').value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(field('join').value).toMatch(/^\d{2}-\d{2}-\d{4}$/);
    expect(field('ev').value).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(field('code').value).toBe('C-1');
  });
  it('keeps a named date after a start date, but reads an expiry of the same thing as its end', () => {
    expect(types(`<form>
      <label for="from">Available from</label><input id="from" type="date">
      <label for="app">Appointment</label><input id="app" class="flatpickr-input" readonly>
      <label for="ps">Policy start date</label><input id="ps" type="date">
      <label for="pe">Policy expiry date</label><input id="pe" type="date">
    </form>`)).toMatchObject({ from: 'startDate', app: 'date', ps: 'startDate', pe: 'endDate' });
  });
  it('writes two- and four-digit years as the picker format asks', () => {
    fill(`<form>
      <label for="a">Date of birth</label><input id="a" class="datepicker" data-date-format="DD/MM/YY">
      <label for="b">Birthday</label><input id="b" class="flatpickr-input" data-date-format="d/m/y">
      <label for="c">Born on</label><input id="c" class="flatpickr-input" data-date-format="Y-m-d">
    </form>`);
    const [y, m, d] = values.birthDate.split('-');
    expect(field('a').value).toBe(`${d}/${m}/${y.slice(2)}`);
    expect(field('b').value).toBe(`${d}/${m}/${y.slice(2)}`);
    expect(field('c').value).toBe(values.birthDate);
  });
  it('leaves read-only fields alone unless they are date pickers', () => {
    fill(`<form>
      <div class="datepicker-row"><label for="total">Total days</label><input id="total" readonly></div>
      <label for="shown">Invoice date</label><input id="shown" readonly placeholder="dd/mm/yyyy" value="01/02/2026">
      <label for="t">Time</label><input id="t" class="timepicker" readonly>
    </form>`);
    expect(field('total').value).toBe('');
    expect(field('shown').value).toBe('01/02/2026');
    expect(field('t').value).toBe('');
  });
  it('writes the date into the hidden input a flatpickr alt input stands for', () => {
    fill(`<form><label for="alt">Delivery date</label>
      <input id="real" name="delivery" type="hidden" class="flatpickr-input"><input id="alt" class="form-control input" readonly placeholder="Choose a date">
    </form>`);
    expect(field('alt').value).not.toBe('');
    expect(field('real').value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('Arabic labels', () => {
  it('fills fields labelled in Arabic with Arabic values, and the same person in Latin script elsewhere', () => {
    fill(`<form>
      <label for="fn">First name</label><input id="fn">
      <label for="afn">الاسم الأول</label><input id="afn">
      <label for="addr">العنوان</label><input id="addr">
      <label for="msg">الرسالة</label><textarea id="msg"></textarea>
      <label for="other">حقل غير معروف</label><input id="other">
      <label for="mail">البريد الإلكتروني</label><input id="mail" type="email">
    </form>`, { localized: { ar: arabic } });
    expect(field('fn').value).toBe(latinTwin.firstName);
    expect(field('afn').value).toBe(arabic.values.firstName);
    expect(field('afn').value).toMatch(ARABIC);
    expect(field('addr').value).toMatch(ARABIC);
    expect((document.getElementById('msg') as HTMLTextAreaElement).value).toMatch(ARABIC);
    expect(field('other').value).toMatch(ARABIC);
    expect(field('mail').value).toBe(`${arabic.values.username}@example.com`);
  });
  it('keeps English values on a page with no Arabic name field', () => {
    fill(`<form><label for="fn">First name</label><input id="fn"><label for="addr">العنوان</label><input id="addr"></form>`, { localized: { ar: arabic } });
    expect(field('fn').value).toBe(values.firstName);
    expect(field('addr').value).toMatch(ARABIC);
  });
  it('uses Arabic values for an unlabelled field in a form whose language is Arabic', () => {
    fill(`<form lang="ar" dir="rtl"><input id="c" name="city"></form>`, { localized: { ar: arabic } });
    expect(field('c').value).toBe(arabic.values.city);
  });
  it('goes by the label, not an English placeholder under it', () => {
    fill(`<form><label for="last">اللقب</label><input id="last" name="lastName" placeholder="Last name">
      <input id="plain" name="note" placeholder="ملاحظة قصيرة"></form>`, { localized: { ar: arabic } });
    expect(field('last').value).toBe(arabic.values.lastName);
    expect(field('plain').value).toMatch(ARABIC);
  });
  it('reads bilingual labels by the script they ask for', () => {
    fill(`<form>
      <label for="nom">Nom / اللقب</label><input id="nom" name="nom" autocomplete="family-name">
      <label for="prenom">Prénom / الاسم</label><input id="prenom" name="prenom" autocomplete="given-name">
      <label for="nomar">Nom en arabe / اللقب بالعربية</label><input id="nomar" name="nom_ar">
      <label for="prenomar">Prénom en arabe</label><input id="prenomar" name="prenom_ar" dir="rtl" lang="ar">
    </form>`, { localized: { ar: arabic } });
    expect(field('nom').value).toBe(latinTwin.lastName);
    expect(field('prenom').value).toBe(latinTwin.firstName);
    expect(field('nomar').value).toBe(arabic.values.lastName);
    expect(field('prenomar').value).toBe(arabic.values.firstName);
  });
  it('writes Arabic country and nationality names into Arabic text fields', () => {
    fill(`<form><label for="c">البلد</label><input id="c"><label for="n">الجنسية</label><input id="n"></form>`, { localized: { ar: arabic } });
    expect(field('c').value).toBe('الجزائر');
    expect(field('n').value).toBe('جزائري');
  });
  it('does not read dir="rtl" alone as Arabic', () => {
    fill(`<form><label for="n">First name</label><input id="n" dir="rtl"></form>`, { localized: { ar: arabic } });
    expect(field('n').value).toBe(values.firstName);
  });
  it('shares dates and numbers between Arabic and Latin fields', () => {
    fill(`<form><label for="d">Date of birth</label><input id="d" type="date"><label for="da">تاريخ الميلاد</label><input id="da" type="date"></form>`, { localized: { ar: arabic } });
    expect(field('da').value).toBe(field('d').value);
  });
  it('keeps the user locale when no Arabic data is supplied', () => {
    fill(`<form><label for="afn">الاسم الأول</label><input id="afn"></form>`);
    expect(field('afn').value).toBe(values.firstName);
  });
});
