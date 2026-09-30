// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { classifyWidget, fillWidgets, listWidgets } from '../src/fill/widgets';
import { fillPage, type FillRequest } from '../src/fill';
import { generateIdentities, generateValues } from '../src/data';
import { generateSamples } from '../src/samples';

const values = { ...generateValues('en'), gender: 'Female', country: 'Algeria' };
const request: FillRequest = { values, identities: generateIdentities('en'), samples: generateSamples('en'), custom: [], overwrite: true, fillUnknown: true, passwords: false };
beforeEach(() => {
  document.body.replaceChildren();
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
});
const el = (id: string) => document.getElementById(id) as HTMLElement;

// The same behaviour a component library gives these roles.
function wire() {
  for (const box of document.querySelectorAll<HTMLElement>('[role=checkbox],[role=switch]')) box.addEventListener('click', () => box.setAttribute('aria-checked', String(box.getAttribute('aria-checked') !== 'true')));
  for (const radio of document.querySelectorAll<HTMLElement>('[role=radio]')) radio.addEventListener('click', () => { for (const other of radio.closest('[role=radiogroup]')!.querySelectorAll('[role=radio]')) other.setAttribute('aria-checked', String(other === radio)); });
  for (const combo of document.querySelectorAll<HTMLElement>('div[role=combobox]')) {
    const list = document.getElementById(combo.getAttribute('aria-controls')!)!;
    combo.addEventListener('mousedown', () => { list.hidden = false; combo.setAttribute('aria-expanded', 'true'); });
    for (const option of list.querySelectorAll<HTMLElement>('[role=option]')) option.addEventListener('click', () => { combo.textContent = option.textContent; list.hidden = true; combo.setAttribute('aria-expanded', 'false'); });
  }
}
const html = `<form>
  <span role="checkbox" aria-checked="false" aria-labelledby="a" id="cb"></span><span id="a">Show weekends</span>
  <span role="checkbox" aria-checked="false" aria-labelledby="b" id="terms"></span><span id="b">I agree to the terms</span>
  <span role="switch" aria-checked="false" aria-labelledby="c" id="usage"></span><span id="c">Share anonymous usage data</span>
  <span role="switch" aria-checked="true" aria-label="Keep me signed in" id="stay"></span>
  <div role="radiogroup" aria-label="Gender"><span role="radio" aria-checked="false" id="m">Male</span><span role="radio" aria-checked="false" id="f">Female</span></div>
  <span id="cl">Country</span><div role="combobox" aria-labelledby="cl" aria-controls="list" aria-expanded="false" id="country">Choose</div>
  <ul role="listbox" id="list" hidden><li role="option">France</li><li role="option">Algeria</li><li role="option">Canada</li></ul>
  <span id="dl">Description</span><div contenteditable="true" role="textbox" aria-labelledby="dl" id="ed"></div>
  <span id="cn">Card number</span><div contenteditable="true" aria-labelledby="cn" id="card"></div>
</form>`;

describe('custom widgets', () => {
  it('are classified like native fields, consent and card fields included', () => {
    document.body.innerHTML = html;
    const types = Object.fromEntries(listWidgets().map(w => [w.id, classifyWidget(w).type]));
    expect(types).toMatchObject({ cb: 'unknown', terms: 'skip:consent', usage: 'skip:consent', stay: 'skip:session', m: 'gender', f: 'gender', country: 'country', ed: 'description', card: 'skip:card' });
  });
  it('are filled by pressing, choosing and typing, never touching consent, session or card widgets', async () => {
    document.body.innerHTML = html;
    wire();
    const result = await fillWidgets(request);
    expect(el('cb').getAttribute('aria-checked')).toBe('true');
    expect(el('terms').getAttribute('aria-checked')).toBe('false');
    expect(el('usage').getAttribute('aria-checked')).toBe('false');
    expect(el('stay').getAttribute('aria-checked')).toBe('true');
    expect(el('f').getAttribute('aria-checked')).toBe('true');
    expect(el('country').textContent).toBe('Algeria');
    expect(el('ed').textContent).toBe(values.description);
    expect(el('card').textContent).toBe('');
    expect(result.filled).toBeGreaterThanOrEqual(4);
  });
  it('repeat exactly with a seed', async () => {
    document.body.innerHTML = html.replace('Gender', 'Pick one');
    wire();
    await fillWidgets({ ...request, seed: 'w' });
    const first = [el('cb').getAttribute('aria-checked'), el('m').getAttribute('aria-checked')];
    await fillWidgets({ ...request, seed: 'w' });
    expect([el('cb').getAttribute('aria-checked'), el('m').getAttribute('aria-checked')]).toEqual(first);
  });
  it('are reported in the classify mode the benchmark reads', () => {
    document.body.innerHTML = html;
    expect(fillPage({ ...request, mode: 'classify' }).widgets!.find(w => w.type === 'country')).toBeDefined();
  });
});
