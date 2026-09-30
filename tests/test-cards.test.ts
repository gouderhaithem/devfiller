// @vitest-environment jsdom
// Card fields are filled with test cards (the numbers payment sandboxes document for testing),
// never real ones: a number for the chosen scenario, a future expiry, a CVC and the cardholder.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fillPage, type FillRequest } from '../src/fill';
import { TEST_CARDS } from '../src/fill/cards';
import { defaults, generateIdentities, generateValues, validateSettings } from '../src/data';
import { generateSamples } from '../src/samples';

const values = generateValues('en');
const request: FillRequest = { values, identities: generateIdentities('en'), samples: generateSamples('en'), custom: [], overwrite: true, fillUnknown: true, passwords: false, cards: 'success' };
beforeEach(() => {
  document.body.replaceChildren();
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
});
const field = (id: string) => document.getElementById(id) as HTMLInputElement;
const digits = (value: string) => value.replace(/\D/g, '');
const year = new Date().getFullYear();

describe('test cards', () => {
  it('lists the documented test card for each scenario', () => {
    expect(Object.fromEntries(Object.entries(TEST_CARDS).map(([key, card]) => [key, card.number]))).toEqual({
      success: '4242 4242 4242 4242', declined: '4000 0000 0000 0002', insufficient: '4000 0000 0000 9995', expired: '4000 0000 0000 0069', cvc: '4000 0000 0000 0127',
    });
  });
  it('fills a checkout card with the test number, a future expiry, a CVC and the cardholder', () => {
    document.body.innerHTML = `<form><fieldset><legend>Payment</legend>
      <label for="num">Card number</label><input id="num" autocomplete="cc-number" inputmode="numeric">
      <label for="exp">Expiry</label><input id="exp" autocomplete="cc-exp" placeholder="MM / YY">
      <label for="cvc">CVC</label><input id="cvc" autocomplete="cc-csc" maxlength="4">
      <label for="name">Name on card</label><input id="name" autocomplete="cc-name">
    </fieldset></form>`;
    fillPage(request);
    expect(digits(field('num').value)).toBe('4242424242424242');
    const [month, yy] = field('exp').value.split(/\s*\/\s*/).map(Number);
    expect(month).toBeGreaterThanOrEqual(1);
    expect(2000 + yy).toBeGreaterThan(year);
    expect(field('exp').value).toMatch(/^\d{2} \/ \d{2}$/);
    expect(field('cvc').value).toMatch(/^\d{3}$/);
    expect(field('name').value).toBe(values.fullName);
  });
  it('fills the card of the chosen scenario', () => {
    document.body.innerHTML = `<form><label for="num">Card number</label><input id="num"></form>`;
    for (const [scenario, card] of Object.entries(TEST_CARDS)) {
      fillPage({ ...request, cards: scenario as FillRequest['cards'] });
      expect(digits(field('num').value), scenario).toBe(digits(card.number));
    }
  });
  it('writes the number the way the field takes it: digits only, spaced, or in four boxes', () => {
    document.body.innerHTML = `<form>
      <label for="a">Card number</label><input id="a" maxlength="16" pattern="\\d{16}">
      <label for="b">Numéro de carte</label><input id="b" maxlength="19">
      <div><span>Card number</span>${[1, 2, 3, 4].map(i => `<input id="p${i}" name="cc_part${i}" maxlength="4" aria-label="Card number, part ${i}">`).join('')}</div>
    </form>`;
    fillPage(request);
    expect(field('a').value).toBe('4242424242424242');
    expect(field('b').value).toBe('4242 4242 4242 4242');
    expect([1, 2, 3, 4].map(i => field(`p${i}`).value)).toEqual(['4242', '4242', '4242', '4242']);
  });
  it('fills split expiry selects, a month input and a four-digit year', () => {
    const months = Array.from({ length: 12 }, (_, i) => `<option value="${String(i + 1).padStart(2, '0')}">${String(i + 1).padStart(2, '0')}</option>`).join('');
    const years = Array.from({ length: 10 }, (_, i) => `<option>${year + i}</option>`).join('');
    document.body.innerHTML = `<form>
      <label for="n">Card number</label><input id="n" autocomplete="cc-number">
      <select id="m" autocomplete="cc-exp-month"><option value="">MM</option>${months}</select>
      <select id="y" autocomplete="cc-exp-year"><option value="">YYYY</option>${years}</select>
      <label for="mi">Card expiry</label><input id="mi" type="month">
      <label for="yy">Expiration year</label><input id="yy" autocomplete="cc-exp-year" placeholder="YYYY">
    </form>`;
    fillPage(request);
    expect(field('m').value).not.toBe('');
    expect(Number((field('y') as unknown as HTMLSelectElement).value)).toBeGreaterThan(year);
    expect(field('mi').value.slice(0, 4) > String(year)).toBe(true);
    expect(Number(field('yy').value)).toBeGreaterThan(year);
  });
  it('leaves a coupon beside the card, a card PIN, bank and one-time-code fields empty', () => {
    document.body.innerHTML = `<form><fieldset><legend>Payment</legend>
      <label for="num">Card number</label><input id="num">
      <label for="promo">Discount code or gift card</label><input id="promo">
      <label for="pin">Card PIN</label><input id="pin" type="password">
      <label for="iban">IBAN</label><input id="iban">
      <label for="otp">SMS code</label><input id="otp" autocomplete="one-time-code">
    </fieldset></form>`;
    fillPage(request);
    expect(digits(field('num').value)).toBe('4242424242424242');
    for (const id of ['promo', 'pin', 'iban', 'otp']) expect(field(id).value, id).toBe('');
  });
  it('never writes a card number into a field that is only beside the card', () => {
    document.body.innerHTML = `<form><div class="grid">
      <label for="num">Card number</label><input id="num"><label for="cvv">CVV</label><input id="cvv">
      <label for="ssn">Social Security Number</label><input id="ssn" name="ssn" placeholder="XXX-XX-XXXX">
      <label for="ref">Number</label><input id="ref" name="x9">
    </div></form>`;
    fillPage(request);
    expect(digits(field('num').value)).toBe('4242424242424242');
    expect(field('ssn').value).toBe('');
    expect(field('ref').value.replace(/\D/g, '')).not.toBe('4242424242424242');
  });
  it('writes a full expiry into a month input, whatever its label says', () => {
    document.body.innerHTML = `<form><label for="n">Card number</label><input id="n"><label for="m">Card expiry month</label><input id="m" type="month"></form>`;
    fillPage(request);
    expect(field('m').value).toMatch(/^\d{4}-12$/);
  });
  it('leaves fields that only mention the card empty', () => {
    const labels = ['Card password', 'Card 3DS password', 'Card token', 'Card issuer', 'Card brand', 'Card billing address', 'Card on file nickname', 'Card reference number', 'Card last 4 digits', 'Card verification code (SMS)', 'Cardholder email', 'Cardholder phone'];
    document.body.innerHTML = `<form><fieldset><legend>Payment card</legend><label for="num">Card number</label><input id="num">
      ${labels.map((label, i) => `<label for="f${i}">${label}</label><input id="f${i}">`).join('')}</fieldset></form>`;
    fillPage(request);
    expect(digits(field('num').value)).toBe('4242424242424242');
    labels.forEach((label, i) => expect(field(`f${i}`).value, label).toBe(''));
  });
  it('reads the expiry format from the label when there is no placeholder', () => {
    document.body.innerHTML = `<form><label for="n">Card number</label><input id="n"><label for="e">Expiry MM/YYYY</label><input id="e"></form>`;
    fillPage(request);
    expect(field('e').value).toBe(`12/${year + 3}`);
  });
  it('shows filled card fields as filled in the side panel, and protected ones as protected', () => {
    document.body.innerHTML = `<form><label for="num">Card number</label><input id="num"><label for="pin">Card PIN</label><input id="pin"></form>`;
    const result = fillPage(request);
    expect(result.fields?.find(f => f.label === 'Card number')).toMatchObject({ status: 'filled' });
    expect(result.fields?.find(f => f.label === 'Card PIN')).toMatchObject({ status: 'skipped', reason: 'Protected payment field' });
  });
  it('leaves card fields empty when test cards are switched off', () => {
    document.body.innerHTML = `<form><label for="num">Card number</label><input id="num" autocomplete="cc-number"><label for="cvc">CVC</label><input id="cvc"></form>`;
    fillPage({ ...request, cards: 'off' });
    expect([field('num').value, field('cvc').value]).toEqual(['', '']);
    fillPage({ ...request, cards: undefined });
    expect(field('num').value).toBe('');
  });
  it('fills test cards by default in settings, and keeps a saved choice', () => {
    expect(defaults.cards).toBe('success');
    expect(validateSettings({ ...defaults, cards: 'declined' }).cards).toBe('declined');
    expect(validateSettings({ ...defaults, cards: 'nonsense' }).cards).toBe('success');
    expect(validateSettings({ ...defaults, cards: 'off' }).cards).toBe('off');
  });
});
