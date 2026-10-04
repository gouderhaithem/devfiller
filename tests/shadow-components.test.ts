// @vitest-environment jsdom
// Fields inside web components, with markup modelled on how component libraries render them: the
// label slotted in from the page (FAST/Fluent, Shoelace), or set only on the component, and the
// component inside the page's form and fieldset.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzePage } from '../src/fill/context';
import { listControls } from '../src/fill/extract';
import { fillPage, type FillRequest } from '../src/fill';
import { generateIdentities, generateValues } from '../src/data';
import { generateSamples } from '../src/samples';

const values = generateValues('en');
const request: FillRequest = { values, identities: generateIdentities('en'), samples: generateSamples('en'), custom: [], overwrite: true, fillUnknown: true, passwords: false, modelGuesses: false };
beforeEach(() => {
  document.body.replaceChildren();
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
});

// Attaches an open shadow root to every element matching `selector`, filled with `template(host)`.
function component(selector: string, template: (host: Element) => string) {
  for (const host of Array.from(document.querySelectorAll(selector))) host.attachShadow({ mode: 'open' }).innerHTML = template(host);
}
const inner = (host: string) => document.querySelector(host)!.shadowRoot!.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')!;
const typeOf = (host: string) => analyzePage(listControls(), undefined, [], false).fields.get(inner(host))?.type;

// FAST / Fluent text field: the label is the component's own text, shown through a default slot.
const fluent = (host: Element) => `<label part="label" for="control" class="label"><slot></slot></label><div class="root" part="root"><input class="control" part="control" id="control" type="${host.getAttribute('type') || 'text'}"></div>`;
// Shoelace input: a named "label" slot, with the label attribute as its fallback.
const shoelace = (host: Element) => `<div part="form-control"><label part="form-control-label" id="label" for="input"><slot name="label">${host.getAttribute('label') ?? ''}</slot></label><div part="form-control-input"><div part="base"><input part="input" id="input" type="${host.getAttribute('type') || 'text'}"></div></div></div>`;
// A plain component that shows its label attribute itself and gives the inner field nothing.
const plain = (host: Element) => `<span class="caption">${host.getAttribute('label') ?? ''}</span><input class="native">`;
const plainArea = () => `<textarea class="native"></textarea>`;

describe('a label slotted in from the page', () => {
  it('reads a FAST/Fluent field\'s own text as its label', () => {
    document.body.innerHTML = `<form><fluent-text-field id="a" type="text">Company name</fluent-text-field><fluent-text-field id="b">Job title</fluent-text-field></form>`;
    component('fluent-text-field', fluent);
    expect([typeOf('#a'), typeOf('#b')]).toEqual(['company', 'jobTitle']);
  });
  it('reads a Shoelace field\'s slotted label, and its label attribute', () => {
    document.body.innerHTML = `<form><sl-input id="a"><span slot="label">Phone number</span></sl-input><sl-input id="b" label="Postal code"></sl-input></form>`;
    component('sl-input', shoelace);
    expect([typeOf('#a'), typeOf('#b')]).toEqual(['phone', 'postalCode']);
  });
});

describe('a label set only on the component', () => {
  it('reads the component\'s label, name and placeholder when the inner field has none', () => {
    document.body.innerHTML = `<form><x-text-input id="a" label="Company"></x-text-input><x-text-input id="b" name="last_name"></x-text-input><x-text-input id="c" placeholder="Your city"></x-text-input></form>`;
    component('x-text-input', plain);
    expect([typeOf('#a'), typeOf('#b'), typeOf('#c')]).toEqual(['company', 'lastName', 'city']);
  });
  it('lends nothing to a component that holds several fields', () => {
    document.body.innerHTML = `<form><x-address id="a" label="Email"></x-address></form>`;
    component('x-address', () => `<input class="one"><input class="two">`);
    expect(typeOf('#a')).not.toBe('email');
  });
});

describe('the page\'s form and fieldset around a component', () => {
  it('reads the legend of the fieldset the component sits in', () => {
    document.body.innerHTML = `<form><fieldset><legend>Date of birth</legend><x-date id="a"></x-date></fieldset></form>`;
    component('x-date', () => `<input class="native" type="text" placeholder="DD/MM/YYYY">`);
    expect(typeOf('#a')).toBe('birthDate');
  });
  it('counts a component\'s text area as the contact form\'s one message', () => {
    document.body.innerHTML = `<form><label for="e">Email</label><input id="e" type="email"><x-textarea id="a"></x-textarea></form>`;
    component('x-textarea', plainArea);
    expect(typeOf('#a')).toBe('message');
  });
});

// Found in review: choices inside components in a form are filled now, so their consent wording
// must be read however it reaches them.
describe('consent inside components', () => {
  const typeOfChoice = (host: string) => analyzePage(listControls(), undefined, [], false).fields.get(document.querySelector(host)!.shadowRoot!.querySelector('input')!)?.type;
  it('skips a radio whose slotted label accepts the terms', () => {
    document.body.innerHTML = `<form><x-radio id="a" name="opt">I accept the terms and conditions</x-radio><x-radio id="b" name="opt">I do not accept</x-radio></form>`;
    component('x-radio', () => `<label><input type="radio" name="opt"><slot></slot></label>`);
    expect(typeOfChoice('#a')).toBe('skip:consent');
  });
  it('skips a checkbox whose own caption asks consent though the component names a topic', () => {
    document.body.innerHTML = `<form><x-checkbox id="a" label="Communication preferences"></x-checkbox></form>`;
    component('x-checkbox', () => `<input type="checkbox" id="c"><span>I agree to receive marketing emails</span>`);
    expect(typeOfChoice('#a')).toBe('skip:consent');
  });
  // Consent boxes get their test value (ticked); what must never happen is a box ticked as an
  // ordinary choice, unrecognized.
  it('ticks no slotted consent checkbox as an ordinary choice in a real fill', () => {
    document.body.innerHTML = `<form><label for="e">Email</label><input id="e" type="email"><x-check id="a">Send me the newsletter</x-check></form>`;
    component('x-check', () => `<label><input type="checkbox"><slot></slot></label>`);
    fillPage(request);
    const box = document.querySelector('#a')!.shadowRoot!.querySelector('input')!;
    const type = analyzePage(listControls(), undefined, [], false).fields.get(box)?.type;
    expect(box.checked && !type?.startsWith('skip:')).toBe(false);
  });
});

describe('a light-DOM field pointing at a missing form', () => {
  it('keeps its own answer: no form', async () => {
    document.body.innerHTML = `<form id="f"><input id="x" form="nowhere"></form>`;
    const { formOf } = await import('../src/fill/extract');
    expect(formOf(document.querySelector('#x')!)).toBeNull();
  });
});

describe('a fill', () => {
  it('fills slotted-label and attribute-label components in the page\'s form', () => {
    document.body.innerHTML = `<form><fluent-text-field id="a" type="email">Work email</fluent-text-field><x-text-input id="b" label="Company"></x-text-input></form>`;
    component('fluent-text-field', fluent);
    component('x-text-input', plain);
    fillPage(request);
    expect(inner('#a').value).toBe(values.email);
    expect(inner('#b').value).toBe(values.company);
  });
});
