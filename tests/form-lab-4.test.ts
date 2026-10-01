// @vitest-environment jsdom
// Findings from the sealed Form Lab pages 151–180 (1 October 2026), retired once opened. Each block
// is one mechanism, written as generic markup, not a copy of the page that exposed it.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fillPage, type FillRequest } from '../src/fill';
import { generateIdentities, generateValues } from '../src/data';
import { generateSamples } from '../src/samples';

const values = { ...generateValues('en'), country: 'France' };
// The generated data is French, so a US number can only come from the form.
const phones = { us: '+1 555-0142', fr: '+33 6 12 34 56 78', dz: '+213 5 51 23 45 67' };
const request: FillRequest = { values: { ...values, phone: phones.fr }, identities: generateIdentities('en'), samples: generateSamples('en'), phones, custom: [], overwrite: true, fillUnknown: true, passwords: false, modelGuesses: false };
beforeEach(() => {
  document.body.replaceChildren();
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
});
const field = (id: string) => document.getElementById(id) as HTMLInputElement;
function types(html: string): Record<string, string> {
  document.body.innerHTML = `<form>${html}</form>`;
  const controls = Array.from(document.querySelectorAll<HTMLInputElement>('input, select, textarea'));
  const result = fillPage({ ...request, mode: 'classify' });
  const found = new Map((result.classified ?? []).map(({ index, type }) => [index, type]));
  return Object.fromEntries(controls.map((el, index) => [el.id || el.name, found.get(index) ?? 'unknown']));
}

describe('consent wording', () => {
  it('protects opt-out and unsubscribe boxes', () => {
    const found = types(`<label for="a">Email Opt Out</label><input id="a" name="emailOptOut" type="checkbox">
      <label><input type="checkbox" id="b"> Unsubscribe me from all emails</label>
      <label><input type="checkbox" id="c" name="optout"> Opt-out of SMS</label>`);
    expect(found).toMatchObject({ a: 'skip:consent', b: 'skip:consent', c: 'skip:consent' });
  });
  it('protects boxes that store details for next time', () => {
    const found = types(`<label><input type="checkbox" id="a"> Save this address to my account for next time</label>
      <label><input type="checkbox" id="b"> Save this card for future purchases</label>
      <label><input type="checkbox" id="c"> Keep my payment details for next time</label>
      <label><input type="checkbox" id="g"> This is a gift</label>`);
    expect(found).toMatchObject({ a: 'skip:consent', b: 'skip:consent', c: 'skip:consent', g: 'unknown' });
  });
});

describe('custom toggles under a heading', () => {
  it('reads the heading above a group of switches, and never flips them', () => {
    document.body.innerHTML = `<form><input id="name" aria-label="Display name">
      <div class="card"><div class="card-title">Notifications &amp; privacy</div>
        <div class="row"><div class="ctl"><div role="switch" id="s1" tabindex="0" aria-checked="true" aria-labelledby="s1-l"></div></div><label id="s1-l" for="s1">Replies to my threads</label></div>
        <div class="row"><div class="ctl"><div role="switch" id="s2" tabindex="0" aria-checked="false" aria-labelledby="s2-l"></div></div><label id="s2-l" for="s2">Weekly product tips</label></div>
      </div></form>`;
    for (const el of document.querySelectorAll('[role="switch"]')) el.addEventListener('click', () => el.setAttribute('aria-checked', String(el.getAttribute('aria-checked') !== 'true')));
    const result = fillPage({ ...request, mode: 'classify' });
    expect(result.widgets?.map(widget => widget.type)).toEqual(['skip:consent', 'skip:consent']);
  });
  it('reads a heading that sits directly in the form, above deeply wrapped switches', () => {
    document.body.innerHTML = `<form><input id="name" aria-label="Display name"><div class="title">Notifications &amp; privacy</div>
      <div class="grid">${[1, 2].map(i => `<div class="input"><div class="control"><div class="selection"><div class="wrapper"><div class="track"></div><div role="switch" id="s${i}" tabindex="0" aria-checked="true" aria-labelledby="s${i}-l"></div></div><label id="s${i}-l" for="s${i}">Mentions ${i}</label></div></div><div class="details"><div class="messages">Push when someone mentions me</div></div></div>`).join('')}</div></form>`;
    const result = fillPage({ ...request, mode: 'classify' });
    expect(result.widgets?.map(widget => widget.type)).toEqual(['skip:consent', 'skip:consent']);
  });
  it('still fills a switch whose heading is not about permission', async () => {
    document.body.innerHTML = `<form><div class="card"><div class="card-title">Appearance</div>
      <div class="row"><div role="switch" id="dark" tabindex="0" aria-checked="false" aria-label="Dark mode"></div></div></div></form>`;
    const result = fillPage({ ...request, mode: 'classify' });
    expect(result.widgets?.[0].type).not.toBe('skip:consent');
  });
});

describe('deadline dates', () => {
  it('reads "Need it back by" after a plain date as the end, and keeps it after the start', () => {
    const found = types(`<label for="d">Drop-off</label><input id="d" type="date"><label for="n">Need it back by</label><input id="n" type="date">
      <label for="o">Order placed</label><input id="o" type="date"><label for="l">Deliver by</label><input id="l" type="date">`);
    expect(found).toMatchObject({ d: 'startDate', n: 'endDate', o: 'startDate', l: 'endDate' });
    fillPage(request);
    expect(field('n').value > field('d').value).toBe(true);
    expect(field('l').value > field('o').value).toBe(true);
  });
  it('leaves two unrelated dates alone', () => {
    const found = types(`<label for="b">Date of birth</label><input id="b" type="date"><label for="h">Hire date</label><input id="h" type="date">`);
    expect(found.h).not.toBe('endDate');
  });
});

describe('phones on US forms without a country field', () => {
  it('writes a US number when the form asks for a ZIP code', () => {
    document.body.innerHTML = `<form><label for="z">ZIP code</label><input id="z" name="zip"><label for="p">Cell #</label><input id="p" type="tel"></form>`;
    fillPage(request);
    expect(field('p').value).toMatch(/^(\+1|\()/);
  });
  it('writes a US number when the placeholder shows one', () => {
    document.body.innerHTML = `<form><label for="p">Phone</label><input id="p" type="tel" placeholder="(555) 555-0123"></form>`;
    fillPage(request);
    expect(field('p').value).toMatch(/^(\+1|\(\d{3}\))/);
  });
  it('keeps a French number on a form with a French postcode', () => {
    document.body.innerHTML = `<form><label for="z">Code postal</label><input id="z" name="cp"><label for="p">Téléphone</label><input id="p" type="tel"></form>`;
    fillPage(request);
    expect(field('p').value).not.toMatch(/^\+1/);
  });
});
