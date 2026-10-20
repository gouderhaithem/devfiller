// @vitest-environment jsdom
// Words found by mining the labelled real forms for fields the rules left unknown: each one names a
// single type on at least three websites. The guards are the fields each word could be mistaken for.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { classifyField } from '../src/fill/classify';

beforeEach(() => {
  document.body.replaceChildren();
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
});
const typeOf = (html: string) => {
  document.body.innerHTML = `<form>${html}</form>`;
  return classifyField(document.querySelector('input, select, textarea') as HTMLInputElement).type;
};
const labelled = (text: string, control = '<input id="f">') => typeOf(`<label for="f">${text}</label>${control}`);
const asked = (text: string) => typeOf(`<input type="text" placeholder="${text}">`);

describe('words mined from real forms', () => {
  it('reads a job asked for in plain words', () => {
    for (const text of ['What is your job?', "What's your job?", 'Your job', 'Current job', 'What do you do?', 'ما هو عملك؟', 'عملك']) expect(asked(text), text).toBe('jobTitle');
  });

  it('keeps the other fields that mention a job away from it', () => {
    // "Job" alone could be any of these, so only "your job", "current job" and the like name a job title.
    expect(labelled('Job')).not.toBe('jobTitle');
    expect(labelled('Job ID')).not.toBe('jobTitle');
    expect(labelled('Job number')).not.toBe('jobTitle');
    expect(labelled('Job location')).not.toBe('jobTitle');
    expect(labelled('Job type')).not.toBe('jobTitle');
    expect(labelled('Job description', '<textarea id="f"></textarea>')).not.toBe('jobTitle');
    expect(labelled('Job function')).toBe('department');
    expect(labelled('Job title')).toBe('jobTitle');
    expect(labelled('جهة العمل')).toBe('company');
  });

  it('reads the other mined words', () => {
    for (const [text, type] of [
      ['Middle initial', 'middleName'], ['Birthdate', 'birthDate'], ['Membership number', 'reference'], ['Member number', 'reference'],
      ['Policy number', 'reference'], ['Contract number', 'reference'], ['Pincode', 'postalCode'], ['Honoree name', 'fullName'],
      ['Sender name', 'fullName'], ['Contact person', 'fullName'], ['Real name', 'fullName'], ['Village', 'city'], ['المبلغ', 'amount'], ['مبلغ التبرع', 'amount'],
    ] as const) expect(labelled(text), text).toBe(type);
    for (const text of ['Anything else?', 'Additional details', 'Explanation']) expect(labelled(text, '<textarea id="f"></textarea>'), text).toBe('message');
    expect(labelled('AM/PM', '<select id="f"><option>AM</option><option>PM</option></select>')).toBe('time');
  });

  it('keeps a PIN sensitive', () => {
    expect(labelled('PIN code')).toMatch(/^(skip:|unknown$)/);
  });
});
