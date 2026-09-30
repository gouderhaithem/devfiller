// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDateText, patternSample, revalidate } from '../src/fill/validation';
import { seededRandom } from '../src/rng';
import { fillPage, type FillRequest } from '../src/fill';
import { generateIdentities, generateValues } from '../src/data';
import { generateSamples } from '../src/samples';

const values = { ...generateValues('en'), phone: '+213 550 12 34 56', birthDate: '1990-07-14', postalCode: '16000' };
const request: FillRequest = { values, identities: generateIdentities('en'), samples: generateSamples('en'), custom: [], overwrite: true, fillUnknown: true, passwords: false };
beforeEach(() => {
  document.body.replaceChildren();
  document.documentElement.lang = '';
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
});
const el = (id: string) => document.getElementById(id) as HTMLInputElement;

describe('pattern samples', () => {
  it.each(['[A-Z]{3}', '\\d{5}', '[0-9]{2}-[0-9]{3}', '(ab|cd)\\d+', 'FR[0-9]{11}', '[A-Z]{2}-[0-9]{4}', '0[5-7][0-9]{8}', '[a-z]+@[a-z]+\\.com'])('matches %s', pattern => {
    const random = seededRandom(pattern);
    for (let i = 0; i < 20; i++) expect(patternSample(pattern, random)).toMatch(new RegExp(`^(?:${pattern})$`));
  });
  it('gives up on patterns beyond it rather than guessing', () => {
    expect(patternSample('[^a]+', seededRandom('x'))).toBeUndefined();
    expect(patternSample('(unclosed', seededRandom('x'))).toBeUndefined();
    expect(patternSample('a{999}', seededRandom('x'))).toBeUndefined();
  });
});

describe('text dates', () => {
  it('follow the format the field shows, then the page language', () => {
    document.body.innerHTML = '<input id="a" placeholder="jj/mm/aaaa"><input id="b" placeholder="MM/DD/YYYY"><input id="c"><div lang="fr"><input id="d"></div><input id="e" type="date">';
    expect(formatDateText(el('a'), '1990-07-14')).toBe('14/07/1990');
    expect(formatDateText(el('b'), '1990-07-14')).toBe('07/14/1990');
    expect(formatDateText(el('c'), '1990-07-14')).toBe('1990-07-14');
    expect(formatDateText(el('d'), '1990-07-14')).toBe('14/07/1990');
    expect(formatDateText(el('e'), '1990-07-14')).toBe('1990-07-14');
  });
});

describe('values the field accepts', () => {
  it('rewrites a phone, a date and a code until the field\'s own rules accept them', () => {
    document.body.innerHTML = `<form><label for="p">Phone</label><input id="p" type="tel" pattern="0[5-7][0-9]{8}">
      <label for="b">Date of birth</label><input id="b" pattern="\\d{2}/\\d{2}/\\d{4}">
      <label for="k">Code</label><input id="k" pattern="[A-Z]{2}-[0-9]{4}">
      <label for="n">First name</label><input id="n" pattern="[A-Z]{3}"></form>`;
    fillPage(request);
    expect(el('p').value).toBe('0550123456');
    expect(el('b').value).toBe('14/07/1990');
    expect(el('k').value).toMatch(/^[A-Z]{2}-\d{4}$/);
    // Names are never forced into a pattern: an invalid name is visible, not disguised.
    expect(el('n').value).toBe(values.firstName);
  });
  it('retries the next format when the app marks a field invalid after the fill', () => {
    document.body.innerHTML = '<form lang="fr"><label for="a">Montant</label><input id="a"><label for="d">Date de naissance</label><input id="d"></form>';
    const rules: Record<string, RegExp> = { a: /^\d+(\.\d{1,2})?$/, d: /^\d{4}-\d{2}-\d{2}$/ };
    for (const [id, rule] of Object.entries(rules)) {
      const check = () => el(id).setAttribute('aria-invalid', String(!rule.test(el(id).value)));
      el(id).addEventListener('input', check);
      el(id).addEventListener('blur', check);
    }
    fillPage({ ...request, values: { ...values, amount: '1250.5' } });
    expect(el('a').getAttribute('aria-invalid')).toBe('true');
    for (let round = 0; round < 6 && revalidate().retried; round++);
    expect(el('a').getAttribute('aria-invalid')).toBe('false');
    expect(el('a').value).toBe('1250.5');
    expect(el('d').value).toBe('1990-07-14');
  });
  it('leaves custom values and fields the page accepts alone', () => {
    document.body.innerHTML = '<form><label for="c">Project code</label><input id="c" aria-invalid="true"><label for="e">Email</label><input id="e" type="email"></form>';
    fillPage({ ...request, custom: [{ id: '1', label: 'Project code', value: 'mine' }] });
    expect(revalidate().retried).toBe(0);
    expect(el('c').value).toBe('mine');
  });
});
