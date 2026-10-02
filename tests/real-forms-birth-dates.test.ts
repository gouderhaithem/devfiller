// @vitest-environment jsdom
// Birth dates split into day, month and year that the rules read as plain dates (round 4 of the real
// forms, 2 October 2026): the parts' names or the words before them say "birth".
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fillPage } from '../src/fill';
import { analyzePage } from '../src/fill/context';
import { generateIdentities, generateValues } from '../src/data';
import { generateSamples } from '../src/samples';
import { listControls } from '../src/fill/extract';

beforeEach(() => {
  document.body.replaceChildren();
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
});
const types = () => { const fields = analyzePage(listControls(), undefined, [], false).fields; return Array.from(document.querySelectorAll('select, input'), el => fields.get(el as HTMLInputElement)?.type); };
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const days = Array.from({ length: 31 }, (_, i) => String(i + 1));
const years = Array.from({ length: 80 }, (_, i) => String(2024 - i));
const select = (attrs: string, head: string, options: readonly string[]) => `<select ${attrs}><option value="">${head}</option>${options.map(o => `<option>${o}</option>`).join('')}</select>`;

describe('a birth date split into parts', () => {
  it('reads every part as the birth date when the words before the first say so', () => {
    document.body.innerHTML = `<form><p>Date of Birth:</p>${select('name="m"', 'Month', months)}${select('name="d"', 'Day', days)}${select('name="y"', 'Year', years)}</form>`;
    expect(types()).toEqual(['birthDate', 'birthDate', 'birthDate']);
  });
  it('reads every part as the birth date when the parts are named after it', () => {
    document.body.innerHTML = `<form>${select('name="dwfrm_customer_dayofbirth" aria-label="Day"', 'Day', days)}${select('name="dwfrm_customer_monthofbirth" aria-label="Month"', 'Month', months)}${select('name="dwfrm_customer_yearOfBirth" aria-label="Year"', 'Year', years)}</form>`;
    expect(types()).toEqual(['birthDate', 'birthDate', 'birthDate']);
  });
  it('leaves the parts of another date alone', () => {
    document.body.innerHTML = `<form><p>Preferred start date</p>${select('name="m"', 'Month', months)}${select('name="d"', 'Day', days)}${select('name="y"', 'Year', years)}</form>`;
    expect(types()).not.toContain('birthDate');
  });
  it('keeps a year typed into a text box as a year, even beside a birth month', () => {
    document.body.innerHTML = `<form>${select('name="dob_month" aria-label="Month"', 'Month', months)}<input name="dob_year" placeholder="Year" aria-label="Year"></form>`;
    expect(types()[1]).not.toBe('birthDate');
  });
  it('fills the year of a split birth date with an adult\'s birth year', () => {
    document.body.innerHTML = `<form>${select('name="birthMonth"', 'Month', months)}${select('name="birthDay"', 'Day', days)}${select('name="birthYear"', 'Year', years)}</form>`;
    for (let seed = 1; seed <= 5; seed++) {
      fillPage({ values: generateValues('en'), identities: generateIdentities('en'), samples: generateSamples('en'), custom: [], overwrite: true, fillUnknown: false, passwords: false, modelGuesses: false, seed: String(seed) });
      const year = Number(document.querySelector<HTMLSelectElement>('[name=birthYear]')!.value);
      expect(new Date().getFullYear() - year).toBeGreaterThanOrEqual(18);
    }
  });
});
