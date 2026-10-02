// @vitest-environment jsdom
// Sensitive fields are filled with values that read as tests at a glance: one-time codes of 4s, a
// bank account of 4s (with a valid IBAN checksum), consent and "remember me" boxes ticked. Cards
// keep their test cards. A field the user excludes stays empty.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fillPage, type FillRequest } from '../src/fill';
import { generateIdentities, generateValues } from '../src/data';
import { generateSamples } from '../src/samples';
import { isTestValue, TEST_ACCOUNT, TEST_BIC, TEST_IBAN, TEST_ROUTING } from '../src/fill/sensitive';

const values = generateValues('en');
const request: FillRequest = { values, identities: generateIdentities('en'), samples: generateSamples('en'), custom: [], overwrite: true, fillUnknown: true, passwords: false, modelGuesses: false };
beforeEach(() => {
  document.body.replaceChildren();
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
});
const value = (id: string) => document.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!.value;
const ticked = (id: string) => document.querySelector<HTMLInputElement>(`#${id}`)!.checked;

// ISO 13616: the IBAN's check digits make the whole number ≡ 1 (mod 97).
const ibanValid = (iban: string) => {
  const moved = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, ch => String(ch.charCodeAt(0) - 55));
  return [...moved].reduce((rest, digit) => (rest * 10 + Number(digit)) % 97, 0) === 1;
};

describe('test values', () => {
  it('builds a bank account of 4s that passes the IBAN checksum', () => {
    expect(TEST_IBAN).toMatch(/^DE\d{2}4{18}$/);
    expect(ibanValid(TEST_IBAN)).toBe(true);
    expect(TEST_ACCOUNT).toMatch(/^4+$/);
    expect(TEST_BIC).toMatch(/^[A-Z]{6}[A-Z0-9]{2}$/);
    // The ABA checksum: 3·(d1+d4+d7) + 7·(d2+d5+d8) + (d3+d6+d9) ≡ 0 (mod 10).
    const d = [...TEST_ROUTING].map(Number);
    expect((3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + d[2] + d[5] + d[8]) % 10).toBe(0);
  });
  it('tells test values from real-looking ones', () => {
    expect(isTestValue('otp', '444444')).toBe(true);
    expect(isTestValue('otp', '839201')).toBe(false);
    expect(isTestValue('iban', TEST_IBAN.replace(/(.{4})/g, '$1 ').trim())).toBe(true);
    expect(isTestValue('iban', 'FR7630006000011234567890189')).toBe(false);
  });
});

describe('filling sensitive fields', () => {
  it('types a one-time code of 4s, sized to the field and across one-character boxes', () => {
    document.body.innerHTML = `<form><label for="otp">Verification code</label><input id="otp" maxlength="6">
      <label for="pin">SMS code</label><input id="pin" maxlength="4">
      <div>${[1, 2, 3, 4, 5, 6].map(i => `<input id="d${i}" maxlength="1" class="otp-digit">`).join('')}</div></form>`;
    fillPage(request);
    expect([value('otp'), value('pin'), ...[1, 2, 3, 4, 5, 6].map(i => value(`d${i}`))]).toEqual(['444444', '4444', '4', '4', '4', '4', '4', '4']);
  });
  it('fills bank fields with the test account', () => {
    document.body.innerHTML = `<form><label for="iban">IBAN</label><input id="iban"><label for="bic">BIC / SWIFT</label><input id="bic">
      <label for="routing">Routing number</label><input id="routing"><label for="acct">Bank account number</label><input id="acct"></form>`;
    fillPage(request);
    expect([value('iban'), value('bic'), value('routing'), value('acct')]).toEqual([TEST_IBAN, TEST_BIC, TEST_ROUTING, TEST_ACCOUNT]);
  });
  it('ticks consent and "remember me" boxes and answers yes to permission questions', () => {
    document.body.innerHTML = `<form><label><input type="checkbox" id="terms"> I agree to the terms and conditions</label>
      <label><input type="checkbox" id="news"> Send me the newsletter</label>
      <label><input type="checkbox" id="remember"> Remember me</label>
      <fieldset><legend>Would you like to receive our newsletter?</legend><label><input type="radio" name="contact" id="no" value="no"> No</label><label><input type="radio" name="contact" id="yes" value="yes"> Yes</label></fieldset>
      <label for="sms">May we send you text messages?</label><select id="sms"><option value="">Select…</option><option value="n">No</option><option value="y">Yes</option></select></form>`;
    fillPage(request);
    expect([ticked('terms'), ticked('news'), ticked('remember'), ticked('yes'), value('sms')]).toEqual([true, true, true, true, 'y']);
  });
  it('still fills cards with a test card', () => {
    document.body.innerHTML = `<form><label for="cc">Card number</label><input id="cc" autocomplete="cc-number"></form>`;
    fillPage({ ...request, cards: 'success' });
    expect(value('cc').replace(/\s/g, '')).toBe('4242424242424242');
  });
  it('leaves an excluded sensitive field empty', () => {
    document.body.innerHTML = `<form><label for="otp">Verification code</label><input id="otp" maxlength="6"><label><input type="checkbox" id="terms"> I agree to the terms</label></form>`;
    fillPage({ ...request, exclusions: { skipSearch: true, skipHeader: true, rules: [{ id: 'x', match: 'selector', value: '#otp, #terms', site: '' }] } });
    expect([value('otp'), ticked('terms')]).toEqual(['', false]);
  });
});

describe('consent toggle widgets', () => {
  it('switches a consent toggle on', async () => {
    const { fillWidgets } = await import('../src/fill/widgets');
    document.body.innerHTML = '<form><div id="t" role="switch" tabindex="0" aria-checked="false">Email me special offers</div></form>';
    const toggle = document.getElementById('t')!;
    toggle.addEventListener('click', () => toggle.setAttribute('aria-checked', String(toggle.getAttribute('aria-checked') !== 'true')));
    await fillWidgets(request);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });
});

describe('short bank boxes', () => {
  it('fills 4s to the length of a box too short for the IBAN', () => {
    document.body.innerHTML = '<form><label for="rib">RIB</label><input id="rib" name="rib" maxlength="20"></form>';
    fillPage(request);
    expect(value('rib')).toBe('4'.repeat(20));
  });
});
