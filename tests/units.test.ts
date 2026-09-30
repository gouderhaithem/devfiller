// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { classifyField } from '../src/fill/classify';
import { describeSignals } from '../src/fill/extract';
import { unitOf, measurementNumber } from '../src/fill/units';
import { seededRandom } from '../src/rng';
import { fillPage, type FillRequest } from '../src/fill';
import { generateIdentities, generateValues } from '../src/data';
import { generateSamples } from '../src/samples';

const values = generateValues('en');
const request: FillRequest = { values, identities: generateIdentities('en'), samples: generateSamples('en'), custom: [], overwrite: true, fillUnknown: true, passwords: false };
beforeEach(() => {
  document.body.replaceChildren();
  document.documentElement.lang = '';
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
});
const el = (id: string) => document.getElementById(id) as HTMLInputElement;
function fill(html: string, lang = 'en', extra: Partial<FillRequest> = {}) {
  document.body.innerHTML = `<form lang="${lang}">${html}</form>`;
  fillPage({ ...request, ...extra });
}
const unit = (label: string) => { document.body.innerHTML = `<label for="x">${label}</label><input id="x">`; return unitOf(describeSignals(el('x'))); };

describe('units', () => {
  it.each([
    ['Longueur (mm)', 'mm', 'length'], ['Weight [lb]', 'lb', 'weight'], ['Surface (m²)', 'm²', 'area'], ['Prix en €', '€', 'currency'],
    ['Labor rate ($/h)', '$', 'currency'], ['Perçages par pièce (u)', 'u', 'count'], ['Remise (%)', '%', 'percent'], ['Volume (L)', 'l', 'volume'],
  ])('reads the unit in "%s"', (label, symbol, kind) => {
    expect(unit(label)).toMatchObject({ symbol, kind });
  });
  it('ignores words that only look like units', () => {
    expect(unit('Project name')).toBeUndefined();
    expect(unit('Your name')).toBeUndefined();
    expect(unit('Type M')).toBeUndefined();
  });
  it('keeps values in range for each dimension and unit', () => {
    const random = seededRandom('units');
    for (let i = 0; i < 200; i++) {
      const thickness = measurementNumber('thickness', 'mm', random).value;
      expect(thickness >= 1 && thickness <= 40).toBe(true);
      const length = measurementNumber('length', 'mm', random).value;
      expect(Number.isInteger(length) && length >= 100 && length <= 6000).toBe(true);
    }
  });
});

describe('measurements, references and numbers', () => {
  it('fills a French production order with numbers and codes, not words', () => {
    fill(`<label for="n">N° de commande*</label><input id="n"><label for="r">Référence*</label><input id="r" maxlength="3">
      <label for="l">Longueur (mm)</label><input id="l" inputmode="decimal"><label for="e">Épaisseur (mm)</label><input id="e" inputmode="decimal">
      <label for="w">Poids unitaire (kg)</label><input id="w" inputmode="decimal"><label for="qty">Quantité planifiée (u)*</label><input id="qty" inputmode="numeric">
      <label for="p">Perçages par pièce (u)</label><input id="p" inputmode="numeric"><label for="m">Nom du repère*</label><input id="m" name="reperes[0][nom]">`, 'fr');
    expect(el('n').value).toMatch(/^CMD-\d{4}-\d{4}$/);
    expect(el('r').value).toMatch(/^[A-Z]\d{0,2}$/);
    expect(el('l').value).toMatch(/^\d{3,4}$/);
    expect(el('e').value).toMatch(/^\d{1,2}(,\d)?$/);
    expect(el('w').value).toMatch(/^\d{1,4}(,\d)?$/);
    expect(el('qty').value).toMatch(/^\d+$/);
    expect(el('p').value).toMatch(/^\d+$/);
    expect(classifyField(el('m')).type).toBe('unknown');
  });
  it('uses English prefixes, digit patterns and the dot on English pages', () => {
    fill(`<label for="i">Invoice no.</label><input id="i"><label for="po">PO number</label><input id="po" pattern="[0-9]{8}"><label for="s">SKU</label><input id="s">
      <label for="w">Weight (lb)</label><input id="w"><label for="t">Total (€)</label><input id="t"><label for="h">Labor rate ($/h)</label><input id="h">`);
    expect(el('i').value).toMatch(/^INV-\d{4}-\d{4}$/);
    expect(el('po').value).toMatch(/^\d{8}$/);
    expect(el('s').value).toMatch(/^SKU-\d{5}$/);
    expect(el('w').value).toMatch(/^\d+(\.\d)?$/);
    expect(classifyField(el('t')).type).toBe('amount');
    expect(classifyField(el('h')).type).toBe('price');
  });
  it('makes each fill a new reference, and a seeded one the same', () => {
    fill('<label for="n">Order number</label><input id="n">');
    const first = el('n').value;
    fillPage(request);
    expect(el('n').value).not.toBe(first);
    fillPage({ ...request, seed: 'ref' });
    const seeded = el('n').value;
    fillPage({ ...request, seed: 'ref' });
    expect(el('n').value).toBe(seeded);
  });
  it('fits a measurement to a number input', () => {
    fill('<label for="d">Diameter (mm)</label><input id="d" type="number" min="1" max="500">');
    expect(Number(el('d').value) >= 5 && Number(el('d').value) <= 500).toBe(true);
  });
  it('gives unknown numeric fields digits', () => {
    fill('<label for="o">Operation code</label><input id="o" inputmode="numeric"><input id="z" pattern="\\d{6}"><input id="t">');
    expect(el('o').value).toMatch(/^\d+$/);
    expect(el('z').value).toMatch(/^\d{6}$/);
    expect(el('t').value).toMatch(/^[A-Za-z]+$/);
  });
  it('keeps personal and legal numbers out of references', () => {
    for (const label of ['Passport number', 'VAT number', 'Numéro de sécurité sociale', 'Referral code', 'Project code']) {
      document.body.innerHTML = `<label for="x">${label}</label><input id="x">`;
      expect(classifyField(el('x')).type, label).not.toBe('reference');
    }
  });
  it('does not read a back-office order form as a checkout', () => {
    document.body.innerHTML = '<form action="/work-orders"><label for="w">Work order #</label><input id="w"><label for="l">Length (in)</label><input id="l"><button>Create order</button></form>';
    expect(fillPage({ ...request, mode: 'inspect' }).forms![0].type).toBe('other');
  });
  it.each([
    ['Length of stay', 'unknown'], ['Volume discount', 'unknown'], ['Pièce jointe', 'unknown'], ['Height', 'measurement'], ['Your height (cm)', 'measurement'],
    ['Loyer mensuel (DA)', 'amount'], ['Prix (€)', 'price'], ['Salary (USD)', 'salary'], ['Surface habitable (m²)', 'measurement'], ['Nombre de pièces', 'quantity'],
  ])('reads "%s" as %s', (label, type) => {
    document.body.innerHTML = `<label for="x">${label}</label><input id="x">`;
    expect(classifyField(el('x')).type).toBe(type);
  });
  it('does not take a formula in brackets for a unit', () => {
    expect(unit('Dimensions (L × l × h)')).toBeUndefined();
  });
});
