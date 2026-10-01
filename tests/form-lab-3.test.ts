// @vitest-environment jsdom
// Findings from the third set of Form Lab pages (61–75, 1 October 2026), retired once the sealed set
// 76–90 was written. Each block is one mechanism, written as generic markup, not a copy of the page.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fillPage, type FillRequest } from '../src/fill';
import { generateIdentities, generatePhones, generateValues } from '../src/data';
import { generateSamples } from '../src/samples';

const values = generateValues('en');
const request: FillRequest = { values, identities: generateIdentities('en'), samples: generateSamples('en'), phones: generatePhones(), custom: [], overwrite: true, fillUnknown: true, passwords: false, modelGuesses: false };
beforeEach(() => {
  document.body.replaceChildren();
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
});
function types(html: string): Record<string, string> {
  document.body.innerHTML = `<form>${html}</form>`;
  const controls = Array.from(document.querySelectorAll<HTMLInputElement>('input, select, textarea'));
  const result = fillPage({ ...request, mode: 'classify' });
  const found = new Map((result.classified ?? []).map(({ index, type }) => [index, type]));
  return Object.fromEntries(controls.map((el, index) => [el.id || el.name, found.get(index) ?? 'unknown']));
}

describe('framework names', () => {
  it('reads Angular formcontrolname when the name and id say nothing', () => {
    expect(types('<input id="mat-input-3" formcontrolname="orderNo" placeholder="e.g. 400-1829374">')['mat-input-3']).toBe('reference');
    expect(types('<textarea id="mat-input-7" formcontrolname="comments"></textarea>')['mat-input-7']).toBe('message');
  });
});

describe('example placeholders', () => {
  it('reads "e.g. …" as a sample value, not as the field’s words', () => {
    expect(types('<input id="x" name="input_13" placeholder="e.g. State Farm">').x).toBe('unknown');
    expect(types('<input id="x" name="input_13" placeholder="Ex : New York">').x).not.toBe('state');
  });
});

describe('longest phrase wins', () => {
  it('reads "Billing address line 2" as the second line', () => {
    expect(types('<input id="x" aria-label="Billing address line 2">').x).toBe('address2');
    expect(types('<input id="x" aria-label="Shipping address line 2">').x).toBe('address2');
    expect(types('<input id="x" aria-label="Billing address">').x).toBe('address');
  });
});

describe('personal references', () => {
  it('reads a reference’s name as a person and its relationship as unknown', () => {
    const found = types(`<fieldset><legend>Personal references</legend>
      <input name="ref_name" aria-label="Reference 1 name"><input name="ref_rel" aria-label="Reference 1 relationship">
      <input name="ref_phone" type="tel" aria-label="Reference 1 phone"></fieldset>`);
    expect(found.ref_name).toBe('fullName');
    expect(found.ref_rel).toBe('unknown');
    expect(found.ref_phone).toBe('phone');
  });
  it('keeps a record’s reference name', () => {
    expect(types('<input id="x" aria-label="Invoice reference name">').x).toBe('reference');
  });
  it('keeps reference numbers', () => {
    expect(types('<input id="x" aria-label="Reference number">').x).toBe('reference');
    expect(types('<input id="x" aria-label="Order reference">').x).toBe('reference');
  });
});

describe('whole names', () => {
  it.each(['First and last name', 'First & last name', 'Name and surname'])('reads "%s" as the full name', text => {
    expect(types(`<input id="x" name="employee_name" placeholder="${text}">`).x).toBe('fullName');
  });
});

describe('start dates named by a verb', () => {
  it.each([
    ['<label for="x">Date you’d like to start</label><input id="x" type="date">'],
    ['<input id="x" name="started_on" type="date">'],
    ['<input id="x" name="week_commencing" type="date">'],
    ['<label for="x">Date de rentrée</label><input id="x" type="date">'],
  ])('reads %s as a start date', html => {
    expect(types(html).x).toBe('startDate');
  });
  it('makes the next date its end', () => {
    const found = types('<input id="a" name="week_commencing" type="date"><input id="b" name="delivery_deadline" type="date">');
    expect(found).toMatchObject({ a: 'startDate', b: 'endDate' });
  });
  it('ignores start words in a hint', () => {
    expect(types('<input id="x" type="date" aria-label="Order date" title="Orders starting this week">').x).toBe('date');
  });
  it('leaves "Date submitted", "Move-in date" and a lone pickup date as plain dates', () => {
    expect(types('<input id="x" name="pickup_date" type="date">').x).toBe('date');
    expect(types('<label for="x">Date submitted</label><input id="x" type="date">').x).toBe('date');
    expect(types('<label for="x">Move-in date</label><input id="x" type="date">').x).toBe('date');
  });
});

describe('a title beside a company', () => {
  it('is the person’s job title', () => {
    const found = types('<label for="c">Company:</label><input id="c"><label for="t">Title:</label><input id="t">');
    expect(found.t).toBe('jobTitle');
  });
  it('stays the title of a thing elsewhere', () => {
    expect(types('<label for="t">Title</label><input id="t"><label for="d">Description</label><textarea id="d"></textarea>').t).toBe('title');
  });
});

describe('national identifiers', () => {
  it('reads a national student identifier as an ID, not a username', () => {
    expect(types('<label for="x">N° INE (identifiant national étudiant)</label><input id="x">').x).toBe('unknown');
  });
});
