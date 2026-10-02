// @vitest-environment jsdom
// Donation and price choices the rules left empty on real forms (1,000 hand-labelled, 2 October
// 2026): 267 amount radios on 71 forms, plus amount selects. Generic markup, one mechanism each.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fillPage, type FillRequest } from '../src/fill';
import { classifyField } from '../src/fill/classify';
import { generateIdentities, generateValues } from '../src/data';
import { generateSamples } from '../src/samples';

const values = generateValues('en');
const request: FillRequest = { values, identities: generateIdentities('en'), samples: generateSamples('en'), custom: [], overwrite: true, fillUnknown: true, passwords: false, modelGuesses: false };
beforeEach(() => {
  document.body.replaceChildren();
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
});
const typeOf = (selector: string) => classifyField(document.querySelector<HTMLInputElement>(selector)!).type;

describe('amount choices', () => {
  it('reads a donation radio group named as an amount', () => {
    document.body.innerHTML = `<form>${['25', '50', '100', 'custom'].map(v => `<input type="radio" id="a${v}" name="transaction.donationAmt" value="${v}">`).join('')}</form>`;
    expect(typeOf('#a25')).toBe('amount');
    fillPage(request);
    expect(document.querySelectorAll('input:checked')).toHaveLength(1);
  });
  it('reads radios whose answers are sums of money as an amount', () => {
    document.body.innerHTML = `<form><fieldset><legend>Choose a level</legend>${['$25', '$50', '$100', 'Other'].map((t, i) => `<label><input type="radio" id="l${i}" name="level_id" value="${i}"> ${t}</label>`).join('')}</fieldset>
      ${['25.00', '50.00', '75.00'].map((v, i) => `<input type="radio" id="v${i}" name="giving" value="${v}">`).join('')}</form>`;
    expect(typeOf('#l0')).toBe('amount');
    expect(typeOf('#v0')).toBe('amount');
  });
  it('reads a select of money ranges as an amount', () => {
    document.body.innerHTML = `<form><label for="s">Monthly budget</label><select id="s"><option value="">Select…</option><option>$0 – $1,000</option><option>$1,000 – $5,000</option><option>More than $5,000</option></select></form>`;
    expect(typeOf('#s')).toBe('amount');
  });
  it('leaves counts and plain choices alone', () => {
    document.body.innerHTML = `<form><fieldset><legend>Number of guests</legend>${['1', '2', '3'].map(t => `<label><input type="radio" name="guests" id="g${t}" value="${t}"> ${t}</label>`).join('')}</fieldset>
      <fieldset><legend>Preferred contact</legend>${['Phone', 'Email'].map(t => `<label><input type="radio" name="contact" id="c${t}" value="${t}"> ${t}</label>`).join('')}</fieldset></form>`;
    expect(typeOf('#g1')).not.toBe('amount');
    expect(typeOf('#cPhone')).not.toBe('amount');
  });
});

describe('about an amount', () => {
  it('leaves currency, frequency and payment-type choices beside an amount alone', () => {
    document.body.innerHTML = `<form><label for="cur">Currency</label><select id="cur" name="unit_price[0][amount][currency_code]"><option>USD</option><option>EUR</option></select>
      ${['once', 'monthly'].map(v => `<input type="radio" id="f${v}" name="donation-frequency" value="${v}"><label for="f${v}">${v}</label>`).join('')}
      ${['card', 'paypal'].map(v => `<input type="radio" id="p${v}" name="q10_donationAmount[paymentType]" value="${v}">`).join('')}</form>`;
    expect([typeOf('#cur'), typeOf('#fonce'), typeOf('#pcard')]).not.toContain('amount');
  });
});
