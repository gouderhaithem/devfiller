// @vitest-environment jsdom
// Sensitive fields the rules filled on 1,402 hand-labelled real forms (UCI web form crawl, 1 October
// 2026): 165 in all, mostly mailing lists. Each block is one mechanism, as generic markup.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fillPage, type FillRequest } from '../src/fill';
import { classifyField } from '../src/fill/classify';
import { analyzePage } from '../src/fill/context';
import { listControls } from '../src/fill/extract';
import { isTestValue, testKind } from '../src/fill/sensitive';
import { generateIdentities, generateValues } from '../src/data';
import { generateSamples } from '../src/samples';

const values = generateValues('en');
const request: FillRequest = { values, identities: generateIdentities('en'), samples: generateSamples('en'), custom: [], overwrite: true, fillUnknown: true, passwords: false, modelGuesses: false };
beforeEach(() => {
  document.body.replaceChildren();
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
});
// Sensitive fields are filled with test values (sensitive.ts); what matters here is that they are
// recognized. checked(): ticked boxes the rules didn't recognize as sensitive. values_(): fields
// holding anything but a test value.
const typeOf = () => analyzePage(listControls()).fields;
const checked = () => { const types = typeOf(); return Array.from(document.querySelectorAll<HTMLInputElement>('input[type=checkbox], input[type=radio]')).filter(el => el.checked && !types.get(el)?.type.startsWith('skip:')).map(el => el.id || el.name); };
const values_ = () => { const types = typeOf(); return Array.from(document.querySelectorAll<HTMLInputElement>('input:not([type=checkbox]):not([type=radio]), select')).filter(el => { const kind = testKind(types.get(el)?.type ?? ''); return el.value && !(kind && isTestValue(kind, el.value)); }).map(el => el.id || el.name); };

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
  it('reads a row of short code boxes as one code when one box takes two characters', () => {
    document.body.innerHTML = `<form><p>Please enter the code we sent to your email.</p>${[1, 1, 2, 1, 1, 1].map((n, i) => `<input type="text" id="c${i}" class="otp-input" maxlength="${n}">`).join('')}</form>`;
    fillPage(request);
    expect(values_()).toEqual([]);
  });
  it.each([
    ['a validation code', '<label for="f">Validation Code</label><input id="f" name="ev_verifyCode">'],
    ['a glued validation code name', '<input id="f" name="valicode">'],
    ['a temporary code', '<label for="f">* / Temporary Code:</label><input id="f" name="form:temporaryCode">'],
    ['a password reset code', '<p>Password Reset Code</p><input id="f" name="ctl00$_bodyContent$_resetCode">'],
    ['a bare "Enter code" box', '<input id="f" type="text" autocomplete="new-password" placeholder="Enter code">'],
  ])('reads %s as a one-time code', (_, field) => {
    document.body.innerHTML = `<form><label for="e">Email</label><input id="e" type="email">${field}</form>`;
    expect(typeOf().get(document.getElementById('f') as HTMLInputElement)?.type).toBe('skip:otp');
  });
  it.each(['Promo code', 'Enter promo code', 'Postal code', 'Coupon code', 'Referral code', 'Country code'])('keeps "%s" out of one-time codes', label => {
    document.body.innerHTML = `<form><label for="f">${label}</label><input id="f" type="text"></form>`;
    expect(typeOf().get(document.getElementById('f') as HTMLInputElement)?.type).not.toBe('skip:otp');
  });
  it('keeps five one-character ZIP boxes out of one-time codes when they are named as a ZIP', () => {
    document.body.innerHTML = `<form><label for="z0">ZIP code</label>${[0, 1, 2, 3, 4].map(i => `<input type="text" id="z${i}" name="zip${i}" maxlength="1">`).join('')}</form>`;
    expect(typeOf().get(document.getElementById('z0') as HTMLInputElement)?.type).not.toBe('skip:otp');
  });
  it('reads a year beside card fields as the card\'s expiry', () => {
    document.body.innerHTML = `<form><div class="card"><label for="num">Card number</label><input id="num"><label for="mm">MM</label><input id="mm" placeholder="MM" maxlength="2"><input id="yy" placeholder="YYYY" maxlength="4"></div></form>`;
    fillPage({ ...request, cards: 'off' });
    expect(values_()).toEqual([]);
  });
});

// The other side: options and statements that only look like consent, found on the same real forms.
describe('not consent', () => {
  const types = () => Array.from(document.querySelectorAll<HTMLInputElement>('input')).map(el => classifyField(el).type);
  it('reads topic words in a list of options as options', () => {
    document.body.innerHTML = `<form><fieldset><legend>Which areas interest you?</legend>${['Analytics', 'Marketing', 'Sales', 'I don\u2019t know yet'].map((t, i) => `<label><input type="checkbox" name="input_20.${i + 1}"> ${t}</label>`).join('')}</fieldset>
      <fieldset><legend>Department</legend>${['Communications', 'Engineering', 'Finance'].map(t => `<label><input type="radio" name="department_id" value="${t}"> ${t}</label>`).join('')}</fieldset></form>`;
    expect(types().filter(t => t === 'skip:consent')).toEqual([]);
  });
  it('reads first-person requests and facts as questions, not declarations', () => {
    const labels = ['I want to choose a dealership', 'I have a vehicle to trade-in', "I'd like to make this contribution in honor or in memory of someone", 'I request expedited processing of my request', 'I am a current student'];
    document.body.innerHTML = `<form>${labels.map(l => `<label><input type="checkbox"> ${l}</label>`).join('')}
      <fieldset><legend>Is this a joint gift with your partner?</legend><label><input type="radio" name="joint" value="y"> Yes</label><label><input type="radio" name="joint" value="n"> No</label></fieldset></form>`;
    expect(types().filter(t => t === 'skip:consent')).toEqual([]);
  });
  it('still reads declarations, sign-up lists and partner offers as consent', () => {
    const labels = ['I confirm I am the account holder', 'I am over 18', 'I certify that the above is accurate', 'I choose to pay the fees to process my donation', 'I do not wish to be publicly recognized for this gift', 'I want to contribute this amount every month', "I'd like to cover the transaction fee", "Je certifie l'exactitude des informations", 'Share my details with our partners', 'Newsletter'];
    document.body.innerHTML = `<form>${labels.map(l => `<label><input type="checkbox"> ${l}</label>`).join('')}
      <ul>${['Marketing', 'Product news', 'Events'].map((t, i) => `<li><label><input type="checkbox" name="lists[${i}]"> ${t}</label></li>`).join('')}</ul></form>`;
    expect(types()).toEqual(Array(13).fill('skip:consent'));
  });
});

// Topic radios a contact form asks for, read as consent on 4 of 1,000 real forms (4 October 2026)
// because one answer or the group's name held a consent word.
describe('a topic question in radios', () => {
  const radios = (name: string, answers: readonly string[], ids = false) => answers.map((t, i) => `<label><input type="radio" name="${name}"${ids ? ` id="edit-${name}-${t.toLowerCase().replace(/ /g, '-')}"` : ''} value="${t}"> ${t}</label>`).join('');
  const typeOf = (name: string) => { const fields = analyzePage(listControls()).fields; return fields.get(document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!)?.type; };
  it.each([
    ['an answer that names a policy', 'topic', ['Medicines', 'Grants', 'Public Policy', 'Research']],
    ['an answer that names a subscription', 'topic', ['Feedback', 'Billing', 'Cancel Subscription', 'Other']],
    ['an answer whose id names a newsletter', 'topic', ['Newsletter', 'Store', 'Content', 'Other']],
  ])('reads a topic group with %s as the subject', (_, name, answers) => {
    document.body.innerHTML = `<form><label for="e">Email</label><input id="e" type="email"><fieldset><legend>Topic</legend>${radios(name, answers, true)}</fieldset></form>`;
    expect(typeOf(name)).toBe('subject');
  });
  it('reads "How can we help you?" as the subject though the group\'s name holds a brand\'s "News"', () => {
    document.body.innerHTML = `<form><label for="e">Email</label><input id="e" type="email"><fieldset><legend>How can we help you?</legend>${radios('whatbringsyoutoEENews', ['Request Pricing', 'Request a Trial', 'Trial Questions', 'Other'])}</fieldset></form>`;
    expect(typeOf('whatbringsyoutoEENews')).toBe('subject');
  });
  it('still skips a consent question asked in radios', () => {
    document.body.innerHTML = `<form><fieldset><legend>Subscribe to our newsletter?</legend>${radios('news', ['Yes', 'No'])}</fieldset>
      <fieldset><legend>Topics you'd like our newsletter about</legend>${radios('nl', ['Yes, all of them', 'Only product news', 'Only events'])}</fieldset>
      <fieldset><legend>Subject</legend>${radios('agree', ['I agree to the terms', 'I do not agree', 'Ask me later'])}</fieldset></form>`;
    expect([typeOf('news'), typeOf('nl'), typeOf('agree')]).toEqual(['skip:consent', 'skip:consent', 'skip:consent']);
  });
  // Found in review: a topic word in the question, or a group named "subject", must not hide a
  // question that asks permission, however its answers agree.
  it.each([
    ['Do you consent to marketing? Reason', ['Sure', 'Absolutely', 'No']],
    ['Terms and conditions regarding use', ['Accepter', 'Refuser', 'Plus tard']],
    ['Subject: Terms and conditions', ['Agreed', 'Disagreed', 'Pending']],
    ['Regarding marketing communications, I would like to receive', ['Email', 'SMS', 'Post']],
    ['Which topics would you like to hear about in our newsletter?', ['Products', 'Events', 'Offers']],
    ['هل ترغب في الاشتراك في النشرة؟ الموضوع', ['أوافق', 'لا أوافق', 'لاحقا']],
    ["Objet : conditions générales d'utilisation", ["D'accord", "Pas d'accord", 'Je ne sais pas']],
    ['الموضوع: الشروط والأحكام', ['أوافق', 'لا أوافق', 'لاحقا']],
    ['Inquiry: marketing emails', ['Enabled', 'Disabled', 'Default']],
    ['Request type: I consent to be contacted', ['Ok', 'Sure', 'No']],
  ])('still skips "%s"', (question, answers) => {
    document.body.innerHTML = `<form><fieldset><legend>${question}</legend>${radios('q', answers)}</fieldset></form>`;
    expect(typeOf('q')).toBe('skip:consent');
  });
  it.each([
    ['Newsletter frequency', 'topic', ['Daily', 'Weekly', 'Monthly']],
    ['Newsletter subscription', 'subject', ['Weekly', 'Monthly', 'Never']],
  ])('still skips "%s" though the group is named "%s"', (question, name, answers) => {
    document.body.innerHTML = `<form><fieldset><legend>${question}</legend>${radios(name, answers)}</fieldset></form>`;
    expect(typeOf(name)).toBe('skip:consent');
  });
  // Found in a second review: permission asked only by the answers, under a topic-looking question.
  it.each([
    ['Subject', ['Email me', 'Text me', "Don't contact me"]],
    ['Topic', ['Send me offers', 'Send me news', 'Nothing']],
    ['Subject', ['Share my data with partners', 'Keep it private', 'Ask me later']],
    ['Inquiry', ['Share my details with third parties', 'Keep my details private', 'Undecided']],
    ['Reason', ['I am over 18', 'I am under 18', 'Prefer not to say']],
    ['Regarding the statement above', ['I certify this is true', 'I cannot certify', 'Not applicable']],
    ['Topic: how would you like to be contacted?', ['Email', 'SMS', 'Post', "Don't contact me"]],
    ['Topic', ['Email', 'SMS', 'Post', 'Unsubscribe me']],
    ['Sujet', ['Envoyez-moi les offres', 'Ne rien envoyer', 'Plus tard']],
    ['Sujet', ['Recevoir les offres', 'Recevoir les actualités', 'Ne rien recevoir']],
    ['Motif', ["J'autorise la diffusion", 'Je refuse', 'Sans avis']],
    ['الموضوع', ['أرسلوا لي العروض', 'لا ترسلوا لي', 'لاحقا']],
    ['الموضوع', ['اشتراك في النشرة', 'العروض', 'لا شيء']],
  ])('still skips "%s" when its answers ask permission: %j', (question, answers) => {
    document.body.innerHTML = `<form><fieldset><legend>${question}</legend>${radios('q', answers)}</fieldset></form>`;
    expect(typeOf('q')).toBe('skip:consent');
  });
  // Found in a third review: other forms of the same words.
  it.each([
    ['Topic', ['Subscribed', 'Unsubscribed', 'Pending']],
    ['Topic', ['Accepting', 'Rejecting', 'Undecided']],
    ['Subject', ['Authorize', 'Deny', 'Skip']],
    ['Subject', ['Give permission', 'Deny permission', 'Later']],
    ['Topic', ['Receive emails', 'Receive SMS', 'Receive nothing']],
    ['Topic', ['Optin', 'Optout', 'Later']],
    ['Sujet', ['Autoriser', 'Refuser', 'Plus tard']],
    ['Sujet', ["S'abonner", 'Ne pas changer', 'Plus tard']],
    ['Sujet', ['Consentement donné', 'Consentement refusé', 'Plus tard']],
    ['الموضوع', ['أسمح', 'لا أسمح', 'لاحقا']],
    ['الموضوع', ['تلقي الرسائل', 'عدم تلقي الرسائل', 'لاحقا']],
    ['الموضوع', ['أقر بذلك', 'لا أقر', 'لاحقا']],
  ])('still skips "%s" over %j', (question, answers) => {
    document.body.innerHTML = `<form><fieldset><legend>${question}</legend>${radios('q', answers)}</fieldset></form>`;
    expect(typeOf('q')).toBe('skip:consent');
  });
  it.each([
    ['Billing', 'Cancel Subscription', 'Technical support', 'Other'],
    ['Partnership', 'Press', 'Careers'],
    ["Demande de partenariat", 'Réclamation', 'Autre'],
    ['Send feedback', 'Report a bug', 'Contact sales'],
    ['Marketing', 'Sales', 'Press'],
  ])('reads a topic group of %s… as the subject', (...answers) => {
    document.body.innerHTML = `<form><fieldset><legend>Topic</legend>${radios('q', answers)}</fieldset></form>`;
    expect(typeOf('q')).toBe('subject');
  });
  it('still skips a group whose only topic word is its name', () => {
    document.body.innerHTML = `<form><fieldset><legend>Frequency</legend>${radios('newsletter_subject', ['Daily', 'Weekly', 'Never'])}</fieldset>
      <div role="radiogroup" aria-label="Subject">${radios('contact', ['Phone me', 'Email me', 'Never contact me'])}</div></form>`;
    expect([typeOf('newsletter_subject'), typeOf('contact')]).toEqual(['skip:consent', 'skip:consent']);
  });
  it('still skips value-only answers under "Regarding our privacy policy"', () => {
    document.body.innerHTML = `<form><fieldset><legend>Regarding our privacy policy</legend>${[1, 2, 3].map(v => `<input type="radio" name="p" value="${v}">`).join('')}</fieldset></form>`;
    expect(typeOf('p')).toBe('skip:consent');
  });
  it('never ticks an answer of these questions in a real fill', () => {
    document.body.innerHTML = `<form><fieldset><legend>Do you consent to marketing? Reason</legend>${radios('a', ['Sure', 'Absolutely', 'No'])}</fieldset>
      <fieldset><legend>Newsletter frequency</legend>${radios('topic', ['Daily', 'Weekly', 'Monthly'])}</fieldset></form>`;
    fillPage(request);
    expect(checked()).toEqual([]);
  });
});
