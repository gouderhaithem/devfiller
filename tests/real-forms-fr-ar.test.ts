// @vitest-environment jsdom
// French and Arabic wording the rules missed on real forms collected from French, Algerian, Moroccan,
// Tunisian and Gulf websites (2 October 2026).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzePage } from '../src/fill/context';
import { listControls } from '../src/fill/extract';

beforeEach(() => {
  document.body.replaceChildren();
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
});
const typeOf = (selector: string) => analyzePage(listControls(), undefined, [], false).fields.get(document.querySelector<HTMLInputElement>(selector)!)?.type;
const select = (prompt: string, options: readonly string[]) => `<select id="s" name="f_574"><option value="">${prompt}</option>${options.map(o => `<option>${o}</option>`).join('')}</select>`;

describe('a select named only by its prompt', () => {
  it.each([
    ['Choisir Fonction', ['Achat', 'Commercial', 'Comptabilité'], 'jobTitle'],
    ['Sélectionnez votre pays', ['Algérie', 'Maroc', 'Tunisie'], 'country'],
    ['اختر الخبرة', ['خريج', 'أقل من سنة', 'سنتان'], 'experience'],
    ['حدد الراتب', ['250 - 499', '500 - 749', '750 - 999'], 'salary'],
  ])('reads "%s" as its type', (prompt, options, type) => {
    document.body.innerHTML = `<form>${select(prompt, options)}</form>`;
    expect(typeOf('#s')).toBe(type);
  });
});

describe('French and Arabic words', () => {
  it.each([
    ['<input id="f" name="kw" placeholder="Mots clés">', 'search'],
    ['<label for="f">Gare de départ</label><input id="f" name="gd">', 'city'],
    ['<label for="f">خبرتك</label><input id="f" name="exp" type="number">', 'experience'],
    ['<label for="f">راتبك المتوقع</label><input id="f" name="sal" type="number">', 'salary'],
  ])('reads %s', (field, type) => {
    document.body.innerHTML = `<form>${field}</form>`;
    expect(typeOf('#f')).toBe(type);
  });
});

describe('"الاسم" and "Name"', () => {
  it('reads "الاسم" as the full name when it is the only name field', () => {
    document.body.innerHTML = `<form><label for="n">الاسم*</label><input id="n" name="name"><label for="e">البريد الإلكتروني</label><input id="e" type="email"></form>`;
    expect(typeOf('#n')).toBe('fullName');
  });
  it('reads "الاسم" beside "اللقب" as the first name', () => {
    document.body.innerHTML = `<form><label for="l">اللقب</label><input id="l" name="nom"><label for="n">الاسم</label><input id="n" name="prenom"></form>`;
    expect([typeOf('#l'), typeOf('#n')]).toEqual(['lastName', 'firstName']);
  });
  it('reads "Name" beside "Last name" as the first name', () => {
    document.body.innerHTML = `<form><label for="n">Name</label><input id="n" name="name"><label for="l">Last name</label><input id="l" name="last"></form>`;
    expect([typeOf('#n'), typeOf('#l')]).toEqual(['firstName', 'lastName']);
  });
  it('keeps "Full name" beside a last name as the full name', () => {
    document.body.innerHTML = `<form><label for="n">Full name</label><input id="n"><label for="l">Last name</label><input id="l"></form>`;
    expect(typeOf('#n')).toBe('fullName');
  });
});
