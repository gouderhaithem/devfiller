// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportFixture } from '../src/fill/export';
import { analyzePage } from '../src/fill/context';
import { listControls } from '../src/fill/extract';
import { fillPage, type FillRequest } from '../src/fill';
import { generateIdentities, generateValues, validateSettings, type TypeRule } from '../src/data';
import { generateSamples } from '../src/samples';

const values = generateValues('en');
const request: FillRequest = { values, identities: generateIdentities('en'), samples: generateSamples('en'), custom: [], overwrite: true, fillUnknown: true, passwords: false };
beforeEach(() => {
  document.body.replaceChildren();
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
});
const el = (id: string) => document.getElementById(id) as HTMLInputElement;
const rule = (selector: string, type: TypeRule['type']): TypeRule => ({ id: selector, selector, site: location.hostname, type });

describe('type rules', () => {
  it('set a field type that recognition and the form pass leave alone', () => {
    document.body.innerHTML = '<form><label for="n">Nom du repère</label><input id="n"><label for="c">Confirm</label><input id="c"></form>';
    const rules = [rule('#n', 'title'), rule('#c', 'unknown')];
    const fields = analyzePage(listControls(), undefined, rules).fields;
    expect(fields.get(el('n'))).toMatchObject({ type: 'title', fixed: true });
    expect(fields.get(el('c'))).toMatchObject({ type: 'unknown', fixed: true });
    fillPage({ ...request, typeRules: rules });
    expect(request.samples!.title).toContain(el('n').value);
  });
  it('only apply on their own site', () => {
    document.body.innerHTML = '<label for="n">Nom du repère</label><input id="n">';
    expect(analyzePage(listControls(), undefined, [{ ...rule('#n', 'title'), site: 'other.example' }]).fields.get(el('n'))!.type).not.toBe('title');
  });
  it('never unlock a sensitive field', () => {
    document.body.innerHTML = '<label for="c">Card number</label><input id="c">';
    fillPage({ ...request, typeRules: [rule('#c', 'fullName')] });
    expect(el('c').value).toBe('');
  });
  it('are validated when settings load', () => {
    const settings = validateSettings({ version: 3, typeRules: [rule('#a', 'email'), { id: 'x', selector: '#b', site: 's', type: 'nonsense' }, { id: 'y', selector: '', site: 's', type: 'email' }] });
    expect(settings.typeRules.map(r => r.selector)).toEqual(['#a']);
  });
});

describe('fixture export', () => {
  const page = `<header>Welcome back, Alice Martin</header>
    <form action="https://shop.example.com/checkout?session=secret123" onsubmit="track()">
      <input type="hidden" name="csrf" value="tok-987">
      <label for="e">Email</label><input id="e" type="email" value="alice@real.example">
      <label for="m">Message</label><textarea id="m">my private note</textarea>
      <label for="c">Country</label><select id="c"><option value="FR" selected>France</option><option value="DZ">Algeria</option></select>
      <label><input type="checkbox" id="t" checked> I agree to the terms</label>
      <label for="n">Nom du repère</label><input id="n" data-testid="x">
      <script>steal()</script><img src="https://tracker.example/pixel.gif">
      <button type="submit">Place order</button>
    </form>`;
  it('keeps structure and labels, never values, scripts, hidden tokens or hosts', () => {
    document.body.innerHTML = page;
    const { html, filename } = exportFixture();
    for (const leaked of ['alice@real.example', 'my private note', 'tok-987', 'csrf', 'secret123', 'shop.example.com', 'steal()', 'tracker.example', 'Alice Martin', 'onsubmit', 'data-testid', 'checked', 'selected']) expect(html, leaked).not.toContain(leaked);
    expect(html).toContain('action="/checkout"');
    expect(html).toContain('<label for="e">Email</label>');
    expect(filename).toMatch(/^devfiller-fixture-.+-\d{4}-\d{2}-\d{2}\.html$/);
  });
  it('labels every control with DevFiller\'s answer or your rule, and the form with its type', () => {
    document.body.innerHTML = page;
    const { html } = exportFixture([rule('#n', 'title')]);
    const exported = new DOMParser().parseFromString(html, 'text/html');
    const labels = Object.fromEntries(Array.from(exported.querySelectorAll('[data-expect]'), node => [node.id, node.getAttribute('data-expect')]));
    expect(labels).toMatchObject({ e: 'email', m: 'message', c: 'country', t: 'skip:consent', n: 'title' });
    expect(exported.querySelectorAll('input, select, textarea').length).toBe(exported.querySelectorAll('[data-expect]').length);
    expect(exported.querySelector('form')!.getAttribute('data-form-type')).toBeTruthy();
  });
});
