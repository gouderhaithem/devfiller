// @vitest-environment jsdom
// Sensitive fields the rules filled on 1,402 hand-labelled real forms (UCI web form crawl, 1 October
// 2026): 165 in all, mostly mailing lists. Each block is one mechanism, as generic markup.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fillPage, type FillRequest } from '../src/fill';
import { generateIdentities, generateValues } from '../src/data';
import { generateSamples } from '../src/samples';

const values = generateValues('en');
const request: FillRequest = { values, identities: generateIdentities('en'), samples: generateSamples('en'), custom: [], overwrite: true, fillUnknown: true, passwords: false, modelGuesses: false };
beforeEach(() => {
  document.body.replaceChildren();
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
});
const checked = () => Array.from(document.querySelectorAll<HTMLInputElement>('input[type=checkbox], input[type=radio]')).filter(el => el.checked).map(el => el.id || el.name);
const values_ = () => Array.from(document.querySelectorAll<HTMLInputElement>('input:not([type=checkbox]):not([type=radio]), select')).filter(el => el.value).map(el => el.id || el.name);

describe('mailing lists', () => {
  it('never ticks the lists of a Mailchimp-style sign-up form', () => {
    document.body.innerHTML = `<form id="mc-embedded-subscribe-form" class="validate"><label for="e">Email</label><input type="email" id="e" name="EMAIL">
      <ul>${['Speeches', 'Research papers', 'Quarterly Bulletin'].map((t, i) => `<li><label for="g${i}"><input type="checkbox" id="g${i}" name="group[4737][${i}]" value="1"> ${t}</label></li>`).join('')}</ul>
      <input type="submit" value="Subscribe"></form>`;
    fillPage(request);
    expect(checked()).toEqual([]);
  });
  it('never ticks newsletter lists named as lists or inside a subscription block', () => {
    document.body.innerHTML = `<form><ul><li><label><input type="checkbox" id="a" name="lists[Technology]" value="true"><span class="newsletter_name">Technology</span></label></li></ul>
      <div class="marketing-subscription-list"><input type="checkbox" id="b" name="9947a728"><label for="b">Seasonal Forecasts</label></div>
      <label><input type="checkbox" id="c" name="nir_email_alerts_signup_alerts[6534][en]"> All filings</label></form>`;
    fillPage(request);
    expect(checked()).toEqual([]);
  });
  it('reads how often something is emailed as a subscription', () => {
    document.body.innerHTML = `<form>
      <label><input type="checkbox" id="a"> Webinars — emailed 10–12 times per year</label>
      <label><input type="checkbox" id="b"> Sunday Shows: who said what (sent weekly)</label>
      <label><input type="checkbox" id="c"> Climate commentary, emailed every 2 weeks</label>
      <label><input type="checkbox" id="g"> This is a gift</label></form>`;
    fillPage(request);
    expect(checked()).toEqual(['g']);
  });
});

describe('consent wording', () => {
  it('protects contact, sign-up, publicity, renewal, saving and declaration boxes', () => {
    const labels = ['Can we contact you via text in the future?', 'Sign me up for the Daily Mail', 'Join our email list!', 'Please keep my gift anonymous',
      'Show my name in the online signature list', 'Include my name on our public list of donors', 'Please set my membership to automatically renew each year',
      'Save card', 'This constitutes my electronic signature', 'This information is correct', 'Acknowledgment (required)',
      "Yes, I'd like to learn more about your work", 'Даю согласие на обработку персональных данных', 'Prihvatam pravila komentarisanja', 'Acepto la política'];
    document.body.innerHTML = `<form>${labels.map((l, i) => `<label><input type="checkbox" id="c${i}"> ${l}</label>`).join('')}<label><input type="checkbox" id="ok"> Show advanced options</label></form>`;
    fillPage(request);
    expect(checked()).toEqual(['ok']);
  });
  it('protects radios and selects that reveal a name or ask to send messages', () => {
    document.body.innerHTML = `<form>
      <label><input type="radio" name="reveal" id="r1"> Do NOT reveal my name to my Employer</label><label><input type="radio" name="reveal" id="r2"> My name may be revealed to my Employer</label>
      <label for="s">May we send you text messages?</label><select id="s"><option value="">Select…</option><option>Yes</option><option>No</option></select>
      <label for="p">Please select your email preferences</label><select id="p"><option value="">Select…</option><option>Send me updates</option><option>Unsubscribe me</option></select>
    </form>`;
    fillPage(request);
    expect(checked()).toEqual([]);
    expect(values_()).toEqual([]);
  });
});

describe('codes and hidden helpers', () => {
  it('never types into a payment provider\'s hidden one-character inputs', () => {
    document.body.innerHTML = `<form><label for="n">Name</label><input id="n" autocomplete="name">${[1, 2, 3].map(i => `<input id="h${i}" class="__PrivateStripeElement-input" aria-hidden="true" aria-label=" " autocomplete="false" maxlength="1">`).join('')}</form>`;
    fillPage(request);
    expect(values_()).toEqual(['n']);
  });
  it('reads a row of one-character boxes as a one-time code, and a code sent by email too', () => {
    document.body.innerHTML = `<form><div class="otp">${[1, 2, 3, 4, 5, 6].map(i => `<input type="text" id="d${i}" class="otpdigits" maxlength="1">`).join('')}</div>
      <input type="text" id="mail" placeholder="Code From Email"></form>`;
    fillPage(request);
    expect(values_()).toEqual([]);
  });
  it('reads a year beside card fields as the card\'s expiry', () => {
    document.body.innerHTML = `<form><div class="card"><label for="num">Card number</label><input id="num"><label for="mm">MM</label><input id="mm" placeholder="MM" maxlength="2"><input id="yy" placeholder="YYYY" maxlength="4"></div></form>`;
    fillPage({ ...request, cards: 'off' });
    expect(values_()).toEqual([]);
  });
});
